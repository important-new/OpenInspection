import { z } from '@hono/zod-openapi';

export const SeverityEnum = z.enum(['satisfactory', 'monitor', 'defect']);

export const CreateRecommendationSchema = z.object({
    category:             z.string().nullable().optional(),
    name:                 z.string().min(1).max(200),
    severity:             SeverityEnum,
    defaultEstimateMin:   z.number().int().nonnegative().nullable().optional(),
    defaultEstimateMax:   z.number().int().nonnegative().nullable().optional(),
    defaultRepairSummary: z.string().min(1).max(2000),
}).openapi('CreateRecommendation');

export const UpdateRecommendationSchema = CreateRecommendationSchema.partial().openapi('UpdateRecommendation');

export const RecommendationSchema = z.object({
    id:                   z.string().uuid(),
    tenantId:             z.string().uuid(),
    category:             z.string().nullable(),
    name:                 z.string(),
    severity:             SeverityEnum,
    defaultEstimateMin:   z.number().int().nullable(),
    defaultEstimateMax:   z.number().int().nullable(),
    defaultRepairSummary: z.string(),
    createdByUserId:      z.string().nullable(),
    createdAt:            z.union([z.string(), z.date(), z.number()]),
}).openapi('Recommendation');

export const RecommendationResponseSchema = z.object({
    success: z.literal(true),
    data:    RecommendationSchema,
}).openapi('RecommendationResponse');

export const RecommendationListResponseSchema = z.object({
    success: z.literal(true),
    data:    z.array(RecommendationSchema),
}).openapi('RecommendationListResponse');

export const ListRecommendationsQuerySchema = z.object({
    category: z.string().optional(),
    severity: SeverityEnum.optional(),
}).openapi('ListRecommendationsQuery');

export type CreateRecommendationInput = z.infer<typeof CreateRecommendationSchema>;
export type UpdateRecommendationInput = z.infer<typeof UpdateRecommendationSchema>;
