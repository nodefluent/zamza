export interface KeyIndex {
    key: number | null;
    timestamp: number;
    partition: number;
    offset: number;
    keyValue: Buffer | null;
    value: Buffer | null;
    timestampValue: Buffer | null;
    deleteAt: number | null;
    fromStream: boolean;
    storedAt: number;
}
