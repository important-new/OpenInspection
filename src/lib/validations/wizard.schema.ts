// Design System 0520 subsystem B phase 5 — NewInspectionWizard payload.
//
// Replaces the single-step "New Inspection" modal with a 4-step flow:
//   1. Property — address + year built + sqft + property type
//   2. Services — at least one inspection service
//   3. Schedule — date + start time + duration (minutes)
//   4. Team    — visible only when teamMode === true; picks lead + helpers
//
// POST /api/inspections/wizard — sibling to the legacy POST /api/inspections
// so existing callers (templates page, agent submissions) keep working
// unchanged. Created inspection redirects the wizard to /inspections/:id/edit.
import { z } from '@hono/zod-openapi';

export const CreateInspectionFromWizardSchema = z.object({
    property: z.object({
        address:      z.string().min(3).max(300),
        yearBuilt:    z.number().int().min(1700).max(2100).optional(),
        sqft:         z.number().int().min(100).max(50_000).optional(),
        propertyType: z.enum(['single_family', 'condo', 'townhouse', 'multi_family', 'commercial']).optional(),
    }),
    services: z.array(z.string().min(1).max(64)).min(1).max(20),
    schedule: z.object({
        date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be ISO YYYY-MM-DD'),
        startTime:       z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:MM'),
        durationMinutes: z.number().int().min(30).max(720),
    }),
    teamMode:           z.boolean(),
    leadInspectorId:    z.string().min(1).nullable().optional(),
    helperInspectorIds: z.array(z.string().min(1)).max(20).optional(),
}).openapi('CreateInspectionFromWizard');

export type CreateInspectionFromWizardInput = z.infer<typeof CreateInspectionFromWizardSchema>;
