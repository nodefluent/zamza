import * as Debug from "debug";
import * as murmur from "murmurhash";
const debug = Debug("zamza:model:keyindex");

import { KeyIndex } from "../../interfaces";
import moment = require("moment");

export class KeyIndexModel {

    public readonly name: string;
    private model: any;

    constructor() {
        this.name = "keyindex";
        this.model = null;
    }

    public registerModel(mongoose: any, schemaConstructor: any) {

        const schemaDefinition = {
            key: Number, // hashed
            topic: Number, // hashed
            timestamp: Number,
            partition: Number,
            offset: Number,
            keyValue: Buffer,
            value: Buffer,
            timestampValue: Buffer,
            deleteAt: Number,
        };

        const schema = new schemaConstructor(schemaDefinition);
        this.model = mongoose.model(this.name, schema);
        debug("Registered model with schema.");
    }

    private hash(value: string): number {
        return murmur.v3(value, 0);
    }

    public insert(document: KeyIndex): Promise<KeyIndex> {
        return this.model.create(document);
    }

    public upsert(document: KeyIndex): Promise<KeyIndex> {

        const query = {
            key: document.key,
            topic: document.topic,
        };

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate(query, document, queryOptions);
    }

    public removeOldDeletePolicyEntries() {
        return this.model.remove({
            deleteAt: {
                // $and doesnt work
                // comparison operators only perform comparisons on fields
                // where the BSON type matches the query value’s type
                // should therefor ignore 'null' values
                $lte: moment().valueOf(),
            },
        });
    }

    public deleteForTopic(topic: string) {
        debug("Deleting all entries for topic", topic);
        return this.model.remove({
            topic: this.hash(topic),
        });
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.remove({});
    }
}
