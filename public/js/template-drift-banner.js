// See network-pill.js for the rationale behind alpine:init registration.
function templateDriftBannerFactory() {
    return {
        show: false,
        snapshotVersion: 1,
        currentVersion: 1,
        inspectionId: null,
        get message() {
            return `Master template is at v${this.currentVersion}; this inspection was started at v${this.snapshotVersion}.`;
        },

        check(inspectionId, snapshotVersion, currentVersion) {
            const dismissedKey = `template_drift_dismissed_${inspectionId}`;
            if (sessionStorage.getItem(dismissedKey)) return;
            this.inspectionId = inspectionId;
            this.snapshotVersion = snapshotVersion;
            this.currentVersion = currentVersion;
            this.show = currentVersion > snapshotVersion;
        },

        async upgrade() {
            const res = await fetch(`/api/inspections/${this.inspectionId}/template/upgrade`, { method: 'POST' });
            if (res.ok) { this.show = false; window.location.reload(); }
            else if (typeof window.showToast === 'function') window.showToast('Upgrade failed', true);
        },

        dismiss() {
            sessionStorage.setItem(`template_drift_dismissed_${this.inspectionId}`, '1');
            this.show = false;
        },
    };
}

// See network-pill.js for the rationale behind this dual registration.
function registerB4Component(name, factory) {
    document.addEventListener('alpine:init', () => window.Alpine.data(name, factory));
    if (window.Alpine && typeof window.Alpine.data === 'function') {
        window.Alpine.data(name, factory);
        document.querySelectorAll(`[x-data="${name}"]`).forEach(el => {
            try { window.Alpine.destroyTree?.(el); } catch {}
            try { window.Alpine.initTree(el); } catch {}
        });
    }
}
registerB4Component('templateDriftBanner', templateDriftBannerFactory);
