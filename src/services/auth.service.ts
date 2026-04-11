import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users, tenantInvites } from '../lib/db/schema';
import { Errors } from '../lib/errors';

/**
 * Service to handle all authentication-related business logic.
 * Decouples database operations from the HTTP routing layer.
 */
export class AuthService {
    constructor(private db: D1Database, private kv?: KVNamespace) {}

    private getDrizzle() {
        return drizzle(this.db);
    }

    /**
     * Hashes a password using SHA-256 (internal consistency).
     */
    async hashPassword(password: string): Promise<string> {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Validates a user's credentials.
     */
    async validateCredentials(email: string, password: string) {
        const db = this.getDrizzle();
        const user = await db.select().from(users).where(eq(users.email, email)).get();

        if (!user) throw Errors.Unauthorized('Invalid email or password');

        const incomingHash = await this.hashPassword(password);
        
        if (user.passwordHash !== incomingHash) {
            throw Errors.Unauthorized('Invalid email or password');
        }

        return user;
    }

    /**
     * Updates a user's password.
     */
    async updatePassword(userId: string, currentPassword: string, newPassword: string) {
        const db = this.getDrizzle();
        const user = await db.select().from(users).where(eq(users.id, userId)).get();
        if (!user) throw Errors.NotFound('User not found');

        const currentHash = await this.hashPassword(currentPassword);
        if (user.passwordHash !== currentHash) {
            throw Errors.Unauthorized('Current password is incorrect');
        }

        const newHash = await this.hashPassword(newPassword);
        await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
    }

    /**
     * Joins a team using an invitation token.
     */
    async joinTeam(token: string, password: string) {
        const db = this.getDrizzle();
        const invite = await db.select().from(tenantInvites).where(eq(tenantInvites.id, token)).get();

        if (!invite) throw Errors.NotFound('Invalid or expired invitation');
        if (invite.status !== 'pending') throw Errors.BadRequest('Invitation has already been used');
        if (invite.expiresAt < new Date()) throw Errors.BadRequest('Invitation has expired');

        const existing = await db.select().from(users).where(eq(users.email, invite.email)).get();
        if (existing) throw Errors.Conflict('An account with this email already exists');

        const passwordHash = await this.hashPassword(password);
        const userId = crypto.randomUUID();

        await db.insert(users).values({
            id: userId,
            tenantId: invite.tenantId,
            email: invite.email,
            passwordHash,
            role: invite.role,
            createdAt: new Date(),
        });

        await db.update(tenantInvites).set({ status: 'accepted' }).where(eq(tenantInvites.id, token));

        return { id: userId, email: invite.email, tenantId: invite.tenantId, role: invite.role };
    }

    /**
     * Creates a password reset token and stores it in KV.
     */
    async createPasswordResetToken(email: string): Promise<string | null> {
        const db = this.getDrizzle();
        const user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user || !this.kv) return null;

        const resetToken = crypto.randomUUID();
        const kvKey = `pw_reset:${resetToken}`;
        await this.kv.put(kvKey, user.id, { expirationTtl: 3600 });
        return resetToken;
    }

    /**
     * Resets a user's password using a valid token.
     */
    async resetPassword(token: string, newPassword: string) {
        if (!this.kv) throw Errors.BadRequest('Password reset not available');

        const kvKey = `pw_reset:${token}`;
        const userId = await this.kv.get(kvKey);
        if (!userId) throw Errors.BadRequest('Invalid or expired reset token');

        const db = this.getDrizzle();
        const newHash = await this.hashPassword(newPassword);
        await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
        await this.kv.delete(kvKey);
    }
}
