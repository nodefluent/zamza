# zamza CHANGELOG

## 2019-01-29, Version 0.34.0

* added new endpoint family `/api/query`
* **BREAKING** moved all query related fetch resouces from `/api/fetch` to `/api/query`
* **BREAKING** renamed endpoint `/api/fetch/:topic/query/find` to `/api/query/:topic/filter`
* added async "call-ability" for `/api/query/:topic/filter`

## 2019-01-28, Version 0.33.0

* replaced un-index query for querable tables with balroks heavy lifting logic
* **BREAKING** `/:topic/query/count` is currently disabled

## 2019-01-22, Version 0.32.2

* query find operation now supports pagination
* query find operation now supports count result
* query find operation now always dynamic limit
* query find operation now supports order parameter
* added new operation to get message count for queried messages
* updated documentation for updated query API
* **BREAKING** added 'queryable' as new field for topic configurations to manage message value storage as buffer or json on 
a per topic basis
* new API endpoint to fetch simple count `GET /metadata/:topic/count`
* new API endpoints to manage shared state `/state/..`
* added new state `enable_metadata_job` to control metadata fetching job **BREAKING** default is false
* updated documentation for new state stuff on metadata polling

## 2019-01-21, Version 0.31.0

* fixed bug where json schema message values would always be "null"
* fixed bug in marshalling, where old keys was used to access value for recursive action

## 2019-01-18, Version 0.28.0 - 0.30.0

* added new query interface to query messages on topics for sub field objects
* updated readme quick doc with new options
* added algorithm to optimize cpu usage of marshalling for topics that do not require marshalling
* added "/api/info/marshalling" endpoint

## 2019-01-18, Version 0.27.0

* removed checkKeys as it did not work after all
* added custom marshalling for message payloads to remove dots and dollar signs
* upgraded dependencies

## 2019-01-16, Version 0.26.0

* checkKeys disabled for keyindex inserts and upserts
* new endpoint to build schema on single message for topic (as it can get more detailed)

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