import { z } from '@hono/zod-openapi';

export const NotificationTypeSchema = z.enum([
    'inspection.created',
    'inspection.confirmed',
    'booking.received',
    'report.published',
    'agreement.signed',
    'payment.received',
    'message.received',
]);

export const ListNotificationsQuerySchema = z.object({
    unread:           z.enum(['0', '1']).optional(),
    includeArchived:  z.enum(['0', '1']).optional(),
    limit:            z.coerce.number().int().min(1).max(100).optional(),
    cursor:           z.string().datetime().optional(),
});

export const MarkReadSchema = z.object({
    ids: z.array(z.string().min(1)).min(1).max(100),
});

export const NotificationDtoSchema = z.object({
    id:         z.string(),
    type:       z.string(),
    title:      z.string(),
    body:       z.string().nullable(),
    entityType: z.string().nullable(),
    entityId:   z.string().nullable(),
    metadata:   z.record(z.string(), z.unknown()).nullable(),
    readAt:     z.string().nullable(),
    archivedAt: z.string().nullable(),
    createdAt:  z.string(),
});

export const ListNotificationsResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        items:      z.array(NotificationDtoSchema),
        nextCursor: z.string().nullable(),
    }),
});

export const UnreadCountResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({ count: z.number().int().min(0) }),
});
