import * as express from "express";
import Zamza from "../../Zamza";

const routeInfo = (zamza: Zamza) => {

    const router = express.Router();
    const topicConfigModel = zamza.mongoWrapper.getTopicConfig();
    const topicMetadataModel = zamza.mongoWrapper.getTopicMetadata();
    const keyIndexModel = zamza.mongoWrapper.getKeyIndex();
    const messageHandler = zamza.messageHandler;
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

                "/api/info/topics/discovered",
                "/api/info/topics/configured",
                "/api/info/topics/available",
                "/api/info/topics",
                "/api/info/topics/describe/:topic",

                "/api/info/metadata",
                "/api/info/metadata/:topic",

                "/api/info/schema/:topic/json",
            ],
        });
    });

    router.get("/metadata", async (req, res) => {

        try {
            res.status(200).json(await topicMetadataModel.list());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/metadata/:topic", async (req, res) => {

        const {topic} = req.params;

        try {

            const topicConfig = messageHandler.findConfigForTopic(topic);
            if (!topicConfig) {
                res.status(400).json({
                    error: "Topic metadata can only be provided for configured topics." +
                        " Please wait a few seconds after configuring a topic.",
                });
                return;
            }

            const topicMetadata = await topicMetadataModel.get(topic);
            if (!topicMetadata) {
                res.status(200).json({
                    info: "Try again soon, topic metadata is still being processed.",
                });
            } else {
                res.status(200).json(topicMetadata);
            }
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
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

    router.get("/topics", (req, res) => {

        try {
            res.status(200).json(discovery.getMetadata());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics/describe/:topic", (req, res) => {

        try {
            res.status(200).json(discovery.getMetadataForTopic(req.params.topic));
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

    router.get("/schema/:topic/json", async (req, res) => {

        try {

            const topic = req.params.topic;

            const topicConfig = messageHandler.findConfigForTopic(topic);
            if (!topicConfig) {
                res.status(400).json({
                    error: "Topic metadata (schema) can only be provided for configured topics." +
                        " Please wait a few seconds after configuring a topic.",
                });
                return;
            }

            const schema = await keyIndexModel.analyseJSONSchema(topic);
            res.status(200).json({ topic, schema });
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeInfo };
