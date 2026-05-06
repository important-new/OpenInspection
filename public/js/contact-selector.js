// B-2.3 contact selector — debounced autocomplete that auto-fills the existing
// clientName/clientEmail form fields. No new FK; inspections stay self-contained.
// Mounted via <div x-data="contactSelector()" ...> from dashboard.tsx.
function contactSelectorFactory() {
    return {
        searchText: '',
        results: [],
        showDropdown: false,
        creating: false,
        debounceTimer: null,

        init() {
            // No-op — search triggers on input
        },

        onInput() {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.search(), 300);
            this.showDropdown = this.searchText.length > 0;
        },

        async search() {
            if (this.searchText.length === 0) {
                this.results = [];
                return;
            }
            try {
                const res = await fetch(`/api/contacts?search=${encodeURIComponent(this.searchText)}&type=client&limit=8&offset=0`, {
                    credentials: 'include',
                });
                if (!res.ok) {
                    this.results = [];
                    return;
                }
                const json = await res.json();
                // API response shape: { success: true, data: [...contacts] } or { data: [...] }
                this.results = (json.data || json.contacts || []).slice(0, 8);
            } catch {
                this.results = [];
            }
        },

        selectContact(c) {
            this.searchText = c.name;
            this._fillFormFields(c.name, c.email || '');
            this.results = [];
            this.showDropdown = false;
        },

        async createNew() {
            if (!this.searchText.trim() || this.creating) return;
            this.creating = true;
            try {
                const res = await fetch('/api/contacts', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'client', name: this.searchText.trim() }),
                });
                if (res.ok) {
                    const json = await res.json();
                    const c = json.data || json;
                    this.selectContact(c);
                    // Open the email field so inspector can fill it in
                    const emailInput = document.getElementById('clientEmail');
                    if (emailInput) emailInput.focus();
                } else if (typeof window.showToast === 'function') {
                    window.showToast('Failed to create contact', true);
                }
            } catch {
                if (typeof window.showToast === 'function') window.showToast('Network error creating contact', true);
            } finally {
                this.creating = false;
            }
        },

        _fillFormFields(name, email) {
            const nameInput = document.getElementById('clientName');
            const emailInput = document.getElementById('clientEmail');
            if (nameInput) { nameInput.value = name; nameInput.dispatchEvent(new Event('input', { bubbles: true })); }
            if (emailInput) { emailInput.value = email; emailInput.dispatchEvent(new Event('input', { bubbles: true })); }
        },
    };
}

// Register via alpine:init or immediately if Alpine already booted
// (matches B4 pattern from network-pill.js etc.)
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
registerB4Component('contactSelector', contactSelectorFactory);
