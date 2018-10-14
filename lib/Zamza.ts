import * as Debug from "debug";

import { ZamzaConfig } from "./interfaces";

const debug = Debug("zamza:zamza");

export class Zamza {

    private readonly config: ZamzaConfig;

    constructor(config: ZamzaConfig) {
        this.config = config;
    }

    private init() {
        debug("Init..");
    }

    public async run() {
        this.init();
        debug("Running..");
    }

    public close() {
        debug("Closing..");
    }
}
