import { describe, it, expect } from 'vitest';
import { mergeResults, type ResultsBlob } from '../../src/services/diff3.service';

const base: ResultsBlob = {
    item1: { status: 'satisfactory', notes: 'Original note.', photos: [{ key: 'p1' }], updatedAt: 1 },
};

describe('mergeResults', () => {
    it('returns ours when server has not changed', () => {
        const ours = { ...base, item1: { ...base.item1, notes: 'Inspector edit.', updatedAt: 2 } };
        const out = mergeResults(base, ours, base);
        expect(out.merged).toEqual(ours);
        expect(out.conflicts).toHaveLength(0);
    });

    it('takes union of photos (each side adds different photos)', () => {
        const ours = { ...base, item1: { ...base.item1, photos: [{ key: 'p1' }, { key: 'p2' }], updatedAt: 2 } };
        const theirs = { ...base, item1: { ...base.item1, photos: [{ key: 'p1' }, { key: 'p3' }], updatedAt: 2 } };
        const out = mergeResults(base, ours, theirs);
        const photoKeys = (out.merged.item1.photos || []).map(p => p.key).sort();
        expect(photoKeys).toEqual(['p1', 'p2', 'p3']);
    });

    it('LWW status: takes whichever side has higher updatedAt', () => {
        const ours   = { ...base, item1: { ...base.item1, status: 'monitor',  updatedAt: 5 } };
        const theirs = { ...base, item1: { ...base.item1, status: 'defect',   updatedAt: 9 } };
        const out = mergeResults(base, ours, theirs);
        expect(out.merged.item1.status).toBe('defect');
    });

    it('diff3 auto-merges non-overlapping notes edits', () => {
        const baseNotes   = 'Line A.\nLine B.\nLine C.';
        const oursNotes   = 'Line A modified.\nLine B.\nLine C.';
        const theirsNotes = 'Line A.\nLine B.\nLine C modified.';
        const b: ResultsBlob = { item1: { status: 'satisfactory', notes: baseNotes,   photos: [], updatedAt: 0 } };
        const o: ResultsBlob = { item1: { status: 'satisfactory', notes: oursNotes,   photos: [], updatedAt: 1 } };
        const t: ResultsBlob = { item1: { status: 'satisfactory', notes: theirsNotes, photos: [], updatedAt: 1 } };
        const out = mergeResults(b, o, t);
        expect(out.conflicts).toHaveLength(0);
        expect(out.merged.item1.notes).toContain('Line A modified.');
        expect(out.merged.item1.notes).toContain('Line C modified.');
    });

    it('flags genuine collision when both sides edit the same line', () => {
        const b: ResultsBlob = { item1: { status: 'satisfactory', notes: 'Original.', photos: [], updatedAt: 0 } };
        const o: ResultsBlob = { item1: { status: 'satisfactory', notes: 'Inspector.', photos: [], updatedAt: 1 } };
        const t: ResultsBlob = { item1: { status: 'satisfactory', notes: 'Office.',    photos: [], updatedAt: 1 } };
        const out = mergeResults(b, o, t);
        expect(out.conflicts).toHaveLength(1);
        expect(out.conflicts[0]).toMatchObject({ itemId: 'item1', field: 'notes' });
    });

    it('handles missing item on one side as add', () => {
        const o: ResultsBlob = { ...base, item2: { status: 'defect', notes: 'New item.', photos: [], updatedAt: 5 } };
        const out = mergeResults(base, o, base);
        expect(out.merged.item2).toBeDefined();
        expect(out.merged.item2.status).toBe('defect');
    });

    it('takes union of recommendations (each side adds different recs)', () => {
        const baseR: ResultsBlob = { item1: { status: 'satisfactory', notes: '', photos: [], updatedAt: 1 } };
        const ours: ResultsBlob   = { item1: { status: 'satisfactory', notes: '', photos: [], updatedAt: 2,
            recommendations: [{ recommendationId: 'r_A', estimateSnapshotMin: null, estimateSnapshotMax: null, summarySnapshot: 'A', attachedAt: 100 }] } };
        const theirs: ResultsBlob = { item1: { status: 'satisfactory', notes: '', photos: [], updatedAt: 2,
            recommendations: [{ recommendationId: 'r_B', estimateSnapshotMin: null, estimateSnapshotMax: null, summarySnapshot: 'B', attachedAt: 100 }] } };
        const out = mergeResults(baseR, ours, theirs);
        const ids = (out.merged.item1.recommendations || []).map(r => r.recommendationId).sort();
        expect(ids).toEqual(['r_A', 'r_B']);
        expect(out.conflicts).toHaveLength(0);
    });

    it('dedupes recommendations by recommendationId', () => {
        const baseR: ResultsBlob = { item1: { status: 'satisfactory', notes: '', photos: [], updatedAt: 1 } };
        const ours: ResultsBlob   = { item1: { status: 'satisfactory', notes: '', photos: [], updatedAt: 2,
            recommendations: [{ recommendationId: 'r_A', estimateSnapshotMin: 100, estimateSnapshotMax: 200, summarySnapshot: 'A-ours', attachedAt: 100 }] } };
        const theirs: ResultsBlob = { item1: { status: 'satisfactory', notes: '', photos: [], updatedAt: 2,
            recommendations: [{ recommendationId: 'r_A', estimateSnapshotMin: 100, estimateSnapshotMax: 200, summarySnapshot: 'A-theirs', attachedAt: 100 }] } };
        const out = mergeResults(baseR, ours, theirs);
        expect((out.merged.item1.recommendations || []).length).toBe(1);
    });

    it('handles missing recommendations field on either side', () => {
        const baseR: ResultsBlob = { item1: { status: 'satisfactory', notes: '', photos: [], updatedAt: 1 } };
        const ours: ResultsBlob   = { item1: { status: 'satisfactory', notes: '', photos: [], updatedAt: 2,
            recommendations: [{ recommendationId: 'r_A', estimateSnapshotMin: null, estimateSnapshotMax: null, summarySnapshot: 'A', attachedAt: 100 }] } };
        const out = mergeResults(baseR, ours, baseR);
        expect((out.merged.item1.recommendations || []).map(r => r.recommendationId)).toEqual(['r_A']);
    });
});
