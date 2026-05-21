// Type definitions for speed-mode-helpers.js — Design System 0520 M10.
// Pure helpers, no DOM dependency. Consumed by both the inspectionEditor
// Alpine factory and the vitest spec under tests/unit/.

export interface SpeedQueueItem {
    id: string;
    rating?: string | null;
    [key: string]: unknown;
}

export function buildSpeedQueue(items: SpeedQueueItem[]): number[];
export function nextUnratedIndex(queue: number[], current: number): number;
export function isQueueExhausted(queue: number[], current: number): boolean;
