import * as Debug from "debug";
const debug = Debug("zamza:mongo");

import * as mongoose from "mongoose";
const Schema = mongoose.Schema;
import Balrok from "balrok";

import { MongoConfig } from "../interfaces";
import * as Models from "./models";
import Zamza from "../Zamza";
import { KeyIndexModel, TopicConfigModel,
        TopicMetadataModel, LockModel,
        HookModel, ReplayModel, StateModel } from "./models";

export default class MongoWrapper {

    private readonly config: MongoConfig;
    private readonly models: any;
    public readonly balrok: Balrok;

    constructor(config: MongoConfig, zamza: Zamza) {
        this.config = config;
        this.models = {};
        this.loadModels(zamza);

        this.balrok = new Balrok({
            cacheCollectionName: "zamza_heavy_lifting",
            cacheTimeMs: 60 * 1000 * 10,
            maxParallelProcesses: 4,
        });

        mongoose.set("bufferCommands", false);
        mongoose.set("useCreateIndex", true);
        (mongoose as any).Promise = Promise;
    }

    private loadModels(zamza: Zamza) {

        Object.keys(Models)
        .map((key: string) => (Models as any)[key])
        .forEach((modelConstructor) => {

            if (modelConstructor.noModel) {
                return;
            }

            const model = new modelConstructor(zamza, this);
            model.registerModel(mongoose, Schema);
            this.models[model.name] = model;
        });
    }

    private connectToMongoDB(attempts = 0): Promise<any> {
        attempts++;
        debug("Attempting to connect to MongoDB..", attempts);
        return mongoose.connect(this.config.url, Object.assign({}, this.config.options, {
            useNewUrlParser: true,
            autoReconnect: true,
            noDelay: true,
            keepAlive: true,
            reconnectTries: 30,
            reconnectInterval: 1000,
            poolSize: 10,
        })).catch((error) => {
            debug("Failed to connect to MongoDB: ", error.message);
            return (new Promise((resolve) => { setTimeout(resolve, attempts * 1000); })).then(() => {
                return this.connectToMongoDB(attempts);
            });
        });
    }

    private async connect() {

        const db = mongoose.connection;

        db.on("error", (error: Error) => {
            debug("Error occured", error.message);
            mongoose.disconnect();
        });

        db.on("connecting", () => {
            debug("Connecting to MongoDB..");
        });

        db.on("connected", () => {
            debug("Connected to MongoDB.");
        });

        db.on("reconnected", () => {
            debug("MongoDB reconnected.");
        });

        db.on("disconnected", () => {
            debug("MongoDB disconnected, reconnecting in 3 seconds..");
            setTimeout(() => {
                this.connectToMongoDB();
            }, 3000);
        });

        return new Promise((resolve) => {

            db.once("open", () => {
                debug("Connection to MongoDB open.");
                resolve(this);
            });

            this.connectToMongoDB();
        });
    }

    public isConnected() {
        return mongoose.connection ? mongoose.connection.readyState === 1 : false;
    }

    public async start() {
        await this.connect();
        await this.balrok.init();
        return this.isConnected();
    }

    public getKeyIndex(): KeyIndexModel {
        return this.models.keyindex;
    }

    public getTopicConfig(): TopicConfigModel {
        return this.models.topicconfig;
    }

    public getTopicMetadata(): TopicMetadataModel {
        return this.models.topicmetadata;
    }

    public getLock(): LockModel {
        return this.models.lock;
    }

    public getHook(): HookModel {
        return this.models.hook;
    }

    public getReplay(): ReplayModel {
        return this.models.replay;
    }

    public getSharedState(): StateModel {
        return this.models.state;
    }

    public close() {

        debug("Closing..");

        if (mongoose.connection) {
            mongoose.connection.close();
        }
    }
}
