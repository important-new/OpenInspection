import { diff3Merge } from 'node-diff3';

export interface AttachedRecommendation {
    recommendationId:    string;
    estimateSnapshotMin: number | null;
    estimateSnapshotMax: number | null;
    summarySnapshot:     string;
    attachedAt:          number;
}

export interface ItemResult {
    status: string | null;
    notes:  string;
    photos: Array<{ key: string; annotatedKey?: string; annotationsJson?: string }>;
    updatedAt: number;
    recommendations?: AttachedRecommendation[];   // optional — older inspection results may lack it
}
export type ResultsBlob = Record<string, ItemResult>;

export interface MergeConflict {
    itemId: string;
    field:  'notes';
    base:   string;
    ours:   string;
    theirs: string;
}

export interface MergeOutcome {
    merged:    ResultsBlob;
    conflicts: MergeConflict[];
}

/**
 * Three-way merge of inspection-results blobs.
 * - status: LWW by per-item updatedAt
 * - notes:  diff3 line-level merge; collisions surface as MergeConflict
 * - photos: array union by `key`
 * Items present on only one side are added (no merge needed).
 */
export function mergeResults(base: ResultsBlob, ours: ResultsBlob, theirs: ResultsBlob): MergeOutcome {
    const allItems = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
    const merged:    ResultsBlob = {};
    const conflicts: MergeConflict[] = [];

    for (const itemId of allItems) {
        const b = base[itemId];
        const o = ours[itemId];
        const t = theirs[itemId];

        // Item only in ours (new addition by ours)
        if (!b && o && !t) { merged[itemId] = o; continue; }
        // Item only in theirs (new addition by theirs)
        if (!b && !o && t) { merged[itemId] = t; continue; }
        // Item in neither base but in both sides — treat as empty base, merge both additions
        if (!b && o && t) {
            const empty: ItemResult = { status: null, notes: '', photos: [], updatedAt: 0 };
            const sub = mergeOne(empty, o, t);
            merged[itemId] = sub.item;
            if (sub.conflict) conflicts.push({ ...sub.conflict, itemId });
            continue;
        }
        // Item in base but deleted on both sides — omit from merged
        if (b && !o && !t) { continue; }
        // Item in base + theirs only — theirs wins (ours deleted it; theirs modified it → keep theirs)
        if (b && !o && t)  { merged[itemId] = t; continue; }
        // Item in base + ours only — ours wins
        if (b && o && !t)  { merged[itemId] = o; continue; }

        // All three present — full three-way merge
        const sub = mergeOne(b, o, t);
        merged[itemId] = sub.item;
        if (sub.conflict) conflicts.push({ ...sub.conflict, itemId });
    }

    return { merged, conflicts };
}

function mergeOne(
    base: ItemResult,
    ours: ItemResult,
    theirs: ItemResult,
): { item: ItemResult; conflict?: Omit<MergeConflict, 'itemId'> } {
    // LWW for status field
    const status = (ours.updatedAt >= theirs.updatedAt) ? ours.status : theirs.status;

    // Photo union by key (preserve first occurrence order: ours first, then theirs additions)
    const seen = new Set<string>();
    const photos: ItemResult['photos'] = [];
    for (const p of [...(ours.photos || []), ...(theirs.photos || [])]) {
        if (!seen.has(p.key)) { seen.add(p.key); photos.push(p); }
    }

    // Recommendations union by recommendationId (snapshots are immutable per attach;
    // any duplicate ID is treated as the same attachment regardless of snapshot text)
    const seenRec = new Set<string>();
    const recommendations: ItemResult['recommendations'] = [];
    for (const r of [...(ours.recommendations || []), ...(theirs.recommendations || [])]) {
        if (!seenRec.has(r.recommendationId)) {
            seenRec.add(r.recommendationId);
            recommendations.push(r);
        }
    }

    // diff3 merge for notes
    const notesResult = mergeNotes(base.notes || '', ours.notes || '', theirs.notes || '');
    const item: ItemResult = {
        status,
        notes: notesResult.text,
        photos,
        updatedAt: Math.max(ours.updatedAt, theirs.updatedAt),
        ...(recommendations.length > 0 ? { recommendations } : {}),  // omit field entirely if empty
    };

    if (notesResult.conflict) {
        return {
            item,
            conflict: { field: 'notes', base: base.notes, ours: ours.notes, theirs: theirs.notes },
        };
    }
    return { item };
}

function mergeNotes(base: string, ours: string, theirs: string): { text: string; conflict: boolean } {
    // Fast-path: identical — no merge needed
    if (ours === theirs)  return { text: ours, conflict: false };
    // Only ours changed
    if (theirs === base)  return { text: ours, conflict: false };
    // Only theirs changed
    if (ours === base)    return { text: theirs, conflict: false };

    // Both sides changed — run diff3
    const blocks = diff3Merge(ours.split('\n'), base.split('\n'), theirs.split('\n'));
    let text = '';
    let hasConflict = false;

    for (const blk of blocks) {
        if (blk.ok !== undefined) {
            text += blk.ok.join('\n') + '\n';
        } else if (blk.conflict !== undefined) {
            hasConflict = true;
            // In conflict, keep ours (side `a`) in the merged text; caller surfaces the conflict
            text += (blk.conflict.a || []).join('\n') + '\n';
        }
    }

    return { text: text.replace(/\n$/, ''), conflict: hasConflict };
}
