import { AutomationService } from './services/automation.service';
import { logger } from './lib/logger';

export interface ScheduledEnv {
    DB: D1Database;
    PHOTOS?: R2Bucket;
    RESEND_API_KEY?: string;
    SENDER_EMAIL?: string;
    APP_NAME?: string;
    APP_BASE_URL?: string;
}

export async function scheduled(
    _event: ScheduledEvent,
    env: ScheduledEnv,
    _ctx: ExecutionContext,
): Promise<void> {
    if (!env.RESEND_API_KEY) {
        logger.info('scheduled: RESEND_API_KEY not set, skipping');
    } else {
        const svc = new AutomationService(env.DB);
        await svc.flush(
            env.RESEND_API_KEY,
            env.SENDER_EMAIL || '',
            env.APP_NAME || 'OpenInspection',
            env.APP_BASE_URL || '',
        );
    }

    // Phase T (T26): clean up abandoned _pending message attachments older than 24h.
    try {
        if (env.PHOTOS) {
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            let cursor: string | undefined = undefined;
            let deleted = 0;
            do {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const list: R2Objects = await (env.PHOTOS as any).list({ cursor, limit: 1000 });
                for (const obj of list.objects) {
                    if (obj.key.includes('/messages/_pending/') && obj.uploaded.getTime() < cutoff) {
                        await env.PHOTOS.delete(obj.key);
                        deleted++;
                    }
                }
                cursor = list.truncated ? list.cursor : undefined;
            } while (cursor);
            if (deleted > 0) logger.info('[cron] cleaned up _pending message attachments', { deleted });
        }
    } catch (e) {
        logger.error('[cron] _pending cleanup failed', {}, e instanceof Error ? e : undefined);
    }
}
