import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { sign } from 'hono/jwt';
import { setCookie } from 'hono/cookie';
import type { HonoConfig } from '../types/hono';
import { Errors } from '../lib/errors';
import { verifyTurnstile } from '../lib/middleware/bot-protection';
import { logger } from '../lib/logger';

/**
 * Agent Accounts A1 — self-serve agent signup endpoint.
 *
 * Public, no JWT. Validates input + Turnstile (when configured), creates a
 * global agent user (tenant_id NULL, role='agent'), runs same-email auto-link
 * to fold in any tenants where this email already lives as an agent contact,
 * and returns Set-Cookie + redirect to /agent-dashboard.
 */
const agentSignupRoutes = new OpenAPIHono<HonoConfig>();

const SignupBodySchema = z
    .object({
        email: z.string().email(),
        password: z.string().min(12).max(120),
        name: z.string().min(2).max(120),
        turnstileToken: z.string().optional(),
    })
    .openapi('AgentSignupBody');

const SignupResponseSchema = z
    .object({
        success: z.literal(true),
        data: z.object({
            redirect: z.string(),
            userId: z.string(),
        }),
    })
    .openapi('AgentSignupResponse');

const signupRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Agents'],
    summary: 'Self-serve agent signup',
    description:
        'Public endpoint. Creates a global agent user, auto-links to any tenants where the ' +
        'email already exists as a type=agent contact, and returns the agent JWT via cookie.',
    request: {
        body: { content: { 'application/json': { schema: SignupBodySchema } } },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: SignupResponseSchema } },
            description: 'Account created',
        },
        400: { description: 'Invalid input' },
        409: { description: 'Email already registered — log in instead' },
    },
});

agentSignupRoutes.openapi(signupRoute, async (c) => {
    const body = c.req.valid('json');

    // Bot protection — only enforced when TURNSTILE_SECRET_KEY is configured.
    // Local dev / open-source operators can ship without it; production gets
    // automatic enforcement when the secret is set.
    if (c.env.TURNSTILE_SECRET_KEY) {
        if (!body.turnstileToken) {
            throw Errors.BadRequest('Bot challenge required');
        }
        let ok = false;
        try {
            ok = await verifyTurnstile(body.turnstileToken, c.env.TURNSTILE_SECRET_KEY);
        } catch (err) {
            logger.warn('agent.signup.turnstile.failed', {
                error: err instanceof Error ? err.message : String(err),
            });
            ok = false;
        }
        if (!ok) throw Errors.BadRequest('Bot challenge failed');
    }

    const result = await c.var.services.agent.signup({
        email: body.email,
        password: body.password,
        name: body.name,
    });

    if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
        throw Errors.Internal('Server configuration error');
    }
    const now = Math.floor(Date.now() / 1000);
    const token = await sign({
        sub: result.userId,
        role: 'agent',
        'custom:userRole': 'agent',
        email: result.email,
        iat: now,
        exp: now + 60 * 60 * 24,
    }, c.env.JWT_SECRET, 'HS256');

    setCookie(c, '__Host-inspector_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: '/',
        maxAge: 60 * 60 * 24,
    });

    return c.json({
        success: true as const,
        data: { redirect: '/agent-dashboard', userId: result.userId },
    }, 200);
});

export default agentSignupRoutes;
