// Design System 0520 subsystem C P6.3 — guest claim form handler.
// Posts { token, name, email, password } to /api/guest/claim and
// redirects to /dashboard on success (the response sets the session
// cookie server-side once the claim hits the auth path; for the MVP
// we redirect to /login so the new user authenticates with the
// credentials they just chose).
(() => {
    const form = document.getElementById('guestJoinForm');
    const errBox = document.getElementById('guestJoinError');
    const submitBtn = document.getElementById('submitBtn');
    if (!form || !errBox || !submitBtn) return;

    form.addEventListener('submit', async (evt) => {
        evt.preventDefault();
        errBox.classList.add('hidden');
        submitBtn.disabled = true;

        const payload = {
            token:    document.getElementById('token').value,
            name:     document.getElementById('name').value.trim(),
            email:    document.getElementById('email').value.trim(),
            password: document.getElementById('password').value,
        };

        try {
            const resp = await fetch('/api/guest/claim', {
                method:  'POST',
                headers: { 'content-type': 'application/json' },
                body:    JSON.stringify(payload),
            });
            const body = await resp.json().catch(() => ({}));

            if (resp.ok && body.success) {
                // Send them to /login so they can sign in with the
                // credentials they just chose. The user row was created
                // server-side; auth issues the cookie there.
                window.location.href = '/login';
                return;
            }

            const code = body?.error?.code || 'unknown';
            const msg  = body?.error?.message || 'Could not complete invitation';
            errBox.textContent = code === 'seat_limit_reached'
                ? 'Team is at its seat limit. Ask the admin to upgrade.'
                : msg;
            errBox.classList.remove('hidden');
        } catch (e) {
            errBox.textContent = 'Network error — please retry';
            errBox.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
