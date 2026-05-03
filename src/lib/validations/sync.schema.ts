import { z } from '@hono/zod-openapi';

const ItemResultSchema = z.object({
    status: z.string().nullable(),
    notes:  z.string(),
    photos: z.array(z.object({
        key: z.string(),
        annotatedKey:    z.string().optional(),
        annotationsJson: z.string().optional(),
    })),
    updatedAt: z.number().int().nonnegative(),
}).passthrough();

export const ResultsBlobSchema = z.record(z.string(), ItemResultSchema).openapi('ResultsBlob');

export const ResultsMergeRequestSchema = z.object({
    baseSyncedAt: z.number().int().nonnegative(),
    base:         ResultsBlobSchema, // client's last server-confirmed snapshot — needed because server doesn't keep history
    ours:         ResultsBlobSchema,
}).openapi('ResultsMergeRequest');

export const MergeConflictSchema = z.object({
    itemId: z.string(),
    field:  z.literal('notes'),
    base:   z.string(),
    ours:   z.string(),
    theirs: z.string(),
}).openapi('MergeConflict');

export const ResultsMergeResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        merged:    ResultsBlobSchema,
        syncedAt:  z.number().int().nonnegative(),
        conflicts: z.array(MergeConflictSchema),
    }),
}).openapi('ResultsMergeResponse');

export const InspectorSignatureSchema = z.object({
    signatureBase64: z.string().min(100).max(500_000),
    signedAt:        z.number().int().positive(),
}).openapi('InspectorSignature');
