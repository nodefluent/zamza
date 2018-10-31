import { Zamza } from "..";
import { zamzaConfig } from "./exampleConfig";

const zamza = new Zamza(zamzaConfig);
zamza
    .run()
    /* tslint:disable */
    .catch(console.error);
    /* tslint:enable */
