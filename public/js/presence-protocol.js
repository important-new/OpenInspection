// Design System 0520 subsystem B phase 2 — presence WS protocol helpers.
//
// Tiny set of pure functions consumed by:
//   1. tests/unit/presence-protocol.spec.ts            (vitest, this file)
//   2. /js/presence-client.js                          (browser ESM)
//   3. /js/tenant-presence-client.js                   (browser ESM)
//
// No DOM / no fetch — encode/decode JSON; rosterDiff is a set diff over
// the `userId` key. Keeping protocol shape here means InspectionPresenceDO
// and TenantPresenceDO never agree-by-string-coincidence with the browser
// client — they share this header logically (even though the DO file
// embeds its own copy because Cloudflare Workers can't import from the
// public/ directory at compile time — see do/inspection-presence.ts).

const VALID_TYPES = new Set([
    // Client → Server
    'hello', 'heartbeat', 'focus', 'bye',
    // Server → Client
    'roster', 'tenant-roster', 'error',
]);

export function encodeMessage(msg) { return JSON.stringify(msg); }

export function decodeMessage(raw) {
    try {
        const m = JSON.parse(raw);
        if (!m || typeof m.type !== 'string' || !VALID_TYPES.has(m.type)) return null;
        return m;
    } catch {
        return null;
    }
}

export function rosterDiff(prev, next) {
    const prevIds = new Set(prev.map(u => u.userId));
    const nextIds = new Set(next.map(u => u.userId));
    return {
        joined: next.filter(u => !prevIds.has(u.userId)),
        left:   prev.filter(u => !nextIds.has(u.userId)),
    };
}
