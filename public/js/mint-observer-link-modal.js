/**
 * Design System 0520 subsystem D P5.2 — Alpine factory for the
 * mint-observer-link modal. Open it from anywhere by dispatching
 * `open-mint-observer` on window.
 *
 * The factory reads the active inspection id from the global
 * `window.__inspectionEditorRoot.inspectionId` set by inspectionEditor()
 * (see public/js/inspection-edit.js), so it works on any page that
 * already booted the editor — no extra wiring needed.
 */
(function () {
    function factory() {
        return {
            open: false,
            durationSeconds: 604800,    // 7 days
            generatedUrl: '',
            submitting: false,
            copied: false,
            error: '',

            openModal() {
                this.open = true;
                this.generatedUrl = '';
                this.error = '';
                this.copied = false;
            },

            close() { this.open = false; },

            async mint() {
                const id = window.__inspectionEditorRoot?.inspectionId;
                if (!id) {
                    this.error = 'No active inspection context';
                    return;
                }
                this.submitting = true;
                this.error = '';
                try {
                    const r = await fetch(`/api/inspections/${id}/observer-links`, {
                        method:  'POST',
                        headers: { 'content-type': 'application/json' },
                        body:    JSON.stringify({ durationSeconds: this.durationSeconds }),
                        credentials: 'same-origin',
                    });
                    if (!r.ok) {
                        const body = await r.json().catch(() => ({}));
                        this.error = body?.error?.message || `Mint failed (${r.status})`;
                        return;
                    }
                    const body = await r.json();
                    this.generatedUrl = body?.data?.url ?? '';
                    if (!this.generatedUrl) this.error = 'Server returned no URL';
                } catch (_e) {
                    this.error = 'Network error';
                } finally {
                    this.submitting = false;
                }
            },

            copy() {
                if (!this.generatedUrl || !navigator.clipboard?.writeText) return;
                navigator.clipboard.writeText(this.generatedUrl);
                this.copied = true;
                setTimeout(() => { this.copied = false; }, 1500);
            },
        };
    }

    if (window.Alpine?.data) window.Alpine.data('mintObserverLink', factory);
    else document.addEventListener('alpine:init', () => window.Alpine.data('mintObserverLink', factory));
    window.mintObserverLink = factory;
})();
