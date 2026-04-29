import type { Context } from 'hono';

/**
 * Builds the base URL (protocol + host) from the current request context.
 */
export function getBaseUrl(c: Context): string {
    const protocol = c.req.url.startsWith('https') ? 'https' : 'http';
    const host = c.req.header('host') || 'localhost';
    return `${protocol}://${host}`;
}
