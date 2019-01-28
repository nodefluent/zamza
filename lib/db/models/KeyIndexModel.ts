import * as Debug from "debug";
import * as murmur from "murmurhash";
const debug = Debug("zamza:model:keyindex");
import * as moment from "moment";
import * as mongoose from "mongoose";
import * as Bluebird from "bluebird";
import * as toJSONSchema from "to-json-schema";
import * as R from "ramda";

import { KeyIndex, TopicMetadata } from "../../interfaces";
import Zamza from "../../Zamza";
import { Metrics } from "../../Metrics";
import Discovery from "../../kafka/Discovery";
import MessageHandler from "./../../MessageHandler";
import { TopicConfig } from "../../interfaces";

export class KeyIndexModel {

    public readonly metrics: Metrics;
    public readonly discovery: Discovery;
    public readonly zamza: Zamza;
    public readonly name: string;
    private readonly models: any;
    private mongoose: any;
    private schemaConstructor: any;

    constructor(zamza: Zamza) {
        this.metrics = zamza.metrics;
        this.discovery = zamza.discovery;
        this.zamza = zamza;
        this.name = "keyindex";
        this.models = {};
        this.mongoose = null;
        this.schemaConstructor = null;
    }

    public registerModel(mongoosePassed: any, schemaConstructor: any) {
        this.mongoose = mongoosePassed;
        this.schemaConstructor = schemaConstructor;
        debug("Not creating any model now, as keyindex models are created per topic on the fly.");
    }

    public ensureModelAndIndicesExist(topic: string, topicConfig: TopicConfig) {
        this.getOrCreateModel(topic, topicConfig);
    }

    private getOrCreateModel(originalTopic: string, unstoredTopicConfig: TopicConfig | null = null) {

        const topic = MessageHandler.cleanTopicNameForMetrics(originalTopic);
        const topicConfig = unstoredTopicConfig || this.zamza.messageHandler.findConfigForTopic(originalTopic);
        if (!topicConfig) {
            debug("Cannot getOrCreateModel, because no config was found for topic", originalTopic);
            throw new Error("Cannot getOrCreateModel, because no config was found for topic: " + originalTopic);
        }

        if (this.models[topic]) {
            return this.models[topic];
        }

        const schemaDefinition = {
            key: Number, // hashed
            timestamp: Number,
            partition: Number,
            offset: Number,
            keyValue: Buffer,
            value: topicConfig.queryable ? mongoose.Schema.Types.Mixed : Buffer,
            deleteAt: Date,
            fromStream: Boolean,
            storedAt: Number,
        };

        const schema = new this.schemaConstructor(schemaDefinition);

        // single lookup indices
        schema.index({ key: 1, type: -1 });
        schema.index({ timestamp: 1, type: 1 });
        schema.index({ timestamp: 1, type: -1 });

        // compound index
        schema.index({ key: 1, fromStream: 1 }, { unique: false });
        schema.index({ partition: 1 }, { unique: false });
        schema.index({ partition: 1, offset: 1 }, { unique: false });

        // ttl index
        schema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

        const model = this.mongoose.model(`${this.name}_${topic}`, schema);

        model.on("index", (error: Error) => {

            if (error) {
                debug("Index creation failed", error.message);
            } else {
                debug("Index creation successfull.");
            }
        });

        debug("Registered model with schema for topic", topic);
        this.models[topic] = model;

        return this.models[topic];
    }

    private hash(value: string): number {
        return murmur.v3(value, 0);
    }

    private static cleanMessageResultForResponse(topic: string, message: KeyIndex):
        {$index: string, topic: string, partition: number, offset: number,
            key: Buffer, value: any, timestamp: number} {

        if (!message) {
            return message;
        }

        if (message.value && Buffer.isBuffer(message.value)) {
            message.value = message.value.toString("utf8");
        }

        const cleanedMessage: any = {};

        cleanedMessage.$index = (message as any)._id; // important for pagination
        cleanedMessage.topic = topic; // cannot use message.topic, as its a hash
        cleanedMessage.partition = message.partition;
        cleanedMessage.offset = message.offset;
        cleanedMessage.key = message.keyValue ? message.keyValue.toString("utf8") : message.keyValue,
        cleanedMessage.value = message.value;
        cleanedMessage.timestamp = message.timestamp;

        if (typeof cleanedMessage.partition === "undefined") {
            debug("Parsed cleaned message seems invalid:", JSON.stringify(message));
        }

        return cleanedMessage;
    }

