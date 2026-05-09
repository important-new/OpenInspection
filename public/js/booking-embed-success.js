// Booking #7 Sprint C-4 — booking-embed-success.js
// Listens for the in-page `oi:booking-success` CustomEvent (dispatched by
// the booking form on a successful POST) and bridges it to the parent host
// page via postMessage. Host can then redirect, show a thank-you, or close
// the iframe — host's choice, not ours.
(function () {
    'use strict';

    window.addEventListener('oi:booking-success', function (e) {
        const detail = (e && e.detail) || {};
        try {
            window.parent.postMessage({
                type: 'oi-embed',
                kind: 'booking-success',
                inspectionId: detail.inspectionId || null,
            }, '*');
        } catch (_) { /* swallow cross-origin failures */ }
    });
})();
