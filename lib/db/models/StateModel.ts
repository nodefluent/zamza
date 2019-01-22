import * as Debug from "debug";
const debug = Debug("zamza:model:statemodel");

import Zamza from "../../Zamza";
import { Metrics } from "../../Metrics";

const STATE_KEYS = {
    noModel: true,
    ENABLE_METADATA_JOB: "enable_metadata_job",
};

const KNOWN_STATE_KEYS: string[] = Object.keys(STATE_KEYS).map((key: string) => (STATE_KEYS as any)[key]);

export class StateModel {

    public readonly metrics: Metrics;
    public readonly name: string;
    private model: any;

    constructor(zamza: Zamza) {
        this.metrics = zamza.metrics;
        this.name = "state";
        this.model = null;
    }

    public registerModel(mongoose: any, schemaConstructor: any) {

        const schemaDefinition = {
            key: String,
            val: String,
        };

        const schema = new schemaConstructor(schemaDefinition);

         // single index
        schema.index({ key: 1 }, { unique: true });

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

    public list(): Promise<Array<{key: string, val: string}>> {
        return this.model.find({}).lean().exec();
    }

    public get(key: string): Promise<string | null> {
        return this.model.findOne({key}).exec().then((result: {key: string, val: string}) => {
            if (result) {
                return result.val;
            } else {
                return null;
            }
        });
    }

    public set(key: string, val: string): Promise<string> {

        if (KNOWN_STATE_KEYS.indexOf(key) === -1) {
            throw new Error("Unknown shared state key: " + key);
        }

        debug("Changing shared state for", key, val);

        const queryOptions = {
            upsert: true,
        };

        return this.model.findOneAndUpdate({key}, {key, val}, queryOptions).exec().then(() => val);
    }

    public del(key: string): Promise<void> {
        debug("Deleting shared state for", key);
        return this.model.deleteOne({key}).exec();
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.deleteMany({}).exec();
    }
}

export {STATE_KEYS};
