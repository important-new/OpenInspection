/**
 * Agent Accounts A2 — /contacts Agents tab.
 *
 * Tab strip toggles between the legacy contacts table and the agent-link
 * panel. Agent panel fetches /api/agents/links and renders one row per active
 * partner with status badge (color-coded) + relative time + Revoke/Re-invite
 * action.
 */
(function () {
    function fetchJson(url, opts) {
        return (typeof window.authFetch === 'function' ? window.authFetch(url, opts) : window.fetch(url, opts || {}))
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, json: j }; }); });
    }

    function relativeTime(ts) {
        if (!ts) return '';
        var now = Date.now();
        var diff = Math.max(0, now - ts);
        var sec = Math.floor(diff / 1000);
        if (sec < 60) return 'just now';
        var min = Math.floor(sec / 60);
        if (min < 60) return min + 'm ago';
        var hr = Math.floor(min / 60);
        if (hr < 24) return hr + 'h ago';
        var day = Math.floor(hr / 24);
        if (day < 30) return day + 'd ago';
        var mo = Math.floor(day / 30);
        if (mo < 12) return mo + 'mo ago';
        var yr = Math.floor(mo / 12);
        return yr + 'y ago';
    }

    var STATUS_BADGE = {
        pending: { label: 'Pending',  cls: 'bg-amber-100 text-amber-800 border-amber-300' },
        active:  { label: 'Active',   cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
        revoked: { label: 'Revoked',  cls: 'bg-slate-100 text-slate-600 border-slate-300' },
    };

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderAgentLinks(rows) {
        var body = document.getElementById('agentLinksBody');
        if (!body) return;
        if (!rows || rows.length === 0) {
            body.innerHTML = '<tr><td colspan="4" class="px-10 py-12 text-center text-sm text-slate-400 italic">No agents linked yet. Invite one from the contacts list.</td></tr>';
            return;
        }
        body.innerHTML = rows.map(function (r) {
            var badge = STATUS_BADGE[r.status] || STATUS_BADGE.active;
            var displayName = escapeHtml(r.agentName || r.agentEmail || 'Unknown agent');
            var actionBtn;
            if (r.status === 'revoked') {
                actionBtn = '<button data-action="reinvite" data-link-id="' + escapeHtml(r.id) + '" data-email="' + escapeHtml(r.agentEmail || '') + '" class="px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100">Re-invite</button>';
            } else {
                actionBtn = '<button data-action="revoke" data-link-id="' + escapeHtml(r.id) + '" data-testid="revoke-link-' + escapeHtml(r.id) + '" class="px-3 py-1 text-xs font-bold text-rose-700 bg-rose-50 rounded hover:bg-rose-100">Revoke</button>';
            }
            return '<tr class="hover:bg-slate-50/60 transition-colors">'
                + '<td class="py-4 pl-10 pr-3 text-sm">'
                + '<div class="font-semibold text-slate-900">' + displayName + '</div>'
                + '<div class="text-xs text-slate-500">' + escapeHtml(r.agentEmail || '') + '</div>'
                + '</td>'
                + '<td class="px-8 py-4">'
                + '<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ' + badge.cls + '">' + badge.label + '</span>'
                + '</td>'
                + '<td class="px-8 py-4 text-xs text-slate-500">' + escapeHtml(relativeTime(r.createdAt)) + '</td>'
                + '<td class="pl-3 pr-10 py-4 text-right">' + actionBtn + '</td>'
                + '</tr>';
        }).join('');
    }

    async function loadAgentLinks() {
        var body = document.getElementById('agentLinksBody');
        if (!body) return;
        body.innerHTML = '<tr><td colspan="4" class="px-10 py-8 text-center text-sm text-slate-400">Loading...</td></tr>';
        try {
            var r = await fetchJson('/api/agents/links');
            if (!r.ok || !r.json || !r.json.success) {
                body.innerHTML = '<tr><td colspan="4" class="px-10 py-8 text-center text-sm text-rose-500">Failed to load agents.</td></tr>';
                return;
            }
            renderAgentLinks((r.json.data && r.json.data.links) || []);
        } catch (e) {
            body.innerHTML = '<tr><td colspan="4" class="px-10 py-8 text-center text-sm text-rose-500">Network error.</td></tr>';
        }
    }

    function activate(tab) {
        var clientsBtn = document.getElementById('contactsTabClientsBtn');
        var agentsBtn = document.getElementById('contactsTabAgentsBtn');
        var clientsPanel = document.getElementById('contactsClientsPanel');
        var agentsPanel = document.getElementById('contactsAgentsPanel');
        if (!clientsBtn || !agentsBtn || !clientsPanel || !agentsPanel) return;

        var showAgents = tab === 'agents';
        clientsBtn.setAttribute('aria-selected', showAgents ? 'false' : 'true');
        agentsBtn.setAttribute('aria-selected', showAgents ? 'true' : 'false');

        clientsBtn.classList.toggle('text-slate-700', !showAgents);
        clientsBtn.classList.toggle('text-slate-500', showAgents);
        clientsBtn.classList.toggle('border-indigo-600', !showAgents);
        clientsBtn.classList.toggle('border-transparent', showAgents);

        agentsBtn.classList.toggle('text-slate-700', showAgents);
        agentsBtn.classList.toggle('text-slate-500', !showAgents);
        agentsBtn.classList.toggle('border-indigo-600', showAgents);
        agentsBtn.classList.toggle('border-transparent', !showAgents);

        clientsPanel.hidden = showAgents;
        agentsPanel.hidden = !showAgents;

        if (showAgents) loadAgentLinks();
    }

    function bindTabs() {
        var clientsBtn = document.getElementById('contactsTabClientsBtn');
        var agentsBtn = document.getElementById('contactsTabAgentsBtn');
        if (clientsBtn) clientsBtn.addEventListener('click', function () { activate('clients'); });
        if (agentsBtn) agentsBtn.addEventListener('click', function () { activate('agents'); });
    }

    async function handleAction(linkId, action, email) {
        if (action === 'revoke') {
            try {
                var r = await fetchJson('/api/agents/' + encodeURIComponent(linkId) + '/revoke', { method: 'POST' });
                if (r.ok && r.json && r.json.success) {
                    loadAgentLinks();
                } else if (typeof window.showToast === 'function') {
                    window.showToast((r.json && r.json.error && r.json.error.message) || 'Could not revoke', false);
                }
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Network error', false);
            }
        } else if (action === 'reinvite') {
            if (!email) return;
            try {
                var r2 = await fetchJson('/api/agents/invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email }),
                });
                if (r2.ok && r2.json && r2.json.success) {
                    if (typeof window.showToast === 'function') window.showToast('Re-invite sent');
                    loadAgentLinks();
                } else if (typeof window.showToast === 'function') {
                    window.showToast((r2.json && r2.json.error && r2.json.error.message) || 'Could not re-invite', false);
                }
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Network error', false);
            }
        }
    }

    function bindActionDelegation() {
        var body = document.getElementById('agentLinksBody');
        if (!body) return;
        body.addEventListener('click', function (event) {
            var btn = event.target.closest('button[data-action]');
            if (!btn) return;
            var linkId = btn.getAttribute('data-link-id');
            var action = btn.getAttribute('data-action');
            var email = btn.getAttribute('data-email');
            if (!linkId || !action) return;
            handleAction(linkId, action, email);
        });
    }

    function ready() {
        bindTabs();
        bindActionDelegation();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
    } else {
        ready();
    }
})();
