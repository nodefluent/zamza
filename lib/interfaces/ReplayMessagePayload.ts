import { KafkaMessage } from "sinek";

export interface ReplayMessagePayload {
    message: KafkaMessage;
}
