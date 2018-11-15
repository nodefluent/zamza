import * as express from "express";
import Zamza from "../../Zamza";

const routeFetch = (zamza: Zamza) => {

    const router = express.Router();
    const keyIndexModel = zamza.mongoWrapper.getKeyIndexModel();

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/fetch",
            children: [
                "/api/fetch/:topic/info",
                "/api/fetch/:topic/find/key/:key",
                "/api/fetch/:topic/find/offset/:partition/:offset",
                "/api/fetch/:topic/find/timestamp/:valueOf",
                "/api/fetch/:topic/range/key/:key/:range",
                "/api/fetch/:topic/range/latest/:count",
                "/api/fetch/:topic/range/earliest/:count",
                "/api/fetch/:topic/paginate/stoe/:skip/:limit",
                "/api/fetch/:topic/paginate/etos/:skip/:limit",
            ],
        });
    });

    router.get("/:topic/info", async (req, res) => {

        const {topic} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        res.status(200).json(await keyIndexModel.getInfoForTopic(topic));
    });

    router.get("/:topic/find/key/:key", async (req, res) => {

        const {topic, key} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        res.status(200).json(await keyIndexModel.findMessageForKey(topic, key));
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

        partition = parseInt(partition, undefined);
        offset = parseInt(offset, undefined);
        res.status(200).json(await keyIndexModel.findMessageForPartitionAndOffset(topic, partition, offset));
    });

    router.get("/:topic/find/timestamp/:valueOf", async (req, res) => {

        const {topic} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        res.status(200).json(await keyIndexModel.findMessageForTimestamp(topic,
            parseInt(req.params.valueOf, undefined)));
    });

    router.get("/:topic/range/key/:key/:range", async (req, res) => {

        const {topic, key, range} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        res.status(200).json(await keyIndexModel.findRangeAroundKey(topic, key,
            parseInt(range, undefined)));
    });

    router.get("/:topic/range/latest/:count", async (req, res) => {

        const {topic, count} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        res.status(200).json(await keyIndexModel.getRangeFromLatest(topic,
            parseInt(count, undefined)));
    });

    router.get("/:topic/range/earliest/:count", async (req, res) => {

        const {topic, count} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        res.status(200).json(await keyIndexModel.getRangeFromEarliest(topic,
            parseInt(count, undefined)));
    });

    router.get("/:topic/paginate/stoe/:skip/:limit", async (req, res) => {

        const {topic, skip, limit} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        res.status(200).json(await keyIndexModel.paginateThroughTopic(topic,
            parseInt(skip, undefined), parseInt(limit, undefined), -1));
    });

    router.get("/:topic/paginate/etos/:skip/:limit", async (req, res) => {

        const {topic, skip, limit} = req.params;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        res.status(200).json(await keyIndexModel.paginateThroughTopic(topic,
            parseInt(skip, undefined), parseInt(limit, undefined), 1));
    });

    return router;
};

export { routeFetch };
