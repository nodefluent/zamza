export interface MongoConfig {
    url: string;
    options?: {
        keepAlive?: number;
        autoIndex?: boolean;
        reconnectTries?: number;
        reconnectInterval?: number;
        poolSize?: number;
    };
}
