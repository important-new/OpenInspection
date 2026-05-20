// Design System 0520 subsystem B phase 6 task 6.2 — ProgressStrip factory.
//
// Lives inside the inspectionEditor Alpine scope so it can reach
// `$root.sections` + `$root.results` for derivation. Refreshes on a
// 1s interval — cheap for typical (~150-item) inspections; can move
// to event-driven later by dispatching `items-updated` from
// inspection-edit.js when rate/notes change.

import { computeCompletion, etaMinutes, sectionHeatMap } from '/js/progress-strip-helpers.js';

window.progressStrip = function () {
    return {
        completion: { rated: 0, total: 0, percent: 0 },
        etaMin: 0,
        heatMap: [],
        _timer: null,

        init() {
            this.refresh();
            this._timer = setInterval(() => this.refresh(), 1000);
        },

        destroy() {
            if (this._timer) clearInterval(this._timer);
            this._timer = null;
        },

        refresh() {
            // Locate the inspectionEditor scope walking up the DOM. The
            // ProgressStrip is mounted inside the editor's x-data, so its
            // root data is the inspectionEditor() return object.
            const editor = this._editor();
            if (!editor) return;

            const items = this._flatItems(editor);
            this.completion = computeCompletion(items);
            this.etaMin     = etaMinutes(editor._itemDurationsSec ?? [], this.completion.total - this.completion.rated);
            this.heatMap    = sectionHeatMap(items);
        },

        _editor() {
            // Bubble through the Alpine roots — the ProgressStrip <div> is a
            // descendant of <div x-data="inspectionEditor(...)">. Cache the
            // resolved root on first lookup.
            if (this._editorCache) return this._editorCache;
            const el = document.querySelector('[x-data^="inspectionEditor"]');
            if (!el || !window.Alpine?.$data) return null;
            this._editorCache = window.Alpine.$data(el);
            return this._editorCache;
        },

        _flatItems(editor) {
            const sections = editor.sections || editor.template?.sections || [];
            const results = editor.results || {};
            const out = [];
            for (const sec of sections) {
                const items = sec.items || [];
                for (const it of items) {
                    out.push({
                        id:        it.id,
                        sectionId: sec.id ?? sec.title ?? '',
                        rating:    results[it.id]?.rating ?? null,
                    });
                }
            }
            return out;
        },
    };
};
