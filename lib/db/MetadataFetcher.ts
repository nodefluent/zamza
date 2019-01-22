import * as Debug from "debug";
const debug = Debug("zamza:metadatafetcher");
import * as Bluebird from "bluebird";

import MongoWrapper from "./MongoWrapper";

import { Metrics } from "../Metrics";
import { LockModel, TopicMetadataModel, TopicConfigModel, KeyIndexModel, StateModel, STATE_KEYS } from "./models";

export default class MetadataFetcher {

    private readonly metrics: Metrics;
    private readonly topicConfigModel: TopicConfigModel;
    private readonly keyIndexModel: KeyIndexModel;
    private readonly lockModel: LockModel;
    private readonly topicMetadataModel: TopicMetadataModel;
    private readonly sharedStateModel: StateModel;
    private intv: any;

    constructor(mongoWrapper: MongoWrapper, metrics: Metrics) {

        this.topicConfigModel = mongoWrapper.getTopicConfig();
        this.keyIndexModel = mongoWrapper.getKeyIndex();
        this.lockModel = mongoWrapper.getLock();
        this.topicMetadataModel = mongoWrapper.getTopicMetadata();
        this.sharedStateModel = mongoWrapper.getSharedState();
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

        // if this is a new setup, reset to false by default
        let shouldRun = await this.sharedStateModel.get(STATE_KEYS.ENABLE_METADATA_JOB);
        if (!shouldRun) {
            shouldRun = await this.sharedStateModel.set(STATE_KEYS.ENABLE_METADATA_JOB, "false");
        }

        if (shouldRun !== "true") {
            debug("Wont run metadata job, as its shared state value is not 'true': ", shouldRun);
            return;
        }

        const startTime = Date.now();

        const topicConfigs = await this.topicConfigModel.listAsTopics();
        await Bluebird.map(topicConfigs, async (topic: string) => {

            const lockName = `metadata:${topic}`;

            if (!await this.lockModel.getLock(lockName, 3 * 60000)) {
                return; // did not get a lock for this topic
            }

            const innerStartTime = Date.now();
            debug("Got lock for topic", topic, "fetching and storing metadata..");

            // got lock for topic, fetch and store metadata
            const topicMetadata = await this.keyIndexModel.getMetadataForTopic(topic);
            await this.topicMetadataModel.upsert(topicMetadata);
            await this.lockModel.removeLock(lockName);

            const innerDuration = Date.now() - innerStartTime;
            debug("Fetched and stored", topic, "metadata in", innerDuration, "ms");

        }, { concurrency: 1 });

        const duration = Date.now() - startTime;
        this.metrics.set("job_metadata_ms", duration);

        this.metrics.inc("job_metadata_ran_success");
    }
}
