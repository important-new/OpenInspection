// Booking #7 Sprint C-1 — Public profile editor (bio + service areas).
// - Live bio character counter
// - Add/remove service-area rows
// - POST to /api/profile/details with { bio, serviceAreas }
(function () {
    'use strict';

    const MAX_AREAS = 20;

    function $(id) { return document.getElementById(id); }

    function toast(message, kind) {
        if (window.showToast) { window.showToast(message, kind || 'info'); return; }
        console.log('[profile-public]', kind || 'info', message);
    }

    function updateBioCounter() {
        const bio = $('profileBio');
        const counter = $('profileBioCounter');
        if (!bio || !counter) return;
        const len = bio.value.length;
        counter.textContent = len + ' / 600';
    }

    function makeAreaRow(values) {
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-center';
        row.setAttribute('data-testid', 'settings-profile-area-row');
        row.innerHTML =
            '<input type="text" placeholder="City" data-area-field="city" class="flex-1 rounded-md border border-surface-200 px-3 py-2 text-sm" />' +
            '<input type="text" placeholder="State" maxlength="4" data-area-field="state" class="w-20 rounded-md border border-surface-200 px-3 py-2 text-sm uppercase" />' +
            '<input type="text" placeholder="ZIP" maxlength="10" data-area-field="zip" class="w-24 rounded-md border border-surface-200 px-3 py-2 text-sm" />' +
            '<button type="button" data-testid="settings-profile-area-remove" data-area-action="remove" class="text-xs text-rose-600 hover:underline">Remove</button>';
        if (values) {
            row.querySelector('[data-area-field="city"]').value = values.city || '';
            row.querySelector('[data-area-field="state"]').value = values.state || '';
            row.querySelector('[data-area-field="zip"]').value = values.zip || '';
        }
        return row;
    }

    function collectAreas() {
        const list = $('profileAreasList');
        if (!list) return [];
        const rows = list.querySelectorAll('[data-testid="settings-profile-area-row"]');
        const out = [];
        rows.forEach((row) => {
            const city = row.querySelector('[data-area-field="city"]').value.trim();
            const state = row.querySelector('[data-area-field="state"]').value.trim();
            const zip = row.querySelector('[data-area-field="zip"]').value.trim();
            if (city || state || zip) {
                out.push({ city, state, zip });
            }
        });
        return out;
    }

    async function save() {
        const btn = $('saveProfilePublicBtn');
        if (btn) btn.disabled = true;
        try {
            const bio = $('profileBio') ? $('profileBio').value : '';
            const serviceAreas = collectAreas();
            const resp = await fetch('/api/profile/details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ bio, serviceAreas }),
            });
            const json = await resp.json();
            if (!resp.ok || !json.success) {
                const message = (json && json.error && json.error.message) || 'Save failed';
                toast(message, 'error');
                return;
            }
            toast('Profile saved.', 'success');
        } catch (err) {
            toast('Save failed: ' + (err && err.message ? err.message : 'network error'), 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function init() {
        const bio = $('profileBio');
        if (bio) bio.addEventListener('input', updateBioCounter);

        const list = $('profileAreasList');
        const addBtn = $('profileAreaAdd');
        if (addBtn && list) {
            addBtn.addEventListener('click', () => {
                const rows = list.querySelectorAll('[data-testid="settings-profile-area-row"]');
                if (rows.length >= MAX_AREAS) {
                    toast('Maximum ' + MAX_AREAS + ' service areas reached.', 'error');
                    return;
                }
                list.appendChild(makeAreaRow());
            });
        }

        // Event delegation for remove buttons.
        if (list) {
            list.addEventListener('click', (e) => {
                const target = e.target;
                if (target && target.getAttribute && target.getAttribute('data-area-action') === 'remove') {
                    const row = target.closest('[data-testid="settings-profile-area-row"]');
                    if (row && row.parentElement) row.parentElement.removeChild(row);
                }
            });
        }

        const saveBtn = $('saveProfilePublicBtn');
        if (saveBtn) saveBtn.addEventListener('click', save);

        updateBioCounter();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
