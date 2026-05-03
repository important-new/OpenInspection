export interface Tier {
    id: 'A' | 'B' | 'C' | 'D' | 'E';
    label: string;
    photoCap: number;
    quotaThreshold: number;
    nag: 'none' | 'persist-prompt' | 'install-pwa-weekly' | 'upgrade-device';
}

export declare const TIERS: Record<'A' | 'B' | 'C' | 'D' | 'E', Tier>;

export declare function detectTier(): Promise<Tier>;

export declare function requestPersist(
    authFetchFn?: (url: string, opts: RequestInit) => Promise<Response>
): Promise<boolean>;

export declare function estimateQuota(): Promise<{ usage: number; quota: number }>;
