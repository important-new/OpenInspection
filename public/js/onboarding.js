function inspectionOnboarding() {
    return {
        active: false,
        stepIdx: 0,
        levels: [],

        async init(levels) {
            this.levels = Array.isArray(levels) ? levels : [];
            try {
                const r = await authFetch('/api/users/me/onboarding');
                if (!r.ok) return;
                const d = await r.json();
                if (!d.data?.state?.inspectionEdit && this.levels.length > 0) {
                    this.active = true;
                    this.stepIdx = 0;
                }
            } catch { /* silent */ }
        },

        get totalSteps() { return this.levels.length + 1; },

        get currentStep() {
            if (this.stepIdx === 0) {
                return {
                    title: 'Rating Buttons',
                    body: 'Each item gets a rating. Tap one of the colored buttons for each item to record your evaluation. Hover (or long-press on touch) to see what each abbreviation means.',
                };
            }
            const level = this.levels[this.stepIdx - 1];
            return {
                title: level.label,
                body: level.description || 'No description set for this level. You can add one in the template editor.',
                color: level.color,
                abbr: level.abbreviation,
            };
        },

        next() {
            if (this.stepIdx + 1 < this.totalSteps) this.stepIdx++;
            else this.dismiss();
        },

        skip() { this.dismiss(); },

        async dismiss() {
            this.active = false;
            try {
                await authFetch('/api/users/me/onboarding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'inspectionEdit', completed: true }),
                });
            } catch { /* silent */ }
        },
    };
}
