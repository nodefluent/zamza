import * as express from "express";
import Zamza from "../../Zamza";

const routeInfo = (zamza: Zamza) => {

    const router = express.Router();
    const topicConfigModel = zamza.mongoWrapper.getTopicConfig();
    const discovery = zamza.discovery;
    const consumer = zamza.consumer;
    const producer = zamza.producer;

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/info",
            children: [
                "/api/info/consumer",
                "/api/info/producer",
                "/api/info/topics",
                "/api/info/topics/discovered",
                "/api/info/topics/configured",
                "/api/info/topics/available",
            ],
        });
    });

    router.get("/consumer", async (req, res) => {

        try {
            res.status(200).json(await consumer.getKafkaStats());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/producer", async (req, res) => {

        try {
            res.status(200).json(await producer.getKafkaStats());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics", async (req, res) => {

        try {
            res.status(200).json(await consumer.getTopicMetadata());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics/discovered", (req, res) => {

        try {
            res.status(200).json(discovery.getDiscoveredTopics());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics/configured", async (req, res) => {

        try {
            res.status(200).json(await topicConfigModel.listAsTopics());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics/available", async (req, res) => {

        try {

            const configuredTopics = await topicConfigModel.listAsTopics();
            const discoveredTopics = discovery.getDiscoveredTopics();
            const availableTopics: string[] = [];

            discoveredTopics.forEach((discoveredTopic) => {
                if (configuredTopics.indexOf(discoveredTopic) === -1) {
                    availableTopics.push(discoveredTopic);
                }
            });

            res.status(200).json(availableTopics);
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeInfo };
