/**
 * B4 — Client-side image resize helper.
 * Resizes image blobs to a maximum long-edge size to prevent IndexedDB quota
 * exhaustion on iOS Safari before queuing photos for offline sync.
 */
export declare function resizeImage(
    blob: Blob,
    maxLongEdge?: number,
    quality?: number,
): Promise<Blob>;
