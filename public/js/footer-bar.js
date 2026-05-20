// Design System 0520 subsystem B phase 4 task 4.4 — FooterBar factory.
//
// Reads exclusively from window.OfflineQueue's 'state' events. Three
// derived view fields:
//   - syncStatus:    online | syncing | offline
//   - lastSyncedRel: "Nm ago" relative timestamp (or '' when never)

import { formatRelativeTime } from '/js/conflict-resolver-helpers.js';

window.footerBar = function () {
    return {
        state: { online: true, length: 0, syncing: false, lastSyncedAt: null, conflicts: [] },

        get syncStatus() {
            if (!this.state.online) return 'offline';
            if (this.state.syncing) return 'syncing';
            return 'online';
        },

        get lastSyncedRel() {
            const ms = this.state.lastSyncedAt;
            if (!ms || typeof ms !== 'number') return '';
            return formatRelativeTime(Math.floor(ms / 1000));
        },

        init() {
            // Snapshot first (OfflineQueue may have already emitted before
            // we subscribed; reading state is idempotent).
            if (window.OfflineQueue?.state) {
                this.state = window.OfflineQueue.state;
            }
            window.OfflineQueue?.addEventListener('state', (e) => {
                if (e.detail) this.state = e.detail;
            });
        },
    };
};
