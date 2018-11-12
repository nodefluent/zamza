export interface KeyIndex {
    key: number | null;
    topic: number;
    timestamp: number;
    partition: number;
    offset: number;
    keyValue: Buffer | null;
    value: Buffer | null;
    timestampValue: Buffer | null;
    deleteAt: number | null;
}
