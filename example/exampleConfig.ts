
const zamzaConfig = {
    kafka: {
        defaultPartitions: "auto",
        producer: {
            noptions: {
                "metadata.broker.list": "localhost:9092",
                "event_cb": false,
                "client.id": "zamza-example-client",
                // "compression.codec": "snappy",
                "api.version.request": true,
                "socket.keepalive.enable": true,
                "socket.blocking.max.ms": 100,
                "heartbeat.interval.ms": 250,
                "retry.backoff.ms": 250,
                // "security.protocol": "sasl_ssl",
                // "ssl.key.location": "/tmp/kafka-clients-key/service-client.key.pem",
                // "ssl.certificate.location": "/tmp/kafka-clients-certificate/service-client.cert.pem",
                // "ssl.ca.location": "/tmp/ca-chain-certificate/ca-chain.cert.pem",
                // "sasl.mechanisms": "PLAIN"
            },
            tconf: {
                "request.required.acks": 1,
            },
        },
        consumer: {
            noptions: {
                "metadata.broker.list": "localhost:9092",
                "group.id": "zamza-example-group",
                "event_cb": false,
                "api.version.request": true,
                "socket.keepalive.enable": true,
                "socket.blocking.max.ms": 100,
                "enable.auto.commit": false,
                "heartbeat.interval.ms": 250,
                "retry.backoff.ms": 250,
                "fetch.min.bytes": 100,
                "fetch.message.max.bytes": 3 * 1024 * 1024,
                "queued.min.messages": 100,
                "fetch.error.backoff.ms": 100,
                "queued.max.messages.kbytes": 500,
                "fetch.wait.max.ms": 1000,
                "queue.buffering.max.ms": 1000,
                "batch.num.messages": 45000,
                // "security.protocol": "sasl_ssl",
                // "ssl.key.location": "/tmp/kafka-clients-key/service-client.key.pem",
                // "ssl.certificate.location": "/tmp/kafka-clients-certificate/service-client.cert.pem",
                // "ssl.ca.location": "/tmp/ca-chain-certificate/ca-chain.cert.pem",
                // "sasl.mechanisms": "PLAIN"
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
    marshallForInvalidCharacters: false,
    discovery: {
        enabled: true,
        scanMs: 48000,
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
            token1: ["topic1", "topic2", "__hook", "__topic"],
            token2: ["topic3", "__delete", "__produce"],
            token3: "*", // any access, also allows to change topic config
        },
    },
    jobs: {
        topicConfigPollingMs: 32000,
        metadataFetcherMs: 39 * 60 * 1000,
    },
    hooks: {
        enabled: true,
        timeout: 1500,
        only: false,
        retries: 3,
        retryTimeoutMs: 1000,
        subscriptionConcurrency: 4,
        replayConcurrency: 4,
    },
};

export {
    zamzaConfig,
};
