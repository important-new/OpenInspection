// Booking #7 Sprint C-4 — embed-resize.js
// ResizeObserver + load + fallback interval to postMessage the iframe height
// to the parent so a host page can autosize without scrollbars.
(function () {
    'use strict';

    function postSize() {
        try {
            const h = Math.max(
                document.documentElement.scrollHeight,
                document.body ? document.body.scrollHeight : 0,
            );
            window.parent.postMessage({ type: 'oi-embed', kind: 'resize', height: h }, '*');
        } catch (_) { /* parent may be cross-origin and reject access — message still delivers */ }
    }

    window.addEventListener('load', postSize);
    if (window.ResizeObserver) {
        try {
            new ResizeObserver(postSize).observe(document.body);
        } catch (_) {
            window.addEventListener('resize', postSize);
            setInterval(postSize, 1000);
        }
    } else {
        window.addEventListener('resize', postSize);
        setInterval(postSize, 1000);
    }
})();
