function settingsServicesFactory() {
    return {
        services: [],
        discounts: [],
        loading: false,
        saving: false,
        serviceModalOpen: false,
        discountModalOpen: false,
        editingServiceId: null,
        editingDiscountId: null,
        serviceForm:  { name: '', description: '', priceDollars: null },
        discountForm: { code: '', type: 'percent', valueInput: 10, active: true },

        async init() {
            await Promise.all([this.reloadServices(), this.reloadDiscounts()]);
        },

        async reloadServices() {
            this.loading = true;
            try {
                const res = await authFetch('/api/services');
                const json = await res.json();
                this.services = json.data || [];
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Failed to load services: ' + e.message, true);
            } finally {
                this.loading = false;
            }
        },

        async reloadDiscounts() {
            try {
                const res = await authFetch('/api/services/discount-codes');
                const json = await res.json();
                this.discounts = json.data || [];
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Failed to load discount codes: ' + e.message, true);
            }
        },

        openCreateService() {
            this.editingServiceId = null;
            this.serviceForm = { name: '', description: '', priceDollars: null };
            this.serviceModalOpen = true;
        },

        openEditService(svc) {
            this.editingServiceId = svc.id;
            this.serviceForm = {
                name:        svc.name,
                description: svc.description || '',
                priceDollars: (svc.price || 0) / 100,
            };
            this.serviceModalOpen = true;
        },

        async saveService() {
            this.saving = true;
            try {
                const cents = this.serviceForm.priceDollars == null
                    ? 0
                    : Math.round(this.serviceForm.priceDollars * 100);
                const body = {
                    name:        this.serviceForm.name,
                    description: this.serviceForm.description || null,
                    price:       cents,
                };
                const url    = this.editingServiceId ? '/api/services/' + this.editingServiceId : '/api/services';
                const method = this.editingServiceId ? 'PUT' : 'POST';
                const res = await authFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || ('HTTP ' + res.status));
                }
                this.serviceModalOpen = false;
                if (typeof window.showToast === 'function') window.showToast(this.editingServiceId ? 'Updated' : 'Created');
                await this.reloadServices();
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Save failed: ' + e.message, true);
            } finally {
                this.saving = false;
            }
        },

        async confirmDeleteService(svc) {
            if (!confirm('Delete service "' + svc.name + '"?')) return;
            try {
                const res = await authFetch('/api/services/' + svc.id, { method: 'DELETE' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                if (typeof window.showToast === 'function') window.showToast('Deleted');
                await this.reloadServices();
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Delete failed: ' + e.message, true);
            }
        },

        openCreateDiscount() {
            this.editingDiscountId = null;
            this.discountForm = { code: '', type: 'percent', valueInput: 10, active: true };
            this.discountModalOpen = true;
        },

        openEditDiscount(d) {
            this.editingDiscountId = d.id;
            this.discountForm = {
                code:       d.code,
                type:       d.type,
                // percent stores raw integer (e.g. 10 = 10%); fixed stores cents (e.g. 1000 = $10.00)
                valueInput: d.type === 'percent' ? d.value : (d.value / 100),
                active:     d.active ?? true,
            };
            this.discountModalOpen = true;
        },

        async saveDiscount() {
            this.saving = true;
            try {
                const valueRaw = this.discountForm.valueInput || 0;
                // percent: store as integer percentage; fixed: store as cents
                const value = this.discountForm.type === 'percent'
                    ? Math.round(valueRaw)
                    : Math.round(valueRaw * 100);
                const body = {
                    code:   (this.discountForm.code || '').trim().toUpperCase(),
                    type:   this.discountForm.type,
                    value,
                    active: this.discountForm.active,
                };
                const url    = this.editingDiscountId
                    ? '/api/services/discount-codes/' + this.editingDiscountId
                    : '/api/services/discount-codes';
                const method = this.editingDiscountId ? 'PUT' : 'POST';
                const res = await authFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || ('HTTP ' + res.status));
                }
                this.discountModalOpen = false;
                if (typeof window.showToast === 'function') window.showToast(this.editingDiscountId ? 'Updated' : 'Created');
                await this.reloadDiscounts();
            } catch (e) {
                if (typeof window.showToast === 'function') window.showToast('Save failed: ' + e.message, true);
            } finally {
                this.saving = false;
            }
        },

        async confirmDeleteDiscount(d) {
            if (!confirm('Delete discount code "' + d.code + '"?')) return;
            try {
                const res = await authFetch('/api/services/discount-codes/' + d.id, { method: 'DELETE' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                if (typeof window.showToast === 'function') window.showToast('Deleted');
                await this.reloadDiscounts();
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
        document.querySelectorAll('[x-data="' + name + '"]').forEach(el => {
            try { window.Alpine.destroyTree?.(el); } catch (_) {}
            try { window.Alpine.initTree(el); } catch (_) {}
        });
    }
}
registerB4Component('settingsServices', settingsServicesFactory);
