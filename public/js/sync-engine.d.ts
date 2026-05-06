export interface SyncEngineState {
    status: 'idle' | 'drainingQueue' | 'conflict' | 'failed';
    total: number;
    done: number;
    lastError: string | null;
}

export const syncEngineState: {
    get(): SyncEngineState;
    set(s: Partial<SyncEngineState>): void;
    reset(): void;
    subscribe(fn: (s: SyncEngineState) => void): () => void;
};

export function drainQueue(opts?: { fetch?: typeof fetch }): Promise<void>;
