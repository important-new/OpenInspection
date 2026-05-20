/**
 * Design System 0520 — M10 SpeedMode MVP (subsystem A, phase 3)
 *
 * Full-screen single-item rating overlay triggered by `Z`. Optimised for
 * single-handed phone use (crawlspace / roof). 100×100 hit targets > WCAG
 * 44×44 minimum.
 *
 * Alpine state (`speedMode`, `speedQueue`, `speedCurrent`, derived getters,
 * mutators `toggleSpeedMode` / `speedRate` / `speedSkip` / `speedPrev` /
 * `speedOpenEditor`) lives in the existing `inspectionEditor` Alpine factory
 * — see `public/js/inspection-edit.js`.
 *
 * Hotkeys (active only when speedMode === true):
 *   1..5      = rate + auto-advance (sat / monitor / defect / ni / np)
 *   Tab / →   = skip to next unrated
 *   Shift+Tab / ← = previous
 *   Enter     = open full editor for current item
 *   Z / Esc   = exit
 */

interface RatingButton {
    key: string;
    label: string;
    value: string;
    tone: string;
}

const RATING_BUTTONS: RatingButton[] = [
    { key: '1', label: 'Sat', value: 'sat',     tone: 'bg-emerald-600 hover:bg-emerald-500' },
    { key: '2', label: 'Mon', value: 'monitor', tone: 'bg-amber-500 hover:bg-amber-400' },
    { key: '3', label: 'Def', value: 'defect',  tone: 'bg-rose-600 hover:bg-rose-500' },
    { key: '4', label: 'N/I', value: 'ni',      tone: 'bg-slate-600 hover:bg-slate-500' },
    { key: '5', label: 'N/P', value: 'np',      tone: 'bg-slate-600 hover:bg-slate-500' },
];

export function SpeedMode(): JSX.Element {
    return (
        <div
            x-show="speedMode"
            x-cloak
            style="display: none"
            class="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col text-white"
            role="dialog"
            aria-modal="true"
            aria-label="Speed-rate inspection items"
        >
            {/* Header */}
            <div class="flex items-center justify-between px-6 py-4">
                <button
                    type="button"
                    class="ih-btn ih-btn--ghost text-white"
                    x-on:click="toggleSpeedMode()"
                    aria-label="Close speed mode"
                >×</button>
                <div class="text-sm tabular-nums">
                    Item <span x-text="speedCurrent + 1"></span> of <span x-text="speedQueue.length"></span>
                </div>
                <div class="ih-eyebrow text-slate-300" x-text="speedSectionName"></div>
            </div>

            {/* Centre */}
            <div class="flex-1 flex flex-col items-center justify-center px-6">
                <div class="ih-eyebrow text-slate-400 mb-3" x-text="speedSectionName"></div>
                <h2 class="text-2xl font-bold text-center mb-12 max-w-2xl" x-text="speedItemTitle"></h2>

                <div class="grid grid-cols-5 gap-3 mb-8">
                    {RATING_BUTTONS.map(b => (
                        <button
                            type="button"
                            class={`w-[100px] h-[100px] rounded-lg ${b.tone} font-bold flex flex-col items-center justify-center transition-transform active:scale-95`}
                            x-on:click={`speedRate('${b.value}')`}
                            aria-label={`Rate ${b.label}`}
                            key={b.key}
                        >
                            <span class="text-2xl mb-1">{b.label}</span>
                            <span class="ih-kbd text-slate-700 bg-white/90">{b.key}</span>
                        </button>
                    ))}
                </div>

                <div class="flex gap-3">
                    <button type="button" class="ih-btn ih-btn--secondary" x-on:click="speedSkip()">Skip ›</button>
                    <button type="button" class="ih-btn ih-btn--ghost text-white" x-on:click="speedOpenEditor()">Open editor ↗</button>
                </div>
            </div>

            {/* Footer */}
            <div class="px-6 py-4 border-t border-white/10 text-slate-300 text-sm tabular-nums text-center">
                <span x-text="speedRatedCount"></span> of <span x-text="speedTotalCount"></span> rated ·
                <span x-text="speedQueue.length"></span> remaining ·
                <span x-text="speedPercentText"></span> complete
            </div>
        </div>
    );
}
