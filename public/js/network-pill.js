import { db, openDb } from './db.js';
import { drainQueue, syncEngineState } from './sync-engine.js';
import { detectTier } from './device-tier.js';

window.networkPill = function networkPill() {
    return {
        online: navigator.onLine,
        engineStatus: 'idle',
        pendingCount: 0,
        pendingItems: [],
        popoverOpen: false,
        tier: null,

        async init() {
            await openDb();
            this.tier = await detectTier();

            window.addEventListener('online',  () => { this.online = true;  this.syncNow(); });
            window.addEventListener('offline', () => { this.online = false; });

            syncEngineState.subscribe(s => { this.engineStatus = s.status; });

            const refresh = async () => {
                this.pendingCount = await db.syncQueue.count();
                this.pendingItems = await db.syncQueue.orderBy('createdAt').toArray();
            };
            refresh();
            setInterval(refresh, 1000);

            if (this.online) this.syncNow();
        },

        get label() {
            if (!this.online) return `Offline · ${this.pendingCount} pending`;
            if (this.engineStatus === 'drainingQueue') return `Syncing ${this.pendingCount}…`;
            if (this.pendingCount > 0) return `${this.pendingCount} pending`;
            return 'Online';
        },
        get dotClass() {
            if (!this.online) return 'bg-orange-500';
            if (this.engineStatus === 'drainingQueue') return 'bg-blue-500 animate-pulse';
            return 'bg-emerald-500';
        },

        async syncNow() {
            if (!this.online) return;
            await drainQueue();
        },
        async retryOne(id) {
            await db.syncQueue.update(id, { attempts: 0, nextAttemptAt: null });
            this.syncNow();
        },
    };
};
