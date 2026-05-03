/**
 * B4 — Client-side image resize before storing in IndexedDB.
 * iPhone HEIC/JPEG photos are 4-12 MB each; resizing to a 2048-px long edge
 * with JPEG quality 0.85 brings them to 250-500 KB and prevents IndexedDB
 * quota exhaustion on iOS Safari (50-500 MB ceiling).
 *
 * Pure ES module — works in browser and in happy-dom for tests.
 */
export async function resizeImage(blob, maxLongEdge = 2048, quality = 0.85) {
    if (!blob.type || !blob.type.startsWith('image/')) return blob;

    const bitmap = await createImageBitmap(blob).catch(() => null);
    if (!bitmap) return blob;

    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= maxLongEdge) {
        if (blob.type === 'image/jpeg') return blob;
    }

    const scale = Math.min(1, maxLongEdge / longest);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        // Canvas 2D context unavailable (e.g. headless environment) — return original
        bitmap.close?.();
        return blob;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    if (canvas.convertToBlob) {
        return await canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}
