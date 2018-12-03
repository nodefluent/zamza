import * as Debug from "debug";
const debug = Debug("zamza:model:replay");

import Zamza from "../../Zamza";
import { Metrics } from "../../Metrics";
import { Replay } from "../../interfaces";

const VERSION = 1;

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
            version: Number,
            topic: String,
            timestamp: Number,
            consumerGroup: String,
        };

        const schema = new schemaConstructor(schemaDefinition);

        schema.index({ version: 1, type: -1});

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

    public get(): Promise<Replay> {
        return this.model.findOne({ version: VERSION }).lean().exec().then((replay: any) => {

            if (!replay) {
                return replay;
            }

            delete replay.version;
            delete replay._id;
            delete replay.__v;
            return replay as Replay;
        });
    }

    public upsert(replay: Replay): Promise<any> {

        const query = {
            version: VERSION,
        };

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate(query, replay, queryOptions).exec();
    }

    public delete() {
        return this.model.deleteMany({version: VERSION}).exec();
    }
}
