import * as express from "express";
import * as moment from "moment";

import Zamza from "../../Zamza";
import { KafkaMessage } from "sinek";

const routeManage = (zamza: Zamza) => {

    const router = express.Router();
    const keyIndexModel = zamza.mongoWrapper.getKeyIndexModel();
    const messageHandler = zamza.messageHandler;
    const producer = zamza.producer;

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/manage",
            children: [
                "/key-index",
                "/key-index/:topic/:key",
            ],
        });
    });

    router.post("/key-index", async (req, res) => {

        if (!req.body || !req.body.topic || typeof req.body.value === "undefined") {
            res.status(400).json({
                error: "Body needs to be a valid object. {topic, value}",
            });
            return;
        }

        if (!res.locals.access.topicAccessAllowedForRequest(req, req.body.topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        const {
            topic,
            partition = 0,
            offset,
            key = null,
            value,
            timestamp = moment().valueOf(),
        } = req.body;

        const kafkaMessage: KafkaMessage = {
            topic: topic as string,
            partition: partition as number,
            offset: offset as number,
            key: key as string,
            value: value as string,
        };

        (kafkaMessage as any).timestamp = timestamp;
        const result = await messageHandler.handleMessage(kafkaMessage, false);
        res.status(result ? 202 : 500).end();
    });

    router.delete("/key-index/:topic/:key/:partition", async (req, res) => {

        const {
            fromStream = false, // also allow deletion of streamed messages
            produceTombstone = false, // also produce tombstone for key on topic (throw error if topic not compacted)
        } = req.query;

        if (!res.locals.access.topicAccessAllowedForRequest(req.params.topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        if (produceTombstone) {

            const configuration = messageHandler.findConfigForTopic(req.params.topic);
            if (!configuration || configuration.cleanupPolicy !== "compact") {
                res.status(400).json({
                    error: "Cannot produce tombstone, as topic config show no 'compact' cleanup policy",
                });
                return;
            }

            await producer.produceTombstone(req.params.topic, req.params.key, req.params.partition);
        }

        await keyIndexModel.delete(req.params.topic, req.params.key, fromStream);
        res.status(204).end();
    });

    return router;
};

export { routeManage };
