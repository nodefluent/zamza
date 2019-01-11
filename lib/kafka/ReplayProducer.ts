import * as Debug from "debug";
const debug = Debug("zamza:replayproducer");

import { NProducer } from "sinek";
import Zamza from "../Zamza";
import { KafkaConfig } from "../interfaces";

export default class ReplayProducer {

    private readonly config: KafkaConfig;
    private readonly zamza: Zamza;
    private producer: NProducer | null;
    private producedLately: number = 0;
    private intv: any;

    constructor(config: KafkaConfig, zamza: Zamza) {
        this.config = config;
        this.zamza = zamza;
        this.producer = null;

        this.intv = setInterval(() => {

            if (this.producedLately > 0) {
                debug("Produced", this.producedLately, "messages lately");
                this.producedLately = 0;
            }

        }, 45000);
    }

    public async start() {

        debug("Connecting..");

        this.producer = new NProducer(this.config.producer, null, this.config.defaultPartitions);

        await this.producer.connect();

        debug("Connected.");
    }

    public produceMessage(topic: string, partition: number | null = null,
                          key: string | null = null, value: any = null): Promise<any> {

        if (!this.producer) {
            return Promise.resolve(null);
        }

        this.producedLately++;
        return this.producer.send(topic, value, (partition as any), (key as any));
    }

    public getKafkaStats() {
        return this.producer ? this.producer.getStats() : {};
    }

    public getTopicMetadata(): Promise<any> {
        return this.producer ? this.producer.getMetadata(2500) : Promise.resolve({});
    }

    public async close() {

        debug("Closing..");

        if (this.intv) {
            clearInterval(this.intv);
        }

        if (this.producer) {
            this.producer.close();
            this.producer = null;
        }
    }
}
