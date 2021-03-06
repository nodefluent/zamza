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

// we dont even store messages that wont live more than 2 minutes
// due to their age and retention on a topicConfig (usually occures during replays)
const MESSAGE_AGE_THRESHOLD = 2 * 60 * 1000;

export { INTERNAL_TOPICS };

export default class MessageHandler {

    private readonly mongoPoller: MongoPoller;
    private readonly hookDealer: HookDealer;
    private readonly keyIndexModel: KeyIndexModel;
    private readonly metrics: Metrics;
    private readonly mongoWrapper: MongoWrapper;
    private readonly hooksEnabled: boolean;
    public readonly hooksOnly: boolean;
    private readonly shouldMarshall: boolean;
    private readonly topicMarshalling: any;

    constructor(zamza: Zamza) {
        this.mongoPoller = zamza.mongoPoller;
        this.hookDealer = zamza.hookDealer;
        this.keyIndexModel = zamza.mongoWrapper.getKeyIndex();
        this.metrics = zamza.metrics;
        this.mongoWrapper = zamza.mongoWrapper;
        this.hooksEnabled = zamza.config.hooks ? !!zamza.config.hooks.enabled : false;
        this.hooksOnly = zamza.config.hooks ? !!zamza.config.hooks.only : false;
        this.shouldMarshall = zamza.config.marshallForInvalidCharacters ? !! zamza.config.marshallForInvalidCharacters
            : false;
        this.topicMarshalling = {};

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

    private marshallJSONPayloadToEnsureSafeMongoKeysRecursive(obj: any): { changed: boolean, obj: any } {

        // no "." or "$" or null as key name (still not fixed in MongoDB > 3.6, as BSON rejects on mixed type)

        let changed = false;
        let changedKey = "";
        let oldKey = "";

        if (Buffer.isBuffer(obj) || obj === null || typeof obj !== "object") {
            return {
                changed,
                obj,
            };
        }

        if (Array.isArray(obj)) {
            obj = obj.map((value) => {

                const {
                    changed: hasChanged,
                    obj: alteredObj,
                } = this.marshallJSONPayloadToEnsureSafeMongoKeysRecursive(value);

                if (hasChanged) {
                    changed = true;
                    return alteredObj;
                } else {
                    return value;
                }
            });

            return {
                changed,
                obj,
            };
        }

        Object.keys(obj).forEach((key) => {
            changedKey = key;

            if (changedKey.indexOf(".") !== -1) {
                oldKey = changedKey;
                changedKey = changedKey.replace(/\./g, "_");
                obj[changedKey] = obj[oldKey];
                delete obj[oldKey];
                changed = true;
            }

            if (changedKey.indexOf("$") !== -1) {
                oldKey = changedKey;
                changedKey = changedKey.replace(/\$/g, "_");
                obj[changedKey] = obj[oldKey];
                delete obj[oldKey];
                changed = true;
            }

            if (typeof obj[changedKey] === "object" || Array.isArray(obj[changedKey])) {

                const {
                    changed: hasChanged,
                    obj: alteredObj,
                } = this.marshallJSONPayloadToEnsureSafeMongoKeysRecursive(obj[changedKey]);

                if (hasChanged) {
                    obj[changedKey] = alteredObj;
                    changed = true;
                }
            }
        });

        return {
            changed,
            obj,
        };
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

    public getMarshallStates() {
        return this.topicMarshalling;
    }

    public resetMarshallStateForTopic(topic: string) {
        debug("marshalling has been reset for", topic);
        this.topicMarshalling[topic] = true;
    }

    public async handleMessage(message: KafkaMessage, fromStream: boolean = true): Promise<boolean> {

        this.metrics.inc("processed_messages");

        if (!message || !message.topic || typeof message.topic !== "string" || typeof message.partition !== "number") {
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

        const topicConfig = this.findConfigForTopic(message.topic);
        if (!topicConfig) {
            this.metrics.inc("processed_messages_failed_no_config");
            debug("Cannot process message, because no config was found for topic", message.topic);
            return false;
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

        // in case a message will be stored and immediately deleted due to
        // retention and message age (likely replay)
        if (messageHasTimestamp &&
            (topicConfig.cleanupPolicy === "compact_and_delete" || topicConfig.cleanupPolicy === "delete")) {

                if (moment((message as any).timestamp)
                    .add(topicConfig.retentionMs, "milliseconds")
                    .diff(moment()) < MESSAGE_AGE_THRESHOLD) {

                        this.metrics.inc("processed_messages_skipped");

                        if (this.hooksEnabled && fromStream) {
                            // always ensure to await this
                            await this.hookDealer.handleMessage(message);
                        }

                        this.metrics.inc("processed_messages_success");
                        return true;
                    }
        }

        // try to strip the value as raw, yet parsed as possible before storing
        // happy path here is to turn a message buffer into its JSON object and store as such
        // in case the value does not contain a JSON payload, it should be stored as RAW (message.value) representative
        // NOTE: Also check if topic shold be queryable, otherwise message value should be stored as buffer
        let alteredMessageValue = null;
        if (message.value && topicConfig.queryable) {

            if (Buffer.isBuffer(message.value)) {
                alteredMessageValue = message.value.toString("utf8");
            } else {
                alteredMessageValue = message.value;
            }

            try {
                alteredMessageValue = JSON.parse(alteredMessageValue);
                // no way to validate the output here
            } catch (_) {
                alteredMessageValue = message.value;
            }
        }
        // elif - always ensure we store value as buffer
        if (message.value && !topicConfig.queryable) {
            if (Buffer.isBuffer(message.value)) {
                alteredMessageValue = message.value;
            } else {
                if (typeof message.value !== "string") {
                    alteredMessageValue = Buffer.from(JSON.stringify(message.value));
                } else {
                    alteredMessageValue = Buffer.from(message.value);
                }
            }
        }

        // marshalling uses a lot of CPU, thats why we always try to avoid it, if possible
        if (this.shouldMarshall && !Buffer.isBuffer(alteredMessageValue) && typeof alteredMessageValue === "object") {

            // check if marshalling is necessary for this topic
            if (typeof this.topicMarshalling[message.topic] === "undefined") {

                const {
                    changed,
                    obj,
                } = this.marshallJSONPayloadToEnsureSafeMongoKeysRecursive(alteredMessageValue);

                if (changed) {
                    // marshalling was necessarry for this topic
                    debug("Marshalling is necessary for", message.topic);
                    this.topicMarshalling[message.topic] = true;
                    alteredMessageValue = obj;
                } else {
                    // does not look like marshalling is necessary for this topic (anymore)
                    debug("No marshalling is necessary for", message.topic);
                    this.topicMarshalling[message.topic] = false;
                }
            } else if (this.topicMarshalling[message.topic] === true) {
                // marshalling is necessary for this topic
                alteredMessageValue = this.marshallJSONPayloadToEnsureSafeMongoKeysRecursive(alteredMessageValue).obj;
            }
            // else {}
            // marshalling was not necessary for this topic, however if the insert errors
            // the marshalling state will be removed for the retry
        }

        const keyIndex: KeyIndex = {
            key: keyAsString ? this.hash(keyAsString) : null,
            timestamp: messageHasTimestamp ? (message as any).timestamp : timeOfStoring,
            partition: message.partition,
            offset: message.offset,
            keyValue: keyAsBuffer,
            value: alteredMessageValue,
            deleteAt: null,
            fromStream,
            storedAt: timeOfStoring,
        };

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
                keyIndex.deleteAt = moment(keyIndex.timestamp).add(topicConfig.retentionMs, "milliseconds").toDate();
                await this.keyIndexModel.insert(message.topic, keyIndex);
                break;

            case "compact_and_delete":
                if (keyIndex.value !== null) {
                    this.metrics.inc("processed_messages_compactdelete");
                    keyIndex.deleteAt = moment(keyIndex.timestamp)
                        .add(topicConfig.retentionMs, "milliseconds").toDate();
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
