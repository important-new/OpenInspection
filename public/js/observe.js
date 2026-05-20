/**
 * Design System 0520 subsystem D P5.1 — observer auto-refresh factory.
 *
 * Points an iframe at `/reports/:id?observer=1` and reloads it every
 * 30 seconds by appending a cache-busting `t` query param. Cheaper
 * than poll-and-diff but good enough for the buyer/agent "watch the
 * inspection unfold" use case the observer link targets.
 */
(function () {
    function factory(inspectionId) {
        return {
            src: '',
            _timer: null,

            init() {
                this.src = `/reports/${inspectionId}?observer=1`;
                this._timer = setInterval(() => {
                    this.src = `/reports/${inspectionId}?observer=1&t=${Date.now()}`;
                }, 30_000);
                window.addEventListener('pagehide', () => {
                    if (this._timer) clearInterval(this._timer);
                });
            },
        };
    }

    if (window.Alpine?.data) window.Alpine.data('observe', factory);
    else document.addEventListener('alpine:init', () => window.Alpine.data('observe', factory));
    window.observe = factory;
})();
