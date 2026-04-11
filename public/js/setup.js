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
