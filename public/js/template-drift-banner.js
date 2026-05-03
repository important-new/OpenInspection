window.templateDriftBanner = function templateDriftBanner() {
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
};
