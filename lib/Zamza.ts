import * as Debug from "debug";
const debug = Debug("zamza:zamza");

import MongoWrapper from "./db/MongoWrapper";
import MongoPoller from "./db/MongoPoller";
import CleanUpDeleteJob from "./db/CleanUpDeleteJob";
import Discovery from "./kafka/Discovery";
import HttpServer from "./api/HttpServer";
import MessageHandler from "./MessageHandler";
import Consumer from "./kafka/Consumer";
import { Metrics } from "./Metrics";

import { ZamzaConfig } from "./interfaces";

const GRACE_EXIT_MS = 1250;

export default class Zamza {

    private readonly config: ZamzaConfig;
    private readonly httpServer: HttpServer;

    public readonly consumer: Consumer;
    public readonly messageHandler: MessageHandler;
    public readonly mongoWrapper: MongoWrapper;
    public readonly mongoPoller: MongoPoller;
    public readonly discovery: Discovery;
    public readonly cleanUpDeleteJob: CleanUpDeleteJob;
    public readonly metrics: Metrics;

    private alive: boolean = true;
    private ready: boolean = false;

    constructor(config: ZamzaConfig) {

        if (!config || typeof config !== "object") {
            throw new Error("Config must be an object: {kafka,discovery,mongo,http,jobs}");
        }

        this.config = config;
        this.metrics = new Metrics("zamza");
        this.mongoWrapper = new MongoWrapper(this.config.mongo);
        this.mongoPoller = new MongoPoller(this.mongoWrapper, this.metrics);
        this.discovery = new Discovery(this.config.discovery, this.metrics);
        this.httpServer = new HttpServer(this.config.http, this);
        this.consumer = new Consumer(this.config.kafka, this);
        this.messageHandler = new MessageHandler(this);
        this.cleanUpDeleteJob = new CleanUpDeleteJob(this);
    }

    public static isProduction(): boolean {
        return process.env.NODE_ENV === "production";
    }

    private shutdownOnErrorIfNotProduction() {

        if (!Zamza.isProduction()) {
            debug("Shutting down (because of error) in", GRACE_EXIT_MS, "ms");
            this.close();
            setTimeout(() => {
                process.exit(1);
            }, GRACE_EXIT_MS);
        }
    }

    private shutdownGracefully() {

        debug("\nShutting down gracefully in", GRACE_EXIT_MS, "ms");
        this.close();
        debug("Bye..");

        setTimeout(() => {
            process.exit(0);
        }, GRACE_EXIT_MS);
    }

    private init() {

        process.on("SIGINT", this.shutdownGracefully.bind(this));
        process.on("SIGUSR1", this.shutdownGracefully.bind(this));
        process.on("SIGUSR2", this.shutdownGracefully.bind(this));

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

        this.metrics.registerDefault();

        this.mongoPoller.on("error", (error) => {
            debug("MongoDB polling error: " + error.message, error.stack);
        });

        this.mongoPoller.on("topic-config-changed", (topics) => {
            debug("Topic Configuration changed, adjusting subscription of consumer accordingly..", topics.length);
            this.consumer.adjustSubscriptions(topics);
        });

        await this.mongoWrapper.start();
        await this.mongoPoller.start(this.config.jobs ? this.config.jobs.topicConfigPollingMs : undefined);
        await this.consumer.start();
        await this.discovery.start(this.consumer.getKafkaClient());
        await this.httpServer.start();
        this.cleanUpDeleteJob.start(this.config.jobs ? this.config.jobs.cleanUpDeleteTimeoutMs : undefined);

        this.setReadyState(true);
        debug("Running..");
    }

    public async close() {

        debug("Closing..");
        this.setAliveState(false);
        this.setReadyState(false);

        this.cleanUpDeleteJob.close();
        this.mongoPoller.close();
        this.discovery.close();
        this.httpServer.close();
        await this.consumer.close();
        this.mongoWrapper.close();
        this.metrics.close();
    }

    public setAliveState(state: boolean): void {
        debug("Setting alive state from", this.alive, "to", state);
        this.alive = state;
    }

    public isAlive(): boolean {
        return this.alive;
    }

    public setReadyState(state: boolean): void {
        debug("Setting ready state from", this.ready, "to", state);
        this.ready = state;
    }

    public isReady(): boolean {
        return this.ready;
    }
}
