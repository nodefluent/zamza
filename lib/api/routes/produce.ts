import * as express from "express";
import Zamza from "../../Zamza";

const routeProduce = (zamza: Zamza) => {

    const router = express.Router();
    const producer = zamza.producer;

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/produce",
            children: [
                "/",
            ],
        });
    });

    router.post("/", async (req, res) => {

        if (!req.body || !req.body.topic || typeof req.body.value === "undefined") {
            res.status(400).json({
                error: "Body must be a valid JSON object, {topic, value} are required.",
            });
            return;
        }

        if (!res.locals.access.produceAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed, no produce rights",
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
            partition = null,
            key = null,
            value,
        } = req.body;

        try {
            const result = await producer.produceMessage(topic, partition, key, value);
            res.status(202).json({
                result,
            });
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeProduce };
