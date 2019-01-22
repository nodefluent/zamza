import * as express from "express";
import Zamza from "../../Zamza";

const routeFetch = (zamza: Zamza) => {

    const router = express.Router();
    const keyIndexModel = zamza.mongoWrapper.getKeyIndex();

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/fetch",
            children: [
                "/api/fetch/:topic/find/key/:key",
                "/api/fetch/:topic/find/offset/:partition/:offset",
                "/api/fetch/:topic/find/timestamp/:valueOf",
                "/api/fetch/:topic/range/key/:key/:range",
                "/api/fetch/:topic/range/latest/:count",
                "/api/fetch/:topic/range/earliest/:count",
                "/api/fetch/:topic/paginate/stoe/:skipToIndex/:limit",
                "/api/fetch/:topic/paginate/etos/:skipToIndex/:limit",
                "/api/fetch/:topic/query/find",
                "/api/fetch/:topic/query/count",
            ],
        });
    });

    router.get("/:topic/find/key/:key", async (req, res) => {

        const {topic, key} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.findMessageForKey(topic, key));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/:topic/find/offset/:partition/:offset", async (req, res) => {

        const {topic} = req.params;
        let {partition, offset} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            partition = parseInt(partition, undefined);
            offset = parseInt(offset, undefined);
            res.status(200).json(await keyIndexModel.findMessageForPartitionAndOffset(topic, partition, offset));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/:topic/find/timestamp/:valueOf", async (req, res) => {

        const {topic} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.findMessageForTimestamp(topic,
                parseInt(req.params.valueOf, undefined)));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/:topic/range/key/:key/:range", async (req, res) => {

        const {topic, key, range} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.findRangeAroundKey(topic, key,
                parseInt(range, undefined)));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/:topic/range/latest/:count", async (req, res) => {

        const {topic, count} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.getRangeFromLatest(topic,
                parseInt(count, undefined)));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/:topic/range/earliest/:count", async (req, res) => {

        const {topic, count} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.getRangeFromEarliest(topic,
                parseInt(count, undefined)));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/:topic/paginate/stoe/:skipToIndex/:limit", async (req, res) => {

        const {topic, skipToIndex = null, limit = "10"} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.paginateThroughTopic(topic,
                skipToIndex ? skipToIndex : null, parseInt(limit, undefined), 1));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/:topic/paginate/etos/:skipToIndex/:limit", async (req, res) => {

        const {topic, skipToIndex = null, limit = "10"} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.paginateThroughTopic(topic,
                skipToIndex ? skipToIndex : null, parseInt(limit, undefined), -1));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/:topic/query/find", async (req, res) => {

        const {topic} = req.params;
        const {query, limit = 512, skipToIndex = null, order = -1} = req.body;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.findForQuery(topic, query, limit, skipToIndex, order, false));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/:topic/query/count", async (req, res) => {

        const {topic} = req.params;
        const {query, limit = 512, skipToIndex = null, order = -1} = req.body;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.findForQuery(topic, query, 0, null, 0, true));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeFetch };
