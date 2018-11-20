import * as Debug from "debug";
const debug = Debug("zamza:metadatafetcher");
import * as Bluebird from "bluebird";

import MongoWrapper from "./MongoWrapper";

import { Metrics } from "../Metrics";
import { LockModel, TopicMetadataModel, TopicConfigModel, KeyIndexModel } from "./models";

export default class MetadataFetcher {

    private readonly metrics: Metrics;
    private readonly topicConfigModel: TopicConfigModel;
    private readonly keyIndexModel: KeyIndexModel;
    private readonly lockModel: LockModel;
    private readonly topicMetadataModel: TopicMetadataModel;
    private intv: any;

    constructor(mongoWrapper: MongoWrapper, metrics: Metrics) {

        this.topicConfigModel = mongoWrapper.getTopicConfig();
        this.keyIndexModel = mongoWrapper.getKeyIndex();
        this.lockModel = mongoWrapper.getLock();
        this.topicMetadataModel = mongoWrapper.getTopicMetadata();
        this.metrics = metrics;
        this.intv = null;
    }

    public async start(intervalMs = 12 * 62000): Promise<any> {

        this.close();

        this.intv = setInterval(() => {
            this.onInterval()
                .catch((error) => {
                    debug("Error on metadata job", error.message);
                });
        }, intervalMs);

        // no instant initial poll
        setTimeout(() => {
            this.onInterval().catch((error) => {
                debug("Initial metadata job failed", error.message);
            });
        }, 12000);
    }

    public close() {

        if (this.intv) {
            clearInterval(this.intv);
        }
    }

    private async onInterval() {

        this.metrics.inc("job_metadata_ran");

        const startTime = Date.now();

        const topicConfigs = await this.topicConfigModel.listAsTopics();
        await Bluebird.map(topicConfigs, async (topic: string) => {

            if (!await this.lockModel.getLock(`metadata:${topic}`, 3 * 60000)) {
                return; // did not get a lock for this topic
            }

            const innerStartTime = Date.now();
            debug("Got lock for topic", topic, "fetching and storing metadata..");

            // got lock for topic, fetch and store metadata
            const topicMetadata = await this.keyIndexModel.getMetadataForTopic(topic);
            await this.topicMetadataModel.upsert(topicMetadata);

            const innerDuration = Date.now() - innerStartTime;
            debug("Fetched and stored", topic, "metadata in", innerDuration, "ms");

        }, { concurrency: 1 });

        const duration = Date.now() - startTime;
        this.metrics.set("job_metadata_ms", duration);

        this.metrics.inc("job_metadata_ran_success");
    }
}
