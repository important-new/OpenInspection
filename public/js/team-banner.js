// Design System 0520 subsystem B phase 6 task 6.5 — TeamBanner factory.
//
// Renders only when the inspection has team_mode === true. Reads
// roster from the inspection record's leadInspectorId +
// helperInspectorIds, enriches via /api/team/members (cached on init).
// Pure static display — live "currently editing X" indicators come from
// RosterPopover (T7.2) which has its own PresenceClient WS.

window.teamBanner = function () {
    return {
        members: [],   // [{ id, name, role: 'lead'|'helper' }]
        teamMode: false,
        _editorCache: null,

        async init() {
            // Poll for the editor scope to be ready (inspection record loads
            // asynchronously in inspection-edit.js init()).
            this._timer = setInterval(() => this.refresh(), 1000);
            this.refresh();
            await this.loadTenantRoster();
        },

        get show() {
            return this.teamMode && this.members.length > 0;
        },

        async loadTenantRoster() {
            try {
                const r = await fetch('/api/team/members', { credentials: 'same-origin' });
                if (!r.ok) return;
                const body = await r.json();
                const rows = body?.data?.members ?? [];
                this._tenantRoster = rows;
                this.refresh();
            } catch { /* swallow */ }
        },

        refresh() {
            const editor = this._editor();
            if (!editor) return;
            const ins = editor.inspection;
            if (!ins || typeof ins !== 'object') return;

            this.teamMode = !!ins.teamMode;
            if (!this.teamMode) {
                this.members = [];
                return;
            }

            const leadId    = ins.leadInspectorId;
            let helperIds = [];
            try {
                const raw = ins.helperInspectorIds;
                helperIds = (typeof raw === 'string') ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
            } catch { helperIds = []; }
            if (!Array.isArray(helperIds)) helperIds = [];

            const roster = this._tenantRoster ?? [];
            const lookup = new Map(roster.map(u => [u.id, u]));

            const out = [];
            if (leadId) {
                const u = lookup.get(leadId);
                out.push({ id: leadId, name: u?.name || u?.email || leadId, role: 'lead' });
            }
            for (const hid of helperIds) {
                const u = lookup.get(hid);
                out.push({ id: hid, name: u?.name || u?.email || hid, role: 'helper' });
            }
            this.members = out;
        },

        _editor() {
            if (this._editorCache) return this._editorCache;
            const el = document.querySelector('[x-data^="inspectionEditor"]');
            if (!el || !window.Alpine?.$data) return null;
            this._editorCache = window.Alpine.$data(el);
            return this._editorCache;
        },

        destroy() {
            if (this._timer) clearInterval(this._timer);
            this._timer = null;
        },
    };
};
