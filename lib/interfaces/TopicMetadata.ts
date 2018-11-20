export interface TopicMetadata {
    topic: string;
    messageCount: number;
    partitionCount: number;
    earliestOffset: number;
    latestOffset: number;
    earliestMessage: number;
    latestMessage: number;
    partitions: any;
    timestamp: number;
}
