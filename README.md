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

## Roadmap

* Fetch endpoints for KeyIndexModel
* apidoc
* docker
* consume hooks v1
* produce endpoints
* more metadata information (Zookeeper <- brokers and configs)
* consume hooks v2

## Maintainer

Build with :heart: :pizza: and :coffee: by [nodefluent](https://github.com/nodefluent)
