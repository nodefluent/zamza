import * as Debug from "debug";
const debug = Debug("zamza:http");

import * as express from "express";
import * as bodyParser from "body-parser";
import * as cors from "cors";

import * as pjson from "../../package.json";

import Zamza from "../Zamza";
import { HttpConfig } from "../interfaces";
import { routeRoot, routeTopicConfigCrud, routeInfo, routeFetch } from "./routes";
import AccessControll from "./AccessControll";

const DEFAULT_PORT = 1912;

export default class HttpServer {

    private readonly config: HttpConfig;
    private readonly zamza: Zamza;
    private server: any;
    private readonly accessControll: AccessControll;

    constructor(config: HttpConfig, zamza: Zamza) {
        this.config = config;
        this.zamza = zamza;
        this.server = null;
        this.accessControll = new AccessControll(this.config.access, this.zamza.metrics);
    }

    public async start() {

        const app = express();

        app.use((req, res, next) => {

            this.zamza.metrics.inc("http_calls");
            if (req.url && req.url.startsWith("/api")) {
                this.zamza.metrics.inc("api_calls");
            }

            res.set("x-powered-by", `${pjson.name}/${pjson.version}`);
            res.locals.access = this.accessControll;
            next();
        });

        app.use(cors());
        app.use(bodyParser.json());

        app.use("/", routeRoot(this.zamza));
        app.use("/api/topic-config", routeTopicConfigCrud(this.zamza));
        app.use("/api/info", routeInfo(this.zamza));
        app.use("/api/fetch", routeFetch(this.zamza));

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
