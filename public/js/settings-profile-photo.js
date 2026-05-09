// Booking #7 Sprint C-1 — Profile photo uploader.
// - File input change → POST multipart to /api/profile/photo
// - On success, swap the preview image src + show toast
// Validates client-side mirror of server limits (2MB, jpg/png/webp).
(function () {
    'use strict';

    const MAX_BYTES = 2_000_000;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

    function $(id) { return document.getElementById(id); }

    function toast(message, kind) {
        // Reuse the global toast if it exists, otherwise log.
        if (window.showToast) { window.showToast(message, kind || 'info'); return; }
        console.log('[profile-photo]', kind || 'info', message);
    }

    async function uploadPhoto(file) {
        if (!ALLOWED.includes(file.type)) {
            toast('Photo must be JPG, PNG, or WebP.', 'error');
            return;
        }
        if (file.size > MAX_BYTES) {
            toast('Photo must be smaller than 2MB.', 'error');
            return;
        }
        const fd = new FormData();
        fd.append('photo', file);
        const button = $('profilePhotoFile');
        if (button) button.disabled = true;
        try {
            const resp = await fetch('/api/profile/photo', {
                method: 'POST',
                body: fd,
                credentials: 'same-origin',
            });
            const json = await resp.json();
            if (!resp.ok || !json.success) {
                const message = (json && json.error && json.error.message) || 'Upload failed';
                toast(message, 'error');
                return;
            }
            const url = json.data && json.data.photoUrl;
            if (url) {
                const preview = $('profilePhotoPreview');
                if (preview) {
                    preview.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = url + '?t=' + Date.now(); // bust cache
                    img.alt = 'Current profile photo';
                    img.className = 'w-full h-full object-cover';
                    preview.appendChild(img);
                    preview.dataset.photoUrl = url;
                }
                toast('Photo updated.', 'success');
            }
        } catch (err) {
            toast('Upload failed: ' + (err && err.message ? err.message : 'network error'), 'error');
        } finally {
            if (button) button.disabled = false;
        }
    }

    function init() {
        const input = $('profilePhotoFile');
        if (!input) return;
        input.addEventListener('change', (e) => {
            const file = e.target && e.target.files && e.target.files[0];
            if (file) uploadPhoto(file);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
