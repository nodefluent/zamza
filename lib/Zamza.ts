import * as Debug from "debug";
const debug = Debug("zamza:zamza");

import MongoWrapper from "./db/MongoWrapper";
import Discovery from "./kafka/Discovery";
import HttpServer from "./api/HttpServer";

import { ZamzaConfig } from "./interfaces";

const GRACE_EXIT_MS = 1500;

export default class Zamza {

    private readonly config: ZamzaConfig;
    private readonly mongoWrapper: MongoWrapper;
    private readonly discovery: Discovery;
    private readonly httpServer: HttpServer;

    constructor(config: ZamzaConfig) {
        this.config = config;
        this.mongoWrapper = new MongoWrapper(this.config.mongo);
        this.discovery = new Discovery(this.config.discovery);
        this.httpServer = new HttpServer(this.config.http, this);
    }

    public static isProduction(): boolean {
        return process.env.NODE_ENV === "production";
    }

    private shutdownOnErrorIfNotProduction() {

        if (!Zamza.isProduction()) {
            debug("Shutting down in", GRACE_EXIT_MS, "ms");
            this.close();
            setTimeout(() => {
                process.exit(1);
            }, GRACE_EXIT_MS);
        }
    }

    private init() {

        process.on("uncaughtException", (error: Error) => {
            debug("Unhandled Exception: ", error.message, error.stack);
            this.shutdownOnErrorIfNotProduction();
        });

        process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
            debug("Unhandled Rejection: ", reason);
            this.shutdownOnErrorIfNotProduction();
        });

        if (Zamza.isProduction()) {
            debug("Running production.");
        } else {
            debug("Running NOT in production.");
        }
    }

    public async run() {
        this.init();

        debug("Starting..");

        await this.mongoWrapper.start();
        // TODO: kafka client await this.discovery.start();
        await this.httpServer.start();

        debug("Running..");
    }

    public close() {

        debug("Closing..");

        this.mongoWrapper.close();
        this.discovery.close();
        this.httpServer.close();
    }
}
