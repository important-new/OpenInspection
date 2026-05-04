async function confirmSkip() {
    if (!confirm('You can finish setup later from Settings. Skip for now?')) return;
    const skipBtn = document.getElementById('skipBtn');
    if (skipBtn) { skipBtn.disabled = true; skipBtn.textContent = 'Skipping...'; }
    try {
        const res = await fetch('/api/auth/setup/skip', { method: 'POST', credentials: 'include' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.location.href = '/dashboard';
    } catch (e) {
        if (typeof window.showToast === 'function') {
            window.showToast('Skip failed: ' + e.message, true);
        } else {
            const errorMsg = document.getElementById('errorMsg');
            if (errorMsg) {
                errorMsg.textContent = 'Skip failed: ' + e.message;
                errorMsg.classList.remove('hidden');
            }
        }
        if (skipBtn) { skipBtn.disabled = false; skipBtn.textContent = 'Skip for now →'; }
    }
}

document.getElementById('setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const errorMsg = document.getElementById('errorMsg');
    
    // Reset state
    errorMsg.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Initializing...';

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            submitBtn.textContent = 'Success! Redirecting...';
            setTimeout(() => {
                window.location.href = result.data.redirect || '/login';
            }, 1500);
        } else {
            throw new Error(result.error || result.message || 'Setup failed');
        }
    } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Initialize System';
    }
});
