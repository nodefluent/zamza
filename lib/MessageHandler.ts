import * as Debug from "debug";
const debug = Debug("zamza:handler");

import Zamza from "./Zamza";
import { KafkaMessage } from "sinek";

export default class MessageHandler {

    private readonly zamza: Zamza;

    constructor(zamza: Zamza) {
        this.zamza = zamza;
    }

    public async handleMessage(message: KafkaMessage): Promise<boolean> {
        // TODO: handle messages
        return true;
    }
}
