import * as express from "express";
import Zamza from "../../Zamza";

const routeRoot = (zamza: Zamza) => {

    const router = express.Router();

    router.get("/", (req, res) => {
        res.json({
            Hi: "I am (Gregor) Z(S)amz(s)a.",
            parent: "/",
            self: "/",
            children: [
                "/api",
                "/doc",
                "/healthcheck",
                "/ready",
                "/metrics",
            ],
        });
    });

    router.get("/api", (req, res) => {
        res.json({
            parent: "/",
            self: "/api",
            children: [
                "/api/info",
                "/api/fetch",
                "/api/config",
                "/api/produce",
                "/api/manage",
            ],
        });
    });

    router.get("/doc", (req, res) => {
        res.end("Coming soon..");
    });

    router.get("/healthcheck", (req, res) => {
        res.status(zamza.isAlive() ? 200 : 503).end();
    });

    router.get("/ready", (req, res) => {
        res.status(zamza.isReady() ? 200 : 503).end();
    });

    router.get("/metrics", (req, res) => {
        res.set("content-type", zamza.metrics.exportType());
        res.end(zamza.metrics.exportMetrics());
    });

    return router;
};

export { routeRoot };
