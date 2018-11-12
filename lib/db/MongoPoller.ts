import * as EventEmitter from "events";
import * as Debug from "debug";
const debug = Debug("zamza:mongopoller");

import MongoWrapper from "./MongoWrapper";
import { TopicConfigModel } from "./models/TopicConfigModel";
import { TopicConfig } from "../interfaces/TopicConfig";
import Discovery from "../kafka/Discovery";

export default class MongoPoller extends EventEmitter {

    public collected: { topicConfigs: TopicConfig[] };

    private readonly mongoWrapper: MongoWrapper;
    private topicConfigModel: TopicConfigModel | null = null;
    private intv: any;
    private topicConfigHash: number;

    constructor(mongoWrapper: MongoWrapper) {
        super();

        this.mongoWrapper = mongoWrapper;
        this.intv = null;
        this.topicConfigHash = 0;
        this.collected = {
            topicConfigs: [],
        };
    }

    public async start(intervalMs = 15000) {

        if (!this.topicConfigModel) {
            this.topicConfigModel = this.mongoWrapper.getTopicConfig();
        }

        this.close();

        this.intv = setInterval(() => {
            this.onInterval()
                .then(() => {
                    this.emit("updated", this.collected);
                })
                .catch((error) => {
                    this.emit("error", error);
                });
        }, intervalMs);

        // poll once initially
        await this.onInterval();
        this.emit("updated", this.collected);
    }

    public close() {

        if (this.intv) {
            clearInterval(this.intv);
        }
    }

    public getCollected() {
        return this.collected;
    }

    private async onInterval() {

        if (!this.topicConfigModel) {
            debug("TopicConfigModel not yet ready");
            return;
        }

        const topicConfigs = await this.topicConfigModel.list();

        const topics = topicConfigs.map((topicConfig) => topicConfig.topic);
        const newTopicConfigHash = Discovery.arrayToFixedHash(topics);
        if (this.topicConfigHash !== newTopicConfigHash) {
            this.topicConfigHash = newTopicConfigHash;
            this.emit("topic-config-changed", topics);
        }

        this.collected = Object.assign(this.collected, {
            topicConfigs,
        });
    }
}
