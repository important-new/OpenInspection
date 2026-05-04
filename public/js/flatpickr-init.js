// Spec 3A — auto-init Flatpickr on any element with [data-flatpickr].
// Usage: <input type="text" data-flatpickr name="..." value="..." />
// Optional attrs: data-min-date="today" | data-no-time
document.addEventListener('alpine:init', () => {
    if (typeof window.flatpickr !== 'function') {
        console.warn('[flatpickr-init] Flatpickr not loaded');
        return;
    }
    document.querySelectorAll('[data-flatpickr]').forEach(el => {
        if (el._flatpickrApplied) return;
        el._flatpickrApplied = true;
        const enableTime = !el.hasAttribute('data-no-time');
        window.flatpickr(el, {
            enableTime,
            dateFormat:  enableTime ? 'Y-m-d H:i' : 'Y-m-d',
            time_24hr:   true,
            minDate:     el.dataset.minDate || undefined,
        });
    });
});
