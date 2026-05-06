/**
 * B4 — Top-right floating network state pill.
 * Layout has no top header so this is fixed-position. Z-order below the
 * sync progress bar (which is fixed top:0).
 */
export const NetworkPill = () => (
    <div
        x-data="networkPill"
        x-cloak
        class="fixed top-4 right-4 z-40"
    >
        <button
            type="button"
            x-on:click="popoverOpen = !popoverOpen"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-md ring-1 ring-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
            <span class="w-2 h-2 rounded-full" x-bind:class="dotClass"></span>
            <span x-text="label"></span>
        </button>
        <div
            x-show="popoverOpen"
            {...{ 'x-on:click.outside': 'popoverOpen = false' }}
            class="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-4 text-sm"
        >
            <div class="font-bold text-slate-900 mb-2" x-text="`Tier ${tier?.id} — ${tier?.label}`"></div>
            <div x-show="pendingItems.length === 0" class="text-slate-500">No pending changes.</div>
            <ul x-show="pendingItems.length > 0" class="space-y-2 max-h-60 overflow-y-auto">
                <template x-for="it in pendingItems" {...{ 'x-bind:key': 'it.id' }}>
                    <li class="flex items-start justify-between gap-2 text-xs">
                        <span x-text="`${it.op} · ${new Date(it.createdAt).toLocaleTimeString()}`"></span>
                        <button x-on:click="retryOne(it.id)" class="text-indigo-600 hover:underline">Retry</button>
                    </li>
                </template>
            </ul>
            <button x-show="pendingItems.length > 0" x-on:click="syncNow()" class="mt-3 w-full px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-black">Sync now</button>
        </div>
    </div>
);
