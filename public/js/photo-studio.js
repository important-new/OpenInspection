// Design System 0520 M14 — PhotoStudio MVP main module (subsystem A, phase 4).
//
// Alpine factory backing components/photo-studio.tsx. State + drawing
// handlers + save/load. Pure helpers live in /js/photo-studio-helpers.js.
//
// Decision (per spec follow-up): EXIF is already extracted server-side at
// upload time and stored on inspection_media_pool.exifData — no need to
// vendor exifr or re-parse the blob on the client. The factory reads
// media.exifData directly when present.

import {
    addShape, undoLast, redoLast, resetShapes,
    serialize, deserialize,
} from '/js/photo-studio-helpers.js';

window.photoStudio = function () {
    return {
        // --- state ---
        open: false,
        media: null,           // { id, inspectionId, url, annotations?, caption?, exifData?, naturalWidth?, naturalHeight? }
        tool: 'pan',           // pan | circle | arrow | draw | label
        shapes: [],
        redo: [],
        caption: '',
        autoCaption: '',
        drawing: false,
        startPt: null,
        currentPath: '',
        zoom: 1,
        pan: { x: 0, y: 0 },
        showInfo: false,
        exif: null,
        saving: false,

        init() {
            // Listen for editor's "open-photo-studio" event so the factory can
            // remain on the page (one mount) and serve any item's photo strip.
            window.addEventListener('open-photo-studio', (e) => {
                if (!e.detail) return;
                this.openFor(e.detail.media, e.detail.inspectionContext || {});
            });
        },

        // --- entry / exit ---
        openFor(media, inspectionContext) {
            this.media = media;
            this.shapes = deserialize(media.annotations || '');
            this.redo = [];
            const sec = inspectionContext.sectionName || '';
            const item = inspectionContext.itemTitle || '';
            this.autoCaption = sec && item ? `${sec} · ${item}` : (sec || item);
            this.caption = (media.caption != null && media.caption !== '') ? media.caption : this.autoCaption;
            this.tool = 'pan';
            this.zoom = 1;
            this.pan = { x: 0, y: 0 };
            this.showInfo = false;
            this.loadExif();
            this.open = true;
            // Surface state to sibling components (InspectorToolsDock hides the
            // FAB while the studio overlay is active to avoid overlap).
            window.__oiPhotoStudioOpen = true;
        },

        close() {
            this.open = false;
            this.media = null;
            window.__oiPhotoStudioOpen = false;
        },

        // --- tool selection ---
        selectTool(t) { this.tool = t; },

        // --- drawing handlers (called from SVG inline event bindings) ---
        onPointerDown(ev) {
            if (this.tool === 'pan') return;
            if (this.tool === 'label') {
                const text = prompt('Label text:');
                if (text) {
                    const pt = this.screenToPhoto(ev);
                    const next = addShape({ shapes: this.shapes, redo: this.redo }, {
                        type: 'label', x: pt.x, y: pt.y, text,
                    });
                    this.shapes = next.shapes;
                    this.redo = next.redo;
                }
                return;
            }
            this.drawing = true;
            this.startPt = this.screenToPhoto(ev);
            if (this.tool === 'draw') {
                this.currentPath = `M${this.startPt.x},${this.startPt.y}`;
            }
        },

        onPointerMove(ev) {
            if (!this.drawing) return;
            if (this.tool === 'draw') {
                const pt = this.screenToPhoto(ev);
                this.currentPath += ` L${pt.x},${pt.y}`;
            }
        },

        onPointerUp(ev) {
            if (!this.drawing) return;
            const end = this.screenToPhoto(ev);
            let shape = null;
            if (this.tool === 'circle') {
                shape = {
                    type: 'circle',
                    cx: (this.startPt.x + end.x) / 2,
                    cy: (this.startPt.y + end.y) / 2,
                    rx: Math.abs(end.x - this.startPt.x) / 2,
                    ry: Math.abs(end.y - this.startPt.y) / 2,
                };
            } else if (this.tool === 'arrow') {
                shape = {
                    type: 'arrow',
                    x1: this.startPt.x, y1: this.startPt.y,
                    x2: end.x,          y2: end.y,
                };
            } else if (this.tool === 'draw') {
                shape = { type: 'freehand', d: this.currentPath };
            }
            if (shape) {
                const next = addShape({ shapes: this.shapes, redo: this.redo }, shape);
                this.shapes = next.shapes;
                this.redo = next.redo;
            }
            this.drawing = false;
            this.startPt = null;
            this.currentPath = '';
        },

        // --- coordinate conversion ---
        // SVG uses viewBox="0 0 naturalW naturalH"; with no pan/zoom (zoom=1,
        // pan={0,0}), ev.offsetX/Y in CSS pixels of the rendered SVG maps to
        // the same pixel of the viewBox after the SVG's built-in
        // preserveAspectRatio scaling. For MVP we hold zoom=1; pan/zoom UI
        // arrives in a follow-up PR (spec known-followup).
        screenToPhoto(ev) {
            const ox = (typeof ev.offsetX === 'number') ? ev.offsetX : 0;
            const oy = (typeof ev.offsetY === 'number') ? ev.offsetY : 0;
            return {
                x: Math.round((ox - this.pan.x) / this.zoom),
                y: Math.round((oy - this.pan.y) / this.zoom),
            };
        },

        // --- undo / redo / reset ---
        undo() {
            const n = undoLast({ shapes: this.shapes, redo: this.redo });
            this.shapes = n.shapes;
            this.redo = n.redo;
        },
        redoShape() {
            const n = redoLast({ shapes: this.shapes, redo: this.redo });
            this.shapes = n.shapes;
            this.redo = n.redo;
        },

        reset() {
            if (typeof confirm === 'function' && !confirm('Clear all annotations and caption?')) return;
            const n = resetShapes({ shapes: this.shapes, redo: this.redo });
            this.shapes = n.shapes;
            this.redo = n.redo;
            this.caption = this.autoCaption;
        },

        // --- save ---
        async save() {
            if (!this.media) return;
            this.saving = true;
            try {
                const r = await fetch(
                    `/api/inspections/${this.media.inspectionId}/media/${this.media.id}/annotations`,
                    {
                        method: 'PUT',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            annotations: serialize(this.shapes),
                            caption:     this.caption,
                        }),
                        credentials: 'same-origin',
                    },
                );
                if (!r.ok) {
                    let msg = String(r.status);
                    try {
                        const body = await r.json();
                        msg = (body && body.error && body.error.message) || msg;
                    } catch { /* swallow */ }
                    if (typeof showToast === 'function') showToast(`Save failed: ${msg}`);
                    else alert(`Save failed: ${msg}`);
                    return;
                }
                const mediaId = this.media.id;
                this.close();
                window.dispatchEvent(new CustomEvent('photo-studio-saved', {
                    detail: { mediaId },
                }));
            } finally {
                this.saving = false;
            }
        },

        // --- EXIF panel — reads server-extracted exifData (no client parsing) ---
        // Server format (per inspection_media_pool.exifData JSON):
        //   { takenAt?: number (epoch ms), gps?: {lat,lng}, cameraModel?: string }
        loadExif() {
            const e = this.media && this.media.exifData;
            if (!e) { this.exif = null; return; }
            this.exif = {
                date:   e.takenAt ? new Date(e.takenAt).toISOString().slice(0, 19).replace('T', ' ') : null,
                gps:    (e.gps && typeof e.gps.lat === 'number' && typeof e.gps.lng === 'number')
                            ? `${e.gps.lat.toFixed(5)}, ${e.gps.lng.toFixed(5)}`
                            : null,
                device: e.cameraModel || null,
                dim:    (this.media.naturalWidth && this.media.naturalHeight)
                            ? `${this.media.naturalWidth} × ${this.media.naturalHeight}`
                            : null,
            };
        },
    };
};
