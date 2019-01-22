import * as express from "express";

import Zamza from "../../Zamza";

const routeState = (zamza: Zamza) => {

    const router = express.Router();
    const sharedStateModel = zamza.mongoWrapper.getSharedState();

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/state",
            children: [
                "/",
                "/list",
                "/:key",
            ],
        });
    });

    router.get("/list", async (req, res) => {

        if (!res.locals.topicConfigAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed, for state",
            });
            return;
        }

        try {
            res.status(200).json(await sharedStateModel.list());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/:key", async (req, res) => {

        const {key} = req.params;

        if (!res.locals.topicConfigAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed, for state",
            });
            return;
        }

        try {
            res.status(204).json({ val: await sharedStateModel.get(key) });
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/", async (req, res) => {

        if (!req.body || !req.body.key || typeof req.body.val === "undefined") {
            res.status(400).json({
                error: "Body needs to be a valid object. {key, val}",
            });
            return;
        }

        if (!res.locals.topicConfigAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed, for state",
            });
            return;
        }

        const {
           key,
           val,
        } = req.body;

        try {
            res.status(200).json({ val: await sharedStateModel.set(key, val) });
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.delete("/:key", async (req, res) => {

        const {key} = req.params;

        if (!res.locals.topicConfigAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed, for state",
            });
            return;
        }

        try {
            await sharedStateModel.del(key);
            res.status(204).end();
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeState };
