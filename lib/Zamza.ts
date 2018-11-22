import * as Debug from "debug";
const debug = Debug("zamza:zamza");

import MongoWrapper from "./db/MongoWrapper";
import MongoPoller from "./db/MongoPoller";
import Discovery from "./kafka/Discovery";
import HttpServer from "./api/HttpServer";
import MessageHandler from "./MessageHandler";
import Consumer from "./kafka/Consumer";
import Producer from "./kafka/Producer";
import { Metrics } from "./Metrics";
import MetadataFetcher from "./db/MetadataFetcher";

import { ZamzaConfig } from "./interfaces";

const GRACE_EXIT_MS = 1250;

export default class Zamza {

    private readonly config: ZamzaConfig;
    private readonly httpServer: HttpServer;

    public readonly consumer: Consumer;
    public readonly producer: Producer;
    public readonly messageHandler: MessageHandler;
    public readonly mongoWrapper: MongoWrapper;
    public readonly mongoPoller: MongoPoller;
    public readonly discovery: Discovery;
    public readonly metrics: Metrics;
    public readonly metadataFetcher: MetadataFetcher;

    private alive: boolean = true;
    private ready: boolean = false;

    constructor(config: ZamzaConfig) {

        if (!config || typeof config !== "object") {
            throw new Error("Config must be an object: {kafka,discovery,mongo,http,jobs}");
        }

        this.config = config;
        this.metrics = new Metrics("zamza");
        this.discovery = new Discovery(this.config.discovery, this.metrics);
        this.mongoWrapper = new MongoWrapper(this.config.mongo, this);
        this.mongoPoller = new MongoPoller(this.mongoWrapper, this.metrics);
        this.producer = new Producer(this.config.kafka, this);
        this.httpServer = new HttpServer(this.config.http, this);
        this.consumer = new Consumer(this.config.kafka, this);
        this.messageHandler = new MessageHandler(this);
        this.metadataFetcher = new MetadataFetcher(this.mongoWrapper, this.metrics);
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

        /*
        process.on("warning", (warning: Error) => {
            debug("Warning:", warning.message);
        }); */

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

        // its okay to start these first, as consumer not subscribe to anything until the
        // poller told him about the configured topics
        // NOTE: this is necessary, because consumer requires connection before adjusting subscriptions
        await this.mongoWrapper.start();
        await this.producer.start();
        await this.consumer.start();

        this.mongoPoller.on("error", (error) => {
            debug("MongoDB polling error: " + error.message, error.stack);
        });

        this.mongoPoller.on("topic-config-changed", (topics) => {
            debug("Topic Configuration changed, adjusting subscription of consumer accordingly..", topics.length);
            this.consumer.adjustSubscriptions(topics);
        });

        await this.discovery.start(this.consumer.getKafkaClient());
        await this.mongoPoller.start(this.config.jobs ? this.config.jobs.topicConfigPollingMs : undefined);
        await this.metadataFetcher.start(this.config.jobs ? this.config.jobs.metadataFetcherMs : undefined);
        await this.httpServer.start();

        this.setReadyState(true);
        debug("Running..");
    }

    public async close() {

        debug("Closing..");
        this.setAliveState(false);
        this.setReadyState(false);

        this.mongoPoller.close();
        this.metadataFetcher.close();
        this.discovery.close();
        this.httpServer.close();
        await this.consumer.close();
        await this.producer.close();
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
