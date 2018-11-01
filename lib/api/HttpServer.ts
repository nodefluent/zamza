
import * as Debug from "debug";
const debug = Debug("zamza:http");

import * as express from "express";
import * as bodyParser from "body-parser";
import * as cors from "cors";

import * as pjson from "../../package.json";

import Zamza from "../Zamza";
import { HttpConfig } from "../interfaces";
import { routeRoot, routeTopicConfigCrud } from "./routes";

const DEFAULT_PORT = 8044;

export default class HttpServer {

    private readonly config: HttpConfig;
    private readonly zamza: Zamza;
    private server: any;

    constructor(config: HttpConfig, zamza: Zamza) {
        this.config = config;
        this.zamza = zamza;
        this.server = null;
    }

    public async start() {

        const app = express();

        app.use((req, res, next) => {
            res.set("x-powered-by", `${pjson.name}/${pjson.version}`);
            next();
        });

        app.use(cors());
        app.use(bodyParser.json());

        app.use("/", routeRoot(this.zamza));
        app.use("/api/topic-config", routeTopicConfigCrud(this.zamza));

        this.server = await new Promise((resolve, reject) => {
            let server: any = null;
            server = app.listen(this.config.port || DEFAULT_PORT, (error: Error) => {

                if (error) {
                    return reject(error);
                }

                resolve(server);
            });
        });

        debug("Listening on port", this.config.port || DEFAULT_PORT);
        return true;
    }

    public close() {
        debug("Closing..");
        if (this.server) {
            this.server.close();
        }
    }
}
