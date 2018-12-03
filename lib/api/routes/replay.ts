import * as express from "express";
import Zamza from "../../Zamza";

const routeReplay = (zamza: Zamza) => {

    const router = express.Router();
    const replayModel = zamza.mongoWrapper.getReplay();
    const replayHandler = zamza.replayHandler;

    // root api GET is in topic-config.ts

    router.get("/replay", async (req, res) => {
        try {
            const replay = await replayModel.get();

            if (replay) {
                res.status(200).json(replay);
                return;
            }

            res.status(404).json({
                error: "Replay does not exist.",
            });

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
                error: "Body should be a valid object, {topic}",
            });
            return;
        }

        try {
            const existingReplay = await replayModel.get();
            if (existingReplay) {
                res.status(400).json({
                    error: "Replay configuration active, can only have one replay" +
                        "at a time, delete currently running one first.",
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

    router.delete("/replay", async (req, res) => {

        if (!res.locals.access.replayAccessAllowedForRequest(req)) {
            res.status(403).json({
                error: "Access not allowed",
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

    return router;
};

export { routeReplay };
