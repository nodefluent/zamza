import * as Debug from "debug";
import * as murmur from "murmurhash";
import * as moment from "moment";
const debug = Debug("zamza:handler");

import Zamza from "./Zamza";
import { KafkaMessage } from "sinek";
import MongoPoller from "./db/MongoPoller";
import { KeyIndexModel } from "./db/models";
import { Metrics } from "./Metrics";
import { KeyIndex } from "./interfaces";
import { TopicConfig } from "./interfaces/TopicConfig";
import MongoWrapper from "./db/MongoWrapper";
import HookDealer from "./HookDealer";

const RETRY_TOPIC = "__zamza_retry_topic";
const REPLAY_TOPIC = "__zamza_replay_topic";

const INTERNAL_TOPICS = {
    RETRY_TOPIC,
    REPLAY_TOPIC,
};

export {INTERNAL_TOPICS};

export default class MessageHandler {

    private readonly mongoPoller: MongoPoller;
    private readonly hookDealer: HookDealer;
    private readonly keyIndexModel: KeyIndexModel;
    private readonly metrics: Metrics;
    private readonly mongoWrapper: MongoWrapper;
    private readonly hooksEnabled: boolean;
    public readonly hooksOnly: boolean;

    constructor(zamza: Zamza) {
        this.mongoPoller = zamza.mongoPoller;
        this.hookDealer = zamza.hookDealer;
        this.keyIndexModel = zamza.mongoWrapper.getKeyIndex();
        this.metrics = zamza.metrics;
        this.mongoWrapper = zamza.mongoWrapper;
        this.hooksEnabled = zamza.config.hooks ? !!zamza.config.hooks.enabled : false;
        this.hooksOnly = zamza.config.hooks ? !!zamza.config.hooks.only : false;

        if (this.hooksEnabled) {
            debug("NOTE: Hooks are enabled.");
        }

        if (this.hooksOnly) {
            debug("NOTE: Hooks-Only mode active, will not persist messages.");
        }

        if (this.hooksOnly && !this.hooksEnabled) {
            throw new Error("Having Hooks-Only mode active while setting hooks enabled to false, makes no sense.");
        }
    }

    private hash(value: string): number {
        return murmur.v3(value, 0);
    }

    public findConfigForTopic(topic: string): TopicConfig | null {

        const topicConfigs = this.mongoPoller.getCollected().topicConfigs;
        for (let i = topicConfigs.length - 1; i >= 0; i--) {
            if (topicConfigs[i].topic === topic) {
                return topicConfigs[i];
            }
        }

        return null;
    }

    public static cleanTopicNameForMetrics(topic: string): string {
        return topic.replace(/-/g, "_");
    }

    public async handleMessage(message: KafkaMessage, fromStream: boolean = true): Promise<boolean> {

        this.metrics.inc("processed_messages");

        if (!message || !message.topic || typeof message.topic !== "string") {
            debug("Dropping message because of bad format, not an object or no topic", message);
            return false;
        }

        // check if this message is from one of our zamza internal topics
        // always make sure to await these calls, so that we make sure we never
        // consume faster than we can actually call hooks or reproduce messages
        // this additionally prevents loops where we consume our own replays
        if (fromStream) {

            if (message.topic === RETRY_TOPIC) {
                return await this.hookDealer.handleRetryMessage(message);
            }

            if (message.topic === REPLAY_TOPIC) {
                return await this.hookDealer.handleReplayMessage(message);
            }
        }

        if (!this.mongoWrapper.isConnected()) {
            throw new Error("MongoDB connection is not established.");
        }

        const startTime = Date.now();
        let keyAsBuffer: Buffer | null = null;
        let keyAsString: string | null = null;

        if (message.key) {
            if (Buffer.isBuffer(message.key)) {
                keyAsBuffer = message.key;
                keyAsString = message.key.toString("utf8");
            } else {
                keyAsBuffer = Buffer.from(message.key);
                keyAsString = message.key + "";
            }
        }

        // if the message has a timestamp (epoch) present, we will use it for retention, otherwise
        // the time of db insertion will be used to determine ttl
        const messageHasTimestamp = (message as any).timestamp && typeof (message as any).timestamp === "number";
        const timeOfStoring = moment().valueOf();

        const keyIndex: KeyIndex = {
            key: keyAsString ? this.hash(keyAsString) : null,
            timestamp: messageHasTimestamp ? (message as any).timestamp : timeOfStoring,
            partition: message.partition,
            offset: message.offset,
            keyValue: keyAsBuffer,
            value: Buffer.isBuffer(message.value) ? message.value : (message.value ? Buffer.from(message.value) : null),
            timestampValue: messageHasTimestamp ? Buffer.from((message as any).timestamp + "") : null,
            deleteAt: null,
            fromStream,
            storedAt: timeOfStoring,
        };

        const topicConfig = this.findConfigForTopic(message.topic);
        if (!topicConfig) {
            this.metrics.inc("processed_messages_failed_no_config");
            debug("Cannot process message, because no config was found for topic", message.topic);
            return false;
        }

        // make sure to run config check first, to ensure the topic can be processed
        // configuation determines that we do not persist messages in MongoDB and only process them as potential hooks
        if (this.hooksOnly) {
            await this.hookDealer.handleMessage(message);
            return true;
        }

        // detect compact or deletion policy and adjust storage process accordingly
        switch (topicConfig.cleanupPolicy) {

            case "compact":

                if (keyIndex.value !== null) {
                    this.metrics.inc("processed_messages_compact");
                    await this.keyIndexModel.upsert(message.topic, keyIndex);
                } else {

                    if (!keyAsString) {
                        debug("Dropping message because of bad format, cannot delete-compact with a missing key",
                            message.key, message.topic, message.partition, message.offset);
                        return false;
                    }

                    // a kafka message with a NULL value on a compacted topic is a tombstone
                    this.metrics.inc("processed_messages_tombstone");
                    await this.keyIndexModel.delete(message.topic, keyAsString as string, fromStream);
                }
                break;

            case "delete":
                this.metrics.inc("processed_messages_delete");
                keyIndex.deleteAt = moment(keyIndex.timestamp).add(topicConfig.retentionMs, "milliseconds").valueOf();
                await this.keyIndexModel.insert(message.topic, keyIndex);
                break;

            default:
            case "none":
                this.metrics.inc("processed_messages_none");
                await this.keyIndexModel.insert(message.topic, keyIndex);
                break;
        }

        const duration = Date.now() - startTime;
        this.metrics.set("processed_message_ms", duration);

        if (this.hooksEnabled && fromStream) {
            // always ensure to await this
            await this.hookDealer.handleMessage(message);
        }

        this.metrics.inc("processed_messages_success");
        return true;
    }
}
