import * as Debug from "debug";
const debug = Debug("zamza:model:keyindex");

import * as murmur from "murmurhash";

import { KafkaMessage } from "../../interfaces";

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
        };

        const schema = new schemaConstructor(schemaDefinition);
        this.model = mongoose.model(this.name, schema);
        debug("Registered model with schema.");
    }

    private hash(value: string): number {
        return murmur.v3(value, 0);
    }

    public upsert(message: KafkaMessage, timestamp: number = Date.now()): Promise<object> {

        const document = {
            key: message.key ? this.hash(message.key.toString()) : null,
            topic: this.hash(message.topic),
            timestamp,
            partition: message.partition,
            offset: message.offset,
            keyValue: message.key,
            value: message.value,
            timestampValue: message.timestamp ? Buffer.from(message.timestamp + "") : null,
        };

        // TODO: need to get topic config here to determine compact or deletion policy as this changes storage

        const query = {
            key: document.key,
            topic: document.topic,
        };

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate(query, document, queryOptions);
    }

    /*
    cleanValuesOfEventForRetention(topic, field, retentionSeconds){
        const key = this._getKey(topic, field);
        return this.model.remove({
            key,
            produced: { $lte: Date.now() - retentionSeconds * 1000 },
        });
    }*/

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.remove({});
    }
}
