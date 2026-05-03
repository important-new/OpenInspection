function commentsAdminFactory() {
    return {
        items: [],
        loading: false,
        saving: false,
        categoryFilter: '',
        modalOpen: false,
        editingId: null,
        form: { category: '', text: '' },

        async init() {
            await this.reload();
        },

        get distinctCategories() {
            return [...new Set(this.items.map(r => r.category).filter(Boolean))].sort();
        },

        async reload() {
            this.loading = true;
            try {
                const res = await authFetch('/api/admin/comments');
                const json = await res.json();
                const all = json.data?.comments || [];
                this.items = this.categoryFilter
                    ? all.filter(c => c.category === this.categoryFilter)
                    : all;
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Failed to load: ' + e.message, true);
            } finally {
                this.loading = false;
            }
        },

        openCreate() {
            this.editingId = null;
            this.form = { category: '', text: '' };
            this.modalOpen = true;
        },

        openEdit(comment) {
            this.editingId = comment.id;
            this.form = {
                category: comment.category || '',
                text: comment.text,
            };
            this.modalOpen = true;
        },

        async save() {
            if (!this.form.text.trim()) {
                if (typeof window.showToast === 'function') window.showToast('Comment text is required', true);
                return;
            }
            this.saving = true;
            try {
                const body = {
                    text: this.form.text,
                    category: this.form.category || null,
                };
                // API supports POST (create) and DELETE. For edit we delete + re-create.
                if (this.editingId) {
                    const delRes = await authFetch('/api/admin/comments/' + this.editingId, { method: 'DELETE' });
                    if (!delRes.ok) {
                        const err = await delRes.json().catch(() => ({}));
                        throw new Error(err?.error?.message || 'HTTP ' + delRes.status);
                    }
                }
                const res = await authFetch('/api/admin/comments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || 'HTTP ' + res.status);
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

        async confirmDelete(comment) {
            const preview = comment.text.length > 40 ? comment.text.slice(0, 40) + '...' : comment.text;
            if (!confirm('Delete comment "' + preview + '"?')) return;
            try {
                const res = await authFetch('/api/admin/comments/' + comment.id, { method: 'DELETE' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                if (typeof window.showToast === 'function') window.showToast('Deleted');
                await this.reload();
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Delete failed: ' + e.message, true);
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
registerB4Component('commentsAdmin', commentsAdminFactory);
