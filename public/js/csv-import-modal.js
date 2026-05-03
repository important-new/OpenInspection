// 2-step CSV import modal: upload → preview (dryRun) → confirm import.
// Mounted via <div x-data="csvImportModal" x-show="open"> from contacts.tsx.
function csvImportModalFactory() {
    return {
        open: false,
        step: 'upload',  // 'upload' | 'preview' | 'done'
        csvText: '',
        fileName: '',
        loading: false,
        previewResult: null,  // { imported, skipped, errors }
        finalResult: null,

        show() {
            this.open = true;
            this.step = 'upload';
            this.csvText = '';
            this.fileName = '';
            this.previewResult = null;
            this.finalResult = null;
        },
        close() {
            this.open = false;
        },

        async onFileChange(ev) {
            const file = ev.target.files?.[0];
            if (!file) return;
            this.fileName = file.name;
            this.csvText = await file.text();
        },

        async preview() {
            if (!this.csvText.trim()) return;
            this.loading = true;
            try {
                const res = await fetch('/api/data/import/contacts?dry_run=true', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'text/csv' },
                    body: this.csvText,
                });
                const json = await res.json();
                if (res.ok) {
                    this.previewResult = json.data || json;
                    this.step = 'preview';
                } else if (typeof window.showToast === 'function') {
                    window.showToast('Preview failed: ' + (json.error?.message || 'unknown'), true);
                }
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Network error: ' + (e.message || ''), true);
            } finally {
                this.loading = false;
            }
        },

        async confirm() {
            this.loading = true;
            try {
                const res = await fetch('/api/data/import/contacts', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'text/csv' },
                    body: this.csvText,
                });
                const json = await res.json();
                if (res.ok) {
                    this.finalResult = json.data || json;
                    this.step = 'done';
                    if (typeof window.showToast === 'function') {
                        window.showToast(`Imported ${this.finalResult.imported} contacts (${this.finalResult.skipped} skipped)`);
                    }
                    // Refresh the contacts list — assumes parent page exposes a reload function on window
                    if (typeof window.reloadContactsList === 'function') {
                        window.reloadContactsList();
                    }
                } else if (typeof window.showToast === 'function') {
                    window.showToast('Import failed: ' + (json.error?.message || 'unknown'), true);
                }
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Network error: ' + (e.message || ''), true);
            } finally {
                this.loading = false;
            }
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
registerB4Component('csvImportModal', csvImportModalFactory);
