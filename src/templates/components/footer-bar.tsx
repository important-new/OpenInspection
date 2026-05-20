/**
 * Design System 0520 subsystem B phase 4 task 4.4 — FooterBar.
 *
 * Sticky bottom-of-editor strip surfacing the offline queue's live
 * state: online/syncing/offline pill + queue length + last-synced
 * relative timestamp. Reads exclusively from window.OfflineQueue
 * (adapter over the existing sync-engine — see public/js/offline-queue.js).
 *
 * Mounted on inspection-edit; coexists with the existing network-pill
 * that already shows offline status in the page header — the FooterBar
 * is the editor-canvas-level sync surface (sub-spec from design 0520).
 */

export function FooterBar(): JSX.Element {
    return (
        <div
            x-data="footerBar()"
            x-show="state.length > 0 || state.syncing || !state.online"
            x-cloak
            class="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-4 py-2 text-sm flex items-center gap-3"
            role="status"
            aria-live="polite"
        >
            <div class="flex items-center gap-2">
                <span x-show="syncStatus === 'online'"   class="ih-pill ih-pill--sat">● Online</span>
                <span x-show="syncStatus === 'syncing'"  class="ih-pill ih-pill--monitor">↻ Syncing</span>
                <span x-show="syncStatus === 'offline'"  class="ih-pill ih-pill--defect">● Offline</span>
            </div>
            <div class="ih-meta">
                <span x-show="state.length > 0" x-text="`${state.length} queued`"></span>
                <span x-show="lastSyncedRel" x-text="` · last synced ${lastSyncedRel}`"></span>
            </div>
        </div>
    );
}
