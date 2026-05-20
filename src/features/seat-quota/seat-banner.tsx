import type { FC } from 'hono/jsx';
import type { SeatUsage } from './usage';

interface SeatBannerProps {
    usage: SeatUsage;
    billingPortalUrl: string | null;
}

/**
 * Stub — PR 3 Task 4 will replace this with the real seat-status banner
 * that renders on the team management page. Kept as a typed export so the
 * barrel and any early importers compile.
 */
export const SeatBanner: FC<SeatBannerProps> = () => null;
