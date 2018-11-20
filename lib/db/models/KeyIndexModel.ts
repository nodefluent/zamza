import * as Debug from "debug";
import * as murmur from "murmurhash";
const debug = Debug("zamza:model:keyindex");
import * as moment from "moment";

import { KeyIndex, TopicMetadata } from "../../interfaces";
import Zamza from "../../Zamza";
import { Metrics } from "../../Metrics";

export class KeyIndexModel {

    public readonly metrics: Metrics;
    public readonly name: string;
    private model: any;

    constructor(zamza: Zamza) {
        this.metrics = zamza.metrics;
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

        // single lookup indices
        schema.index({ key: 1, type: -1 });
        // schema.index({ topic: 1, type: -1 });
        // schema.index({ timestamp: 1, type: -1 });
        // schema.index({ timestamp: 1, type: 1 });
        // schema.index({ deleteAt: 1, type: -1 });
        // schema.index({ partition: 1, type: -1 });
        // schema.index({ offset: 1, type: -1 });
        // schema.index({ fromStream: 1, type: -1 });

        // compound index
        schema.index({ topic: 1, key: 1 }, { unique: false });
        schema.index({ topic: 1, key: 1, fromStream: 1 }, { unique: false });
        schema.index({ topic: 1, partition: 1 }, { unique: false });
        schema.index({ topic: 1, partition: 1, offset: 1 }, { unique: false });

        schema.index({ topic: 1, timestamp: 1 }, { unique: false });
        schema.index({ topic: 1, timestamp: -1 }, { unique: false });

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

    private static cleanMessageResultForResponse(topic: string, message: KeyIndex):
        {topic: string, partition: number, offset: number, key: Buffer, value: Buffer, timestamp: number} {

        if (!message) {
            return message;
        }

        const cleanedMessage: any = {};

        cleanedMessage.topic = topic; // cannot use message.topic, as its a hash
        cleanedMessage.partition = message.partition;
        cleanedMessage.offset = message.offset;
        cleanedMessage.key = message.keyValue ? message.keyValue.toString("utf8") : message.keyValue,
        cleanedMessage.value = message.value ? message.value.toString("utf8") : message.value;
        cleanedMessage.timestamp = message.timestampValue ?
            parseInt(message.timestampValue.toString("utf8"), undefined) : message.timestampValue;

        return cleanedMessage;
    }

    private static cleanMessageResultsForResponse(topic: string, messages: KeyIndex[]) {
        return messages.map((message) => {
            return KeyIndexModel.cleanMessageResultForResponse(topic, message);
        });
    }

    public async getMetadataForTopic(topic: string): Promise<TopicMetadata> {

        const startTime = Date.now();

        const [
            partitions,
            earliestOffset,
            latestOffset,
            earliestMessage,
            latestMessage,
        ] = await Promise.all([
            this.getPartitionCountsForTopic(topic),
            this.getEarliestOffset(topic),
            this.getLatestOffset(topic),
            this.getEarliestTimestamp(topic),
            this.getLatestTimestamp(topic),
        ]);

        const counts = this.partitionsToTotalCount(partitions);
        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_info_ms", duration);

        return {
            topic,
            messageCount: counts.size,
            partitionCount: counts.count,
            partitions,
            earliestOffset,
            latestOffset,
            earliestMessage,
            latestMessage,
            timestamp: moment().valueOf(),
        };
    }

    private partitionsToTotalCount(partitions: any) {

        let size = 0;
        let count = 0;

        Object.keys(partitions).forEach((key) => {
            count++;
            size += partitions[key];
        });

        return {
            count,
            size,
        };
    }

    public async getEarliestOffset(topic: string) {

        const startTime = Date.now();

        const result = await this.model.aggregate([
              {
                $match: {
                    topic: this.hash(topic),
                },
              },
              {
                $group: {
                  _id: {},
                  minOffset: { $min: "$offset" },
                },
              },
        ]);

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_info_earliest_offset_ms", duration);

        return result.length ? result[0].minOffset : -1;
    }

    public async getLatestOffset(topic: string) {

        const startTime = Date.now();

        const result = await this.model.aggregate([
              {
                $match: {
                    topic: this.hash(topic),
                },
              },
              {
                $group: {
                  _id: {},
                  maxOffset: { $max: "$offset" },
                },
              },
        ]);

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_info_latest_offset_ms", duration);

        return result.length ? result[0].maxOffset : -1;
    }

    public async getEarliestTimestamp(topic: string) {

        const startTime = Date.now();

        const result = await this.model.aggregate([
              {
                $match: {
                    topic: this.hash(topic),
                },
              },
              {
                $group: {
                  _id: {},
                  minTimestamp: { $min: "$timestamp" },
                },
              },
        ]);

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_info_earliest_ts_ms", duration);

        return result.length ? result[0].minTimestamp : -1;
    }

    public async getLatestTimestamp(topic: string) {

        const startTime = Date.now();

        const result = await this.model.aggregate([
              {
                $match: {
                    topic: this.hash(topic),
                },
              },
              {
                $group: {
                  _id: {},
                  maxTimestamp: { $max: "$timestamp" },
                },
              },
        ]);

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_info_latest_ts_ms", duration);

        return result.length ? result[0].maxTimestamp : -1;
    }

    public async getPartitionCountsForTopic(topic: string) {

        const startTime = Date.now();

        const partitionAggregation = await this.model.aggregate([
            { // Filter for specific topic
                $match: {
                    topic: this.hash(topic),
                },
            }, // Count all occurrences
            { $group: {
                _id: { // accumulator object
                    partition: "$partition",
                },
                count: { $sum: 1 },
                },
            },
        ]);

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_info_partition_ms", duration);

        const partitions: any = {};
        partitionAggregation.forEach((aggregatedPartition: any) => {
            partitions[aggregatedPartition._id.partition] = aggregatedPartition.count;
        });

        return partitions;
    }

    public async findMessageForKey(topic: string, key: string) {

        const startTime = Date.now();

        const message = await this.model.findOne({
            topic: this.hash(topic),
            key: this.hash(key),
        }).lean().exec();

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_find_key_ms", duration);

        return {
            result: KeyIndexModel.cleanMessageResultForResponse(topic, message),
        };
    }

    public async findMessageForPartitionAndOffset(topic: string, partition: number, offset: number) {

        const startTime = Date.now();

        const message = await this.model.findOne({
            topic: this.hash(topic),
            partition,
            offset,
        }).lean().exec();

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_find_pof_ms", duration);

        return {
            result: KeyIndexModel.cleanMessageResultForResponse(topic, message),
        };
    }

    public async findMessageForTimestamp(topic: string, timestamp: number) {

        const startTime = Date.now();

        // TODO: range this a little? use timestampValue???
        const message = await this.model.findOne({
            topic: this.hash(topic),
            timestamp,
        }).lean().exec();

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_find_ts_ms", duration);

        return {
            result: KeyIndexModel.cleanMessageResultForResponse(topic, message),
        };
    }

    public async findRangeAroundKey(topic: string, key: string, range: number = 50) {

        // TODO: implement
        return {
            results: [],
        };
    }

    public async paginateThroughTopic(topic: string, skip: number = 0, limit: number = 50, order: number = -1) {

        if (limit > 2500) {
            throw new Error(limit + " is a huge limit size, please stay under 2500 per call.");
        }

        debug("Paginating from", skip, "to", skip + limit, "on topic", topic, "order", order);
        const startTime = Date.now();

        const messages = await this.model.find({
            topic: this.hash(topic),
        }).skip(skip).limit(limit).sort({
            timestamp: order,
        }).lean().exec();

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_paginate_ms", duration);

        return {
            results: KeyIndexModel.cleanMessageResultsForResponse(topic, messages),
        };
    }

    public async getRangeFromLatest(topic: string, range: number = 50) {
        return this.paginateThroughTopic(topic, 0, range, 1);
    }

    public async getRangeFromEarliest(topic: string, range: number = 50) {
        return this.paginateThroughTopic(topic, 0, range, -1);
    }

    public async insert(document: KeyIndex): Promise<KeyIndex> {

        const startTime = Date.now();

        const result = await this.model.create(document);

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_insert_ms", duration);

        return result;
    }

    public async upsert(document: KeyIndex): Promise<KeyIndex> {

        const startTime = Date.now();

        const query = {
            topic: document.topic,
            key: document.key,
        };

        const queryOptions = {
            upsert: true,
        };

        const result = await this.model.findOneAndUpdate(query, document, queryOptions).exec();
        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_upsert_ms", duration);

        return result;
    }

    public delete(topic: string, key: string, fromStream: boolean = false) {

        if (!topic) {
            debug("Cannot delete message without topic", topic, key, fromStream);
            return Promise.reject(new Error("Cannot delete message without topic"));
        }

        if (!key) {
            debug("Cannot delete message without key", topic, key, fromStream);
            return Promise.reject(new Error("Cannot delete message without key"));
        }

        return this.model.deleteMany({
            topic: this.hash(topic),
            key: this.hash(key),
            fromStream,
        });
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
