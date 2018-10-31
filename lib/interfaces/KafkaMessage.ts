export interface KafkaMessage {
    topic: string;
    key: Buffer | string;
    value: Buffer | string;
    offset: number;
    partition: number;
    timestamp: number;
}
