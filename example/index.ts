import { Zamza } from "..";
import { zamzaConfig } from "./exampleConfig";

const zamza = new Zamza(zamzaConfig);
zamza
    .run()
    .catch(console.error);
