/**
 * Design System 0520 subsystem B phase 4 task 4.5 — ReconnectBanner.
 *
 * Top-of-editor amber strip shown when the offline queue has either:
 *   - Pending writes while offline ("⤷ Reconnecting… N queued"), or
 *   - Conflicts blocking the queue ("⤷ N change(s) conflict — Review →")
 *
 * The Review button defers to the EXISTING conflict-modal (offline-replay
 * surface) by setting `conflictModal.open = true` via window event. That
 * modal already iterates db.conflicts; the banner just makes the entry
 * point visible at the top of the page.
 */

export function ReconnectBanner(): JSX.Element {
    return (
        <div
            x-data="reconnectBanner()"
            x-show="visible"
            x-cloak
            class="sticky top-0 inset-x-0 z-40 bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900 flex items-center justify-between gap-3"
            role="alert"
        >
            <span x-show="state.conflicts.length === 0 && !state.online">
                ⤷ Reconnecting… <span x-text="state.length"></span> queued
            </span>
            <span x-show="state.conflicts.length > 0">
                ⤷ <span x-text="state.conflicts.length"></span> change(s) conflict with edits by another inspector
            </span>
            <button
                type="button"
                class="ih-btn ih-btn--sm ih-btn--primary"
                x-show="state.conflicts.length > 0"
                x-on:click="reviewConflicts()"
            >Review →</button>
        </div>
    );
}
