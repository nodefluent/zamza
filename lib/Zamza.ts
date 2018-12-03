import * as Debug from "debug";
const debug = Debug("zamza:zamza");
import { KafkaConsumerConfig, KafkaProducerConfig } from "sinek";

import MongoWrapper from "./db/MongoWrapper";
import MongoPoller from "./db/MongoPoller";
import Discovery from "./kafka/Discovery";
import HttpServer from "./api/HttpServer";
import MessageHandler, { INTERNAL_TOPICS } from "./MessageHandler";
import Consumer from "./kafka/Consumer";
import Producer from "./kafka/Producer";
import { Metrics } from "./Metrics";
import MetadataFetcher from "./db/MetadataFetcher";
import ReplayConsumer from "./kafka/ReplayConsumer";
import RetryConsumer from "./kafka/RetryConsumer";
import ReplayProducer from "./kafka/ReplayProducer";
import RetryProducer from "./kafka/RetryProducer";

import { ZamzaConfig, KafkaConfig } from "./interfaces";
import HookDealer from "./HookDealer";
import { ReplayHandler } from "./ReplayHandler";

const GRACE_EXIT_MS = 1250;

export default class Zamza {

    private readonly httpServer: HttpServer;

    public readonly config: ZamzaConfig;
    public readonly consumer: Consumer;
    public readonly replayConsumer: ReplayConsumer;
    public readonly retryConsumer: RetryConsumer;
    public readonly replayProducer: ReplayProducer;
    public readonly retryProducer: RetryProducer;
    public readonly producer: Producer;
    public readonly messageHandler: MessageHandler;
    public readonly mongoWrapper: MongoWrapper;
    public readonly mongoPoller: MongoPoller;
    public readonly discovery: Discovery;
    public readonly metrics: Metrics;
    public readonly metadataFetcher: MetadataFetcher;
    public readonly hookDealer: HookDealer;
    public readonly replayHandler: ReplayHandler;

    private alive: boolean = true;
    private ready: boolean = false;

    constructor(config: ZamzaConfig) {

        if (!config || typeof config !== "object") {
            throw new Error("Config must be an object: {kafka,discovery,mongo,http,jobs}");
        }

        if (!config.hooks) {
            debug("No hook configuration found.");
            config.hooks = {};
        }

        this.config = config;
        this.metrics = new Metrics("zamza");
        this.discovery = new Discovery(this.config.discovery, this.metrics);
        this.mongoWrapper = new MongoWrapper(this.config.mongo, this);
        this.mongoPoller = new MongoPoller(this.mongoWrapper, this.metrics);
        this.producer = new Producer(this.config.kafka, this);
        this.httpServer = new HttpServer(this.config.http, this);

        this.consumer = new Consumer(this.config.kafka, this);

        this.replayConsumer = new ReplayConsumer(Object.assign(this.config.kafka, {
            consumer: this.cloneKafkaConsumerConfig("zamza-internal-replay-consumer-group-1", this.config.kafka),
        }), this);

        this.retryConsumer = new RetryConsumer(Object.assign(this.config.kafka, {
            consumer: this.cloneKafkaConsumerConfig("zamza-internal-retry-consumer-group-1", this.config.kafka),
        }), this);

        this.replayProducer = new ReplayProducer(Object.assign(this.config.kafka, {
            producer: this.cloneKafkaProducerConfig("zamza-internal-replay-producer-1", this.config.kafka),
        }), this);

        this.retryProducer = new RetryProducer(Object.assign(this.config.kafka, {
            producer: this.cloneKafkaProducerConfig("zamza-internal-retry-producer-1", this.config.kafka),
        }), this);

        this.hookDealer = new HookDealer(this);
        this.replayHandler = new ReplayHandler(this);
        this.messageHandler = new MessageHandler(this);
        this.metadataFetcher = new MetadataFetcher(this.mongoWrapper, this.metrics);
    }

    private cloneKafkaProducerConfig(clientId: string, config: KafkaConfig): KafkaProducerConfig {
        const cloneConfig: KafkaProducerConfig = JSON.parse(JSON.stringify(config.consumer));
        cloneConfig.noptions = Object.assign(cloneConfig.noptions, {
            "client.id": clientId,
        });
        return cloneConfig;
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

        await this.replayProducer.start();
        await this.retryProducer.start();
        await this.replayConsumer.start();
        await this.retryConsumer.start();

        this.mongoPoller.on("error", (error) => {
            debug("MongoDB polling error: " + error.message, error.stack);
        });

        this.mongoPoller.on("topic-config-changed", (topics) => {

            // no need to adjust subscriptions
            if (this.messageHandler.hooksOnly) {
                return;
            }

            debug("Topic Configuration changed, adjusting subscription of consumer accordingly..", topics.length);
            this.consumer.adjustSubscriptions(topics);
        });

        this.mongoPoller.on("hooks-changed", (hooks) => {
            this.hookDealer.processHookUpdate(hooks);
        });

        await this.discovery.start(this.consumer.getKafkaClient());
        await this.mongoPoller.start(this.config.jobs ? this.config.jobs.topicConfigPollingMs : undefined);
        await this.metadataFetcher.start(this.config.jobs ? this.config.jobs.metadataFetcherMs : undefined);
        await this.httpServer.start();

        this.replayConsumer.adjustSubscriptions([INTERNAL_TOPICS.REPLAY_TOPIC]);
        this.retryConsumer.adjustSubscriptions([INTERNAL_TOPICS.RETRY_TOPIC]);

        this.setReadyState(true);
        debug("Running..");
    }

    public async close() {

        debug("Closing..");
        this.setAliveState(false);
        this.setReadyState(false);

        await this.replayHandler.close();
        this.mongoPoller.close();
        this.metadataFetcher.close();
        this.discovery.close();
        this.httpServer.close();
        await this.consumer.close();
        await this.replayConsumer.close();
        await this.retryConsumer.close();
        await this.producer.close();
        await this.replayProducer.close();
        await this.retryProducer.close();
        this.mongoWrapper.close();
        this.metrics.close();
        this.hookDealer.close();
    }

    public cloneKafkaConsumerConfig(groupId: string, config: KafkaConfig): KafkaConsumerConfig {
        const cloneConfig: KafkaConsumerConfig = JSON.parse(JSON.stringify(config.consumer));
        cloneConfig.noptions = Object.assign(cloneConfig.noptions, {
            "group.id": groupId,
        });
        return cloneConfig;
    }

    public static isProduction(): boolean {
        return process.env.NODE_ENV === "production";
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
