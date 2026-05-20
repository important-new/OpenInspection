// Design System 0520 subsystem B phase 7 task 7.2 — RosterPopover factory.
//
// Subscribes to the current inspection's presence channel via the
// PresenceClient EventTarget (loaded by inspection-edit.tsx). The
// inspection id is pulled from the editor's `<body data-inspection-id>`
// attribute (set by the existing editor markup) so this factory doesn't
// need to be aware of the inspectionEditor Alpine scope.

window.rosterPopover = function () {
    return {
        open: false,
        roster: [],
        _client: null,

        async init() {
            window.addEventListener('open-roster-popover', () => { this.open = true; });
            // Eagerly subscribe so the roster is fresh when the user opens.
            // Connection is cheap (WebSocket Hibernation API on the DO side)
            // and the same WS would be opened by the future TeamBanner anyway.
            this.openWs();
        },

        close() {
            this.open = false;
        },

        openWs() {
            if (typeof WebSocket === 'undefined' || typeof window.PresenceClient !== 'function') return;

            const inspectionId =
                document.body?.dataset?.inspectionId
                ?? document.querySelector('[data-inspection-id]')?.getAttribute('data-inspection-id')
                ?? null;
            if (!inspectionId) return;

            const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const wsUrl = `${proto}://${window.location.host}/api/inspections/${inspectionId}/presence/ws`;
            this._client = new window.PresenceClient({
                wsUrl,
                userId:   '',  // identity comes from JWT-derived headers
                name:     '',
                photoUrl: null,
            });
            this._client.addEventListener('roster', (e) => {
                if (Array.isArray(e.detail)) this.roster = e.detail;
            });
            this._client.connect();
        },

        destroy() {
            try { this._client?.close(); } catch { /* already closing */ }
            this._client = null;
        },
    };
};
