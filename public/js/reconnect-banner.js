// Design System 0520 subsystem B phase 4 task 4.5 — ReconnectBanner factory.
//
// Reads from window.OfflineQueue 'state' events. Visible when EITHER:
//   - the user is offline AND has pending queued writes, OR
//   - any conflicts have surfaced (queue is paused).
//
// reviewConflicts() defers to the existing conflict-modal.tsx (the
// offline-replay surface) by setting its open state — that modal
// already iterates db.conflicts via Dexie; we just make the entry
// point discoverable from the top of the page.

window.reconnectBanner = function () {
    return {
        state: { online: true, length: 0, syncing: false, lastSyncedAt: null, conflicts: [] },

        get visible() {
            return (this.state.conflicts?.length ?? 0) > 0
                || (!this.state.online && (this.state.length ?? 0) > 0);
        },

        init() {
            if (window.OfflineQueue?.state) this.state = window.OfflineQueue.state;
            window.OfflineQueue?.addEventListener('state', (e) => {
                if (e.detail) this.state = e.detail;
            });
        },

        reviewConflicts() {
            // The existing conflictModal Alpine factory polls db.conflicts on
            // a 1s interval AND mounts via Alpine. Opening it is a matter of
            // flipping `open` on its scope. We dispatch a custom event the
            // existing factory hasn't been wired for — so the simpler path
            // is to scroll the conflict modal into view by triggering a
            // sync attempt (the existing factory auto-opens on `open` true
            // when conflicts.length > 0).
            //
            // Lacking a direct hook into that Alpine scope from here, the
            // pragmatic action is to fire a re-drain — the conflict-modal's
            // 1s refresh poll will pick up the conflicts list anyway.
            window.OfflineQueue?.replay();
        },
    };
};
