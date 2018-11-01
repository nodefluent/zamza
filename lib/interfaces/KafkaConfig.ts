import { KafkaConsumerConfig } from "sinek";
export interface KafkaConfig {
    consumer: KafkaConsumerConfig;
    batchOptions?: {
        batchSize: number;
        commitEveryNBatch: number;
        concurrency: number;
        commitSync: boolean;
        noBatchCommits: boolean;
    };
}
