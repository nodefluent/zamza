import * as express from "express";
import Zamza from "../../Zamza";

const routeReplay = (zamza: Zamza) => {

    const router = express.Router();
    const replayHandler = zamza.replayHandler;

    // root api GET is in topic-config.ts

    router.get("/replay", async (req, res) => {
        try {
            res.status(200).json(await replayHandler.getCurrentReplay());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/replays", async (req, res) => {
        try {
            res.status(200).json(await replayHandler.listReplays());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/replay/lag", async (req, res) => {
        try {
            res.status(200).json(replayHandler.mirrorConsumer ?
                await replayHandler.mirrorConsumer.getLagStatus() : null);
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/replay/analytics", async (req, res) => {
        try {
            res.status(200).json(replayHandler.mirrorConsumer ?
                await replayHandler.mirrorConsumer.getAnalytics() : null);
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.post("/replay", async (req, res) => {

        if (!res.locals.access.replayAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        const { topic, consumerGroup } = req.body || ({} as any);
        if (!topic) {
            res.status(400).json({
                error: "Body should be a valid object, {topic, consumerGroup?}",
            });
            return;
        }

        if (replayHandler.isCurrentlyRunning()) {
            res.status(400).json({
                error: "Replay configuration active, can only have one replay" +
                    "at a time, delete currently running one first.",
            });
            return;
        }

        try {
            const existingReplay = await replayHandler.isBeingReplayedByAnyInstance(topic);
            if (existingReplay) {
                res.status(400).json({
                    error: "Replay configuration active, can only have one replay" +
                        " per topic at a time, delete currently running one first.",
                });
                return;
            }

            const result = await replayHandler.startReplay(topic, consumerGroup);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.delete("/replay/:topic", async (req, res) => {

        if (!res.locals.access.replayAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        if (!replayHandler.dealsWithTopic(req.params.topic)) {
            res.status(400).json({
                error: "This instance does not deal with the provided topic. It deals with: " +
                    replayHandler.currentTargetTopic,
            });
            return;
        }

        try {
            await replayHandler.stopReplay();
            res.status(204).end();
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.delete("/replay/flushall", async (req, res) => {

        if (!res.locals.access.replayAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        try {
            await replayHandler.flushall();
            res.status(204).end();
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.delete("/replay/flushone", async (req, res) => {

        if (!res.locals.access.replayAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
            });
            return;
        }

        try {
            await replayHandler.flushone();
            res.status(204).end();
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeReplay };
