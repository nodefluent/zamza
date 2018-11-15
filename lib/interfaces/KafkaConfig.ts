import { KafkaConsumerConfig, KafkaProducerConfig } from "sinek";
export interface KafkaConfig {
    consumer: KafkaConsumerConfig;
    producer: KafkaProducerConfig;
    defaultPartitions: "auto" | number;
    batchOptions?: {
        batchSize: number;
        commitEveryNBatch: number;
        concurrency: number;
        commitSync: boolean;
        noBatchCommits: boolean;
    };
}
