# zamza CHANGELOG

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