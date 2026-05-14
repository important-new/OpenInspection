import { z } from '@hono/zod-openapi';

export const QBOCloudEventSchema = z.object({
    specversion:      z.string(),
    id:               z.string(),
    source:           z.string(),
    type:             z.string(),
    datacontenttype:  z.string().optional(),
    time:             z.string().optional(),
    intuitentityid:   z.string(),
    intuitaccountid:  z.string(),
    data:             z.record(z.string(), z.unknown()).optional(),
});

export const QBOInvoiceResponseSchema = z.object({
    Invoice: z.object({
        Id:         z.string(),
        SyncToken:  z.string(),
        Balance:    z.number(),
        TotalAmt:   z.number(),
        DocNumber:  z.string().optional(),
    }),
});

export const QBOCustomerResponseSchema = z.object({
    Customer: z.object({
        Id:          z.string(),
        SyncToken:   z.string(),
        DisplayName: z.string(),
    }),
});

export const QBOPaymentResponseSchema = z.object({
    Payment: z.object({
        Id:        z.string(),
        SyncToken: z.string(),
    }),
});

export const QBOCreditMemoResponseSchema = z.object({
    CreditMemo: z.object({
        Id:        z.string(),
        SyncToken: z.string(),
    }),
});

export const QBOCompanyInfoResponseSchema = z.object({
    CompanyInfo: z.object({
        CompanyName: z.string(),
    }),
});

export const QBOTokenResponseSchema = z.object({
    access_token:               z.string(),
    refresh_token:              z.string(),
    x_refresh_token_expires_in: z.number(),
    token_type:                 z.string().optional(),
});

export const QBOErrorSchema = z.object({
    Fault: z.object({
        Error: z.array(z.object({
            Message: z.string(),
            Detail:  z.string().optional(),
            code:    z.string().optional(),
        })),
    }).optional(),
});

export const QBOLinkCustomerBodySchema = z.object({
    qboCustomerId: z.string().min(1),
});

export type QBOCloudEvent = z.infer<typeof QBOCloudEventSchema>;
export type QBOTokenResponse = z.infer<typeof QBOTokenResponseSchema>;
