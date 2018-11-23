import * as express from "express";
import Zamza from "../../Zamza";

const routeHook = (zamza: Zamza) => {

    const router = express.Router();
    const hookModel = zamza.mongoWrapper.getHook();

    // root api GET is in topic-config.ts

    router.get("/hook", async (req, res) => {
        try {
            res.status(200).json(await hookModel.list());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/hook/:_id", async (req, res) => {
        try {
            const hook = await hookModel.get(req.params._id);

            if (hook) {
                res.status(200).json(hook);
                return;
            }

            res.status(404).json({
                error: "Hook does not exist.",
            });

        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/hook/name/:name", async (req, res) => {
        try {
            const hook = await hookModel.getForName(req.params.name);

            if (hook) {
                res.status(200).json(hook);
                return;
            }

            res.status(404).json({
                error: "Hook (with name) does not exist.",
            });

        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/hook", async (req, res) => {

        if (!res.locals.access.hookAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        const { name, subscriptions, endpoint } = req.body || ({} as any);
        if (!name || !subscriptions || !endpoint) {
            res.status(400).json({
                error: "Body should be a valid object, {name, endpoint, subscriptions}",
            });
            return;
        }

        if (!res.locals.access.subscriptionsAllowedForRequest(req, subscriptions)) {
            res.status(403).json({
                error: "Access not allowed for topics declared in subscriptions",
            });
            return;
        }

        try {
            const topicConfig = await hookModel.getForName(name);
            if (topicConfig) {
                res.status(400).json({
                    error: name + " hook configuration (with name) already exists.",
                });
                return;
            }

            delete req.body._id;
            res.status(200).json(await hookModel.upsert(req.body));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.put("/hook", async (req, res) => {

        if (!res.locals.access.hookAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        const { name, subscriptions, endpoint } = req.body || ({} as any);
        if (!name || !subscriptions || !endpoint) {
            res.status(400).json({
                error: "Body should be a valid object, {name, endpoint, subscriptions}",
            });
            return;
        }

        if (!res.locals.access.subscriptionsAllowedForRequest(req, subscriptions)) {
            res.status(403).json({
                error: "Access not allowed for topics declared in subscriptions",
            });
            return;
        }

        try {
            res.status(200).json(await hookModel.upsert(req.body));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.delete("/hook/:_id", async (req, res) => {

        if (!res.locals.access.hookAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        try {
            await hookModel.delete(req.params._id);
            res.status(204).end();
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeHook };
