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

export default class MessageHandler {

    private readonly mongoPoller: MongoPoller;
    private readonly keyIndexModel: KeyIndexModel;
    private readonly metrics: Metrics;

    constructor(zamza: Zamza) {
        this.mongoPoller = zamza.mongoPoller;
        this.keyIndexModel = zamza.mongoWrapper.getKeyIndexModel();
        this.metrics = zamza.metrics;
    }

    private hash(value: string): number {
        return murmur.v3(value, 0);
    }

    private findConfigForTopic(topic: string): TopicConfig | null {

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

    public async handleMessage(message: KafkaMessage): Promise<boolean> {

        this.metrics.inc("processed_messages");

        if (!message || !message.topic || typeof message.topic !== "string") {
            debug("Dropping message because of bad format, not an object or no topic", message);
            return false;
        }

        this.metrics.inc(`processed_messages_topic_${this.cleanTopicNameForMetrics(message.topic)}`);

        const startTime = Date.now();

        const keyAsBuffer: Buffer | null = Buffer.isBuffer(message.key) ? message.key :
            (message.key ? Buffer.from(message.key) : null);

        const keyAsString: string =
            typeof message.key === "string" ? message.key :
                (Buffer.isBuffer(message.key) ? message.key.toString("utf8") : message.key + "");

        const keyIndex: KeyIndex = {
            key: keyAsString ? this.hash(keyAsString) : null,
            topic: this.hash(message.topic),
            timestamp: moment().valueOf(),
            partition: message.partition,
            offset: message.offset,
            keyValue: keyAsBuffer,
            value: Buffer.isBuffer(message.value) ? message.value : (message.value ? Buffer.from(message.value) : null),
            timestampValue: (message as any).timestamp ? Buffer.from((message as any).timestamp + "") : null,
            deleteAt: null,
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
                this.metrics.inc("processed_messages_compact");
                await this.keyIndexModel.upsert(keyIndex);
                break;

            case "delete":
                this.metrics.inc("processed_messages_delete");
                keyIndex.deleteAt = moment().add(topicConfig.segmentMs, "milliseconds").valueOf();
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
