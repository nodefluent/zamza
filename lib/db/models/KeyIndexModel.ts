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
            fromStream: Boolean,
            storedAt: Number,
        };

        const schema = new schemaConstructor(schemaDefinition);

        schema.index({ key: 1, type: -1});
        schema.index({ topic: 1, type: -1});
        schema.index({ timestamp: 1, type: -1});
        schema.index({ timestamp: 1, type: 1});
        schema.index({ deleteAt: 1, type: -1});
        schema.index({ partition: 1, type: -1});
        schema.index({ offset: 1, type: -1});

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

    private hash(value: string): number {
        return murmur.v3(value, 0);
    }

    private static cleanMessageResultForResponse(message: KeyIndex):
        {topic: string, partition: number, offset: number, key: Buffer, value: Buffer, timestamp: number} {

        if (!message) {
            return message;
        }

        const cleanedMessage: any = {};
        cleanedMessage.topic = message.topic;
        cleanedMessage.partition = message.partition;
        cleanedMessage.offset = message.offset;
        cleanedMessage.key = message.keyValue;
        cleanedMessage.value = message.value;
        cleanedMessage.timestamp = message.timestampValue;
        return cleanedMessage;
    }

    private static cleanMessageResultsForResponse(messages: KeyIndex[]) {
        return messages.map(KeyIndexModel.cleanMessageResultForResponse);
    }

    public async getInfoForTopic(topic: string) {

        const partitions = await this.model.distinct("partition", {
            topic: this.hash(topic),
        });

        const earliestOffsets: any[] = [];
        const latestOffsets: any[] = [];

        const earliestMessage = 0;
        const latestMessage = 0;

        return {
            topic,
            partitions,
            earliestOffsets,
            latestOffsets,
            earliestMessage,
            latestMessage,
        };
    }

    public async findMessageForKey(topic: string, key: string) {

        const message = await this.model.findOne({
            topic: this.hash(topic),
            key: this.hash(key),
        }).lean().exec();

        return {
            result: KeyIndexModel.cleanMessageResultForResponse(message),
        };
    }

    public async findMessageForPartitionAndOffset(topic: string, partition: number, offset: number) {

        const message = await this.model.findOne({
            topic: this.hash(topic),
            partition,
            offset,
        }).lean().exec();

        return {
            result: KeyIndexModel.cleanMessageResultForResponse(message),
        };
    }

    public async findMessageForTimestamp(topic: string, timestamp: number) {

        // TODO: range this a little? use timestampValue???
        const message = await this.model.findOne({
            topic: this.hash(topic),
            timestamp,
        }).lean().exec();

        return {
            result: KeyIndexModel.cleanMessageResultForResponse(message),
        };
    }

    public async findRangeAroundKey(topic: string, key: string, range: number = 50) {

        // TODO: implement
        return {
            results: [],
        };
    }

    public async paginateThroughTopic(topic: string, skip: number = 0, limit: number = 50, order: number = -1) {

        const messages = await this.model.find({
            topic: this.hash(topic),
        }, {
            skip,
            limit,
            sort: {
                timestamp: order,
            },
        }).lean().exec();

        return {
            results: KeyIndexModel.cleanMessageResultsForResponse(messages),
        };
    }

    public async getRangeFromLatest(topic: string, range: number = 50) {
        return this.paginateThroughTopic(topic, 0, range, 1);
    }

    public async getRangeFromEarliest(topic: string, range: number = 50) {
        return this.paginateThroughTopic(topic, 0, range, -1);
    }

    public insert(document: KeyIndex): Promise<KeyIndex> {
        return this.model.create(document).exec();
    }

    public upsert(document: KeyIndex): Promise<KeyIndex> {

        const query = {
            key: document.key,
            topic: document.topic,
        };

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate(query, document, queryOptions).exec();
    }

    public removeOldDeletePolicyEntries() {
        return this.model.deleteMany({
            deleteAt: {
                // $and doesnt work
                // comparison operators only perform comparisons on fields
                // where the BSON type matches the query value’s type
                // should therefor ignore 'null' values
                $lte: moment().valueOf(),
            },
        }).exec();
    }

    public deleteForTopic(topic: string) {
        debug("Deleting all entries for topic", topic);
        return this.model.deleteMany({
            topic: this.hash(topic),
        }).exec();
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.deleteMany({}).exec();
    }
}
