/**
 * Design System 0520 — M15 InspectorTools FAB dock (subsystem A, phase 5).
 *
 * Right-bottom floating action button that consolidates four mouse-driven
 * entry points for editor tools. Hot keys remain authoritative; the dock
 * is purely a discoverability surface.
 *
 * Mounted inside the inspectionEditor x-data scope so tiles can call the
 * factory's methods directly (toggleSpeedMode, toggleCheatsheet) without
 * dispatching to a sibling component.
 *
 * Tiles:
 *   ⚡ Speed mode  (Z)        — toggleSpeedMode()
 *   📷 Burst camera           — dispatches `burst-camera:open` with activeItemId
 *   🎨 Photo studio           — dispatches `open-photo-studio` (off when no
 *                               active photo selected; tile shows a hint toast)
 *   ⌨  Shortcuts   (?)        — toggleCheatsheet()
 *
 * FAB hidden while SpeedMode or PhotoStudio overlay is active (no
 * overlapping floats).
 */

interface DockTile {
    id:         string;
    label:      string;
    icon:       string;
    hotkey?:    string;
    /** Inline Alpine expression invoked on click. Closes the dock too. */
    action:     string;
    /** Optional Alpine expression to disable the tile. */
    disabledIf?: string;
}

const TILES: DockTile[] = [
    {
        id:     'speed-mode',
        label:  'Speed mode',
        icon:   '⚡',
        hotkey: 'Z',
        action: 'toggleSpeedMode(); dockOpen = false',
    },
    {
        id:     'burst-camera',
        label:  'Burst camera',
        icon:   '📷',
        action: `if (activeItemId) { $dispatch('burst-camera:open', { itemId: activeItemId }); dockOpen = false } else if (typeof showToast === 'function') { showToast('Select an item first to start a camera burst'); }`,
    },
    {
        id:     'photo-studio',
        label:  'Photo studio',
        icon:   '🎨',
        action: `if (typeof showToast === 'function') showToast('Tap any photo to annotate'); dockOpen = false`,
    },
    {
        id:     'shortcuts',
        label:  'Shortcuts',
        icon:   '⌨',
        hotkey: '?',
        action: 'toggleCheatsheet(); dockOpen = false',
    },
];

export function InspectorToolsDock(): JSX.Element {
    return (
        <div
            x-show="!speedMode && !(window.__oiPhotoStudioOpen || false)"
            class="fixed bottom-6 right-6 z-40"
            {...{ 'x-on:keydown.escape.window': 'dockOpen = false' }}
        >
            {/* Backdrop (click-outside closes the dock) */}
            <div
                x-show="dockOpen"
                x-cloak
                class="fixed inset-0 z-[-1]"
                x-on:click="dockOpen = false"
                aria-hidden="true"
            />

            {/* Dock panel */}
            <div
                x-show="dockOpen"
                x-cloak
                {...{ 'x-transition.scale.origin.bottom.right.duration.200ms': '' }}
                class="absolute bottom-16 right-0 mb-2 ih-card p-2 min-w-[200px]"
                role="menu"
                aria-label="Inspector tools"
            >
                {TILES.map(t => (
                    <button
                        type="button"
                        class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-100"
                        x-on:click={t.action}
                        role="menuitem"
                        key={t.id}
                    >
                        <span aria-hidden="true" class="text-lg">{t.icon}</span>
                        <span class="flex-1 text-left text-sm">{t.label}</span>
                        {t.hotkey && <span class="ih-kbd">{t.hotkey}</span>}
                    </button>
                ))}
            </div>

            {/* FAB itself */}
            <button
                type="button"
                class="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg flex items-center justify-center text-white text-2xl active:scale-95 transition-transform"
                x-on:click="dockOpen = !dockOpen"
                aria-label="Open inspector tools"
                x-bind:aria-expanded="dockOpen"
            >
                <span aria-hidden="true">🛠</span>
            </button>
        </div>
    );
}
