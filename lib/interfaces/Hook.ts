export interface Hook {
    _id?: string;
    name: string;
    endpoint: string;
    authorizationHeader: string;
    authorizationValue: string;
    disabled: boolean;
    subscriptions: [ Subscription ];
    timestamp: number;
}

export interface Subscription {
    topic: string;
    ignoreReplay: boolean;
    disabled: boolean;
}
