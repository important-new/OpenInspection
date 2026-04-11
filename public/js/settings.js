function parseJwt(t) {
    try { return JSON.parse(atob(t.split('.')[1])); } catch { return {}; }
}

let token = localStorage.getItem('inspector_token');
if (!token) {
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token');
    if (token) {
        localStorage.setItem('inspector_token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        window.location.href = '/login';
    }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('inspector_token');
    window.location.href = '/login';
});

// Populate profile info from JWT
(function () {
    const payload = parseJwt(token);
    const email = payload.email || '';
    const role = payload['custom:userRole'] || payload.role || '';
    const name = email ? email.split('@')[0] : 'User';

    const emailEl = document.getElementById('profileEmail');
    const roleEl = document.getElementById('profileRole');
    if (emailEl) emailEl.textContent = email || 'Unknown user';
    if (roleEl) roleEl.textContent = role || 'inspector';

    const avatarSrc = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=6366f1&color=fff&size=56';
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) profileAvatar.src = avatarSrc;

    const navAvatar = document.querySelector('nav img[alt="User"]');
    if (navAvatar) {
        navAvatar.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=6366f1&color=fff';
        navAvatar.alt = name;
    }
})();

function showAlert(msg, isError, target = 'pwAlert') {
    const el = document.getElementById(target);
    if (!el) return;
    el.textContent = msg;
    el.className = 'mb-4 px-4 py-3 rounded-xl text-sm font-medium ' + (isError ? 'bg-red-50 text-red-700 border border-red-200 fade-in' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 fade-in');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

async function uploadLogo(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    const alertTarget = 'brandingAlert';
    try {
        const res = await fetch('/api/admin/branding/logo', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });

        const response = await res.json();
        const data = response.data || response;
        if (res.ok) {
            const preview = document.getElementById('brandingLogoPreview');
            const placeholder = document.getElementById('brandingLogoPlaceholder');
            if (preview) {
                preview.src = data.logoUrl;
            } else if (placeholder) {
                // If it was a placeholder, replace it with an image
                const parent = placeholder.parentElement;
                placeholder.remove();
                const newImg = document.createElement('img');
                newImg.id = 'brandingLogoPreview';
                newImg.src = data.logoUrl;
                newImg.alt = 'Logo';
                newImg.className = 'w-full h-full object-contain';
                parent.prepend(newImg);
            }
            showAlert('Logo uploaded successfully. Refresh to see changes globally.', false, alertTarget);
        } else {
            showAlert('Upload failed: ' + (data.error || 'Unknown error'), true, alertTarget);
        }
    } catch (err) {
        showAlert('Network error during upload.', true, alertTarget);
    }
}

async function saveBranding() {
    const siteName = document.getElementById('siteName').value;
    const primaryColor = document.getElementById('primaryColor').value;
    const supportEmail = document.getElementById('supportEmail').value;
    const billingUrl = document.getElementById('billingUrl').value;
    const gaMeasurementId = document.getElementById('gaMeasurementId').value;

    const alertTarget = 'brandingAlert';
    const btn = document.getElementById('brandingBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await fetch('/api/admin/branding', {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ siteName, primaryColor, supportEmail, billingUrl, gaMeasurementId })
        });

        if (res.ok) {
            showAlert('Branding updated successfully! Some changes may take up to an hour to propagate (cache).', false, alertTarget);
        } else {
            const err = await res.json();
            showAlert('Error: ' + (err.error || 'Failed to save branding'), true, alertTarget);
        }
    } catch (err) {
        showAlert('Network error while saving.', true, alertTarget);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Branding Changes';
    }
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showAlert('All fields are required.', true); return;
    }
    if (newPassword !== confirmPassword) {
        showAlert('New passwords do not match.', true); return;
    }
    if (newPassword.length < 8) {
        showAlert('New password must be at least 8 characters.', true); return;
    }

    const btn = document.getElementById('pwBtn');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
    });

    btn.disabled = false;
    btn.textContent = 'Update Password';

    if (res.ok) {
        document.getElementById('pwForm').reset();
        showAlert('Password updated successfully.', false);
    } else {
        const err = await res.json();
        showAlert('Error: ' + (err.error || 'Failed to update password'), true);
    }
}
