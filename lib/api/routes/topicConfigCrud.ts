import * as express from "express";
import Zamza from "../../Zamza";

const routeTopicConfigCrud = (zamza: Zamza) => {

    const router = express.Router();
    const topicConfigModel = zamza.mongoWrapper.getTopicConfig();
    const keyIndexModel = zamza.mongoWrapper.getKeyIndexModel();

    router.get("/", async (req, res) => {
        res.status(200).json(await topicConfigModel.list());
    });

    router.post("/", async (req, res) => {

        if (!res.locals.access.wildcardAccessAllowedForToken(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        const { topic, cleanupPolicy, segmentMs } = req.body;
        res.status(201).json(await topicConfigModel.upsert(topic, cleanupPolicy, segmentMs));
    });

    router.put("/", async (req, res) => {

        if (!res.locals.access.wildcardAccessAllowedForToken(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        const { topic, cleanupPolicy, segmentMs } = req.body;
        res.status(200).json(await topicConfigModel.upsert(topic, cleanupPolicy, segmentMs));
    });

    router.delete("/:topic", async (req, res) => {

        if (!res.locals.access.wildcardAccessAllowedForToken(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        const topic = req.params.topic;
        await topicConfigModel.delete(topic);

        if (req.query.purge) {
            await keyIndexModel.deleteForTopic(topic);
        }

        res.status(204).end();
    });

    return router;
};

export { routeTopicConfigCrud };
