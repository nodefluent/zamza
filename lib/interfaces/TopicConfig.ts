export interface TopicConfig {
    topic: string;
    cleanupPolicy: string;
    retentionMs: number;
    timestamp: number;
    queryable?: boolean;
}
