import * as express from "express";
import Zamza from "../../Zamza";

const routeRoot = (zamza: Zamza) => {

    const router = express.Router();

    router.get("/", (req, res) => {
        res.status(200).json({
            Hi: "I am (Gregor) Z(S)amz(s)a.",
        });
    });

    router.get("/healthcheck", (req, res) => {
        res.status(zamza.isAlive() ? 200 : 503).end();
    });

    router.get("/ready", (req, res) => {
        res.status(zamza.isReady() ? 200 : 503).end();
    });

    router.get("/metrics", (req, res) => {
        res.status(200);
        res.set("content-type", zamza.metrics.exportType());
        res.end(zamza.metrics.exportMetrics());
    });

    return router;
};

export { routeRoot };
