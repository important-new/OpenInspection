/**
 * Agent Accounts A2 — /agent-dashboard progressive enhancement.
 *
 * Page is fully markup-rendered server-side; this file adds:
 *   - Collapse / expand of tenant sections (data-tenant-toggle)
 *   - Sign-out button -> POST /api/auth/logout -> /login
 *
 * Persists open/closed tenant section state in localStorage so the dashboard
 * remembers the agent's preference across reloads. Keyed by tenantId so each
 * team starts in the user's last-chosen state.
 */
(function () {
    var STORAGE_KEY = 'agent.dashboard.tenantOpen';

    function readState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            /* private mode / quota — silently noop */
        }
    }

    function applyState() {
        var state = readState();
        var sections = document.querySelectorAll('[data-tenant-section]');
        for (var i = 0; i < sections.length; i++) {
            var sec = sections[i];
            var id = sec.getAttribute('data-tenant-section');
            if (!id) continue;
            if (state[id] === false) sec.setAttribute('data-open', 'false');
            else sec.setAttribute('data-open', 'true');
        }
    }

    function bindToggles() {
        var headers = document.querySelectorAll('[data-tenant-toggle]');
        for (var i = 0; i < headers.length; i++) {
            (function (header) {
                var tenantId = header.getAttribute('data-tenant-toggle');
                if (!tenantId) return;
                var onToggle = function () {
                    var sec = header.closest('[data-tenant-section]');
                    if (!sec) return;
                    var isOpen = sec.getAttribute('data-open') !== 'false';
                    sec.setAttribute('data-open', isOpen ? 'false' : 'true');
                    var state = readState();
                    state[tenantId] = !isOpen;
                    writeState(state);
                };
                header.addEventListener('click', onToggle);
                header.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onToggle();
                    }
                });
            })(headers[i]);
        }
    }

    function bindSignout() {
        var btn = document.getElementById('signoutBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
                .catch(function () { /* fall through */ })
                .then(function () { window.location.href = '/login'; });
        });
    }

    function ready() {
        applyState();
        bindToggles();
        bindSignout();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
    } else {
        ready();
    }
})();
