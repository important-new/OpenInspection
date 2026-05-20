export function mergeText(a: string | null | undefined | number, b: string | null | undefined | number): string;
export function formatRelativeTime(epochSeconds: number): string;
export function isConflictResolved(state: { action?: 'keep-mine' | 'keep-theirs' | 'merge' | null | undefined } | null | undefined): boolean;
