import * as Debug from "debug";
const debug = Debug("zamza:access");

const WILDCARD = "*";

export default class AccessControll {

    private readonly accessConfig: any;

    constructor(accessConfig: any) {
        this.accessConfig = accessConfig;

        if (!this.accessConfig || Object.keys(this.accessConfig).length <= 0) {
            debug("NOTE: Automatically switched access configuration to allow everything.");
            this.accessConfig = WILDCARD;
        }

        if (this.accessConfig === WILDCARD) {
            debug("NOTE: You have NOT configured secured access to config and fetch endpoints.");
        } else {

            debug("Validating access configuration..");

            if (!this.accessConfig || typeof this.accessConfig !== "object") {
                throw new Error("Bad access configuration provided (object): " + JSON.stringify(this.accessConfig));
            } else {
                Object.keys(this.accessConfig).map((key) => {
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
        }
    }

    public topicAccessAllowedForRequest(req: any, topic: string) {
        const providedToken: string = req.headers ? req.headers.authorization : null;
        return this.topicAccessAllowedForToken(providedToken, topic);
    }

    public wildcardAccessAllowedForRequest(req: any, topic: string) {
        const providedToken: string = req.headers ? req.headers.authorization : null;
        return this.wildcardAccessAllowedForToken(providedToken);
    }

    private topicAccessAllowedForToken(token: string | null, topic: string): boolean {

        if (this.accessConfig === WILDCARD) {
            return true;
        }

        if (!token) {
            debug("Topic access not allowed for token", token, "and topic", topic, "reason: no token.");
            return false;
        }

        const configuration = this.accessConfig[token];
        if (!configuration) {
            debug("Topic access not allowed for token", token, "and topic", topic, "reason: no configuration.");
            return false;
        }

        if (configuration === WILDCARD) {
            return true;
        }

        if (configuration.indexOf(topic) !== -1) {
            return true;
        }

        debug("Topic access not allowed for token", token, "and topic", topic, "reason: topic not allowed.");
        return false;
    }

    private wildcardAccessAllowedForToken(token: string | null): boolean {

        if (this.accessConfig === WILDCARD) {
            return true;
        }

        if (!token) {
            debug("Topic access not allowed for token", token, "reason: no token.");
            return false;
        }

        const configuration = this.accessConfig[token];
        if (!configuration) {
            debug("Topic access not allowed for token", token, "reason: no configuration.");
            return false;
        }

        if (configuration === WILDCARD) {
            return true;
        }

        debug("Topic access not allowed for token", token, "reason: no wildcard.");
        return false;
    }
}
