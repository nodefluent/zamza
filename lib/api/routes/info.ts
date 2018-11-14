import * as express from "express";
import Zamza from "../../Zamza";

const routeInfo = (zamza: Zamza) => {

    const router = express.Router();
    const topicConfigModel = zamza.mongoWrapper.getTopicConfig();
    const discovery = zamza.discovery;
    const consumer = zamza.consumer;

    router.get("/consumer", async (req, res) => {
        res.status(200).json(await consumer.getKafkaStats());
    });

    router.get("/topics", async (req, res) => {
        res.status(200).json(await consumer.getTopicMetadata());
    });

    router.get("/topics/discovered", (req, res) => {
        res.status(200).json(discovery.getDiscoveredTopics());
    });

    router.get("/topics/configured", async (req, res) => {
        res.status(200).json(await topicConfigModel.listAsTopics());
    });

    router.get("/topics/available", async (req, res) => {

        const configuredTopics = await topicConfigModel.listAsTopics();
        const discoveredTopics = discovery.getDiscoveredTopics();
        const availableTopics: string[] = [];

        discoveredTopics.forEach((discoveredTopic) => {
            if (configuredTopics.indexOf(discoveredTopic) === -1) {
                availableTopics.push(discoveredTopic);
            }
        });

        res.status(200).json(availableTopics);
    });

    return router;
};

export { routeInfo };
