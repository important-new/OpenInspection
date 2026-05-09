// Booking #7 Sprint C-4 — booking-embed-form.js
// Minimal form submitter for the iframe-friendly /embed/book/<slug> page.
// Posts JSON to /api/public/book and dispatches `oi:booking-success` on a
// 2xx response so booking-embed-success.js can postMessage the parent.
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }

    function setStatus(el, text, kind) {
        if (!el) return;
        el.textContent = text;
        el.className = 'embed-status' + (kind ? ' embed-status--' + kind : '');
    }

    async function submit(e) {
        e.preventDefault();
        const form = e.currentTarget;
        const status = $('embedStatus');
        const button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        setStatus(status, 'Submitting...', '');

        const fd = new FormData(form);
        const body = {
            address: fd.get('address') || '',
            clientName: fd.get('clientName') || '',
            clientEmail: fd.get('clientEmail') || '',
            date: fd.get('date') || '',
            // Embed defaults to morning; host can pre-fill if needed by hidden input.
            timeSlot: fd.get('timeSlot') || 'morning',
            inspectorId: form.dataset.inspectorId || fd.get('inspectorId') || undefined,
        };
        const turnstileToken = fd.get('cf-turnstile-response');
        if (turnstileToken) body.turnstileToken = turnstileToken;

        try {
            const resp = await fetch('/api/public/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await resp.json();
            if (!resp.ok || !json.success) {
                const message = (json && json.error && json.error.message) || 'Booking failed';
                setStatus(status, message, 'error');
                return;
            }
            const inspectionId = json.data && (json.data.id || json.data.inspectionId) || null;
            setStatus(status, 'Booked. Check your email for confirmation.', 'ok');
            window.dispatchEvent(new CustomEvent('oi:booking-success', { detail: { inspectionId } }));
            form.reset();
        } catch (err) {
            setStatus(status, 'Network error. Try again.', 'error');
        } finally {
            if (button) button.disabled = false;
        }
    }

    function init() {
        const form = document.getElementById('embedBookingForm');
        if (form) form.addEventListener('submit', submit);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
