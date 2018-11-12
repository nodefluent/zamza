import { DiscoveryConfig } from "./DiscoveryConfig";
import { MongoConfig } from "./MongoConfig";
import { HttpConfig } from "./HttpConfig";

export interface ZamzaConfig {
    kafka: any;
    discovery: DiscoveryConfig;
    mongo: MongoConfig;
    http: HttpConfig;
    jobs?: {
        cleanUpDeleteTimeoutMs?: number;
        topicConfigPollingMs?: number;
    };
}
