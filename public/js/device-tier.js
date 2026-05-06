/**
 * B4 — Device tier detection for offline storage strategy.
 * Tiers A/B/C/D/E differ in photo caps, quota nag thresholds, and onboarding
 * nudges. See spec §3.6 for the full matrix.
 *
 * Pure ES module. detectTier() is async because it awaits navigator.storage APIs.
 */
export const TIERS = {
    A: { id: 'A', label: 'PWA + Persisted',     photoCap: Infinity, quotaThreshold: 0.80, nag: 'none' },
    B: { id: 'B', label: 'PWA + Not Persisted', photoCap: Infinity, quotaThreshold: 0.80, nag: 'persist-prompt' },
    C: { id: 'C', label: 'iOS 15+ Safari Tab',  photoCap: 75,       quotaThreshold: 0.60, nag: 'install-pwa-weekly' },
    D: { id: 'D', label: 'iOS ≤14',             photoCap: 30,       quotaThreshold: 0.40, nag: 'upgrade-device' },
    E: { id: 'E', label: 'Android / Other',     photoCap: Infinity, quotaThreshold: 0.80, nag: 'none' },
};

function parseIosVersion(ua) {
    const m = ua.match(/OS (\d+)_/);
    return m ? parseInt(m[1], 10) : null;
}

function isIosUA(ua) { return /iPad|iPhone|iPod/.test(ua); }

function isStandalone() {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (navigator.standalone === true) return true;
    return false;
}

export async function detectTier() {
    const ua = navigator.userAgent || '';
    const iosVer = isIosUA(ua) ? parseIosVersion(ua) : null;
    const standalone = isStandalone();

    if (iosVer !== null && iosVer <= 14) return TIERS.D;

    if (standalone) {
        let persisted = false;
        if (navigator.storage?.persisted) {
            try { persisted = await navigator.storage.persisted(); } catch {}
        }
        return persisted ? TIERS.A : TIERS.B;
    }

    if (iosVer !== null && iosVer >= 15) return TIERS.C;

    return TIERS.E;
}

/**
 * Request persistent storage. Audit-logged for analytics.
 * Should be invoked on first inspection open after auth, never on a public page.
 */
export async function requestPersist(authFetchFn) {
    if (!navigator.storage?.persist) return false;
    let granted = false;
    try { granted = await navigator.storage.persist(); } catch {}
    if (typeof authFetchFn === 'function') {
        authFetchFn('/api/audit/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: granted ? 'persistence.granted' : 'persistence.denied' }),
        }).catch(() => {});
    }
    return granted;
}

export async function estimateQuota() {
    if (!navigator.storage?.estimate) return { usage: 0, quota: 50 * 1024 * 1024 };
    const e = await navigator.storage.estimate();
    return { usage: e.usage || 0, quota: e.quota || 50 * 1024 * 1024 };
}
