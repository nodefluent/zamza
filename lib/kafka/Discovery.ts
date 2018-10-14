"use strict";

import * as EventEmitter from "events";
import * as Debug from "debug";
import * as murmur from "murmurhash";
import { ZamzaConfig } from "../interfaces";

const debug = Debug("zamza:discovery");
const DEFAULT_DISCOVER_MS: number = 15000;

export default class Discovery extends EventEmitter {

    private config: ZamzaConfig;
    private kafkaClient?: null | any;
    private scanTimeout: null | any;
    private lastTopicsHash: null | number;
    private discoveredTopics: string[];

    public isActive: boolean;

    constructor(config: ZamzaConfig) {
        super();

        this.config = config;
        this.kafkaClient = null;
        this.scanTimeout = null;
        this.isActive = false;

        this.lastTopicsHash = null;
        this.discoveredTopics = [];

        // TODO: might want to cleanup on deleted-topics event
    }

    private static arrayToFixedHash(array: string[]): number {
        return murmur.v3(array.sort().join(":"), 0);
    }

    public async start(kafkaClient: any, discoverFields = false) {

        if (!this.config.discovery || !this.config.discovery.enabled) {
            return debug("Discovery not running.");
        }

        debug("Discovery is configured, starting.. discoverFields:", discoverFields);

        this.kafkaClient = kafkaClient;

        this.discover(discoverFields).catch((error) => {
            debug("Failed to start discover process", error.message);
        });

        this.isActive = true;
    }

    private async discover(discoverFields = false) {

        try {
            await this.discoverTopics();
        } catch (error) {
            debug("Discovery failed", error.message);
        }

        this.scanTimeout = setTimeout(this.discover.bind(this), this.config.discovery.scanMs || DEFAULT_DISCOVER_MS);
    }

    private async discoverTopics() {

        let topics = await this.kafkaClient.getTopicList();

        if (!topics || !topics.length) {
            debug("No topics discovered.");
            return false;
        }

        let blacklist: string[] = [];
        if (this.config.discovery && Array.isArray(this.config.discovery.topicBlacklist)) {
            blacklist = JSON.parse(JSON.stringify(this.config.discovery.topicBlacklist));
        }

        topics = topics.filter((topic: string) => blacklist.indexOf(topic) === -1);

        const newTopicsHash = Discovery.arrayToFixedHash(topics);

        if (this.lastTopicsHash === newTopicsHash) {
            debug("Topic hashes are identical, no new topics discovered.");
            return false;
        }

        debug("Topic hashes have changed old:", this.lastTopicsHash, "new:", newTopicsHash);
        this.lastTopicsHash = newTopicsHash;

        const newTopics: string[] = [];
        topics.forEach((topic: string) => {
            if (this.discoveredTopics.indexOf(topic) === -1) {
                newTopics.push(topic);
            }
        });

        debug("Discovered new topics", newTopics);
        this.emit("created-topics", newTopics);

        const deletedTopics: string[] = [];
        this.discoveredTopics.forEach((topic) => {
            if (topics.indexOf(topic) === -1) {
                deletedTopics.push(topic);
            }
        });

        debug("Discovered deleted topics", deletedTopics);
        this.emit("deleted-topics", deletedTopics);

        this.discoveredTopics = topics;
        this.emit("discovered-topics", topics);

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
