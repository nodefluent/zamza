import * as Debug from "debug";
const debug = Debug("zamza:consumer");

import { NConsumer } from "sinek";
import Zamza from "../Zamza";
import { KafkaConfig } from "../interfaces";

export default class Consumer {

    private readonly config: KafkaConfig;
    private readonly zamza: Zamza;
    private consumer: NConsumer | null;
    private consumedLately: number = 0;
    private intv: any;

    constructor(config: KafkaConfig, zamza: Zamza) {
        this.config = config;
        this.zamza = zamza;
        this.consumer = null;

        this.intv = setInterval(() => {

            if (this.consumedLately > 0) {
                debug("Consumed", this.consumedLately, "messages lately");
                this.consumedLately = 0;
            }

        }, 15000);
    }

    public async start() {

        debug("Connecting..");

        this.consumer = new NConsumer([], this.config.consumer);

        await this.consumer.connect();
        this.consumer.consume(async (message, callback) => {
            this.consumedLately++;
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

        if (this.intv) {
            clearInterval(this.intv);
        }

        if (this.consumer) {
            await this.consumer.close(true);
            this.consumer = null;
        }
    }
}
