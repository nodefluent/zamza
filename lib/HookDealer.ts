import * as Debug from "debug";
const debug = Debug("zamza:hookdealer");
import * as Bluebird from "bluebird";

import Zamza from "./Zamza";
import { KafkaMessage } from "sinek";
import { Metrics } from "./Metrics";
import MongoPoller from "./db/MongoPoller";
import { Hook, TopicConfig, ReplayMessagePayload, RetryMessagePayload } from "./interfaces";
import HookClient from "./HookClient";
import RetryProducer from "./kafka/RetryProducer";
import { INTERNAL_TOPICS } from "./MessageHandler";
import { HookModel } from "./db/models";

const DEFAULT_TIMEOUT = 1500;
const DEFAUT_RETRIES = 0;
const DEFAULT_RETRY_TIMEOUT = 1000;
const DEFAULT_SUBSCRIPTION_CONCURRENCY = 4;
const DEFAULT_REPLAY_CONCURRENCY = 4;

export default class HookDealer {

    private readonly metrics: Metrics;
    private readonly timeout: number;
    private readonly retries: number;
    private readonly retryTimeout: number;
    private readonly mongoPoller: MongoPoller;
    private readonly hookModel: HookModel;
    private readonly subscriptionConcurrency: number;
    private readonly replayConcurrency: number;
    private initialHooksLoaded: boolean = false;
    private topicSubscriptionMap: {[key: string]: Array<Hook & { ignoreReplay: boolean }>};
    private oldTopicSubscriptionLength: number = 0;
    private hookClient: HookClient;
    private retryProducer: RetryProducer;

    constructor(zamza: Zamza) {
        this.metrics = zamza.metrics;

        zamza.config.hooks = zamza.config.hooks ? zamza.config.hooks : {};

        this.timeout = zamza.config.hooks.timeout ? zamza.config.hooks.timeout : DEFAULT_TIMEOUT;
        this.retries = typeof zamza.config.hooks.retries === "number" ? zamza.config.hooks.retries : DEFAUT_RETRIES;
        this.retryTimeout = zamza.config.hooks.retryTimeoutMs ?
            zamza.config.hooks.retryTimeoutMs : DEFAULT_RETRY_TIMEOUT;
        this.subscriptionConcurrency = zamza.config.hooks.subscriptionConcurrency ?
            zamza.config.hooks.subscriptionConcurrency : DEFAULT_SUBSCRIPTION_CONCURRENCY;
        this.replayConcurrency = zamza.config.hooks.replayConcurrency ?
            zamza.config.hooks.replayConcurrency : DEFAULT_REPLAY_CONCURRENCY;

        try {
            this.validateConfigForConvenience(zamza.config.hooks.ignoreConfigValidation);
        } catch (error) {
            debug("(HookDealer) Validation error: " + error.message);
            process.exit(1);
        }

        this.mongoPoller = zamza.mongoPoller;
        this.hookModel = zamza.mongoWrapper.getHook();
        this.hookClient = new HookClient(zamza);
        this.retryProducer = zamza.retryProducer;
        this.topicSubscriptionMap = {};
    }

    private validateConfigForConvenience(ignoreConfigValidation?: boolean) {

        if (ignoreConfigValidation) {
            return;
        }

        if (typeof this.timeout !== "number" || this.timeout < 50 || this.timeout > 45000) {
            throw new Error("Configuring the hook timeout below 50 ms or above 45 seconds is not a good idea.");
        }

        if (typeof this.retries !== "number" || this.retries < 0 || this.retries > 25) {
            throw new Error("Configuring the retries below 0 or above 25 is not a good idea.");
        }

        if (typeof this.retryTimeout !== "number" || this.retryTimeout < 0 || this.retryTimeout > 15000) {
            throw new Error("Configuring the retryTimeout below 0 ms or above 15 seconds is not a good idea.");
        }

        if (typeof this.subscriptionConcurrency !== "number" || this.subscriptionConcurrency < 1 ||
                this.subscriptionConcurrency > 150) {
            throw new Error("Configuring the subscriptionConcurrency below 1 or above 150 is not a good idea.");
        }

        if (typeof this.replayConcurrency !== "number" || this.replayConcurrency < 1 ||
                this.replayConcurrency > 150) {
            throw new Error("Configuring the replayConcurrency below 1 or above 150 is not a good idea.");
        }
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
            this.initialHooksLoaded = true;
        }

        let endpoints = 0;
        // transform the hooks into a structure that is more performant to process
        const topicSubscriptionMap: {[key: string]: Array<Hook & { ignoreReplay: boolean }>} = {};
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

                const hookClone: Hook & { ignoreReplay: boolean } = JSON.parse(JSON.stringify(hook));
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

    private async handleSubscription(message: KafkaMessage,
                                     mappedHook: Hook & { ignoreReplay: boolean },
                                     replayPayload?: ReplayMessagePayload,
                                     retryPayload?: RetryMessagePayload): Promise<void> {

        const body: any = {
            message,
            context: null,
        };

        if (replayPayload) {
            delete replayPayload.message;
            body.context = {
                type: "replay",
                data: replayPayload,
            };
        } else if (retryPayload) {
            delete retryPayload.message;
            body.context = {
                type: "retry",
                data: replayPayload,
            };
        }

        const options: any = {
            method: "POST",
            url: mappedHook.endpoint,
            headers: {
                "content-type": "application/json",
            },
            timeout: this.timeout,
            body: JSON.stringify(body),
        };

        if (mappedHook.authorizationHeader && mappedHook.authorizationValue) {
            options.headers[mappedHook.authorizationHeader] = mappedHook.authorizationValue;
        }

        await this.hookClient.call(options, 200);
    }

