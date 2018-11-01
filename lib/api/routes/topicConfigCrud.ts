import * as express from "express";
import Zamza from "../../Zamza";

const routeTopicConfigCrud = (zamza: Zamza) => {

    const router = express.Router();
    const topicConfigModel = zamza.mongoWrapper.getTopicConfig();

    router.get("/", async (req, res) => {
        res.status(200).json(await topicConfigModel.list());
    });

    router.post("/", async (req, res) => {
        const { topic, cleanupPolicy, segmentMs } = req.body;
        res.status(201).json(await topicConfigModel.upsert(topic, cleanupPolicy, segmentMs));
    });

    router.put("/", async (req, res) => {
        const { topic, cleanupPolicy, segmentMs } = req.body;
        res.status(200).json(await topicConfigModel.upsert(topic, cleanupPolicy, segmentMs));
    });

    router.delete("/:topic", async (req, res) => {
        await topicConfigModel.delete(req.params.topic);
        res.status(204).end();
    });

    return router;
};

export { routeTopicConfigCrud };