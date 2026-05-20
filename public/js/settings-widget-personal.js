// Booking #7 Sprint C-4 — Personal /embed/book/<slug> snippet generator.
// Defaults to width:100% per frontend-design directive (host page caps).
// Re-renders on the compact toggle.
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }

    function buildSnippet(slug, host, tenant, compact) {
        const styleQs = compact ? '?style=compact' : '';
        const initialHeight = compact ? 80 : 600;
        const embedPath = '/embed/book/' + tenant + '/' + slug;
        return [
            '<!-- OpenInspection booking widget -->',
            '<iframe',
            '    src="https://' + host + embedPath + styleQs + '"',
            '    style="width:100%;border:0;display:block;"',
            '    height="' + initialHeight + '"',
            '    title="Book an inspection"',
            '    loading="lazy"',
            '></iframe>',
            '<script>',
            '(function(){',
            '    window.addEventListener("message", function (e) {',
            '        if (!e.data || e.data.type !== "oi-embed") return;',
            '        if (e.data.kind === "resize") {',
            '            var f = document.querySelector(\'iframe[src*="' + embedPath + '"]\');',
            '            if (f) f.height = e.data.height;',
            '        }',
            '    });',
            '})();',
            '<' + '/script>',
        ].join('\n');
    }

    function init() {
        const root = document.querySelector('[data-testid="settings-widget-personal-snippet"]');
        if (!root) return;
        const slug = root.dataset.slug;
        const host = root.dataset.host;
        const tenant = root.dataset.tenant;
        if (!slug || !host || !tenant) return;

        const codeEl = $('personalSnippet');
        const compactBox = $('personalSnippetCompact');
        const copyBtn = $('copyPersonalSnippetBtn');

        function render() {
            const compact = !!(compactBox && compactBox.checked);
            if (codeEl) codeEl.textContent = buildSnippet(slug, host, tenant, compact);
        }

        if (compactBox) compactBox.addEventListener('change', render);
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const text = codeEl ? codeEl.textContent : '';
                try {
                    await navigator.clipboard.writeText(text);
                    if (window.showToast) window.showToast('Snippet copied.', 'success');
                } catch (_) {
                    prompt('Copy this snippet:', text);
                }
            });
        }

        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
