// Shared auth utilities. The HttpOnly inspector_token cookie is sent automatically
// on same-origin fetches — never store the token in JS-readable storage.

const authFetch = (url, opts = {}) =>
    fetch(url, { credentials: 'same-origin', ...opts });

async function logout() {
    try { await authFetch('/api/auth/logout', { method: 'POST' }); } catch {}
    window.location.href = '/login';
}
