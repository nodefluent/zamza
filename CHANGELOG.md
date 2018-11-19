# zamza CHANGELOG

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