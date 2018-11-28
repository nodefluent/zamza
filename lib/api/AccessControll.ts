import * as Debug from "debug";
import { Metrics } from "../Metrics";
import { Subscription } from "../interfaces";
const debug = Debug("zamza:access");

const WILDCARD = "*";

const PERMISSIONS = {
    DELETE: "__delete",
    PRODUCE: "__produce",
    HOOK: "__hook",
    TOPIC: "__topic",
};

const ZAMZA_TOPIC_PREFIX = "__zamza";

export default class AccessControll {

    private readonly accessConfig: any;
    private readonly metrics: Metrics;

    constructor(accessConfig: any, metrics: Metrics) {
        this.accessConfig = accessConfig;
        this.metrics = metrics;

        if (!this.accessConfig || Object.keys(this.accessConfig).length <= 0) {
            debug("NOTE: Automatically switched access configuration to allow everything.");
            this.accessConfig = WILDCARD;
        }

        if (this.accessConfig === WILDCARD) {
            debug("NOTE: You have NOT configured secured access to config and fetch endpoints.");
            debug("Configured Access Controll: ", this.accessConfig);
        } else {

            debug("Validating access configuration..");

            if (!this.accessConfig || typeof this.accessConfig !== "object") {
                throw new Error("Bad access configuration provided (object): " + JSON.stringify(this.accessConfig));
            } else {
                Object.keys(this.accessConfig).map((key) => {

                    if (!key || key === WILDCARD) {
                        throw new Error("Multi token configuration does not allow null or wildcard as key: " + key);
                    }

                    if (!key.length || key.length < 5) {
                        throw new Error("Tokens should at least contain 6 characters.. " + key);
                    }

                    return this.accessConfig[key];
                }).forEach((acv) => {
                    if (!Array.isArray(acv) && acv !== WILDCARD) {
                        throw new Error("Bad access configuration provided (key or wildcard): " + JSON.stringify(acv));
                    } else {
                        if (Array.isArray(acv)) {
                            acv.forEach((acvv) => {
                                if (typeof acvv !== "string") {
                                    throw new Error("Bad access configuration provided (array value string): "
                                        + JSON.stringify(acvv));
                                }
                            });
                        }
                    }
                });
            }

            debug("Access configuration is valid.");

            const anonymisedAccessConfig: any = {};
            let i = 0;
            Object.keys(this.accessConfig).forEach((token) => {
                anonymisedAccessConfig[`${i}_${this.anonymiseToken(token)}`] = this.accessConfig[token];
                i++;
            });
            debug("Configured Access Controll: ", anonymisedAccessConfig);
        }
    }

    private anonymiseToken(token: string): string {

        let anonymisedToken = token.substr(0, 3);
        for (let i = 3; i < token.length; i++) {
            anonymisedToken += "#";
        }

        return anonymisedToken;
    }

    private topicAccessAllowedForToken(token: string | null, topic: string): boolean {

        if (topic && topic.startsWith(ZAMZA_TOPIC_PREFIX)) {
            debug("Cannot allow access to topic that begins with zamza's internal prefix", topic);
            return false;
        }

        if (this.accessConfig === WILDCARD) {
            this.metrics.inc("access_good");
            return true;
        }

        if (!token) {
            debug("Topic access not allowed for token", "token", "and topic", topic, "reason: no token.");
            this.metrics.inc("access_bad");
            return false;
        }

        const configuration = this.accessConfig[token];
        if (!configuration) {
            debug("Topic access not allowed for token", "token", "and topic", topic, "reason: no configuration.");
            this.metrics.inc("access_bad");
            return false;
        }

        if (configuration === WILDCARD) {
            this.metrics.inc("access_good");
            return true;
        }

        if (Array.isArray(configuration) && configuration.indexOf(topic) !== -1) {
            this.metrics.inc("access_good");
            return true;
        }

        if (Array.isArray(configuration) && configuration.indexOf(WILDCARD) !== -1) {
            this.metrics.inc("access_good");
            return true;
        }

        debug("Topic access not allowed for token", "token", "and topic", topic, "reason: topic not allowed.");
        this.metrics.inc("access_bad");
        return false;
    }

