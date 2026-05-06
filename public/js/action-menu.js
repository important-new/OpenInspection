// Spec 3A — Alpine factory for the per-inspection "•••" action menu.
// Usage: <div x-data="actionMenu({ id: '...', status: 'scheduled' })">
//          <button @click="open=!open">•••</button>
//          <div x-show="open" @click.outside="open=false">
//              <template x-for="a in validActions()"><button @click="run(a)" x-text="actionLabel(a)"></button></template>
//          </div>
//        </div>
// Emits 'inspection-updated' on success so list pages can reload.

(function() {
    function actionMenuFactory(initial) {
        return {
            open: false,
            id: initial.id,
            status: initial.status,
            busy: false,

            validActions() {
                if (this.status === 'scheduled')   return ['confirm', 'cancel', 'edit'];
                if (this.status === 'confirmed')   return ['cancel', 'edit'];
                if (this.status === 'in_progress') return ['edit'];
                if (this.status === 'cancelled')   return ['uncancel', 'edit'];
                if (this.status === 'completed')   return ['view_report', 'edit'];
                return ['edit'];
            },

            actionLabel(a) {
                return ({ confirm: 'Confirm', cancel: 'Cancel', uncancel: 'Uncancel',
                          edit: 'Edit', view_report: 'View report' })[a] || a;
            },

            async run(action) {
                this.open = false;
                if (action === 'edit') {
                    window.location.href = '/inspections/' + this.id + '/edit';
                    return;
                }
                if (action === 'view_report') {
                    window.location.href = '/inspections/' + this.id + '/report';
                    return;
                }
                if (action === 'cancel') {
                    window.dispatchEvent(new CustomEvent('open-cancel-modal', { detail: { id: this.id } }));
                    return;
                }
                this.busy = true;
                try {
                    const res = await fetch('/api/inspections/' + this.id + '/' + action, {
                        method: 'POST', credentials: 'include',
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err?.error?.message || ('HTTP ' + res.status));
                    }
                    if (typeof window.showToast === 'function') {
                        window.showToast(this.actionLabel(action) + ' succeeded');
                    }
                    window.dispatchEvent(new CustomEvent('inspection-updated', { detail: { id: this.id } }));
                } catch (e) {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Failed: ' + e.message, true);
                    }
                } finally {
                    this.busy = false;
                }
            },
        };
    }

    function registerB4Component(name, factory) {
        document.addEventListener('alpine:init', () => window.Alpine.data(name, factory));
        if (window.Alpine && typeof window.Alpine.data === 'function') {
            window.Alpine.data(name, factory);
            document.querySelectorAll('[x-data^="' + name + '("]').forEach(el => {
                try { window.Alpine.destroyTree?.(el); } catch {}
                try { window.Alpine.initTree(el); } catch {}
            });
        }
    }
    registerB4Component('actionMenu', actionMenuFactory);
})();
