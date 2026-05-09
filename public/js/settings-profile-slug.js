// Booking #7 Sprint A — Settings → Profile booking slug card.
// - Debounced availability check via GET /api/public/check/slug
// - POST to /api/profile/slug to save
// - Copy-to-clipboard for the live booking link
// Plain client-side IIFE; no Alpine dependency required for this card.
(function () {
    'use strict';

    const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    const DEBOUNCE_MS = 300;

    function $(id) { return document.getElementById(id); }

    function setStatus(text, kind) {
        const el = $('profileSlugStatus');
        if (!el) return;
        el.textContent = text;
        // Reset state classes then apply the requested one. Tailwind tokens
        // chosen so the visual states match the rest of the design system.
        el.className = 'mt-1 text-xs';
        switch (kind) {
            case 'ok':       el.className += ' text-emerald-600 font-semibold'; break;
            case 'error':    el.className += ' text-rose-600 font-semibold'; break;
            case 'checking': el.className += ' text-ink-500'; break;
            default:         el.className += ' text-ink-500'; break;
        }
    }

    let debounceId = null;

    async function checkAvailability(value) {
        try {
            const url = '/api/public/check/slug?value=' + encodeURIComponent(value);
            const resp = await fetch(url, { credentials: 'same-origin' });
            const json = await resp.json();
            if (!json || !json.success || !json.data) {
                setStatus('Could not check availability', 'error');
                return;
            }
            const data = json.data;
            if (data.available) {
                setStatus('Available', 'ok');
                return;
            }
            if (data.reason === 'reserved') {
                setStatus('Reserved — please choose another', 'error');
                return;
            }
            if (data.suggestions && data.suggestions.length) {
                setStatus('Taken — try ' + data.suggestions.join(', '), 'error');
                return;
            }
            setStatus('Not available', 'error');
        } catch (err) {
            setStatus('Could not check availability', 'error');
        }
    }

    function onInput(event) {
        const value = (event.target && event.target.value || '').trim();
        if (debounceId) clearTimeout(debounceId);
        if (!value) {
            setStatus('Lowercase letters, numbers, and hyphens (3-32 chars).', 'idle');
            return;
        }
        if (value.length < 3 || value.length > 32 || !SLUG_RE.test(value)) {
            setStatus('Invalid format. Use 3-32 lowercase letters/numbers/hyphens.', 'error');
            return;
        }
        setStatus('Checking…', 'checking');
        debounceId = setTimeout(function () { checkAvailability(value); }, DEBOUNCE_MS);
    }

    async function onSave() {
        const input = $('profileSlug');
        if (!input) return;
        const value = (input.value || '').trim();
        if (!SLUG_RE.test(value) || value.length < 3 || value.length > 32) {
            setStatus('Invalid format. Use 3-32 lowercase letters/numbers/hyphens.', 'error');
            return;
        }
        const btn = $('saveProfileSlugBtn');
        if (btn) btn.disabled = true;
        try {
            const fetcher = (window.authFetch || fetch).bind(window);
            const resp = await fetcher('/api/profile/slug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ slug: value }),
            });
            const json = await resp.json();
            if (resp.ok && json && json.success) {
                setStatus('Saved', 'ok');
                // Reload so the booking link panel renders with the new slug.
                window.location.reload();
                return;
            }
            const msg = (json && json.error && json.error.message) || 'Could not save slug';
            setStatus(msg, 'error');
        } catch (err) {
            setStatus('Could not save slug', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function onCopy() {
        const code = document.querySelector('[data-testid="settings-slug-link"]');
        if (!code) return;
        const text = code.textContent || '';
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                if (window.showToast) window.showToast('Copied');
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const input = $('profileSlug');
        if (input) input.addEventListener('input', onInput);
        const saveBtn = $('saveProfileSlugBtn');
        if (saveBtn) saveBtn.addEventListener('click', onSave);
        const copyBtn = $('profileSlugCopy');
        if (copyBtn) copyBtn.addEventListener('click', onCopy);
    });
})();