    private wildcardAccessAllowedForToken(token: string | null): boolean {

        if (this.accessConfig === WILDCARD) {
            this.metrics.inc("access_good");
            return true;
        }

        if (!token) {
            debug("Topic access not allowed for token", "token", "reason: no token.");
            this.metrics.inc("access_bad");
            return false;
        }

        const configuration = this.accessConfig[token];
        if (!configuration) {
            debug("Topic access not allowed for token", "token", "reason: no configuration.");
            this.metrics.inc("access_bad");
            return false;
        }

        if (configuration === WILDCARD) {
            this.metrics.inc("access_good");
            return true;
        }

        if (Array.isArray(configuration) && configuration.indexOf(WILDCARD) !== -1) {
            this.metrics.inc("access_good");
            return true;
        }

        debug("Topic access not allowed for token", "token", "reason: no wildcard.");
        this.metrics.inc("access_bad");
        return false;
    }

    private permissionTypeAccessAllowedForToken(token: string | null, permissionType: string): boolean {

        if (this.accessConfig === WILDCARD) {
            this.metrics.inc("access_good");
            return true;
        }

        if (!token) {
            debug(permissionType, "access not allowed for token", "token", "reason: no token.");
            this.metrics.inc("access_bad");
            return false;
        }

        const configuration = this.accessConfig[token];
        if (!configuration) {
            debug(permissionType, "access not allowed for token", "token", "reason: no configuration.");
            this.metrics.inc("access_bad");
            return false;
        }

        if (configuration === WILDCARD || configuration === permissionType) {
            this.metrics.inc("access_good");
            return true;
        }

        if (Array.isArray(configuration) && configuration.indexOf(WILDCARD) !== -1) {
            this.metrics.inc("access_good");
            return true;
        }

        if (Array.isArray(configuration) && configuration.indexOf(permissionType) !== -1) {
            this.metrics.inc("access_good");
            return true;
        }

        debug(permissionType, "access not allowed for token", "token", "reason: no wildcard, no permission.");
        this.metrics.inc("access_bad");
        return false;
    }

    public topicAccessAllowedForRequest(req: any, topic: string) {
        const providedToken: string = req.headers ? req.headers.authorization : null;
        return this.topicAccessAllowedForToken(providedToken, topic);
    }

    public wildcardAccessAllowedForRequest(req: any) {
        const providedToken: string = req.headers ? req.headers.authorization : null;
        return this.wildcardAccessAllowedForToken(providedToken);
    }

    public topicConfigAccessAllowedForRequest(req: any) {
        const providedToken: string = req.headers ? req.headers.authorization : null;
        return this.permissionTypeAccessAllowedForToken(providedToken, PERMISSIONS.TOPIC);
    }

    public produceAccessAllowedForRequest(req: any) {
        const providedToken: string = req.headers ? req.headers.authorization : null;
        return this.permissionTypeAccessAllowedForToken(providedToken, PERMISSIONS.PRODUCE);
    }

    public deleteAccessAllowedForRequest(req: any) {
        const providedToken: string = req.headers ? req.headers.authorization : null;
        return this.permissionTypeAccessAllowedForToken(providedToken, PERMISSIONS.DELETE);
    }

    public hookAccessAllowedForRequest(req: any) {
        const providedToken: string = req.headers ? req.headers.authorization : null;
        return this.permissionTypeAccessAllowedForToken(providedToken, PERMISSIONS.HOOK);
    }

    public subscriptionsAllowedForRequest(req: any, subscriptions: Subscription[]) {

        const providedToken: string = req.headers ? req.headers.authorization : null;

        if (!Array.isArray(subscriptions)) {
            throw new Error("Subscriptions must be an array.");
        }

        for (const subscription of subscriptions) {

            if (!subscription || !subscription.topic) {
                throw new Error("Subscription missing topic field.");
            }

            if (!this.topicAccessAllowedForToken(providedToken, subscription.topic)) {
                return false;
            }
        }

        return true;
    }
}
