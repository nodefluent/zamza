import * as express from "express";
import Zamza from "../../Zamza";

const routeRoot = (zamza: Zamza) => {

    const router = express.Router();

    router.get("/", (req, res) => {
        res.status(200).json();
    });

    return router;
};

export { routeRoot };
