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

export default class MessageHandler {

    private readonly mongoPoller: MongoPoller;
    private readonly keyIndexModel: KeyIndexModel;
    private readonly metrics: Metrics;
    private readonly mongoWrapper: MongoWrapper;

    constructor(zamza: Zamza) {
        this.mongoPoller = zamza.mongoPoller;
        this.keyIndexModel = zamza.mongoWrapper.getKeyIndexModel();
        this.metrics = zamza.metrics;
        this.mongoWrapper = zamza.mongoWrapper;
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

    private cleanTopicNameForMetrics(topic: string): string {
        return topic.replace(/-/g, "_");
    }

    public async handleMessage(message: KafkaMessage, fromStream: boolean = true): Promise<boolean> {

        this.metrics.inc("processed_messages");

        if (!message || !message.topic || typeof message.topic !== "string") {
            debug("Dropping message because of bad format, not an object or no topic", message);
            return false;
        }

        if (!this.mongoWrapper.isConnected()) {
            throw new Error("MongoDB connection is not established.");
        }

        this.metrics.inc(`processed_messages_topic_${this.cleanTopicNameForMetrics(message.topic)}`);

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
            topic: this.hash(message.topic),
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

        // detect compact or deletion policy and adjust storage process accordingly
        switch (topicConfig.cleanupPolicy) {

            case "compact":

                if (keyIndex.value !== null) {
                    this.metrics.inc("processed_messages_compact");
                    await this.keyIndexModel.upsert(keyIndex);
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
                await this.keyIndexModel.insert(keyIndex);
                break;

            default:
            case "none":
                this.metrics.inc("processed_messages_none");
                await this.keyIndexModel.insert(keyIndex);
                break;
        }

        const duration = Date.now() - startTime;
        this.metrics.set("processed_message_ms", duration);

        this.metrics.inc("processed_messages_success");
        return true;
    }
}
