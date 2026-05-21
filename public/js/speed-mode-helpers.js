// SpeedMode pure helpers — single source for both vitest unit tests and the
// inspectionEditor Alpine factory. Loaded in the browser via a module script
// in inspection-edit.tsx that re-exports onto `window.SpeedMode`.

export function buildSpeedQueue(items) {
    const out = [];
    for (let i = 0; i < items.length; i++) {
        const rating = items[i]?.rating;
        if (rating === null || rating === undefined) out.push(i);
    }
    return out;
}

export function nextUnratedIndex(queue, current) {
    if (current + 1 < queue.length) return current + 1;
    return -1;
}

export function isQueueExhausted(queue, current) {
    if (queue.length === 0) return true;
    return current >= queue.length - 1;
}
