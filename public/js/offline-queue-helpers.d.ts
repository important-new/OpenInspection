export interface QueueEntry {
    url:    string;
    method: string;
    body:   string;          // JSON-stringified payload
    [key: string]: unknown;
}

export interface QueueState {
    online:  boolean;
    length:  number;
    syncing?: boolean;
    [key: string]: unknown;
}

export function dedupePatches(queue: QueueEntry[]): QueueEntry[];
export function shouldReplay(state: QueueState | null | undefined): boolean;
export function classifyError(input: { status: number }): 'conflict' | 'fatal' | 'retry';
