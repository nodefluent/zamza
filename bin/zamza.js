#!/usr/bin/env node

const program = require("commander");
const pjson = require("./../package.json");

program
    .usage("[options] <file ..>")
    .version(pjson.version, "-v, --version")
    .option("-p, --port <n>", "HttpServer port (optional)")
    .option("-l, --logs", "Log to stdout (optional)")
    .option("-j, --json", "Parses log output as JSON (optional)")
    .parse(process.argv);

let debugBase = null;
if(program.json){

    process.env.DEBUG_HIDE_DATE = "true";
    process.env.DEBUG_COLORS = "false";
    
    debugBase = require("debug"); //overwrite
    const oldDebug = debugBase.log;
    debugBase.log = (arg1, arg2, arg3) => {
        try {
            if(arg1 && typeof arg1 !== "string"){
                arg1 = JSON.stringify(arg1);
            }
        
            if(arg1 && typeof arg2 !== "string"){
                arg2 = JSON.stringify(arg2);
            }
        
            if(arg1 && typeof arg3 !== "string"){
                arg3 = JSON.stringify(arg3);
            }
    
            const msgs = [arg1, arg2, arg3];
            
            oldDebug(JSON.stringify({
                msg: msgs.filter(m => !!m).join(" ")
            }));
        } catch(error){
            oldDebug("Dropped log message because of error " + error.message);
        }
    }
} else {
    debugBase = require("debug"); //overwrite
}

//require here because of potential debug usage
const path = require("path");
const fs = require("fs");
const debug = debugBase("zamza:bin");

const { Zamza } = require("./../dist/index.js");

let overwritePort = false;
let port = 1912;
if(program.port){
    overwritePort = true;
    port = program.port;
}

if(program.logs){
    debugBase.enable("zamza:*");
} else {
    debugBase.enable("zamza:bin");
}

const defaultOptions = require("./baseConfig.js");

if(!program.args || !program.args.length){
    debug("No config JSON file path passed, exiting.");
    return process.exit(1);
}

let uri = program.args[0];
if(!path.isAbsolute(uri)){
    uri = path.join(__dirname, uri);
}

debug(`Loading conf: ${uri}.`);
let options = {};

try {
    options = require(uri);
    if(!options || typeof options !== "object"){
        throw new Error("Config content is not a JSON object.");
    }
} catch(error){
    debug(`Failed to load JSON config file ${error.message}.`);
    return process.exit(2);
}

const readAndDisplayBanner = () => {

    if(program.json){
        debug("Skipping banner..");
        return Promise.resolve();
    }

    return new Promise((resolve, _) => {
        fs.readFile(path.join(__dirname, "./banner.txt"), "utf8", (error, banner) => {
            if(error || !banner){
                debug("Failed to display banner :(.");
            } else {
                //allow console
                console.log(banner);
                //forbid console
            }
            resolve();
        });
    });
};

debug(`zamza in version`, pjson.version);
options = Object.assign(defaultOptions, options);

//overwrite secrets via env variables (easier for kubernetes setups)

