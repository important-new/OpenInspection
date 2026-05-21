// Design System 0520 subsystem B phase 3 task 3.7 — live conflict modal
// Alpine factory. Companion to the JSX in
// /src/templates/components/live-conflict-modal.tsx.
//
// Wires the `present-live-conflict` window event (dispatched by the
// editor when a PATCH returns 409) to the modal's open state, then
// drives the retry PATCH with the user's chosen value + theirs.v.

import { mergeText, formatRelativeTime, isConflictResolved } from '/js/conflict-resolver-helpers.js';

window.liveConflictModal = function () {
    return {
        open: false,
        // Conflict payload from the 409 response (echoed into a CustomEvent
        // by the inspectionEditor factory):
        //   { inspectionId, itemId, field, yours:{value,expectedVersion},
        //     theirs:{value, by?, at?, v} }
        conflict: { yours: { value: '', expectedVersion: 0 }, theirs: { value: '', v: 0 } },
        action: null,
        mergedValue: '',
        saving: false,

        get theirsRelTime() {
            const at = this.conflict?.theirs?.at;
            return (typeof at === 'number') ? formatRelativeTime(at) : 'just now';
        },

        init() {
            window.addEventListener('present-live-conflict', (e) => {
                if (!e || !e.detail) return;
                this.present(e.detail);
            });
        },

        present(conflict) {
            this.conflict = conflict;
            this.action = null;
            this.mergedValue = mergeText(
                conflict?.yours?.value ?? '',
                conflict?.theirs?.value ?? '',
            );
            this.open = true;
        },

        async resolve() {
            if (!isConflictResolved(this)) return;

            if (this.action === 'keep-theirs') {
                // No retry — adopt server value. Editor refreshes local copy
                // via the resolved event.
                this.open = false;
                window.dispatchEvent(new CustomEvent('live-conflict-resolved', {
                    detail: { ...this.conflict, action: 'keep-theirs', finalValue: this.conflict.theirs.value },
                }));
                return;
            }

            const finalValue = (this.action === 'merge') ? this.mergedValue : this.conflict.yours.value;
            const expectedVersion = this.conflict.theirs.v;
            this.saving = true;
            try {
                const r = await fetch(
                    `/api/inspections/${this.conflict.inspectionId}/items/${encodeURIComponent(this.conflict.itemId)}`,
                    {
                        method:  'PATCH',
                        headers: { 'content-type': 'application/json' },
                        body:    JSON.stringify({
                            field:           this.conflict.field,
                            value:           finalValue,
                            expectedVersion,
                        }),
                        credentials: 'same-origin',
                    },
                );
                if (r.status === 409) {
                    // Yet another concurrent write — re-present with the
                    // freshest server state.
                    const body = await r.json().catch(() => null);
                    if (body && body.error) {
                        this.present({
                            inspectionId: this.conflict.inspectionId,
                            itemId:       this.conflict.itemId,
                            field:        this.conflict.field,
                            yours:        { value: finalValue, expectedVersion },
                            theirs:       body.error.current,
                        });
                    }
                    return;
                }
                if (!r.ok) {
                    let msg = String(r.status);
                    try { const body = await r.json(); msg = body?.error?.message ?? msg; } catch { /* swallow */ }
                    if (typeof showToast === 'function') showToast(`Conflict retry failed: ${msg}`);
                    else alert(`Conflict retry failed: ${msg}`);
                    return;
                }
                this.open = false;
                window.dispatchEvent(new CustomEvent('live-conflict-resolved', {
                    detail: { ...this.conflict, action: this.action, finalValue },
                }));
            } finally {
                this.saving = false;
            }
        },
    };
};
