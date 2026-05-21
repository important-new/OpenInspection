// Design System 0520 subsystem B phase 4 task 4.2 — OfflineQueue adapter.
//
// Thin EventTarget wrapper around the EXISTING sync-engine (Dexie + the
// drainQueue/syncEngineState pair in sync-engine.js + db.js). Exposes
// the API FooterBar (T4.4) + ReconnectBanner (T4.5) expect:
//
//   window.OfflineQueue.state                     → { online, length, syncing, lastSyncedAt, conflicts }
//   window.OfflineQueue.addEventListener('state', cb)
//   window.OfflineQueue.replay()                  → triggers drainQueue
//   window.OfflineQueue.enqueue({url, method, body, inspectionId})
//
// Per feedback_design_system_0520_not_authoritative we do NOT replace
// the existing Dexie-based offline path — it already handles conflicts
// + retry + idb quota monitoring. The adapter shims its state machine
// onto the surface phase-4 consumers want.
//
// enqueue() is currently a no-op stub for the MVP because editor save
// path still uses coarse PUT /results (subsystem B P3 T3.7 will switch
// to field-level PATCH and route those through here). FooterBar /
// ReconnectBanner still work today because they only READ state.

import { db, openDb } from '/js/db.js';
import { drainQueue, syncEngineState } from '/js/sync-engine.js';

class OfflineQueueAdapter extends EventTarget {
    constructor() {
        super();
        this._lastSyncedAt = null;
        this._cachedLength = 0;
        this._cachedConflicts = [];

        // Bridge syncEngineState changes → our 'state' event.
        syncEngineState.subscribe((s) => {
            // Surface lastSyncedAt when the engine returns to idle after a drain.
            if (s.status === 'idle' && s.done > 0) {
                this._lastSyncedAt = Date.now();
            }
            this._refreshCounts().then(() => this._emit());
        });

        // Bridge connectivity changes.
        if (typeof window !== 'undefined') {
            window.addEventListener('online',  () => { this._emit(); this.replay(); });
            window.addEventListener('offline', () => { this._emit(); });
        }

        // Eager initial snapshot (after the DB is open).
        openDb().then(() => this._refreshCounts().then(() => this._emit())).catch(() => {});
    }

    get state() {
        const engine = syncEngineState.get();
        return {
            online:       (typeof navigator !== 'undefined') ? !!navigator.onLine : true,
            length:       this._cachedLength,
            syncing:      engine.status === 'drainingQueue' || engine.status === 'syncing',
            lastSyncedAt: this._lastSyncedAt,
            conflicts:    this._cachedConflicts,
        };
    }

    async replay() {
        try {
            await drainQueue();
        } catch (err) {
            // Engine logs internally; surface via state refresh only.
            // eslint-disable-next-line no-console
            console.error('[offline-queue] drain failed', err);
        }
    }

    async enqueue(/* { url, method, body, inspectionId } */) {
        // MVP stub: editor writes still go through the existing sync-engine's
        // results.merge op via inspection-edit.js debounceSave. When subsystem
        // B P3 T3.7 switches to field-level PATCH, this method routes those
        // entries into db.syncQueue alongside the existing merge ops.
        await this._refreshCounts();
        this._emit();
    }

    async _refreshCounts() {
        try {
            this._cachedLength    = await db.syncQueue.count();
            const conflictsAll    = await db.conflicts.toArray();
            this._cachedConflicts = conflictsAll;
        } catch {
            this._cachedLength    = 0;
            this._cachedConflicts = [];
        }
    }

    _emit() {
        this.dispatchEvent(new CustomEvent('state', { detail: this.state }));
    }
}

window.OfflineQueue = new OfflineQueueAdapter();
