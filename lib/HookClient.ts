import * as Debug from "debug";
const debug = Debug("zamza:hookclient");
import * as request from "request";
import * as Bluebird from "bluebird";

import Zamza from "./Zamza";

export default class HookClient {

    private readonly zamza: Zamza;
    private calledLately: number = 0;
    private intv: any;

    constructor(zamza: Zamza) {
        this.zamza = zamza;

        this.intv = setInterval(() => {

            if (this.calledLately > 0) {
                debug("Called", this.calledLately, "hooks lately");
                this.calledLately = 0;
            }

        }, 45000);
    }

    public call(options: any, expectedStatusCode: number = 200) {
        return new Bluebird((resolve, reject) => {
            request(options, (error: Error, response: any, body: any) => {

                if (error) {
                    return reject(error);
                }

                if (expectedStatusCode !== response.statusCode) {
                    return reject(new Error(`Expected status code not matched`
                        + `${expectedStatusCode} !== ${response.statusCode}.`));
                }

                resolve({
                    status: response.statusCode,
                    headers: response.headers,
                    body,
                });
            });
        });
    }

    public async close() {

        debug("Closing..");

        if (this.intv) {
            clearInterval(this.intv);
        }
    }
}
