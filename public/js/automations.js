document.addEventListener('alpine:init', () => {
    Alpine.data('automations', () => ({
        rules: [],
        loading: true,
        error: '',
        logs: [],
        logsLoading: false,

        async init() {
            await Promise.all([this.load(), this.loadLogs()]);
        },

        async load() {
            this.loading = true;
            try {
                const res = await authFetch('/api/automations');
                if (res.ok) {
                    const json = await res.json();
                    this.rules = json.data || [];
                } else {
                    this.error = 'Failed to load automations';
                }
            } catch (e) {
                this.error = 'Network error';
            } finally {
                this.loading = false;
            }
        },

        async toggle(rule) {
            try {
                const res = await authFetch(`/api/automations/${rule.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: !rule.active }),
                });
                if (res.ok) rule.active = !rule.active;
            } catch (e) {
                console.error('[Automations] toggle error', e);
            }
        },

        triggerLabel(trigger) {
            const map = {
                'inspection.created':   'Booking created',
                'inspection.confirmed': 'Inspection confirmed',
                'inspection.cancelled': 'Inspection cancelled',
                'report.published':     'Report published',
                'invoice.created':      'Invoice created',
                'payment.received':     'Payment received',
                'agreement.signed':     'Agreement signed',
            };
            return map[trigger] || trigger;
        },

        recipientLabel(recipient) {
            const map = { client: 'Client', buying_agent: "Buyer's Agent", selling_agent: "Seller's Agent", inspector: 'Inspector', all: 'All' };
            return map[recipient] || recipient;
        },

        delayLabel(minutes) {
            if (minutes === 0) return 'Immediately';
            if (minutes < 60) return `${minutes} min delay`;
            return `${minutes / 60}h delay`;
        },

        statusClass(status) {
            if (status === 'sent')    return 'bg-emerald-100 text-emerald-700';
            if (status === 'failed')  return 'bg-rose-100 text-rose-700';
            if (status === 'skipped') return 'bg-amber-100 text-amber-700';
            return 'bg-slate-100 text-slate-500'; // pending / unknown
        },

        async loadLogs() {
            this.logsLoading = true;
            try {
                const res = await authFetch('/api/automations/logs/recent?limit=50');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const json = await res.json();
                this.logs = json.data || [];
            } catch (e) {
                console.warn('[automations] loadLogs failed', e);
            } finally {
                this.logsLoading = false;
            }
        },
    }));
});
