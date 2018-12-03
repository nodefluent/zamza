import * as Debug from "debug";
const debug = Debug("zamza:replayhandler");
import * as uuid from "uuid";

import Zamza from "./Zamza";
import { ReplayModel } from "./db/models";
import MirrorConsumer from "./kafka/MirrorConsumer";
import ReplayProducer from "./kafka/ReplayProducer";
import { Replay, ReplayMessagePayload } from "./interfaces";
import { KafkaMessage } from "sinek";
import { INTERNAL_TOPICS } from "./MessageHandler";
import { Metrics } from "./Metrics";

export class ReplayHandler {

    private readonly zamza: Zamza;
    private readonly replayModel: ReplayModel;
    private readonly replayProducer: ReplayProducer;
    private readonly metrics: Metrics;
    public mirrorConsumer: MirrorConsumer | null;

    constructor(zamza: Zamza) {
        this.zamza = zamza;
        this.replayModel = zamza.mongoWrapper.getReplay();
        this.replayProducer = zamza.replayProducer;
        this.metrics = zamza.metrics;
        this.mirrorConsumer = null;
    }

    private createConsumerGroupId(): string {
        return `zamza-internal-mirror-${uuid.v4()}`;
    }

    private async messageHandle(message: KafkaMessage): Promise<any> {

        const replayMessage: ReplayMessagePayload = {
            message,
        };

        this.metrics.inc("mirrored_messages");
        await this.replayProducer.produceMessage(INTERNAL_TOPICS.REPLAY_TOPIC, undefined,
            undefined, JSON.stringify(replayMessage));
    }

    public async startReplay(topic: string, consumerGroup?: string): Promise<Replay> {

        if (this.mirrorConsumer) {
            throw new Error("Consumer is already running on this instance.");
        }

        debug("Starting replay..");

        const replay: Replay = {
            topic,
            consumerGroup: consumerGroup ? consumerGroup : this.createConsumerGroupId(),
            timestamp: Date.now(),
        };

        await this.replayModel.upsert(replay);

        this.mirrorConsumer = new MirrorConsumer(Object.assign(this.zamza.config.kafka, {
            consumer: this.zamza.cloneKafkaConsumerConfig(replay.consumerGroup, this.zamza.config.kafka),
        }), this.zamza);

        this.mirrorConsumer.start(this.messageHandle.bind(this));
        this.mirrorConsumer.adjustSubscriptions([replay.topic]);

        return replay;
    }

    public async stopReplay() {

        if (!this.mirrorConsumer) {
            throw new Error("No consumer running on this instance.");
        }

        debug("Stopping replay..");

        await this.mirrorConsumer.close();
        await this.replayModel.delete();
        this.mirrorConsumer = null;
        return true;
    }

    public async close() {

        if (this.mirrorConsumer) {
            await this.mirrorConsumer.close();
        }
    }
}
