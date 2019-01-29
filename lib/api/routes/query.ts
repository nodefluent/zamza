import * as express from "express";
import Zamza from "../../Zamza";

const routeQuery = (zamza: Zamza) => {

    const router = express.Router();
    const keyIndexModel = zamza.mongoWrapper.getKeyIndex();
    const balrok = zamza.mongoWrapper.balrok;

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/query",
            children: [
                "/api/query/queries",
                "/api/query/abort/:cacheKey",
                "/api/query/results/:cacheKey",
                "/api/query/:topic/filter",
                "/api/query/:topic/reduce",
                "/api/query/:topic/map",
                "/api/query/:topic/count",
            ],
        });
    });

    router.get("/queries", (req, res) => {
        try {
            res.status(200).json(balrok.getRunningQueries());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.delete("/abort/:cacheKey", async (req, res) => {
        try {
            await balrok.deleteCacheKeyResult(req.params.cacheKey);
            res.status(204).end();
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/results/:cacheKey", async (req, res) => {
        try {

            const results = await keyIndexModel
                .getResultsForQueryWithCacheKey(parseInt(req.params.cacheKey, undefined));

            if (results === null) {
                res.status(202).end();
            } else {
                res.status(200).json(results);
            }
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/:topic/filter", async (req, res) => {

        const {topic} = req.params;
        const {query, limit = null, skipToIndex = null, order = -1, async = false} = req.body;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(200).json(await keyIndexModel.filterForQuery(topic, query, limit, skipToIndex, order, async));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/:topic/reduce", async (req, res) => {

        const {topic} = req.params;
        const {query, limit = 512, skipToIndex = null, order = -1} = req.body;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(405).json({
                error: "Not implemented",
            });
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/:topic/map", async (req, res) => {

        const {topic} = req.params;
        const {query, limit = 512, skipToIndex = null, order = -1} = req.body;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(405).json({
                error: "Not implemented",
            });
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/:topic/count", async (req, res) => {

        const {topic} = req.params;
        const {query, limit = 512, skipToIndex = null, order = -1} = req.body;

        if (!res.locals.access.topicAccessAllowedForRequest(req, topic)) {
            res.status(403).json({
                error: "Access not allowed, for this topic",
            });
            return;
        }

        try {
            res.status(405).json({
                error: "Not implemented",
            });
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeQuery };
