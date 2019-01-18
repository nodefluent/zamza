import * as Debug from "debug";
const debug = Debug("zamza:consumer");

import { NConsumer, KafkaMessage } from "sinek";
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

        }, 45000);
    }

    private async processMessageWithRetry(message: KafkaMessage, attempts = 0): Promise<boolean> {
        try {
            attempts++;
            await this.zamza.messageHandler.handleMessage(message);
            return true;
        } catch (error) {
            debug("Failed to process kafka message, attempt", attempts, "with error", error.message);
            // reset marshalling, in case error was due to bson insert error
            this.zamza.messageHandler.resetMarshallStateForTopic(message.topic);
            return (new Promise((resolve) => setTimeout(resolve, attempts * 1000)))
                .then(() => {
                    return this.processMessageWithRetry(message, attempts);
                });
        }
    }

    public async start() {

        debug("Connecting..");

        this.consumer = new NConsumer([], this.config.consumer);

        await this.consumer.connect();
        this.consumer.consume(async (message, callback) => {
            this.consumedLately++;
            await this.processMessageWithRetry(message);
            callback(null);
        }, false, false, this.config.batchOptions);

        this.consumer.enableAnalytics({
            analyticsInterval: 1000 * 60 * 4,
            lagFetchInterval: 1000 * 60 * 8,
        });

        debug("Connected.");
    }

    public getAnalytics() {
        return this.consumer ? this.consumer.getAnalytics() : null;
    }

    public getLagStatus() {
        return this.consumer ? this.consumer.getLagStatus(false) : null;
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

    public getTopicMetadata(): Promise<any> {
        return this.consumer ? this.consumer.getMetadata(2500) : Promise.resolve({});
    }

    public async close() {

        debug("Closing..");

        if (this.intv) {
            clearInterval(this.intv);
        }

        if (this.consumer) {
            this.consumer.haltAnalytics();
            await this.consumer.close(true);
            this.consumer = null;
        }
    }
}
