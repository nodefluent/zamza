import * as Debug from "debug";
const debug = Debug("zamza:model:hookmodel");
import * as mongoose from "mongoose";

import Zamza from "../../Zamza";
import { Metrics } from "../../Metrics";
import { Hook } from "../../interfaces";

export class HookModel {

    public readonly metrics: Metrics;
    public readonly name: string;
    private model: any;

    constructor(zamza: Zamza) {
        this.metrics = zamza.metrics;
        this.name = "hook";
        this.model = null;
    }

    public registerModel(passedMongoose: any, schemaConstructor: any) {

        const schemaDefinition = {
            name: String,
            endpoint: String,
            authorizationHeader: String,
            authorizationValue: String,
            disabled: Boolean,
            subscriptions: [
                {
                    topic: String,
                    disabled: Boolean,
                    ignoreReplay: Boolean,
                },
            ],
            timestamp: Number,
        };

        const schema = new schemaConstructor(schemaDefinition);

        // single index
        // schema.index({ name: 1, type: -1});

        // compound index
        // schema.index({ name: 1, timestamp: 1 }, { unique: false });

        this.model = passedMongoose.model(this.name, schema);

        this.model.on("index", (error: Error) => {

            if (error) {
                debug("Index creation failed", error.message);
            } else {
                debug("Index creation successfull.");
            }
        });

        debug("Registered model with schema.");
    }

    private asObjectId(id: string) {

        if (typeof id === "object") {
            return id;
        }

        return mongoose.Types.ObjectId(id);
    }

    public get(id: string): Promise<Hook> {
        return this.model.findOne({ _id: this.asObjectId(id) }).lean().exec();
    }

    public getForName(name: string): Promise<Hook> {
        return this.model.findOne({ name }).lean().exec();
    }

    public list(): Promise<Hook[]> {
        return this.model.find({}).lean().exec().then((hooks: any[]) => {
            return hooks.map((hook: any) => {
                delete hook.__v;
                return hook as Hook;
            });
        });
    }

    public upsert(hook: Hook): Promise<Hook> {

        let query = {};
        if (hook._id) {
            query = {
                _id: this.asObjectId(hook._id),
            };
        } else if (hook.name) {
            query = {
                name: hook.name,
            };
        }

        const queryOptions = {
            upsert: true,
            new: true,
        };

        return this.model.findOneAndUpdate(query, hook, queryOptions).exec();
    }

    public delete(id: string) {
        return this.model.deleteMany({
            _id: this.asObjectId(id),
        }).exec();
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.deleteMany({}).exec();
    }
}
