import * as Debug from "debug";
const debug = Debug("zamza:consumer");

import { NConsumer } from "sinek";
import Zamza from "../Zamza";
import { KafkaConfig } from "../interfaces";

export default class Consumer {

    private readonly config: KafkaConfig;
    private readonly zamza: Zamza;
    private consumer: NConsumer | null;

    constructor(config: KafkaConfig, zamza: Zamza) {
        this.config = config;
        this.zamza = zamza;
        this.consumer = null;
    }

    public async start() {

        debug("Connecting..");

        this.consumer = new NConsumer([], this.config.consumer);

        await this.consumer.connect();
        this.consumer.consume(async (message, callback) => {
            try {
                await this.zamza.messageHandler.handleMessage(message);
                callback(null);
            } catch (error) {
                debug("Failed to process kafka message.", error);
                callback(error);
            }
        }, false, false, this.config.batchOptions);

        debug("Connected.");
    }

    public adjustSubscriptions(topics: string[]) {

        if (this.consumer) {
            debug("Adjusting topic subscription", topics.length);
            this.consumer.adjustSubscription(topics);
        }
    }

    public getKafkaClient() {
        return this.consumer;
    }

    public getKafkaStats() {
        return this.consumer ? this.consumer.getStats() : {};
    }

    public getTopicMetadata(): Promise<Array<{name: string, configs: null, partitions: any[]}>> {
        return this.consumer ? this.consumer.getMetadata(1000).then((metadata) => {
            return metadata.asTopicDescription();
        }) : Promise.resolve([]);
    }

    public async close() {

        debug("Closing..");
        if (this.consumer) {
            await this.consumer.close(true);
            this.consumer = null;
        }
    }
}
