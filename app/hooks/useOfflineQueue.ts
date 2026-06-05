/**
 * useOfflineQueue — React binding for the OfflineQueue core.
 *
 * Module-level singleton: one OfflineQueue instance shared across the app
 * for the lifetime of the page.  Built from:
 *   - IDB storage when IndexedDB is available (browser)
 *   - In-memory storage when it is not (SSR / test envs)
 *   - ActionTransport: submits queued writes through the inspection-edit
 *     route action's `replay-write` / `replay-photo` intent branches.
 *
 * Hook return shape (stable across re-renders):
 *   online        — current navigator.onLine status
 *   pendingCount  — count of pending queue entries
 *   failedCount   — count of permanently-failed queue entries
 *   syncing       — true while a replay() run is in progress
 *   replayNow     — trigger an immediate replay (idempotent / single-flight)
 *
 * Wire-up:
 *   - window 'online'  event → replayNow() (auto-drain on reconnect)
 *   - queue subscription    → re-read counts on every queue mutation
 *   - SW 'message' event with data.type === 'drain-queue' → replayNow()
 *     (service worker can prod the queue after a background sync)
 *
 * The exported hook name `useOfflineQueue` is kept stable so existing import
 * sites continue to work without changes.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { idbAvailable, createIdbQueueStorage } from "~/lib/offline/queue-storage.idb";
import { createMemoryQueueStorage } from "~/lib/offline/queue-storage.memory";
import { OfflineQueue } from "~/lib/offline/offline-queue";
import type { ReplayResult } from "~/lib/offline/offline-queue";
import { createActionTransport } from "~/lib/offline/action-transport";

// ── Module-level singleton ────────────────────────────────────────────────────

/**
 * Lazily created on first hook call (deferred so SSR renders do not attempt
 * to access indexedDB / navigator).
 */
let _queue: OfflineQueue | null = null;

function getQueue(): OfflineQueue {
    if (!_queue) {
        const storage = idbAvailable()
            ? createIdbQueueStorage()
            : createMemoryQueueStorage();
        const transport = createActionTransport();
        _queue = new OfflineQueue(storage, transport);
    }
    return _queue;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// Re-export so callers can type the result without importing from offline-queue directly.
export type { ReplayResult };

export interface OfflineQueueState {
    online: boolean;
    pendingCount: number;
    failedCount: number;
    syncing: boolean;
    /** Trigger an immediate replay. Resolves with the ReplayResult when the run
     * completes, or null when a replay is already in progress (single-flight). */
    replayNow: () => Promise<ReplayResult | null>;
}

export function useOfflineQueue(): OfflineQueueState {
    const [online, setOnline] = useState(
        typeof navigator !== "undefined" ? navigator.onLine : true,
    );
    const [pendingCount, setPendingCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const syncingRef = useRef(false);

    // ── Queue counts refresh ──────────────────────────────────────────────────

    const refreshCounts = useCallback(async () => {
        try {
            const { pending, failed } = await getQueue().counts();
            setPendingCount(pending);
            setFailedCount(failed);
        } catch {
            /* storage unavailable — leave counts unchanged */
        }
    }, []);

    // ── replayNow ─────────────────────────────────────────────────────────────

    const replayNow = useCallback((): Promise<ReplayResult | null> => {
        // Single-flight guard: if a replay is already running, return null immediately.
        if (syncingRef.current) return Promise.resolve(null);
        syncingRef.current = true;
        setSyncing(true);
        return getQueue()
            .replay()
            .then((result) => {
                void refreshCounts();
                return result;
            })
            .catch((): ReplayResult => {
                // Network error — counts will refresh on next online event.
                return { synced: 0, conflicts: 0, failed: 0 };
            })
            .finally(() => {
                syncingRef.current = false;
                setSyncing(false);
            });
    }, [refreshCounts]);

    // ── Effects ───────────────────────────────────────────────────────────────

    useEffect(() => {
        // Read initial counts from storage.
        void refreshCounts();

        // Subscribe to queue mutations so counts stay live.
        const unsub = getQueue().subscribe(() => {
            void refreshCounts();
        });

        // Auto-drain when connectivity returns.
        function handleOnline() {
            setOnline(true);
            replayNow();
        }
        function handleOffline() {
            setOnline(false);
        }

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Service worker can prod the queue after a Background Sync event.
        function handleSwMessage(event: MessageEvent) {
            if (
                event.data &&
                typeof event.data === "object" &&
                (event.data as { type?: string }).type === "drain-queue"
            ) {
                replayNow();
            }
        }

        if (typeof navigator !== "undefined" && navigator.serviceWorker) {
            navigator.serviceWorker.addEventListener("message", handleSwMessage);
        }

        return () => {
            unsub();
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            if (typeof navigator !== "undefined" && navigator.serviceWorker) {
                navigator.serviceWorker.removeEventListener("message", handleSwMessage);
            }
        };
    }, [refreshCounts, replayNow]);

    return { online, pendingCount, failedCount, syncing, replayNow };
}

// ── Re-export the singleton for use outside React (e.g. useFindings) ─────────

export { getQueue as getOfflineQueue };
