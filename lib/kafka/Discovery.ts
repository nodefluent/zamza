import * as EventEmitter from "events";
import * as Debug from "debug";
import * as murmur from "murmurhash";
import { DiscoveryConfig } from "../interfaces";
import { NConsumer } from "sinek";
import { Metrics } from "../Metrics";

const debug = Debug("zamza:discovery");
const DEFAULT_DISCOVER_MS: number = 15000;

export default class Discovery extends EventEmitter {

    private readonly config: DiscoveryConfig;
    private readonly metrics: Metrics;
    private kafkaClient: NConsumer | null;
    private scanTimeout: null | any;
    private lastTopicsHash: null | number;
    private discoveredTopics: string[];

    public isActive: boolean;

    constructor(config: DiscoveryConfig, metrics: Metrics) {
        super();

        this.config = config;
        this.metrics = metrics;
        this.kafkaClient = null;
        this.scanTimeout = null;
        this.isActive = false;

        this.lastTopicsHash = null;
        this.discoveredTopics = [];
    }

    public static arrayToFixedHash(array: string[]): number {
        return murmur.v3(array.sort().join(":"), 0);
    }

    public async start(kafkaClient: NConsumer | null) {

        if (!kafkaClient) {
            return debug("Cannot start discovery, without kafka client.");
        }

        if (!this.config || !this.config.enabled) {
            return debug("Discovery not running.");
        }

        debug("Discovery is configured, starting..");

        this.kafkaClient = kafkaClient;

        this.discover().catch((error) => {
            debug("Failed to start discover process", error.message);
        });

        this.isActive = true;
    }

    private async discover() {

        try {
            this.metrics.inc("job_discover_ran");
            await this.discoverTopics();
            this.metrics.inc("job_discover_ran_success");
        } catch (error) {
            debug("Discovery failed", error.message);
        }

        this.scanTimeout = setTimeout(this.discover.bind(this), this.config.scanMs || DEFAULT_DISCOVER_MS);
    }

    private async discoverTopics() {

        if (!this.kafkaClient) {
            return false;
        }

        let topics = await this.kafkaClient.getTopicList();

        if (!topics || !topics.length) {
            debug("No topics discovered.");
            return false;
        }

        let blacklist: string[] = [];
        if (this.config && Array.isArray(this.config.topicBlacklist)) {
            blacklist = JSON.parse(JSON.stringify(this.config.topicBlacklist));
        }

        topics = topics.filter((topic: string) => blacklist.indexOf(topic) === -1);

        const newTopicsHash = Discovery.arrayToFixedHash(topics);

        if (!this.lastTopicsHash && !newTopicsHash) {
            return false;
        }

        if (this.lastTopicsHash === newTopicsHash) {
            return false;
        }

        debug("Topic hashes have changed old:", this.lastTopicsHash, "new:", newTopicsHash);
        this.lastTopicsHash = newTopicsHash;
        this.metrics.inc("discovered_topics_changed");

        const newTopics: string[] = [];
        topics.forEach((topic: string) => {
            if (this.discoveredTopics.indexOf(topic) === -1) {
                newTopics.push(topic);
            }
        });

        debug("Discovered new topics", newTopics);
        this.emit("created-topics", newTopics);
        this.metrics.inc("discovered_topics_created", newTopics.length);

        const deletedTopics: string[] = [];
        this.discoveredTopics.forEach((topic) => {
            if (topics.indexOf(topic) === -1) {
                deletedTopics.push(topic);
            }
        });

        debug("Discovered deleted topics", deletedTopics);
        this.emit("deleted-topics", deletedTopics);
        this.metrics.inc("discovered_topics_deleted", deletedTopics.length);

        this.discoveredTopics = topics;
        this.emit("discovered-topics", topics);
        this.metrics.inc("discovered_topics_total", topics.length);

        return true;
    }

    public getDiscoveredTopics() {
        return this.discoveredTopics;
    }

    public close() {

        debug("Closing..");
        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
        }
    }
}
