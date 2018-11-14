import * as Debug from "debug";
const debug = Debug("zamza:cleanupjob");

import Zamza from "../Zamza";
import { KeyIndexModel } from "./models";
import { Metrics } from "../Metrics";

export default class CleanUpDeleteJob {

    private readonly keyIndexModel: KeyIndexModel;
    private readonly metrics: Metrics;
    private t: any;
    private halt: boolean;

    constructor(zamza: Zamza) {
        this.keyIndexModel = zamza.mongoWrapper.getKeyIndexModel();
        this.metrics = zamza.metrics;
        this.t = null;
        this.halt = false;
    }

    public start(timeoutMs = 60000) {

        this.close();
        this.halt = false;

        this.t = setTimeout(async () => {

            try {
                await this.job();
            } catch (error) {
                debug("failed,", error.message);
            }

            if (!this.halt) {
                this.start(timeoutMs);
            } else {
                this.halt = false;
            }

        }, timeoutMs);
    }

    public close() {

        this.halt = true;
        if (this.t) {
            clearTimeout(this.t);
        }
    }

    private async job() {
        this.metrics.inc("job_clean_up_ran");
        const startTime = Date.now();
        await this.keyIndexModel.removeOldDeletePolicyEntries();
        const duration = Date.now() - startTime;
        debug("ran, took", duration, "ms");
        this.metrics.inc("job_clean_up_ran_success");
        this.metrics.set("job_clean_up_ms", duration);
    }
}
