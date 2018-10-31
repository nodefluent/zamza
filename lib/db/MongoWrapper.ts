
import * as Debug from "debug";
const debug = Debug("zamza:mongo");

import * as mongoose from "mongoose";
const Schema = mongoose.Schema;

import { MongoConfig } from "../interfaces";
import * as Models from "./models";
import { KeyIndexModel, TopicConfigModel } from "./models";

export default class MongoWrapper {

    private readonly config: MongoConfig;
    private readonly models: any;

    constructor(config: MongoConfig) {
        this.config = config;
        this.models = {};
    }

    private connect() {
        debug("Connecting..");
        return new Promise((resolve) => {

            mongoose.set("bufferCommands", false);
            (mongoose as any).Promise = Promise;
            mongoose.connect(this.config.url, Object.assign({}, this.config.options, {
                useNewUrlParser: true,
            }));

            const db = mongoose.connection;

            db.on("error", (error: Error) => {
                debug("Error occured", error);
            });

            db.once("open", () => {
                debug("Connected.");
                resolve(this);
            });
        });
    }

    public async start() {

        await this.connect();

        Object.keys(Models)
        .map((key: string) => (Models as any)[key])
        .forEach((modelConstructor) => {
            const model = new modelConstructor();
            model.registerModel(mongoose, Schema);
            this.models[model.name] = model;
        });

        return true;
    }

    public getKeyIndexModel(): KeyIndexModel {
        return this.models.keyindex;
    }

    public getTopicConfig(): TopicConfigModel {
        return this.models.topicconfig;
    }

    public close() {

        debug("Closing..");

        if (mongoose.connection) {
            mongoose.connection.close();
        }
    }
}
