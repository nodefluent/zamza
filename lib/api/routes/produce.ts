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

        const {
            topic,
            partition = null,
            key = null,
            value,
        } = req.body;

        const result = await producer.produceMessage(topic, partition, key, value);

        res.status(202).json({
            result,
        });
    });

    return router;
};

export { routeProduce };
