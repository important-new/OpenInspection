// Sprint B-4b — Settings → Profile signature card.
// Reads the inspector's data from data-sig-* attributes on the section root,
// builds HTML + plain-text variants on the client (mirror of inspectorSignature
// in src/lib/inspector-signature.ts — keep in sync), and wires Copy buttons.
(function () {
    'use strict';
    var card = document.querySelector('[data-testid="settings-signature-card"]');
    if (!card) return;

    var data = {
        name:    card.getAttribute('data-sig-name')    || '',
        email:   card.getAttribute('data-sig-email')   || '',
        phone:   card.getAttribute('data-sig-phone')   || '',
        license: card.getAttribute('data-sig-license') || '',
        slug:    card.getAttribute('data-sig-slug')    || '',
        host:    card.getAttribute('data-sig-host')    || ''
    };

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function phoneTel(raw) {
        if (!raw) return null;
        var digits = raw.replace(/\D/g, '');
        if (digits.length < 7) return null;
        return '+1' + digits.slice(-10);
    }

    function buildHtml() {
        var lines = [];
        if (data.name)    lines.push('<strong>— ' + escapeHtml(data.name) + '</strong>');
        if (data.license) lines.push('<span style="color:#475569">Licensed home inspector · ' + escapeHtml(data.license) + '</span>');
        var contactBits = [];
        var tel = phoneTel(data.phone);
        if (data.phone && tel) contactBits.push('📞 <a href="tel:' + tel + '">' + escapeHtml(data.phone) + '</a>');
        if (data.email)        contactBits.push('✉️ <a href="mailto:' + escapeHtml(data.email) + '">' + escapeHtml(data.email) + '</a>');
        if (contactBits.length) lines.push(contactBits.join(' '));
        if (data.slug && data.host) {
            var link = 'https://' + data.host + '/book/' + escapeHtml(data.slug);
            lines.push('Book again: <a href="' + link + '">' + link + '</a>');
        }
        return '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-family:-apple-system,Segoe UI,sans-serif;font-size:13px;line-height:1.5;color:#0f172a">' + lines.join('<br>') + '</div>';
    }

    function buildText() {
        var lines = ['--'];
        if (data.name)    lines.push('— ' + data.name);
        if (data.license) lines.push('Licensed home inspector · ' + data.license);
        var cb = [];
        if (data.phone) cb.push(data.phone);
        if (data.email) cb.push(data.email);
        if (cb.length) lines.push(cb.join(' · '));
        if (data.slug && data.host) lines.push('Book again: https://' + data.host + '/book/' + data.slug);
        return lines.join('\n');
    }

    var htmlSig = buildHtml();
    var textSig = buildText();

    var htmlPreview = document.querySelector('#profileSignatureHtmlPreview code');
    var textPreview = document.querySelector('#profileSignatureTextPreview code');
    if (htmlPreview) htmlPreview.textContent = htmlSig;
    if (textPreview) textPreview.textContent = textSig;

    function copy(text) {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(function () {
            if (typeof window.showToast === 'function') window.showToast('Copied');
        }).catch(function () { /* swallow */ });
    }

    var copyHtml = document.getElementById('profileSignatureCopyHtml');
    var copyText = document.getElementById('profileSignatureCopyText');
    if (copyHtml) copyHtml.addEventListener('click', function () { copy(htmlSig); });
    if (copyText) copyText.addEventListener('click', function () { copy(textSig); });
})();
