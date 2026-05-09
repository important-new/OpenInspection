/**
 * Agent Accounts A2 — /agent-inspectors progressive enhancement.
 *
 * Card grid is server-rendered. JS handles:
 *   - Click-to-copy for the booking link buttons
 *   - Hover/focus already handled in CSS via .copy-row:hover .copy-preview
 *   - Sign-out button -> POST /api/auth/logout -> /login
 */
(function () {
    function flashCopied(btn) {
        var prev = btn.textContent;
        btn.setAttribute('data-copied', 'true');
        btn.textContent = 'Copied!';
        setTimeout(function () {
            btn.setAttribute('data-copied', 'false');
            btn.textContent = prev;
        }, 1600);
    }

    function bindCopy() {
        var btns = document.querySelectorAll('button[data-booking-url]');
        for (var i = 0; i < btns.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    var url = btn.getAttribute('data-booking-url') || '';
                    if (!url) return;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(url).then(function () {
                            flashCopied(btn);
                        }, function () {
                            // Permission denied — fall back to manual selection prompt.
                            window.prompt('Copy this booking link:', url);
                        });
                    } else {
                        window.prompt('Copy this booking link:', url);
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
        bindCopy();
        bindSignout();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
    } else {
        ready();
    }
})();
