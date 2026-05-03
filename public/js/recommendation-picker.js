// Spec 2B — recommendation picker overlay. Mounted via <div x-data="recommendationPicker">.
// Exposes openRecommendationPicker(itemId, sectionTitle, onAttach) globally for form-renderer.
// Caches the library on first open and re-uses the cache for subsequent opens.

(function() {
    window.openRecommendationPicker = function(itemId, sectionTitle, onAttachFn) {
        const el = document.querySelector('[x-data="recommendationPicker"]');
        if (!el) {
            console.warn('Recommendation picker not mounted on this page');
            return;
        }
        const data = window.Alpine?.$data?.(el);
        if (data) data.show(itemId, sectionTitle, onAttachFn);
    };

    function recommendationPickerFactory() {
        return {
            open: false,
            loading: false,
            results: [],
            search: '',
            categoryFilter: '',
            severityFilter: '',
            currentItemId: null,
            currentOnAttach: null,
            cacheLoaded: false,
            allItems: [],

            async show(itemId, sectionTitle, onAttachFn) {
                this.currentItemId = itemId;
                this.currentOnAttach = onAttachFn;
                this.categoryFilter = sectionTitle || '';
                this.severityFilter = '';
                this.search = '';
                this.open = true;
                if (!this.cacheLoaded) {
                    await this.loadLibrary();
                }
                this.applyFilter();
            },

            async loadLibrary() {
                this.loading = true;
                try {
                    const res = await fetch('/api/recommendations', { credentials: 'include' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const json = await res.json();
                    this.allItems = json.data || [];
                    this.cacheLoaded = true;
                } catch (e) {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Failed to load recommendations: ' + e.message, true);
                    }
                    this.allItems = [];
                } finally {
                    this.loading = false;
                }
            },

            applyFilter() {
                const q = this.search.trim().toLowerCase();
                this.results = this.allItems.filter(r => {
                    if (this.categoryFilter && r.category !== this.categoryFilter) return false;
                    if (this.severityFilter && r.severity !== this.severityFilter) return false;
                    if (q && !`${r.name} ${r.defaultRepairSummary}`.toLowerCase().includes(q)) return false;
                    return true;
                });
            },

            attach(rec) {
                if (this.currentOnAttach) {
                    this.currentOnAttach({
                        recommendationId:    rec.id,
                        estimateSnapshotMin: rec.defaultEstimateMin,
                        estimateSnapshotMax: rec.defaultEstimateMax,
                        summarySnapshot:     rec.defaultRepairSummary,
                        attachedAt:          Date.now(),
                    });
                }
                this.close();
            },

            close() {
                this.open = false;
                this.currentItemId = null;
                this.currentOnAttach = null;
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
    registerB4Component('recommendationPicker', recommendationPickerFactory);
})();
