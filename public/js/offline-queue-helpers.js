// Design System 0520 subsystem B phase 4 task 4.1 — offline-queue helpers.
//
// Pure functions consumed by:
//   1. /js/offline-queue.js (Alpine-free IndexedDB replay loop).
//   2. tests/unit/offline-queue-helpers.spec.ts (vitest).
//
// No DOM / no IndexedDB — keep this file mockable. The actual replay
// loop (T4.2) imports these for its dedupe + state-gate + per-error
// branching logic.

/**
 * Collapse same-item-same-field rapid edits down to the latest entry.
 * Order is preserved for cross-item entries — the consumer (replay loop)
 * processes the result in array order. Pass-through for non-PATCH or
 * malformed-body entries so we never silently drop pending writes.
 */
export function dedupePatches(queue) {
    if (!Array.isArray(queue) || queue.length === 0) return [];
    const seen = new Map();    // key: `${url}::${field}` → index in `out`
    const out = [];
    for (const entry of queue) {
        if (entry.method !== 'PATCH') {
            out.push(entry);
            continue;
        }
        let body;
        try { body = JSON.parse(entry.body); } catch { out.push(entry); continue; }
        if (!body || typeof body.field !== 'string') {
            out.push(entry);
            continue;
        }
        const key = `${entry.url}::${body.field}`;
        const prev = seen.get(key);
        if (typeof prev === 'number') {
            out[prev] = entry;       // newer wins
        } else {
            seen.set(key, out.length);
            out.push(entry);
        }
    }
    return out;
}

/**
 * Gate for the replay loop: only run when online AND queue non-empty.
 * Callers also guard against `syncing` to avoid re-entry.
 */
export function shouldReplay(state) {
    return !!state && state.online === true && (state.length ?? 0) > 0;
}

/**
 * Map HTTP status into a replay-action bucket:
 *   - 'conflict' — 409. Stop the queue + surface to user via
 *     ReconnectBanner so they can resolve before more writes replay.
 *   - 'fatal'    — 403/404. Discard the entry; retrying won't help.
 *   - 'retry'    — everything else (5xx, network errors, unknown). The
 *     loop will bump retryCount + back off until the limit is reached.
 */
export function classifyError({ status }) {
    if (status === 409) return 'conflict';
    if (status === 403 || status === 404) return 'fatal';
    return 'retry';
}