    public async handleMessage(message: KafkaMessage): Promise<boolean> {

        // called after message handler has handled mongo storage

        const subscriptions = this.topicSubscriptionMap[message.topic];
        if (!subscriptions) {
            return false;
        }

        this.metrics.inc("hook_processed_messages");

        await Bluebird.map(subscriptions, (subscription) => {
            return this.handleSubscription(message, subscription).then(() => {
                this.metrics.inc("hook_delivered");
            }).catch((_) => {
                this.metrics.inc("hook_failed");
                if (this.retries > 0) {

                    const retryMessage: RetryMessagePayload = {
                        message,
                        hookId: subscription._id,
                        retryCount: 0,
                        fromReplay: false,
                    };

                    this.metrics.inc("hook_produce_retry");
                    setTimeout(() => {
                        this.retryProducer.produceMessage(INTERNAL_TOPICS.RETRY_TOPIC,
                            undefined, undefined, JSON.stringify(retryMessage));
                    }, this.retryTimeout);
                }
            });
        }, { concurrency: this.subscriptionConcurrency });

        this.metrics.inc("hook_processed_messages_success");
        return true;
    }

    public async handleRetryMessage(message: KafkaMessage): Promise<boolean> {

        // called before message handler has handled mongo storage

        this.metrics.inc("hook_processed_retry_messages");

        if (!message.value) {
            return false;
        }

        let parsedMessage: RetryMessagePayload | null = null;
        try {
            if (typeof message.value === "string") {
                parsedMessage = JSON.parse(Buffer.isBuffer(message.value) ?
                    message.value.toString("utf8") : message.value);
            } else {
                parsedMessage = message.value;
            }

            if (!parsedMessage) {
                throw new Error("Parsed Message empty.");
            }

            if (!parsedMessage.hookId) {
                throw new Error("HookID missing on retry message payload.");
            }
        } catch (error) {
            debug("Failed to parse retry message payload: " + error.message);
            return false;
        }

        // no topic config present anymore, skip hooks for replays
        if (!this.findConfigForTopic(parsedMessage!.message.topic)) {
            this.metrics.inc("hook_processed_retry_messages_success");
            return false;
        }

        // subscription has been deleted OR is disabled currently
        // let error fall through for retry
        const subscription = await this.hookModel.get(parsedMessage.hookId);
        if (!subscription || subscription.disabled) {
            return false;
        }

        return this.handleSubscription(parsedMessage.message, subscription as any, undefined,
                parsedMessage as any).then(() => {
            this.metrics.inc("hook_retry_delivered");
            this.metrics.inc("hook_processed_retry_messages_success");
            return true;
        }).catch((_) => {
            this.metrics.inc("hook_retry_failed");
            if (this.retries > parsedMessage!.retryCount) {

                const retryMessage: RetryMessagePayload = {
                    message,
                    hookId: subscription._id,
                    retryCount: parsedMessage!.retryCount + 1,
                };

                this.metrics.inc("hook_produce_retry");
                setTimeout(() => {
                    this.retryProducer.produceMessage(INTERNAL_TOPICS.RETRY_TOPIC,
                        undefined, undefined, JSON.stringify(retryMessage));
                }, this.retryTimeout);
            } else {
                this.metrics.inc("hook_retry_reached");
            }
            this.metrics.inc("hook_processed_retry_messages_success");
            return true;
        });
    }

    public async handleReplayMessage(message: KafkaMessage): Promise<boolean> {

        // called before message handler has handled mongo storage

        this.metrics.inc("hook_processed_replay_messages");

        if (!message.value) {
            return false;
        }

        let parsedMessage: ReplayMessagePayload | null = null;
        try {
            if (typeof message.value === "string") {
                parsedMessage = JSON.parse(Buffer.isBuffer(message.value) ?
                    message.value.toString("utf8") : message.value);
            } else {
                parsedMessage = message.value;
            }

            if (!parsedMessage) {
                throw new Error("Parsed Message empty.");
            }
        } catch (error) {
            debug("Failed to parse retry message payload: " + error.message);
            return false;
        }

        // no topic config present anymore, skip hooks for replays
        if (!this.findConfigForTopic(parsedMessage.message.topic)) {
            this.metrics.inc("hook_processed_retry_messages_success");
            return false;
        }

        let subscriptions = this.topicSubscriptionMap[parsedMessage.message.topic];
        if (!subscriptions) {
            return false;
        }

        // filter out subscriptions that dont participate in replays
        subscriptions = subscriptions.filter((subscription) => !subscription.ignoreReplay);

        await Bluebird.map(subscriptions, (subscription) => {
            return this.handleSubscription(parsedMessage!.message, subscription, parsedMessage as any).then(() => {
                this.metrics.inc("hook_replay_delivered");
            }).catch((_) => {
                this.metrics.inc("hook_replay_failed");
                if (this.retries > 0) {

                    const retryMessage: RetryMessagePayload = {
                        message,
                        hookId: subscription._id,
                        retryCount: 0,
                        fromReplay: true,
                    };

                    this.metrics.inc("hook_replay_produce_retry");
                    setTimeout(() => {
                        this.retryProducer.produceMessage(INTERNAL_TOPICS.RETRY_TOPIC,
                            undefined, undefined, JSON.stringify(retryMessage));
                    }, this.retryTimeout);
                }
            });
        }, { concurrency: this.replayConcurrency });

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
