import { z } from '@hono/zod-openapi';

/**
 * Helper to wrap a schema in the standard ApiResponse structure for OpenAPI.
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
    return z.object({
        success: z.boolean().openapi({ example: true }),
        data: dataSchema.openapi({ description: 'Response payload' }),
        error: z.object({
            message: z.string().openapi({ example: 'Error message' }),
            code: z.string().openapi({ example: 'ERROR_CODE' }),
            details: z.any().optional(),
        }).optional(),
        meta: z.any().optional(),
    });
}

/**
 * Standard Success Response Schema (when no specific data is returned)
 */
export const SuccessResponseSchema = z.object({
    success: z.boolean().openapi({ example: true }),
    data: z.object({
        success: z.boolean().openapi({ example: true }),
    }).optional(),
    error: z.any().optional(),
    meta: z.any().optional(),
}).openapi('SuccessResponse');
