
const zamzaConfig = {
    kafka: {
        defaultPartitions: "auto",
        producer: {
            noptions: {
                "metadata.broker.list": "localhost:9092",
                "event_cb": false,
                // "compression.codec": "snappy",
                "api.version.request": true,
                "socket.keepalive.enable": true,
                "socket.blocking.max.ms": 100,
                "enable.auto.commit": false,
                "heartbeat.interval.ms": 250,
                "retry.backoff.ms": 250,
                "fetch.min.bytes": 100,
                "fetch.message.max.bytes": 2 * 1024 * 1024,
                "queued.min.messages": 100,
                "fetch.error.backoff.ms": 100,
                "queued.max.messages.kbytes": 50,
                "fetch.wait.max.ms": 1000,
                "queue.buffering.max.ms": 1000,
                "batch.num.messages": 10000,
            },
            tconf: {
                "request.required.acks": 1,
            },
        },
        consumer: {
            noptions: {
                "metadata.broker.list": "localhost:9092",
                "group.id": "zamza-example-group-1",
                "event_cb": false,
                // "compression.codec": "snappy",
                "api.version.request": true,
                "socket.keepalive.enable": true,
                "socket.blocking.max.ms": 100,
                "enable.auto.commit": false,
                "heartbeat.interval.ms": 250,
                "retry.backoff.ms": 250,
                "fetch.min.bytes": 100,
                "fetch.message.max.bytes": 2 * 1024 * 1024,
                "queued.min.messages": 100,
                "fetch.error.backoff.ms": 100,
                "queued.max.messages.kbytes": 50,
                "fetch.wait.max.ms": 1000,
                "queue.buffering.max.ms": 1000,
                "batch.num.messages": 10000,
            },
            tconf: {
                "auto.offset.reset": "earliest",
            },
        },
        batchOptions: {
            batchSize: 500,
            commitEveryNBatch: 1,
            concurrency: 1,
            commitSync: false,
            noBatchCommits: false,
        },
    },
    discovery: {
        enabled: true,
        scanMs: 15000,
        topicBlacklist: [],
    },
    mongo: {
        url: "mongodb://localhost:27017/zamza_example",
        options: {
            keepAlive: 120,
            autoIndex: true,
            reconnectTries: Number.MAX_VALUE,
            reconnectInterval: 500,
            poolSize: 20,
        },
    },
    http: {
        port: 1912,
        // access: "*" is default
        access: {
            token1: ["topic1", "topic2"],
            token2: ["topic3"],
            token3: "*", // any access, also allows to change topic config
        },
    },
    jobs: {
        cleanUpDeleteTimeoutMs: 60000,
        topicConfigPollingMs: 32000,
        metadataFetcherMs: 12 * 62000,
    },
};

export {
    zamzaConfig,
};
