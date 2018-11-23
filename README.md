# zamza

```text
   .             Hi, I am (Gregor) Z(S)amz(s)a.                                                             
     /                                                                         
      (                     %      @                         &                 
       .                    /    ,@                       @                    
        (                  @    @                      @                       
         &               @    @                 *@@#                           
          @            @(   @        /@@@@&                                    
           *         *@@*  @@@@@@@  /@@@@@ .                                   
             (  @,      @@@#@@&@@@&/@(  @@@&*@#  &@&@@@@@@@@@@@@*@,          
              @ */@#@*@@#  @@@@@@@@@@@@@@@@ ##,  / ,*@@ @@%,@@@@@@@@@*         
              @@ @&%@%@@@@@@@@@@@@@@@%@@@@@@@/@  @@@@@@@@@@@@@@@@@@@@@@        
        .*%@@@&%@@@@#/@#%@@@@@@@@&@@@@/@@@, @@@@@@@@@@@@@@@@@@@@@@@@@@@        
              @*@@@@@@@@@@@@@@@@@@@@@@@(@@@@@@@@@@@@@%*.,@@@@@@@@@@@&,         
                @@@.&@@@&@@@@@@@@@@(@@@/* @@@@@%,*/@@@@@@@@@@@@@@@@@           
                   /@@@#@@@@@@@@@@@@@@@ .@@@@@@@@@@@,@@@@@/(       @           
                          (.@@@@@@ (#@,@@@@@@*&@@&&                            
                                     @@&@@/ &    
```

## What

Apache Kafka discovery, indexing, searches, storage, hooks and HTTP gateway.

## How

You can manage topics to be indexed on the fly via `/api/topic-config` and 
zamza will keep track of anything that goes through your Apache Kafka cluster.
It will index and store messages in MongoDB, according to the topic's `delete` or `compact` configuration. You can find and retrieve messages in milliseconds via `/api/fetch`. Zamza also allows you to register HTTP hooks to subscribe to topics, as well as HTTP calls to produce to Kafka topics.
Hooks also allow performant retries as well as replays of whole Kafka topics for specific (hook-) subscribers.

## Why

There are some tools out there that help developers to browse Kafka topics,
like `kafka-rest-ui` or `Java Kafka Tool`, however they provide a very poor experience to their users, as they either require an annoying secret management, when working with production clusters (SASL-SSL) or are just very unresponsive and slow, because they are built upon a backend that spins up kafka consumers, which fetch with timeouts.

With zamza we simply accept the fact that spinning up a consumer and searching for a given message (seeking) might be the streaming way, but its a slow and frustrating thing to do, especially if you have a lot of developers doing that at the same time. Zamza brings millisecond message for key lookups by indexing topic windows in MongoDB.

_Disclaimer: Depending on the size of your Kafka cluster (and topics..) you will need experience in scaling MongoDB._

## Requirements

* node.js >= 9.x.x (we suggest >= 10.11.x)
* Apache Kafka >= 0.11.x (we suggest >= 1.x.x)
* MongoDB >= 3.2

## Install

As simple as `yarn global add zamza`.
(_NOTE: In case you dont have yarn run `npm i -g yarn` first._)

## Run

`zamza "./baseConfig.js"`

You just have to throw in a config (JSON or JS).
[A base config is always used](bin/baseConfig.js), so you just have to overwrite
your specific requirements.

Check out `zamza -h` for other options.

## Using

Checkout the APIDOC at `http://localhost:1912/doc`.
**There will be a UI for zamza very soon! Stay frosty.**

## Metrics

You can monitor zamza via Prometheus at `http://localhost:1912/metrics`.

## Access Management

Zamza allows _fine grained_ access management with a similiar span of what Kafka ACLs allow you to do on a per topic basis.
You define tokens as keys in the configs http access object and set the topic names or special rights as string members of the key's array value. A wildcard `*` grants all rights.

e.g.

```javascript
const config = {
  http: {
    access: {
      "my-crazy-secure-token-string": [ "__delete", "__produce", "__hook", "__topic", "on-some-topic" ],
      "token-for-some-topics": [ "customers", "baskets", "orders" ],
      "token-for-admin": [ "*" ]
    }
  }
};
```

When making calls to zamza's HTTP API the token is provided in the `authorization` header.

* `*` Allows every operation
* `__topic` Is allowed to configure topics (only for provided topics)
* `__hook` Is allowed to create hooks (only for provided topics)
* `__delete` Allows deletes on topics (if no wildcard is present, only on the provided topics)
* `__produce` Allows producing messages to topic (that are provided additionally)

Be aware that the default configuration is a wildcard for everything. (Meaning no token is required).
Never expose Zamza's HTTP interface publicly.

## Using Hooks

First of all you will have to enable hooks in the config `config.hooks.enabled`.
Afterwards please make sure to create the following topics with key compaction or deletion (to your liking)
so that zamza can automatically deal with retrys and replays: `__zamza_retry_topic, __zamza_replay_topic`.
(Please do no never produce to these topics manually, they should be kept exclusive for zamza).

TODO

## Config via Environment Variables

It is possible to set a few config parameters (most in role of secrets) via environment variables.
They will always overwrite the passed configuration file.

* `MONGODB_URL="mongodb://localhost:27017"` -> turns into: `config.mongo.url = "mongodb://localhost:27017";`
* `MONGODB_USERNAME=admin` -> turns into: `config.mongo.options.user = "admin";`
* `MONGODB_PASSWORD=admin` -> turns into: `config.mongo.options.pass = "admin";`
* `MONGODB_DBNAME=zamza_prod` -> turns into: `config.mongo.options.dbName = "zamza_prod";`
* `KAFKA_BROKER_LIST=kafka-1:9093,kafka-2:9093` -> turns into: `config.kafka.consumer.noptions["metadata.broker.list"] = "kafka-1:9093";`
* `KAFKA_SSL_PASSPHRASE="123456"` -> turns into: `config.kafka.consumer.noptions["ssl.key.password"] = "123456";`
* `KAFKA_SASL_USERNAME="123456"` -> turns into: `config.kafka.consumer.noptions["sasl.username"] = "123456";`
* `KAFKA_SASL_PASSWORD="123456"` -> turns into: `config.kafka.consumer.noptions["sasl.password"] = "123456";`
* `ACL_DEFINITIONS="mytoken=topic1,topic2;othertoken=topic3" zamza -l "./config.json"` -> turns into: `config.http.access.mytoken = [ "topic1", "topic2" ];`

The kafka env values will set consumer and producer at the same time.

## Maintainer

Build with :heart: :pizza: and :coffee: by [nodefluent](https://github.com/nodefluent)
