import { z } from "zod";

/**
 * Form schemas, mirroring the API's validation rules
 * (api/src/lib/validations/auth.schema.ts). Kept as plain zod (no `.openapi()`)
 * so the SAME schema runs in the action (`parseWithZod`) and in the browser via
 * Conform's `onValidate` — one validation source, progressive-enhancement safe.
 *
 * NOTE (rollout): the API schemas use `@hono/zod-openapi`'s `z`. To make these
 * a single shared source of truth, extract the plain-zod base of each schema
 * into a `packages/shared-schemas` consumed by both api and frontend. For now
 * these are co-located mirrors.
 */
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
