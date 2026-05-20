// Design System 0520 subsystem B phase 3 task 3.5 — conflict-resolver
// pure helpers. Consumed by:
//   1. /js/inspection-edit.js (conflictResolver Alpine factory) for the
//      "mine" / "theirs" merge UX inside ConflictModal.
//   2. tests/unit/conflict-resolver-helpers.spec.ts (vitest, this file).
//
// Pure functions — no DOM, no fetch. Mergeable into a single inlined
// script tag at page mount if the bundle size ever matters.

/**
 * Concatenate two text values with a separator. Used to seed the "Merge"
 * mode textarea so the user starts with both sides visible and edits
 * down. Coerces non-strings via String(), returns the non-empty side
 * verbatim when one is empty.
 */
export function mergeText(a, b) {
    const sa = (a == null || a === '') ? '' : String(a);
    const sb = (b == null || b === '') ? '' : String(b);
    if (!sa) return sb;
    if (!sb) return sa;
    return `${sa}\n---\n${sb}`;
}

/**
 * Format an epoch-seconds timestamp as relative time:
 *   < 60s        → "Ns ago"
 *   < 60m        → "Nm ago"
 *   < 24h        → "Nh ago"
 *   ≥ 24h        → ISO date (YYYY-MM-DD)
 *
 * Powers the "edited by Eli 2m ago" inline metadata on PropertyInfo
 * fields + the conflict modal's "Last edited by …" hint.
 */
export function formatRelativeTime(epochSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - epochSeconds;
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Has the user picked a resolution? True for any non-null action value
 * ('keep-mine' / 'keep-theirs' / 'merge'); false otherwise. Drives the
 * "Save merged" button enable state in the modal.
 */
export function isConflictResolved(state) {
    return state != null && state.action != null;
}
