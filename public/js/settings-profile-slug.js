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

    const STATUS_CLASSES = {
        ok:       ' text-emerald-600 font-semibold',
        error:    ' text-rose-600 font-semibold',
        checking: ' text-ink-500',
        idle:     ' text-ink-500',
    };

    function setStatus(text, kind) {
        const el = $('profileSlugStatus');
        if (!el) return;
        el.textContent = text;
        el.className = 'mt-1 text-xs' + (STATUS_CLASSES[kind] || STATUS_CLASSES.idle);
    }

    function isValidSlug(value) {
        return value.length >= 3 && value.length <= 32 && SLUG_RE.test(value);
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
        if (!isValidSlug(value)) {
            setStatus('Invalid format. Use 3-32 lowercase letters/numbers/hyphens.', 'error');
            return;
        }
        setStatus('Checking…', 'checking');
        debounceId = setTimeout(function () { checkAvailability(value); }, DEBOUNCE_MS);
    }

    async function persistSlug(value) {
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

    function openConfirmModal(currentSlug, nextSlug, onConfirm) {
        const modal = $('profileSlugConfirm');
        const diff = $('profileSlugConfirmDiff');
        if (diff) diff.textContent = currentSlug + '  →  ' + nextSlug;
        if (!modal || typeof modal.showModal !== 'function') {
            // Fallback for environments without <dialog> support: skip the
            // modal and go straight to save. Better to lose the warning than
            // to brick the form.
            onConfirm();
            return;
        }
        const yes = $('profileSlugConfirmYes');
        const cancel = $('profileSlugConfirmCancel');
        function cleanup() {
            if (yes) yes.removeEventListener('click', onYes);
            if (cancel) cancel.removeEventListener('click', onCancel);
        }
        function onYes() {
            cleanup();
            modal.close();
            onConfirm();
        }
        function onCancel() {
            cleanup();
            modal.close();
        }
        if (yes) yes.addEventListener('click', onYes);
        if (cancel) cancel.addEventListener('click', onCancel);
        modal.showModal();
    }

    async function onSave() {
        const input = $('profileSlug');
        if (!input) return;
        const value = (input.value || '').trim();
        if (!isValidSlug(value)) {
            setStatus('Invalid format. Use 3-32 lowercase letters/numbers/hyphens.', 'error');
            return;
        }
        // The current saved slug is rendered into a data attribute on first
        // render; an empty string means the inspector has no slug yet, so a
        // first-time set is silent. A *change* of a real previously-saved slug
        // requires an explicit confirmation since the inspector may have
        // already shared the old link with leads out of band.
        const currentSlug = (input.getAttribute('data-current-slug') || '').trim();
        if (currentSlug && currentSlug !== value) {
            openConfirmModal(currentSlug, value, function () { persistSlug(value); });
            return;
        }
        if (currentSlug === value) {
            // No-op save; nothing to persist.
            setStatus('Already saved', 'ok');
            return;
        }
        await persistSlug(value);
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
