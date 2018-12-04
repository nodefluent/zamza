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
    private readonly instanceId: string;
    private readonly replayModel: ReplayModel;
    private readonly replayProducer: ReplayProducer;
    private readonly metrics: Metrics;
    public mirrorConsumer: MirrorConsumer | null;
    public currentTargetTopic: string | null;
    public currentConsumerGroup: string | null;

    constructor(zamza: Zamza) {
        this.zamza = zamza;
        this.instanceId = uuid.v4();

        debug("Instance Replay ID:", this.instanceId);

        this.replayModel = zamza.mongoWrapper.getReplay();
        this.replayProducer = zamza.replayProducer;
        this.metrics = zamza.metrics;
        this.mirrorConsumer = null;
        this.currentTargetTopic = null;
        this.currentConsumerGroup = null;
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

    public isCurrentlyRunning() {
        if (this.mirrorConsumer) {
            return true;
        } else {
            return false;
        }
    }

    public dealsWithTopic(topic: string) {
        if (this.currentTargetTopic === topic) {
            return true;
        } else {
            return false;
        }
    }

    public async getCurrentReplay() {

        // clean-up
        const replayForInstanceId = await this.replayModel.getForInstanceId(this.instanceId);
        if (replayForInstanceId && !this.isCurrentlyRunning()) {
            await this.replayModel.delete(replayForInstanceId.topic);
        }

        // clean-up
        if (!replayForInstanceId && this.isCurrentlyRunning()) {
            await this.replayModel.upsert({
                instanceId: this.instanceId,
                topic: this.currentTargetTopic!,
                consumerGroup: this.currentConsumerGroup!,
                timestamp: Date.now(),
            });
        }

        return {
            instanceId: this.instanceId,
            replay: await this.replayModel.getForInstanceId(this.instanceId),
        };
    }

    public async isBeingReplayedByAnyInstance(topic: string) {
        const replay = await this.replayModel.get(topic);
        return !!replay;
    }

    public async flushall() {
        debug("Flushing all instances..");
        await this.flushone();
        await this.replayModel.truncate();
        debug("Flushed.");
        return true;
    }

    public async flushone() {
        debug("Flushing current instance");

        if (this.currentTargetTopic) {
            await this.replayModel.delete(this.currentTargetTopic);
        }

        await this.replayModel.deleteForInstanceId(this.instanceId);

        if (this.mirrorConsumer) {
            await this.mirrorConsumer.close();
        }

        this.mirrorConsumer = null;
        this.currentConsumerGroup = null;
        this.currentTargetTopic = null;

        debug("Flushed.");
        return true;
    }

    public listReplays() {
        return this.replayModel.list();
    }

    public async startReplay(topic: string, consumerGroup?: string): Promise<Replay> {

        if (this.mirrorConsumer) {
            throw new Error("Consumer is already running on this instance.");
        }

        debug("Starting replay..");

        const replay: Replay = {
            instanceId: this.instanceId,
            topic,
            consumerGroup: consumerGroup ? consumerGroup : this.createConsumerGroupId(),
            timestamp: Date.now(),
        };

        this.currentConsumerGroup = replay.consumerGroup;
        this.currentTargetTopic = topic;

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
        await this.replayModel.delete(this.currentTargetTopic!);

        this.mirrorConsumer = null;
        this.currentTargetTopic = null;
        this.currentConsumerGroup = null;

        return true;
    }

    public async close() {

        if (this.mirrorConsumer) {
            await this.mirrorConsumer.close();
        }
    }
}
