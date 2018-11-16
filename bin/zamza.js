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
    debugBase.log = (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10) => {
        try {
            if(arg1 && typeof arg1 !== "string"){
                arg1 = JSON.stringify(arg1);
            }
        
            if(arg2 && typeof arg2 !== "string"){
                arg2 = JSON.stringify(arg2);
            }
        
            if(arg3 && typeof arg3 !== "string"){
                arg3 = JSON.stringify(arg3);
            }

            if(arg4 && typeof arg4 !== "string"){
                arg4 = JSON.stringify(arg4);
            }

            if(arg5 && typeof arg5 !== "string"){
                arg5 = JSON.stringify(arg5);
            }

            if(arg6 && typeof arg6 !== "string"){
                arg6 = JSON.stringify(arg6);
            }

            if(arg7 && typeof arg7 !== "string"){
                arg7 = JSON.stringify(arg7);
            }

            if(arg8 && typeof arg8 !== "string"){
                arg8 = JSON.stringify(arg8);
            }

            if(arg9 && typeof arg9 !== "string"){
                arg9 = JSON.stringify(arg9);
            }

            if(arg10 && typeof arg10 !== "string"){
                arg10 = JSON.stringify(arg10);
            }
    
            const msgs = [arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10];
            
            oldDebug(JSON.stringify({
                msg: msgs.filter(m => typeof m !== "undefined").join(" ")
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

Object.keys(process.env)
.map(key => { return {key: key, val: process.env[key]}; })
.forEach(iter => {

    switch(iter.key){

        case "ACL_DEFINITIONS":

            // ACL_DEFINITIONS="token1=topic1,topic2;token2=topic3"

            if(!options.http){
                options.http = {};
            }

            if(!options.http.access || typeof options.http.access !== "object"){
                options.http.access = {};
            }

            const multiValues = iter.val.split(";").filter((str) => !!str);
            multiValues.forEach((multiValue) => {
                const token = multiValue.split("=")[0];
                const values = multiValue.split("=")[1];
                const topics = values.split(",");

                if(!options.http.access[token]){
                    options.http.access[token] = topics;
                } else {
                    topics.forEach((topic) => {
                        options.http.access[token].push(topic);
                    });
                }
            });
        break;

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