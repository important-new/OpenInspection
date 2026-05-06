import type Dexie from 'dexie';
import type { Table } from 'dexie';

interface InspectionRow { id: string; tenantId: string; [key: string]: unknown; }
interface ResultsRow    { inspectionId: string; data: Record<string, unknown>; updatedAt: number; syncedAt: number; }
interface BaseRow       { inspectionId: string; data: Record<string, unknown>; syncedAt: number; }
interface SyncQueueRow  { id: string; op: string; payload: Record<string, unknown>; attempts: number; nextAttemptAt?: number; lastError?: string; createdAt: number; }
interface ConflictRow   { id: string; inspectionId: string; itemId: string; field: string; base: string; ours: string; theirs: string; createdAt: number; }

interface OiDb extends Dexie {
    inspections: Table<InspectionRow, string>;
    results:     Table<ResultsRow, string>;
    bases:       Table<BaseRow, string>;
    syncQueue:   Table<SyncQueueRow, string>;
    conflicts:   Table<ConflictRow, string>;
}

export const db: OiDb;
export function openDb(): Promise<OiDb>;