    private static cleanMessageResultsForResponse(topic: string, messages: KeyIndex[]) {
        return messages.map((message) => {
            return KeyIndexModel.cleanMessageResultForResponse(topic, message);
        });
    }

    public async getSimpleCountOfMessagesStoredForTopic(topic: string, fromMetadata: boolean = true): Promise<number> {

        const startTime = Date.now();

        const model = this.getOrCreateModel(topic);
        let count = -1;
        if (fromMetadata) {
            count = await model.estimatedDocumentCount();
        } else {
            count = await model.countDocuments({});
        }

        const duration = Date.now() - startTime;
        this.metrics.set(`mongo_keyindex_simple_count_${fromMetadata ? "m" : "c"}_ms`, duration);

        return count;
    }

    public async getMetadataForTopic(topic: string): Promise<TopicMetadata> {

        const startTime = Date.now();
        const partitionCountOfTopic = this.discovery.getPartitionCountOfTopic(topic, 40);

        const [
            partitions,
            earliestOffset,
            latestOffset,
            earliestMessage,
            latestMessage,
        ] = await Promise.all([
            this.getPartitionCountsForTopic(topic, partitionCountOfTopic),
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

        const result = await this.getOrCreateModel(topic).aggregate([
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

        const result = await this.getOrCreateModel(topic).aggregate([
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

        const result = await this.getOrCreateModel(topic).aggregate([
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

        const result = await this.getOrCreateModel(topic).aggregate([
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

    public async getPartitionCountsForTopicViaAggregation(topic: string) {

        const startTime = Date.now();

        const partitionAggregation = await this.getOrCreateModel(topic).aggregate([
            { $group: { // Count all occurrences
                _id: { // accumulator object
                    partition: "$partition",
                },
                count: { $sum: 1 },
                },
            },
        ]);

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_info_partition_aggregation_ms", duration);

        const partitions: any = {};
        partitionAggregation.forEach((aggregatedPartition: any) => {
            partitions[aggregatedPartition._id.partition] = aggregatedPartition.count;
        });

        return partitions;
    }

    public async getPartitionCountsForTopic(topic: string, partitionCount: number) {

        const startTime = Date.now();
        const model = this.getOrCreateModel(topic);

        const partitions: number[] = [];
        for (let i = 0; i < partitionCount; i++) {
            partitions.push(i);
        }

        // although splitting a single query in multiple seems absurd, these counts run on the index
        // and are a lot faster then the single aggregate query on top
        const partitionCounts: any = await Bluebird.map(partitions, (partition: number) => {
            return model.countDocuments({ partition }).then((count: number) => {
                return {
                    partition,
                    count,
                };
            });
        }, { concurrency: 3 });

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_info_partition_ms", duration);

        const partitionResults: any = {};
        partitionCounts.forEach((aggregatedPartition: any) => {
            partitionResults[aggregatedPartition.partition] = aggregatedPartition.count;
        });

        return partitionResults;
    }

    public async findMessageForKey(topic: string, key: string) {

        const startTime = Date.now();

        const message = await this.getOrCreateModel(topic).findOne({
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

        const message = await this.getOrCreateModel(topic).findOne({
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

        // TODO: range this a little? use timestamp
        const message = await this.getOrCreateModel(topic).findOne({
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

    public async paginateThroughTopic(topic: string, skipToIndex: string | null,
                                      limit: number = 50, order: number = -1) {

        // order
        // 1 = ascending = earliest
        // -1 = descending = latest

        if (limit > 2500) {
            throw new Error(limit + " is a huge limit size, please stay under 2500 per call.");
        }

        debug("Paginating from", skipToIndex, "to next", limit, "on topic", topic, "order", order);

        let query = {};
        if (skipToIndex && skipToIndex !== "null") {

            // use last object id to find cursor, its a million times faster
            // than using .skip() which does not use an index
            let objectIdIndex = null;
            try {
                objectIdIndex = mongoose.Types.ObjectId(skipToIndex);
                if (!mongoose.Types.ObjectId.isValid(objectIdIndex)) {
                    throw new Error("Invalid ObjectID");
                }
            } catch (error) {
                throw new Error("Provided skipToIndex is not a valid ObjectId: " + skipToIndex + ", " + error.message);
            }

            query = {
                _id: { [order === 1 ? "$gt" : "$lt"]: objectIdIndex },
            };
        }

        const startTime = Date.now();

        const messages = await this.getOrCreateModel(topic)
            .find(query)
            .sort({ _id: order })
            .limit(limit)
            .lean()
            .exec();

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_paginate_ms", duration);

        return {
            results: KeyIndexModel.cleanMessageResultsForResponse(topic, messages),
        };
    }

    public async findForQuery(topic: string, origQuery: any, limit: number = 512,
                              skipToIndex: string | null = null, order: number = -1) {

        const topicConfig = this.zamza.messageHandler.findConfigForTopic(topic);
        if (!topicConfig) {
            debug("Cannot findForQuery, because no config was found for topic", topic);
            throw new Error("Cannot findForQuery, because no config was found for topic: " + topic);
        }

        if (!topicConfig.queryable) {
            debug("Cannot run query for topic", topic, "because it is not configured as queryable.", topicConfig);
            throw new Error("Cannot run query for topic " + topic + " because it is not configured as queryable.");
        }

        // order
        // 1 = ascending = earliest
        // -1 = descending = latest

        if (!origQuery || typeof origQuery !== "object") {
            throw new Error("query must be an object, filtering for 'dot-notated' keys.");
        }

        if (limit > 2500) {
            throw new Error(limit + " is a huge limit size, please stay under 2500 per call.");
        }

        const queryId = topic + "_" +
            this.hash(`${Object.keys(origQuery).join("")}${limit}${skipToIndex}${order}`);

        debug(queryId, "filtering for", origQuery,
            "on topic", topic, "limit", limit, "skipToIndex", skipToIndex, "order", order);

        const query = {...origQuery};
        if (skipToIndex && skipToIndex !== "null") {

            // use last object id to find cursor, its a million times faster
            // than using .skip() which does not use an index
            let objectIdIndex = null;
            try {
                objectIdIndex = mongoose.Types.ObjectId(skipToIndex);
                if (!mongoose.Types.ObjectId.isValid(objectIdIndex)) {
                    throw new Error("Invalid ObjectID");
                }
            } catch (error) {
                throw new Error("Provided skipToIndex is not a valid ObjectId: " + skipToIndex + ", " + error.message);
            }

            if (query._id) {
                debug(queryId,
                    "you provided '_id' in your query, but you also use skipToIndex, _id has been overwritten.");
            }

            query._id = { [order === 1 ? "$gt" : "$lt"]: objectIdIndex };
        }

        const queryFilter = R.allPass(Object.keys(query).map((key: string) => {

            if (key.indexOf("[") !== -1 || key.indexOf("]") !== -1) {
                throw new Error("Character not allowed in query key [], only dot strings as path allowed.");
            }

            if (Array.isArray(query[key]) || (typeof query[key] === "object" && query[key] !== null)) {
                throw new Error(
                    "Query field values, must not be arrays or objects, please resolve via flat string paths. " + key);
            }

            return R.pathEq(key.split("."), query[key]);
        }));

        const documentOperation = (doc: any) => {
            return queryFilter(doc);
        };

        const resolveOptions = {
            options: {},
            batchSize: 1024,
            order,
            timeoutMs: 55000,
            dontAwait: false,
            noCache: false,
        };

        const startTime = Date.now();

        const messages: any = await this.zamza
            .mongoWrapper.balrok.filter(this.getOrCreateModel(topic), {}, documentOperation, resolveOptions);

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_find_query_ms", duration);
        debug(queryId, "filter for query", query, "on topic", topic, "took", duration, "ms");

        return {
            results: KeyIndexModel.cleanMessageResultsForResponse(topic, messages),
        };
    }

    public async getRangeFromLatest(topic: string, range: number = 50) {
        return this.paginateThroughTopic(topic, null, range, -1);
    }

    public async getRangeFromEarliest(topic: string, range: number = 50) {
        return this.paginateThroughTopic(topic, null, range, 1);
    }

    public async analyseSingleMessageJSONSchema(topic: string) {

        const latestMessages = await this.getRangeFromLatest(topic, 1);
        const message = latestMessages.results.length ? latestMessages.results[0] : null;

        if (!message || !message.value) {
            throw new Error("The topic " + topic + " has not enough fetchable messages"
                + " to create a stable JSON schema. (At least 1 message with non null value required.)");
        }

        try {
            let value = null;
            if (typeof message.value !== "object" || Buffer.isBuffer(message.value)) {

                if (Buffer.isBuffer(message.value)) {
                    value = JSON.parse(message.value.toString("utf8"));
                } else {
                    value = JSON.parse(message.value);
                }

                if (!value || typeof value !== "object") {
                    return;
                }

                message.value = value;
            }

            delete message.$index;
            (message as any).key = message.key ? message.key.toString("utf8") : message.key;
        } catch (error) {
            throw new Error("Cannot determine JSON schema for topic "
                + topic + ", as it does not contain JSON. " + error.message);
        }

        try {
            const schema = toJSONSchema(message);
            if (!schema) {
                throw new Error("Empty schema.");
            }

            return schema;
        } catch (error) {
            throw new Error("Failed to create schema for topic " + topic + ", " + error.message);
        }
    }

    public async analyseJSONSchema(topic: string) {

        const earliestMessages = await this.getRangeFromEarliest(topic, 10);
        const latestMessages = await this.getRangeFromLatest(topic, 10);
        const parsedAndConsolidatedMessages: any = [];

        const analyseMessage = (message: any) => {

            if (!message.value) {
                return;
            }

            try {
                let value = null;
                if (typeof message.value !== "object" || Buffer.isBuffer(message.value)) {

                    if (Buffer.isBuffer(message.value)) {
                        value = JSON.parse(message.value.toString("utf8"));
                    } else {
                        value = JSON.parse(message.value);
                    }

                    if (!value || typeof value !== "object") {
                        return;
                    }

                    message.value = value;
                }

                delete message.$index;
                message.key = message.key ? message.key.toString("utf8") : message.key;

                parsedAndConsolidatedMessages.push(message);
            } catch (error) {
                throw new Error("Cannot determine JSON schema for topic "
                    + topic + ", as it does not contain JSON. " + error.message);
            }
        };

        earliestMessages.results.forEach(analyseMessage);
        latestMessages.results.forEach(analyseMessage);

        if (parsedAndConsolidatedMessages.length < 2) {
            throw new Error("The topic " + topic + " has not enough fetchable messages"
                + " to create a stable JSON schema. (At least 2 messages with non null value required.)");
        }

        try {
            const schema = toJSONSchema(parsedAndConsolidatedMessages);
            if (!schema) {
                throw new Error("Empty schema.");
            }

            return schema;
        } catch (error) {
            throw new Error("Failed to create schema for topic " + topic + ", " + error.message);
        }
    }

    public async insert(topic: string, document: KeyIndex): Promise<KeyIndex> {

        if (!document.partition && document.partition !== 0) {
            throw new Error("Cannot store key index document without partition: " + JSON.stringify(document));
        }

        const startTime = Date.now();

        const result = await this.getOrCreateModel(topic).create(document);

        const duration = Date.now() - startTime;
        this.metrics.set("mongo_keyindex_insert_ms", duration);

        return result;
    }

    public async upsert(topic: string, document: KeyIndex): Promise<KeyIndex> {

        if (!document.partition && document.partition !== 0) {
            throw new Error("Cannot store key index document without partition: " + JSON.stringify(document));
        }

        if (!document.key) {
            debug("Cannot upsert message without key.", topic, document.key);
            return null as any;
        }

        const startTime = Date.now();

        const query = {
            key: document.key,
        };

        const queryOptions = {
            upsert: true,
        };

        const result = await this.getOrCreateModel(topic).findOneAndUpdate(query, document, queryOptions).exec();
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

        return this.getOrCreateModel(topic).deleteMany({
            key: this.hash(key),
            fromStream,
        });
    }

    public deleteForTopic(topic: string) {
        debug("Deleting all entries for topic", topic);
        return this.getOrCreateModel(topic).deleteMany({}).exec();
    }
}
