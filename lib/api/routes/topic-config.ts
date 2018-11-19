import * as express from "express";
import * as Promise from "bluebird";
import Zamza from "../../Zamza";

const routeTopicConfig = (zamza: Zamza) => {

    const router = express.Router();
    const topicConfigModel = zamza.mongoWrapper.getTopicConfig();
    const keyIndexModel = zamza.mongoWrapper.getKeyIndexModel();

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/config",
            children: [
                "/api/config/topic",
                "/api/config/topic/many",
                "/api/config/topic/:topic",
            ],
        });
    });

    router.get("/topic", async (req, res) => {
        try {
            res.status(200).json(await topicConfigModel.list());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topic/:topic", async (req, res) => {
        try {
            const topicConfig = await topicConfigModel.get(req.params.topic);

            if (topicConfig) {
                res.status(200).json(await topicConfigModel.list());
                return;
            }

            res.status(404).json({
                error: req.params.topic + " does not exist.",
            });

        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/topic", async (req, res) => {

        if (!res.locals.access.wildcardAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        if (!req.body || !req.body.topic) {
            res.status(400).json({
                error: "Body should be a valid object, {topic, cleanupPolicy, retentionMs}",
            });
            return;
        }

        try {
            const { topic, cleanupPolicy, retentionMs } = req.body;

            const topicConfig = await topicConfigModel.get(topic);
            if (topicConfig) {
                res.status(400).json({
                    error: topic + " topic configuration already exists.",
                });
                return;
            }

            res.status(202).json(await topicConfigModel.upsert(topic, cleanupPolicy, retentionMs));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.put("/topic", async (req, res) => {

        if (!res.locals.access.wildcardAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        try {
            const { topic, cleanupPolicy, retentionMs } = req.body;
            res.status(202).json(await topicConfigModel.upsert(topic, cleanupPolicy, retentionMs));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.put("/topic/many", async (req, res) => {

        if (!res.locals.access.wildcardAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        if (!req.body || !req.body.topics || !Array.isArray(req.body.topics)) {
            res.status(400).json({
                error: "Body should be a valid object, {topics: []}",
            });
            return;
        }

        try {

            await Promise.map(req.body.topics, ((topicConfig: any) => {
                const { topic, cleanupPolicy, retentionMs } = topicConfig;
                return topicConfigModel.upsert(topic, cleanupPolicy, retentionMs);
            }), {concurrency: 1});

            res.status(200).json(await topicConfigModel.list());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.delete("/topic/:topic", async (req, res) => {

        if (!res.locals.access.wildcardAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        try {
            const topic = req.params.topic;
            await topicConfigModel.delete(topic);

            if (req.query.purge) {
                await keyIndexModel.deleteForTopic(topic);
            }

            res.status(204).end();
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeTopicConfig };
