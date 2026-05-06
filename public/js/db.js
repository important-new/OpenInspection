/**
 * B4 — Dexie-backed offline IndexedDB. 5 stores per spec §3.1.
 * Loaded as ES module by every authenticated page that touches inspections.
 *
 * Browser loading: import via importmap that maps 'dexie' → '/vendor/dexie.mjs'
 * (set up in T5.6 main-layout). In vitest, the npm 'dexie' package resolves
 * directly from node_modules — no additional config needed.
 */
import Dexie from 'dexie';

export const db = new Dexie('oi_offline');

db.version(1).stores({
    inspections: 'id, tenantId, fetchedAt',
    results:     'inspectionId, updatedAt, syncedAt',
    bases:       'inspectionId, syncedAt',
    syncQueue:   'id, op, createdAt',
    conflicts:   'id, inspectionId, createdAt',
});

let opened = false;
export async function openDb() {
    if (opened) return db;
    await db.open();
    await migrateLegacyPhotoQueue();
    opened = true;
    return db;
}

/**
 * One-shot migration from the Phase O `oi_pending_photos` IndexedDB
 * (raw IDB used by form-renderer.js before B4). Read all rows, insert
 * them as `photo.upload` ops in syncQueue, then delete the old DB.
 * Idempotent — safe to call repeatedly; no-ops if old DB is missing.
 */
async function migrateLegacyPhotoQueue() {
    if (typeof indexedDB === 'undefined') return;
    let openReq;
    try { openReq = indexedDB.open('oi_pending_photos', 1); } catch { return; }
    const oldDb = await new Promise(resolve => {
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror   = () => resolve(null);
        openReq.onupgradeneeded = () => {
            openReq.transaction?.abort();
            resolve(null);
        };
    });
    if (!oldDb) return;

    let rows = [];
    try {
        rows = await new Promise((resolve, reject) => {
            const tx = oldDb.transaction('queue', 'readonly');
            const req = tx.objectStore('queue').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror   = () => reject(req.error);
        });
    } catch { rows = []; }
    oldDb.close();

    if (rows.length > 0) {
        await db.syncQueue.bulkPut(rows.map(r => ({
            id: r.id || crypto.randomUUID(),
            op: 'photo.upload',
            payload: { inspectionId: r.inspectionId, itemId: r.itemId, blob: r.blob },
            attempts: 0,
            createdAt: Date.now(),
        })));
    }

    indexedDB.deleteDatabase('oi_pending_photos');
}
