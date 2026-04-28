// Shared toast notification utility
function showToast(msg, isError) {
    var el = document.getElementById('statusToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'fixed bottom-8 right-8 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold text-white z-50 transition-all ' +
        (isError ? 'bg-red-600' : 'bg-emerald-600');
    clearTimeout(el._timer);
    el._timer = setTimeout(function() { el.classList.add('hidden'); }, 3500);
}
