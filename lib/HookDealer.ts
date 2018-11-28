import * as Debug from "debug";
const debug = Debug("zamza:hookdealer");
import * as Bluebird from "bluebird";

import Zamza from "./Zamza";
import { KafkaMessage } from "sinek";
import { Metrics } from "./Metrics";
import MongoPoller from "./db/MongoPoller";
import { Hook, TopicConfig } from "./interfaces";
import HookClient from "./HookClient";

const DEFAULT_TIMEOUT = 2500;

export default class HookDealer {

    private readonly metrics: Metrics;
    private readonly timeout: number;
    private readonly mongoPoller: MongoPoller;
    private initialHooksLoaded: boolean = false;
    private topicSubscriptionMap: any;
    private oldTopicSubscriptionLength: number = 0;
    private hookClient: HookClient;

    constructor(zamza: Zamza) {
        this.metrics = zamza.metrics;
        this.timeout = zamza.config.hooks ?
            zamza.config.hooks.timeout ? zamza.config.hooks.timeout : DEFAULT_TIMEOUT
            : DEFAULT_TIMEOUT;
        this.mongoPoller = zamza.mongoPoller;
        this.hookClient = new HookClient(zamza);
    }

    private findConfigForTopic(topic: string): TopicConfig | null {

        const topicConfigs = this.mongoPoller.getCollected().topicConfigs;
        for (let i = topicConfigs.length - 1; i >= 0; i--) {
            if (topicConfigs[i].topic === topic) {
                return topicConfigs[i];
            }
        }

        return null;
    }

    public processHookUpdate(hooks: Hook[]) {

        if (!hooks) {
            return;
        }

        if (!this.initialHooksLoaded) {
            debug("Initial hooks loaded", hooks.length);
        }

        let endpoints = 0;
        // transform the hooks into a structure that is more performant to process
        const topicSubscriptionMap: any = {};
        hooks.forEach((hook) => {

            if (hook.disabled || !hook.subscriptions) {
                return; // skip
            }

            hook.subscriptions.forEach((subscription) => {

                if (subscription.disabled) {
                    return; // skip
                }

                if (topicSubscriptionMap[subscription.topic]) {
                    topicSubscriptionMap[subscription.topic] = [];
                }

                const hookClone = JSON.parse(JSON.stringify(hook));
                delete hookClone.subscriptions;
                hookClone.ignoreReplay = subscription.ignoreReplay;

                topicSubscriptionMap[subscription.topic].push(hookClone);
                endpoints++;
            });
        });

        if (endpoints !== this.oldTopicSubscriptionLength) {
            debug("Topic Subscription Map has changed from", this.oldTopicSubscriptionLength,
                 "to", endpoints);
            this.oldTopicSubscriptionLength = endpoints;
            this.metrics.set("configured_active_subscriptions", endpoints);
        }

        this.topicSubscriptionMap = topicSubscriptionMap;
    }

    private async handleSubscription(mappedHook: any): Promise<void> {
        // TODO: create hook http client use here to make call, handle errors and timeouts -> replay

    }

    public async handleMessage(message: KafkaMessage): Promise<boolean> {

        // called after message handler has handled mongo storage

        const subscriptions = this.topicSubscriptionMap[message.topic];
        if (!subscriptions) {
            return false;
        }

        this.metrics.inc("hook_processed_messages");

        // TODO: handle retry count
        this.metrics.inc("hook_processed_messages_success");
        return true;
    }

    public async handleRetryMessage(message: KafkaMessage): Promise<boolean> {

        // called before message handler has handled mongo storage

        this.metrics.inc("hook_processed_retry_messages");

        // no topic config present anymore, skip hooks for replays
        if (!this.findConfigForTopic(message.topic)) {
            return false;
        }

        // TODO: handle retry count
        this.metrics.inc("hook_processed_retry_messages_success");
        return true;
    }

    public async handleReplayMessage(message: KafkaMessage): Promise<boolean> {

        // called before message handler has handled mongo storage

        this.metrics.inc("hook_processed_replay_messages");

        // no topic config present anymore, skip hooks for replays
        if (!this.findConfigForTopic(message.topic)) {
            return false;
        }

        // TODO: handle replay enabled, how to trigger replay in the first place?
        // TODO: option to run hook and produce only (without storing messages to mongodb)
        this.metrics.inc("hook_processed_replay_messages_success");
        return true;
    }

    public close() {

        if (this.hookClient) {
            return this.hookClient.close();
        }

        return null;
    }
}
