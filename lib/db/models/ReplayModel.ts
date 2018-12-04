import * as Debug from "debug";
const debug = Debug("zamza:model:replay");

import Zamza from "../../Zamza";
import { Metrics } from "../../Metrics";
import { Replay } from "../../interfaces";

export class ReplayModel {

    public readonly metrics: Metrics;
    public readonly name: string;
    private model: any;

    constructor(zamza: Zamza) {
        this.metrics = zamza.metrics;
        this.name = "replay";
        this.model = null;
    }

    public registerModel(mongoose: any, schemaConstructor: any) {

        const schemaDefinition = {
            instanceId: String,
            topic: String,
            timestamp: Number,
            consumerGroup: String,
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

    public list(): Promise<Replay[]> {
        return this.model.find({}).lean().exec().then((replays: any[]) => {
            return replays.map((replay) => {
                delete replay._id;
                delete replay.__v;
                return replay as Replay;
            });
        });
    }

    public get(topic: string): Promise<Replay> {
        return this.model.findOne({ topic }).lean().exec().then((replay: any) => {

            if (!replay) {
                return replay;
            }

            delete replay._id;
            delete replay.__v;
            return replay as Replay;
        });
    }

    public getForInstanceId(instanceId: string): Promise<Replay> {
        return this.model.findOne({ instanceId }).lean().exec().then((replay: any) => {

            if (!replay) {
                return replay;
            }

            delete replay._id;
            delete replay.__v;
            return replay as Replay;
        });
    }

    public upsert(replay: Replay): Promise<any> {

        const query = {
            topic: replay.topic,
        };

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate(query, replay, queryOptions).exec();
    }

    public delete(topic: string) {
        return this.model.deleteMany({ topic }).exec();
    }

    public deleteForInstanceId(instanceId: string) {
        return this.model.deleteMany({ instanceId }).exec();
    }

    public truncate() {
        return this.model.deleteMany({}).exec();
    }
}
