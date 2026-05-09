/**
 * Agent Accounts A2 — /agent-settings/profile progressive enhancement.
 *
 * Page server-renders the slug input + 3 notification toggles. JS handles:
 *   - Slug live-validation against /api/public/check/slug?value=...&namespace=agent
 *     (debounced 300ms; sets helper text + button enabled state)
 *   - Slug save -> POST /api/agent/profile { slug }
 *   - Notification toggle clicks -> POST /api/agent/profile { <field>: bool }
 *   - Sign-out button -> POST /api/auth/logout -> /login
 */
(function () {
    var SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

    function setStatus(el, text, level) {
        if (!el) return;
        el.textContent = text;
        el.classList.remove('error', 'ok');
        if (level === 'error') el.classList.add('error');
        else if (level === 'ok') el.classList.add('ok');
    }

    function debounce(fn, ms) {
        var t = null;
        return function () {
            var args = arguments;
            var ctx = this;
            if (t) clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    }

    function bindSlug() {
        var input = document.getElementById('agentSlug');
        var btn = document.getElementById('agentSlugSave');
        var status = document.getElementById('agentSlugStatus');
        if (!input || !btn) return;

        var validate = debounce(async function () {
            var raw = (input.value || '').trim().toLowerCase();
            if (!raw) {
                setStatus(status, 'Pick a slug to start sharing your referral link.', null);
                return;
            }
            if (!SLUG_RE.test(raw)) {
                setStatus(status, 'Lowercase letters, numbers, and hyphens (3-32 chars).', 'error');
                return;
            }
            setStatus(status, 'Checking availability…', null);
            try {
                var res = await fetch('/api/public/check/slug?value=' + encodeURIComponent(raw) + '&namespace=agent', {
                    credentials: 'same-origin',
                });
                var data = await res.json();
                if (data && data.data && data.data.available) {
                    setStatus(status, 'Available.', 'ok');
                } else {
                    var reason = data && data.data && data.data.reason;
                    setStatus(
                        status,
                        reason === 'reserved' ? 'That slug is reserved.' : 'That slug is already taken.',
                        'error',
                    );
                }
            } catch (e) {
                setStatus(status, 'Could not check availability — try again.', 'error');
            }
        }, 300);

        input.addEventListener('input', validate);
        input.addEventListener('blur', validate);

        btn.addEventListener('click', async function () {
            var raw = (input.value || '').trim().toLowerCase();
            if (!raw || !SLUG_RE.test(raw)) {
                setStatus(status, 'Pick a valid slug first.', 'error');
                return;
            }
            btn.disabled = true;
            setStatus(status, 'Saving…', null);
            try {
                var res = await fetch('/api/agent/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ slug: raw }),
                });
                var data = await res.json();
                if (res.ok && data && data.success) {
                    setStatus(status, 'Saved — your referral link is ready.', 'ok');
                    // Reload so the booking-link preview re-renders with the new slug.
                    // 1500ms keeps the success line on screen long enough to read.
                    setTimeout(function () { window.location.reload(); }, 1500);
                } else {
                    setStatus(status, (data && data.error && data.error.message) || 'Could not save.', 'error');
                }
            } catch (e) {
                setStatus(status, 'Network error — try again.', 'error');
            } finally {
                btn.disabled = false;
            }
        });
    }

    function bindToggles() {
        var btns = document.querySelectorAll('button[data-toggle-field]');
        for (var i = 0; i < btns.length; i++) {
            (function (btn) {
                btn.addEventListener('click', async function () {
                    var field = btn.getAttribute('data-toggle-field');
                    if (!field) return;
                    var row = btn.closest('[data-active]');
                    var current = row ? row.getAttribute('data-active') === 'true' : btn.classList.contains('on');
                    var next = !current;
                    btn.disabled = true;
                    var prevLabel = btn.textContent;
                    try {
                        var body = {};
                        body[field] = next;
                        var res = await fetch('/api/agent/profile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'same-origin',
                            body: JSON.stringify(body),
                        });
                        var data = await res.json();
                        if (res.ok && data && data.success) {
                            if (next) btn.classList.add('on'); else btn.classList.remove('on');
                            if (row) row.setAttribute('data-active', next ? 'true' : 'false');
                            var label = btn.querySelector('.toggle-state-label');
                            if (label) label.textContent = next ? 'On' : 'Off';
                            btn.setAttribute('aria-checked', next ? 'true' : 'false');
                        } else {
                            btn.textContent = prevLabel;
                        }
                    } catch (e) {
                        btn.textContent = prevLabel;
                    } finally {
                        btn.disabled = false;
                    }
                });
            })(btns[i]);
        }
    }

    function bindSignout() {
        var btn = document.getElementById('signoutBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
                .catch(function () {})
                .then(function () { window.location.href = '/login'; });
        });
    }

    function ready() {
        bindSlug();
        bindToggles();
        bindSignout();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
    } else {
        ready();
    }
})();