const ACK_PREFIX = "ACK_";
Object.keys(process.env)
.map(key => { return {key: key, val: process.env[key]}; })
.forEach(iter => {

    // turn ACK_MYPREFIX=123 into http: { access: { myprefix: ["123"] } }
    if(iter.key.startsWith(ACK_PREFIX)){

        const key = iter.key.split(ACK_PREFIX)[1].toLowerCase();

        if(!options.http.access || typeof options.http.access !== "object"){
            options.http.access = {};
        }

        const iterValues = iter.val && iter.val.indexOf && iter.val.indexOf(",") !== -1 
            ? iter.val.split(",")
            : [iter.val];

        if(!options.http.access[key]){
            options.http.access[key] = iterValues;
            debug("Created access key for prefix", iterValues);
        } else {
            iterValues.forEach((value) => {
                options.http.access[key].push(value);
            });
            debug("Added token to access key for prefix", iterValues);
        }

        return;
    }

    switch(iter.key){

        case "MONGODB_URL":

            if(!options.mongo){
                options.mongo = {};
            }

            options.mongo.url = iter.val;
        break;

        case "MONGODB_USERNAME":

            if(!options.mongo){
                options.mongo = {};
            }

            if(!options.mongo.options){
                options.mongo.options = {}
            }

            options.mongo.options.user = iter.val;
        break;

        case "MONGODB_PASSWORD":

            if(!options.mongo){
                options.mongo = {};
            }

            if(!options.mongo.options){
                options.mongo.options = {}
            }

            options.mongo.options.pass = iter.val;
        break;

        case "MONGODB_DBNAME":

            if(!options.mongo){
                options.mongo = {};
            }

            if(!options.mongo.options){
                options.mongo.options = {}
            }

            options.mongo.options.dbName = iter.val;
        break;

        case "KAFKA_BROKER_LIST":
            
            if(!options.kafka){
                options.kafka = {};
            }

            if(!options.kafka.consumer){
                options.kafka.consumer = {};
            }

            if(!options.kafka.producer){
                options.kafka.producer = {};
            }

            if(!options.kafka.consumer.noptions){
                options.kafka.consumer.noptions = {};
            }

            if(!options.kafka.producer.noptions){
                options.kafka.producer.noptions = {};
            }

            options.kafka.consumer.noptions["metadata.broker.list"] = iter.val;
            options.kafka.producer.noptions["metadata.broker.list"] = iter.val;
        break;

        case "KAFKA_SSL_PASSPHRASE":

            if(!options.kafka){
                options.kafka = {};
            }

            if(!options.kafka.consumer){
                options.kafka.consumer = {};
            }

            if(!options.kafka.producer){
                options.kafka.producer = {};
            }

            if(!options.kafka.consumer.noptions){
                options.kafka.consumer.noptions = {};
            }

            if(!options.kafka.producer.noptions){
                options.kafka.producer.noptions = {};
            }

            options.kafka.consumer.noptions["ssl.key.password"] = iter.val;
            options.kafka.producer.noptions["ssl.key.password"] = iter.val;
        break;

        case "KAFKA_SASL_USERNAME":

            if(!options.kafka){
                options.kafka = {};
            }

            if(!options.kafka.consumer){
                options.kafka.consumer = {};
            }

            if(!options.kafka.producer){
                options.kafka.producer = {};
            }

            if(!options.kafka.consumer.noptions){
                options.kafka.consumer.noptions = {};
            }

            if(!options.kafka.producer.noptions){
                options.kafka.producer.noptions = {};
            }

            options.kafka.consumer.noptions["sasl.username"] = iter.val;
            options.kafka.producer.noptions["sasl.username"] = iter.val;
        break;

        case "KAFKA_SASL_PASSWORD":

            if(!options.kafka){
                options.kafka = {};
            }

            if(!options.kafka.consumer){
                options.kafka.consumer = {};
            }

            if(!options.kafka.producer){
                options.kafka.producer = {};
            }

            if(!options.kafka.consumer.noptions){
                options.kafka.consumer.noptions = {};
            }

            if(!options.kafka.producer.noptions){
                options.kafka.producer.noptions = {};
            }

            options.kafka.consumer.noptions["sasl.password"] = iter.val;
            options.kafka.producer.noptions["sasl.password"] = iter.val;
        break;

        default:
            debug("Unknown env key", PREFIX + iter.key);
        return;
    }

    debug("Env var used for config overwrite", iter.key);
});

// start server

if(overwritePort){
    options.http.port = port;
} else {
    port = options.http.port;
}

debug("Starting..");
const zamza = new Zamza(options);
zamza.run().then(() => {
    debug(`Http interface running @ ${port}.`);
    readAndDisplayBanner().then(() => {
        debug(`zamza is ready to accept connections.`);
    });
}, error => {
    debug(`Exception during start-up: ${error.message}.`);
    process.exit(3);
});