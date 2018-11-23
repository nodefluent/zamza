import { DiscoveryConfig } from "./DiscoveryConfig";
import { MongoConfig } from "./MongoConfig";
import { HttpConfig } from "./HttpConfig";

export interface ZamzaConfig {
    kafka: any;
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
    };
}
