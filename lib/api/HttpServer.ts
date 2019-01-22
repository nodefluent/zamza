import * as Debug from "debug";
const debug = Debug("zamza:http");

import * as express from "express";
import * as bodyParser from "body-parser";
import * as cors from "cors";

import * as pjson from "../../package.json";

import Zamza from "../Zamza";
import { HttpConfig } from "../interfaces";
import { routeRoot, routeTopicConfig, routeInfo,
         routeFetch, routeProduce, routeManage,
         routeHook, routeReplay, routeState } from "./routes";

import AccessControll from "./AccessControll";

const DEFAULT_PORT = 1912;
const WARNING_LOG_MS = 1500;

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

        app.set("etag", false);

        app.use((req, res, next) => {

            const onEndOfRequest = () => {
                res.removeListener("finish", onEndOfRequest);
                res.removeListener("close", onEndOfRequest);

                const diff = Date.now() - res.locals.startTime;
                // debug(`Access-log: ${req.method} : ${req.url} => ${res.statusCode} after ${diff} ms.`);

                if (diff >= WARNING_LOG_MS) {
                    debug(`Slow request alert: ${req.method} : ${req.url} took ${diff} ms.` +
                        `Token used: ${this.accessControll.anonymiseToken(req.headers.authorization)}.`);
                }
            };

            // crawler check
            if (req.path === "/robots.txt") {
                res.status(200);
                res.set("content-type", "text/plain");
                return res.end("User-agent: *\nDisallow: /");
            }

            // dev browser check
            if (req.path === "/favicon.ico") {
                return res.status(404).end();
            }

            res.on("finish", onEndOfRequest);
            res.on("close", onEndOfRequest);

            this.zamza.metrics.inc("http_calls");
            if (req.url && req.url.startsWith("/api")) {
                this.zamza.metrics.inc("api_calls");
                debug("api call =>", req.method, ":", req.url);
            }

            res.set("x-powered-by", `${pjson.name}/${pjson.version}`);
            res.set("cache-control", "no-cache");
            res.locals.access = this.accessControll;

            next();
        });

        app.use(cors());
        app.use(bodyParser.json());

        app.use("/", routeRoot(this.zamza));

        app.use("/api/config", routeTopicConfig(this.zamza));
        app.use("/api/config", routeHook(this.zamza));
        app.use("/api/config", routeReplay(this.zamza));

        app.use("/api/info", routeInfo(this.zamza));
        app.use("/api/fetch", routeFetch(this.zamza));
        app.use("/api/produce", routeProduce(this.zamza));
        app.use("/api/manage", routeManage(this.zamza));
        app.use("/api/state", routeState(this.zamza));

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
