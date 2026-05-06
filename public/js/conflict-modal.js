import { db, openDb } from './db.js';
import { drainQueue } from './sync-engine.js';

// See network-pill.js for the rationale behind alpine:init registration.
function conflictModalFactory() {
    return {
        open: false,
        conflicts: [],
        index: 0,
        get current() { return this.conflicts[this.index]; },

        async init() {
            await openDb();
            const refresh = async () => {
                this.conflicts = await db.conflicts.orderBy('createdAt').toArray();
                this.open = this.conflicts.length > 0;
                if (this.index >= this.conflicts.length) this.index = 0;
            };
            refresh();
            setInterval(refresh, 1000);
        },

        async resolve(choice) {
            const cf = this.current;
            if (!cf) return;
            let chosen = cf.ours;
            if (choice === 'theirs') chosen = cf.theirs;
            else if (choice === 'edit') {
                const edited = window.prompt('Edit the merged notes:', cf.ours + '\n\n--- Theirs ---\n' + cf.theirs);
                if (edited == null) return;
                chosen = edited;
            }

            const r = await db.results.get(cf.inspectionId);
            if (r?.data?.[cf.itemId]) {
                r.data[cf.itemId][cf.field] = chosen;
                r.data[cf.itemId].updatedAt = Date.now();
                await db.results.put(r);
                const baseRow = await db.bases.get(cf.inspectionId);
                await db.syncQueue.add({
                    id: crypto.randomUUID(),
                    op: 'results.merge',
                    payload: { inspectionId: cf.inspectionId, baseSyncedAt: r.syncedAt || 0, base: baseRow?.data || {}, ours: r.data },
                    attempts: 0, createdAt: Date.now(),
                });
            }
            await db.conflicts.delete(cf.id);
            await drainQueue();
        },
    };
}

// See network-pill.js for the rationale behind this dual registration.
function registerB4Component(name, factory) {
    document.addEventListener('alpine:init', () => window.Alpine.data(name, factory));
    if (window.Alpine && typeof window.Alpine.data === 'function') {
        window.Alpine.data(name, factory);
        document.querySelectorAll(`[x-data="${name}"]`).forEach(el => {
            try { window.Alpine.destroyTree?.(el); } catch {}
            try { window.Alpine.initTree(el); } catch {}
        });
    }
}
registerB4Component('conflictModal', conflictModalFactory);
