import { KafkaMessage } from "sinek";

export interface RetryMessagePayload {
    hookId?: string;
    retryCount: number;
    message: KafkaMessage;
}
