function recommendationsLibraryFactory() {
    return {
        items: [],
        loading: false,
        saving: false,
        categoryFilter: '',
        severityFilter: '',
        modalOpen: false,
        editingId: null,
        form: { category: '', name: '', severity: 'defect', estimateMinDollars: null, estimateMaxDollars: null, defaultRepairSummary: '' },

        async init() {
            await this.reload();
        },

        get distinctCategories() {
            return [...new Set(this.items.map(r => r.category).filter(Boolean))].sort();
        },

        async reload() {
            this.loading = true;
            try {
                const params = new URLSearchParams();
                if (this.categoryFilter) params.set('category', this.categoryFilter);
                if (this.severityFilter) params.set('severity', this.severityFilter);
                const res = await fetch('/api/recommendations?' + params, { credentials: 'include' });
                const json = await res.json();
                this.items = json.data || [];
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Failed to load: ' + e.message, true);
            } finally {
                this.loading = false;
            }
        },

        openCreate() {
            this.editingId = null;
            this.form = { category: '', name: '', severity: 'defect', estimateMinDollars: null, estimateMaxDollars: null, defaultRepairSummary: '' };
            this.modalOpen = true;
        },

        openEdit(rec) {
            this.editingId = rec.id;
            this.form = {
                category: rec.category || '',
                name: rec.name,
                severity: rec.severity,
                estimateMinDollars: rec.defaultEstimateMin == null ? null : (rec.defaultEstimateMin / 100),
                estimateMaxDollars: rec.defaultEstimateMax == null ? null : (rec.defaultEstimateMax / 100),
                defaultRepairSummary: rec.defaultRepairSummary,
            };
            this.modalOpen = true;
        },

        async save() {
            this.saving = true;
            try {
                const body = {
                    category: this.form.category || null,
                    name: this.form.name,
                    severity: this.form.severity,
                    defaultEstimateMin: this.form.estimateMinDollars == null ? null : Math.round(this.form.estimateMinDollars * 100),
                    defaultEstimateMax: this.form.estimateMaxDollars == null ? null : Math.round(this.form.estimateMaxDollars * 100),
                    defaultRepairSummary: this.form.defaultRepairSummary,
                };
                const url = this.editingId ? '/api/recommendations/' + this.editingId : '/api/recommendations';
                const method = this.editingId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `HTTP ${res.status}`);
                }
                this.modalOpen = false;
                if (typeof window.showToast === 'function') window.showToast(this.editingId ? 'Updated' : 'Created');
                await this.reload();
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Save failed: ' + e.message, true);
            } finally {
                this.saving = false;
            }
        },

        async confirmDelete(rec) {
            if (!confirm(`Delete "${rec.name}"?`)) return;
            try {
                const res = await fetch('/api/recommendations/' + rec.id, { method: 'DELETE', credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                if (typeof window.showToast === 'function') window.showToast('Deleted');
                await this.reload();
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Delete failed: ' + e.message, true);
            }
        },

        async seedDefaults() {
            this.loading = true;
            try {
                const res = await fetch('/api/recommendations/seed-defaults', { method: 'POST', credentials: 'include' });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
                if (typeof window.showToast === 'function') {
                    window.showToast(`Seeded ${json.data.inserted} new entries (${json.data.skipped} skipped)`);
                }
                await this.reload();
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Seed failed: ' + e.message, true);
            } finally {
                this.loading = false;
            }
        },

        severityClass(sev) {
            if (sev === 'satisfactory') return 'bg-emerald-100 text-emerald-700';
            if (sev === 'monitor')      return 'bg-amber-100 text-amber-700';
            return 'bg-rose-100 text-rose-700';
        },

        estimateLabel(rec) {
            const min = rec.defaultEstimateMin;
            const max = rec.defaultEstimateMax;
            if (min == null && max == null) return '';
            if (min === max) return `$${(min / 100).toFixed(0)}`;
            return `$${(min / 100).toFixed(0)}-${(max / 100).toFixed(0)}`;
        },
    };
}

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
registerB4Component('recommendationsLibrary', recommendationsLibraryFactory);
