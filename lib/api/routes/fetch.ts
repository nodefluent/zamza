import * as express from "express";
import Zamza from "../../Zamza";

const routeFetch = (zamza: Zamza) => {

    const router = express.Router();
    const keyIndexModel = zamza.mongoWrapper.getKeyIndexModel();

    router.get("/:topic/info", async (req, res) => {
        res.status(504).end(); // TODO:
    });

    router.get("/:topic/find/key/:key", async (req, res) => {
        res.status(504).end(); // TODO:
    });

    router.get("/:topic/find/offset/:partition/:offset", async (req, res) => {
        res.status(504).end(); // TODO:
    });

    router.get("/:topic/find/timestamp/:valueof", async (req, res) => {
        res.status(504).end(); // TODO:
    });

    router.get("/:topic/range/key/:key", async (req, res) => {
        res.status(504).end(); // TODO:
    });

    router.get("/:topic/range/head/:count", async (req, res) => {
        res.status(504).end(); // TODO:
    });

    router.get("/:topic/range/tail/:count", async (req, res) => {
        res.status(504).end(); // TODO:
    });

    return router;
};

export { routeFetch };
