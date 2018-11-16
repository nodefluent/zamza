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

As simple as `npm i -g zamza`.

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

## Config via Environment Variables

It is possible to set a few config parameters (most in role of secrets) via environment variables.
They will always overwrite the passed configuration file.

* `ZAMZA_MONGODB_URL="mongodb://localhost:27017"` -> turns into: `config.mongo.url = "mongodb://localhost:27017";`
* `ZAMZA_MONGODB_USERNAME=admin` -> turns into: `config.mongo.options.user = "admin";`
* `ZAMZA_MONGODB_PASSWORD=admin` -> turns into: `config.mongo.options.pass = "admin";`
* `ZAMZA_MONGODB_DBNAME=zamza_prod` -> turns into: `config.mongo.options.dbName = "zamza_prod";`
* `ZAMZA_KAFKA_BROKER_LIST=kafka-1:9093,kafka-2:9093` -> turns into: `config.kafka.consumer.noptions["metadata.broker.list"] = "kafka-1:9093";`
* `ZAMZA_KAFKA_SSL_PASSPHRASE="123456"` -> turns into: `config.kafka.consumer.noptions["ssl.key.password"] = "123456";`
* `ZAMZA_KAFKA_SASL_USERNAME="123456"` -> turns into: `config.kafka.consumer.noptions["sasl.username"] = "123456";`
* `ZAMZA_KAFKA_SASL_PASSWORD="123456"` -> turns into: `config.kafka.consumer.noptions["sasl.password"] = "123456";`
* `ZAMZA_ACK_MYTOKEN=topic1,topic2 zamza -l "./config.json"` -> turns into: `config.http.access.mytoken = [ "topic1", "topic2" ];`

The kafka env values will set consumer and producer at the same time.

## Roadmap

* apidoc
* consume hooks v1
* more metadata information (Zookeeper <- brokers and configs)
* consume hooks v2

## Maintainer

Build with :heart: :pizza: and :coffee: by [nodefluent](https://github.com/nodefluent)
