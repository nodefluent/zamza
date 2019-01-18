import { DiscoveryConfig } from "./DiscoveryConfig";
import { MongoConfig } from "./MongoConfig";
import { HttpConfig } from "./HttpConfig";

export interface ZamzaConfig {
    kafka: any;
    marshallForInvalidCharacters?: boolean;
    discovery: DiscoveryConfig;
    mongo: MongoConfig;
    http: HttpConfig;
    jobs?: {
        topicConfigPollingMs?: number;
        metadataFetcherMs?: number;
    };
    hooks?: {
        enabled?: boolean;
        timeout?: number;
        only?: boolean;
        retries?: number;
        retryTimeoutMs?: number;
        subscriptionConcurrency?: number;
        replayConcurrency?: number;
        ignoreConfigValidation?: boolean;
    };
}
