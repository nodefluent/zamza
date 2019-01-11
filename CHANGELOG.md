# zamza CHANGELOG

## 2019-01-11, Version 0.25.0

* fixed multiple bugs in LockModel
* fixed bug in KeyIndexModel, as exireAfterSeconds requires 'Date' and will not work on 'Number'
* **BREAKING** storing message values now as 'Mixed' meaning you can store and retrieve JSON objects, directly
this will allow to access and search through messages directly
* **BREAKING** removed timestampValue field to safe some storage, if message is missing a timestamp field now,
the time of insertion will be used instead
* upgraded dependencies

## 2018-12-04, Version 0.24.0-0.24.1

* **BREAKING** put earliest and latest in correct order (was the other way around)
* added hookmodel to manage http subscriptions
* added /api/config/hook endpoints
* providing better kafka example config
* fine grained access rights for produce, delete, topicConfig and hook operations
* removed per topic metrics
* added HookDealer to bring subscription processing to message handler
* added internal topics to handle retries and replays for hooks
* added new endpoint to fetch analysed schemas for json message values /api/info/schema/:topic/json
* increasesd lately log intervals for consumer and producer
* added HookClient to process http requests of hooks
* added hooks only mode
* made some precautions to protect zamza internal topics
* different additional consumer and producer types to handle hook replays and retries
* handling of hooks in hookdealer
* handling of retries in hookdealer
* consumer and producer info endpoints for additional clients
* new endpoints /api/config/replay to use ReplayHandler (single instance based)
* added replay logic to HookDealer
* enabling lag analytics for main kafka consumer and exposing through info api
* adjusted ReplayHandler logic to work on a topic per instance basis
* added endpoints to work with ReplayHandler
* added lag analytics for mirror consumer on replays
* added new topic-config cleanupPolicy type compact_and_delete
* updated dependencies
* updated readme with a short documentation on API resources
* added slow request log for requests above 1.5 seconds

## 2018-11-22, Version 0.23.0

* **BREAKING** changed key index schema from single collection to collection per topic
* **BREAKING** changed pagination to run via _id native index instead of skip
* fixed metadata fetching in consumer and producer
* now continously fetching metadata in discovery
* changed partition counting from aggregation to single counts per partition 

## 2018-11-20, Version 0.21.0

* fixed bug in lock model delete

## 2018-11-20, Version 0.20.0

* removing locks after metadatafetcher is done
* removed cleanupdeletejob and replaced with native mongodb index ttl
* fixed old name in api description
* upgraded mongoose dependency

## 2018-11-20, Version 0.19.0

* **BREAKING** moved /api/fetch/info to /api/info/metadata
* added LockModel to handle job lockings
* added TopicMetadataModel to store fetched topic metadatas
* /api/info/metadata will now only serve cached metadata from mongo
* added MongoFetcher as new job to handle contant updating of topic metadata in background

## 2018-11-19, Version 0.17.0-0.18.0

* fixing bug in message handle on bad message keys

## 2018-11-19, Version 0.16.0

* beautify aggregated partitions for fetch topic info

## 2018-11-19, Version 0.15.0

* adjusted key index model indices once again
* pagination limit "limit"

## 2018-11-19, Version 0.14.0

* fixed bug in metrics, gauge prefixing
* changed topic fetch info from distinct to custom aggregate count query
* added compound indices for key index model

## 2018-11-19, Version 0.13.0

* advanced handling of MongoDB reconnection

## 2018-11-19, Version 0.12.0

* fixed bug in topic with wildcard access controll
* now retrying kafka messages on errors endlessly with increasing cooldown on attempts

## 2018-11-19, Version 0.11.1

* fixed bug in wildcard access controll

## 2018-11-19, Version 0.11.0

* added more endpoints for topic configuration (/many and /:topic)
* POST now rejects if configuration already exists
* correct error handling for all endpoints
* now logging anonymised version of access configuration, for debug convenience
* **BREAKING** moved /api/topic-config to /api/config/topics
* focussing on `yarn` as package manager only

## 2018-11-16, Version 0.10.0

* small fixes

## 2018-11-16, Version 0.9.0

* migrated according to kafka docus from "segementMs" to "retentionMs" for topic-configurations
* not logging tokens on bad access anymore
* simple access log

## 2018-11-16, Version 0.8.0

* acl env variable overwrite, can now be done without exposing secrets in the key

## 2018-11-16, Version 0.7.0

* handling tombstone messages as deletes on messageHandler
* removed env variable prefix

## 2018-11-16, Version 0.6.0

* handle message now respects tombstones on compact topics
* /api/manage endpoints to create and delete keyindexes
* produce endpoint now respects topic access tokens
* advanced env variable overwrites for config (deploy secrets)

## 2018-11-15, Version 0.5.0

* convenience root endpoints
* docker stuff
* implemented fetch logic for keyIndexModel
* added produce endpoints
* added producer
* fixed bugs
* added performance metrics for inserts and upserts
* now using timestamp from message to determine ttl, if available

## 2018-11-14, Version 0.4.0

* bootstrapping done
* /bin deployment
* fetch endpoints
* readme

## 2018-11-13, Version 0.3.0

* Initial release with changelog