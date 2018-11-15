import * as Debug from "debug";
import { TopicConfig } from "../../interfaces/TopicConfig";
import { exec } from "child_process";
const debug = Debug("zamza:model:topicconfig");

const ALLOWED_POLICIES = ["compact", "delete", "none"];

export class TopicConfigModel {

    public readonly name: string;
    private model: any;

    constructor() {
        this.name = "topicconfig";
        this.model = null;
    }

    public registerModel(mongoose: any, schemaConstructor: any) {

        const schemaDefinition = {
            topic: String,
            cleanupPolicy: String,
            segmentMs: Number,
            timestamp: Number,
        };

        const schema = new schemaConstructor(schemaDefinition);

        schema.index({ topic: 1, type: -1});

        this.model = mongoose.model(this.name, schema);

        this.model.on("index", (error: Error) => {

            if (error) {
                debug("Index creation failed", error.message);
            } else {
                debug("Index creation successfull.");
            }
        });

        debug("Registered model with schema.");
    }

    public async listAsTopics(): Promise<string[]> {
        const topicConfigs = await this.list();
        return topicConfigs.map((topicConfig) => topicConfig.topic);
    }

    public list(): Promise<TopicConfig[]> {
        return this.model.find({}).lean().exec().then((topicConfigs: any[]) => {
            return topicConfigs.map((topicConfig: any) => {

                const responseTopicConfig: TopicConfig = {
                    topic: topicConfig.topic,
                    cleanupPolicy: topicConfig.cleanupPolicy,
                    segmentMs: topicConfig.segmentMs,
                    timestamp: topicConfig.timestamp,
                };

                return responseTopicConfig;
            });
        });
    }

    public upsert(topic: string, cleanupPolicy: string, segmentMs: number,
                  timestamp: number = Date.now()): Promise<TopicConfig> {

        if (ALLOWED_POLICIES.indexOf(cleanupPolicy) === -1) {
            throw new Error("cleanupPolicy not allowed, choose the one of the following: "
                + ALLOWED_POLICIES.join(", ") + ".");
        }

        if (cleanupPolicy === "delete" && (!segmentMs || segmentMs <= 0)) {
            throw new Error("cleanupPolicy 'delete' requires segmentMs to be set.");
        }

        if (cleanupPolicy === "compact" && (segmentMs || segmentMs > 0)) {
            throw new Error("cleanupPolicy 'compact' requires segmentMs to be 0 or null.");
        }

        if (cleanupPolicy === "none" && (segmentMs || segmentMs > 0)) {
            throw new Error("cleanupPolicy 'none' requires segmentMs to be 0 or null.");
        }

        const document = {
            topic,
            cleanupPolicy,
            segmentMs,
            timestamp,
        };

        const query = {
            topic,
        };

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate(query, document, queryOptions).exec();
    }

    public delete(topic: string) {
        return this.model.deleteMany({topic}).exec();
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.deleteMany({}).exec();
    }
}
