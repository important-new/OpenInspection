// Design System 0520 subsystem B phase 7 task 7.1 — TeamStrip factory.
//
// Loads static roster from /api/team/members + opens
// TenantPresenceClient WS for live online/offline updates. Merges both
// sources into a `members` array consumed by the JSX template. Falls
// back to users.last_active_at "Nm ago" rendering when a member is
// offline (the touch-last-active middleware from P1 keeps this fresh).

import { formatRelativeTime } from '/js/conflict-resolver-helpers.js';

window.teamStrip = function () {
    return {
        members: [],     // [{ id, name, email, online, lastSeenRel, currentInspectionId }]
        _client: null,

        get onlineCount() {
            return this.members.filter(m => m.online).length;
        },

        async init() {
            await this.loadRoster();
            if (this.members.length > 1) {
                this.openWs();
            }
        },

        async loadRoster() {
            try {
                const r = await fetch('/api/team/members', { credentials: 'same-origin' });
                if (!r.ok) return;
                const body = await r.json();
                const rows = body?.data?.members ?? [];
                this.members = rows.map(u => ({
                    id:                  u.id,
                    name:                u.name || '',
                    email:               u.email || '',
                    online:              false,
                    lastSeenAt:          u.lastActiveAt ?? null,
                    lastSeenRel:         u.lastActiveAt ? formatRelativeTime(u.lastActiveAt) : '',
                    currentInspectionId: null,
                }));
            } catch {
                this.members = [];
            }
        },

        openWs() {
            // Eagerly bail on environments without WebSocket support (test
            // pages that pre-render via Playwright's text-only fetch).
            if (typeof WebSocket === 'undefined' || typeof window.TenantPresenceClient !== 'function') return;

            const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const wsUrl = `${proto}://${window.location.host}/api/tenant/presence/ws`;
            this._client = new window.TenantPresenceClient({
                wsUrl,
                userId:   '',  // server reads x-user-id from JWT-derived header
                name:     '',
                photoUrl: null,
            });
            this._client.addEventListener('roster', (e) => this.applyRoster(e.detail));
            this._client.connect();
        },

        applyRoster(membersMap) {
            if (!membersMap || typeof membersMap !== 'object') return;
            // membersMap is keyed by userId → { online, currentInspectionId, lastSeenAt }
            this.members = this.members.map(m => {
                const presence = membersMap[m.id];
                if (!presence) return m;
                const lastSeenAt = presence.lastSeenAt ? Math.floor(presence.lastSeenAt / 1000) : m.lastSeenAt;
                return {
                    ...m,
                    online:              !!presence.online,
                    currentInspectionId: presence.currentInspectionId ?? null,
                    lastSeenAt,
                    lastSeenRel:         lastSeenAt ? formatRelativeTime(lastSeenAt) : '',
                };
            });
        },

        destroy() {
            try { this._client?.close(); } catch { /* already closing */ }
            this._client = null;
        },
    };
};
