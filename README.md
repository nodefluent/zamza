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
* MongoDB >= 3.2 (we suggest >= 4.x)

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
* `__replay` Is allowed to configure topic replays

Be aware that the default configuration is a wildcard for everything. (Meaning no token is required).
Never expose Zamza's HTTP interface publicly.

## Getting general info about zamza and your Kafka clusters

You can get an overview of possible API actions by calling `GET /api/info`.

## Configuring Kafka topics for zamza

By default zamza, will connect and fetch some information about your Kafka cluster. 
But it wont start building indices and metadata yet. You will have to configure topics so that they will be consumed
and processed.

You can do that by providing a small configuraton in a `POST /api/config/topic` call.
You will have to provide the following information in the body `{ topic, cleanupPolicy, retentionMs? }`.

* `topic` is the name of the Kafka topic (you can fetch available topics via `GET /api/info/topics/available`)
* `cleanupPolicy` is the clean up policy of your topic (similiarly configured in the MongoDB backend of zamza)
allowed values are: `compact` (runs upserts based on you topics keys), `delete` (uses retentionMs to determine a ttl for messages),
`none` (inserts only, no ttl) or `compact_and_delete` (runs upserts with ttl on retentionMs combined)
* `retentionMs` ttl for the given messages in milliseconds (either the messages have a timestamp or the time of insertion will be used to determine when to delete a message), messages are deleted via MongoDB's document delete index

If you configure a topic, it will be consumed from earliest and stored to MongoDB depending on the given configuration by zamza.
Topics require about 1/2 the storage size in MongoDB (enable compression) that they require in Kafka.

It is also possible to deactivate persisting messages in zamza (see config file) and run in `hookOnly` mode.
It is also possible to deactivate hooks and run consumption via pagination only (see config file).

Please note that any changes on the topic-config resource will take a few seconds to be polled and applied to all zamza instances,
just like hook changes.

## Fetching a message for a certain key

If your token has access to a topic, you can find messages for keys very fast by calling `GET /:topic/find/key/:key`.

## Get a bulk of earliest messages for a topic

Very simply by calling `GET /api/fetch/:topic/range/earliest/:count`.

## Get a bulk of latest messages for a topic

Very simply by calling `GET /api/fetch/:topic/range/latest/:count`.

## Producing through zamza

It is very easy to produce Kafka messages to different topics via zamza.
Just make sure your token has the `__produce` value and the topic exists prior to producing to it.
As zamza is using auto-discovery to identify the partition count of a topic, it requires the topic to exist
beforehand and cannot create it on the fly.

Then simply make HTTP `POST /api/produce/` requests.

## Paginating through topics through zamza (without Hooks)

It is possible to paginate through topics very efficiently, by using the fetch endpoints.
Make sure your token has access rights to the specific topic and that the topic is configured
in zamza.

Then simply make HTTP `GET /:topic/paginate/stoe/:skipToIndex/:limit` requests.

Please note that this can be a bit tricky to understand at first, but to paginate efficiently with a MongoDB backend
zamza requires the last ObjectID. The correct way to start is therefore the following:

1. fetch `GET /:topic/paginate/stoe/null/100` to get the first 100 messages from `earliest` of a given topic
2. response will look like `{ results: [ {$index: "123", .. }, ..] }`
3. now for the next fetch take the $index of the last message e.g. `const lastIndex = response.results[response.results.length - 1].$index` and fetch again `GET /:topic/paginate/stoe/${lastIndex}/100` to get the next 100 messages

If you want to fetch from latest to earliest just use the other endpoint `GET /:topic/paginate/etos/null/100` schema is the same.
Please note that for zamza to provide you with the full topic data it will take some time to process the full Kafka topic after
its configuration first, before you can start to paginate through it.

## Fetching the JSON schema of a topic

If you have configured topics that are sticking to a certain JSON schema for their value payload and, which
are (as they should be..) produced with full updates of the entities only, you can use the `GET /api/info/schema/:topic/json`
endpoint to fetch the schema.

## Using Hooks

First of all you will have to enable hooks in the config `config.hooks.enabled`.
Afterwards please make sure to create the following topics with key compaction or deletion (to your liking)
so that zamza can automatically deal with retrys and replays: `__zamza_retry_topic, __zamza_replay_topic`.
(Please do no never produce to these topics manually, they should be kept exclusive for zamza).

* Each hook can subscribe to multiple topics
* If the hook http call times out (config file) or does not respond with status code 200 zamza will
produce a message to its internal zamza-retry topic after a short timeout (config file) and will run a
retry shortly after up to max retry attempts are reached (config file).
* Hooks can be removed or subscriptions changed any time, as well as topic configuration, if these are missing
when a retry or replay is processed, zamza will simply skip the retried or replayed messages
* please note that hook `name`s should be unique

* to check all configured hooks call `GET /api/config/hook`
* to create a hook call `POST /api/config/hook` with body `{name, subscriptions: [ { topic, ignoreReplay?, disabled? } ], endpoint}`
you can provide additional fields `authorizationHeader, authorizationValue, disabled` for your hook.
* you can update a configured hook by calling `PUT /api/config/hook`
* you can remove a hook by calling `DELETE /api/config/hook/name/:name`

Please note that any changes on the hook resource will take a few seconds to be polled and applied to all zamza instances,
just like topic-config changes.

## Doing topic replays for hook subscriptions

First of all ensure that you have configured a hook subscription that has no set `ignoreReplay` to `true`.
Otherwise you wont receive messages from a replay. Additionally your token will require `__replay` access
rights.

Replays work on a per instance basis, there can only be one replay per topic be active at the same time.
And there can only be one replay per instance at the same time.

Replays dont stop at some point, please ensure your Kafka consumer config is set to earliest (deafault value).
When you have reached a state of sufficient lag on the replay consumer, you can stop the the replay process.

If you are running you have to make sure to call the same instance, with start and stop orders for replays,
calling the wrong instance will result in 400 responses.

In case of restarts or crashes during (no clean SIG kills) = bad shutdowns for zamza, there are endpoints to restore
and flush the replay state. It is also possible to provide a certain consumer group again, to continue at a certain offset
on a topic, if not provided a random consumer group will be generated for each replay.

Replays work by spawning a small and fast mirror that pipes the target topic onto the internal zamza-replay Kafka topic
and running through all hook subcriptions that are not ignoring replays (config).

* To get an overview of all replays across instances call `GET /api/config/replays`.
* To check if the current instance you are calling is running a replay call `GET /api/config/replay`
* To start a new replay on an instance call `POST /api/config/replay` with the body `{ topic, consumerGroup? }`
* To check the current lag status on an instance call `GET /api/config/replay/lag`
* To stop a replay process call `DELETE /api/config/replay/:topic`
* In case you cannot start new replays due to bad shutdowns call `DELETE /api/config/replay/flushone` on the instance

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

Christian Fröhlingsdorf [@chrisfroeh](https://twitter.com/chrisfroeh)

Build with :heart: :pizza: and :coffee: by [nodefluent](https://github.com/nodefluent)
