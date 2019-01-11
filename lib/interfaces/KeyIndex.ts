export interface KeyIndex {
    key: number | null;
    timestamp: number;
    partition: number;
    offset: number;
    keyValue: Buffer | null;
    value: any;
    deleteAt: Date | null;
    fromStream: boolean;
    storedAt: number;
}
