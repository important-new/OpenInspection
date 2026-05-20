export interface OfflineQueueState {
    online:       boolean;
    length:       number;
    syncing:      boolean;
    lastSyncedAt: number | null;
    conflicts:    Array<{ id: string; inspectionId: string; itemId: string; field: string; [key: string]: unknown }>;
}

export interface OfflineQueueAdapter extends EventTarget {
    readonly state: OfflineQueueState;
    replay(): Promise<void>;
    enqueue(entry: { url: string; method: string; body: string; inspectionId?: string }): Promise<void>;
}

declare global {
    interface Window {
        OfflineQueue?: OfflineQueueAdapter;
    }
}

export {};
