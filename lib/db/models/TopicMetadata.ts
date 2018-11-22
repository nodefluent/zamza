import * as Debug from "debug";
const debug = Debug("zamza:model:topicmetadata");

import Zamza from "../../Zamza";
import { Metrics } from "../../Metrics";
import { TopicMetadata } from "../../interfaces";

export class TopicMetadataModel {

    public readonly metrics: Metrics;
    public readonly name: string;
    private model: any;

    constructor(zamza: Zamza) {
        this.metrics = zamza.metrics;
        this.name = "topicmetadata";
        this.model = null;
    }

    public registerModel(mongoose: any, schemaConstructor: any) {

        const schemaDefinition = {
            topic: String,
            messageCount: Number,
            partitionCount: Number,
            earliestOffset: Number,
            latestOffset: Number,
            earliestMessage: Number,
            latestMessage: Number,
            partitions: Object,
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

    public get(topic: string): Promise<TopicMetadata> {
        return this.model.findOne({ topic }).lean().exec().then((topicMetadata: any) => {
            delete topicMetadata._id;
            delete topicMetadata.__v;
            return topicMetadata as TopicMetadata;
        });
    }

    public list(): Promise<TopicMetadata[]> {
        return this.model.find({}).lean().exec().then((topicMetadatas: any[]) => {
            return topicMetadatas.map((topicMetadata) => {
                delete topicMetadata._id;
                delete topicMetadata.__v;
                return topicMetadata as TopicMetadata;
            });
        });
    }

    public upsert(topicMetadata: TopicMetadata): Promise<any> {

        const query = {
            topic: topicMetadata.topic,
        };

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate(query, topicMetadata, queryOptions).exec();
    }

    public delete(topic: string) {
        return this.model.deleteMany({topic}).exec();
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.deleteMany({}).exec();
    }
}
