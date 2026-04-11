import { Context, Next } from 'hono';

// Middleware to enforce specific roles based on the decoded JWT
export const requireRole = (allowedRoles: string[]) => {
    return async (c: Context, next: Next) => {
        const userRole = c.get('userRole'); // Populated by authMiddleware earlier

        if (!userRole) {
            return c.json({ error: 'Unauthorized: No role found in context' }, 401);
        }

        if (!allowedRoles.includes(userRole)) {
            return c.json({ error: `Forbidden: Requires one of [${allowedRoles.join(', ')}]` }, 403);
        }

        return next();
    };
};
