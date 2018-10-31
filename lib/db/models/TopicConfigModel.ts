import * as Debug from "debug";
const debug = Debug("zamza:model:topicconfig");

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
        this.model = mongoose.model(this.name, schema);
        debug("Registered model with schema.");
    }

    public list(): Promise<object[]> {
        return this.model.find({}).then((topics: object[]) => topics.map((topic: any) => topic.get()));
    }

    public upsert(topic: string, cleanupPolicy: string, segmentMs: number,
                  timestamp: number = Date.now()): Promise<object> {

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

        return this.model.findOneAndUpdate(query, document, queryOptions);
    }

    public delete(topic: string) {
        return this.model.remove({topic});
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.remove({});
    }
}
