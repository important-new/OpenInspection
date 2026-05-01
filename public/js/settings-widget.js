let _selectedStyle = 'light';

document.addEventListener('DOMContentLoaded', async () => {
    const styleBtns = document.querySelectorAll('.widget-style-btn');
    styleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            _selectedStyle = btn.dataset.style;
            styleBtns.forEach(b => {
                b.classList.toggle('ring-indigo-600', b === btn);
                b.classList.toggle('bg-indigo-50', b === btn);
            });
            renderSnippet();
            renderPreview();
        });
    });
    document.querySelector('.widget-style-btn[data-style="light"]').click();

    document.getElementById('saveOriginsBtn').onclick = saveOrigins;
    document.getElementById('copySnippetBtn').onclick = copySnippet;

    await loadOrigins();
    renderSnippet();
    renderPreview();
});

async function loadOrigins() {
    const res = await authFetch('/api/admin/widget/origins');
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('widgetOrigins').value = (data.data?.origins || []).join('\n');
}

async function saveOrigins() {
    const lines = document.getElementById('widgetOrigins').value
        .split('\n').map(s => s.trim()).filter(Boolean);
    const res = await authFetch('/api/admin/widget/origins', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origins: lines })
    });
    if (res.ok) {
        if (typeof showToast === 'function') showToast('Origins saved.');
    } else {
        const err = await res.json().catch(() => ({}));
        if (typeof showToast === 'function') showToast('Save failed: ' + (err.error?.message || 'unknown'), { type: 'error' });
    }
}

function snippetHtml() {
    const origin = window.location.origin;
    return `<div data-openinspection-widget></div>\n<script src="${origin}/widget.js" data-style="${_selectedStyle}" defer><\/script>`;
}

function renderSnippet() {
    document.getElementById('widgetSnippet').textContent = snippetHtml();
}

function renderPreview() {
    const iframe = document.getElementById('widgetPreview');
    iframe.src = `/book?embed=1&style=${encodeURIComponent(_selectedStyle)}`;
}

async function copySnippet() {
    try {
        await navigator.clipboard.writeText(snippetHtml());
        if (typeof showToast === 'function') showToast('Snippet copied.');
    } catch {
        prompt('Copy this snippet:', snippetHtml());
    }
}
