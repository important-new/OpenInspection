import { MainLayout } from '../layouts/main-layout';
import { BrandingConfig } from '../../types/auth';

export const CalendarPage = ({ branding }: { branding?: BrandingConfig | undefined } = {}): JSX.Element => {
    const siteName = branding?.siteName || 'OpenInspection';
    return (
        <MainLayout title={`${siteName} | Calendar`} branding={branding}>
            <div class="space-y-8 animate-fade-in">
                {/* Header */}
                <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <span class="inline-flex items-center rounded-lg bg-violet-600/10 px-3 py-1 text-[10px] font-black text-violet-600 uppercase tracking-[0.2em] ring-1 ring-inset ring-violet-600/20 mb-4">Calendar</span>
                        <h1 class="text-5xl font-black tracking-tight text-slate-900">Calendar</h1>
                        <p class="text-lg text-slate-500 font-semibold mt-2">View scheduled inspections by month.</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="prevMonth()" class="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition shadow-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                        <h2 id="calMonthLabel" class="text-lg font-black text-slate-900 min-w-[160px] text-center">—</h2>
                        <button onclick="nextMonth()" class="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition shadow-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                        <button onclick="goToday()" class="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition shadow-sm">Today</button>
                    </div>
                </div>

                {/* Calendar grid */}
                <div class="glass-panel rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50">
                    {/* Day headers */}
                    <div class="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div class="py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{d}</div>
                        ))}
                    </div>
                    {/* Calendar cells */}
                    <div id="calGrid" class="grid grid-cols-7 min-h-[500px]">
                        <div class="col-span-7 py-16 text-center text-slate-400 font-semibold text-sm">Loading...</div>
                    </div>
                </div>

                {/* Day detail panel */}
                <div id="dayDetail" class="hidden glass-panel rounded-3xl p-8 shadow-xl shadow-slate-200/50">
                    <h3 id="dayDetailTitle" class="text-xl font-black text-slate-900 mb-6">Inspections</h3>
                    <div id="dayDetailList" class="space-y-3"></div>
                </div>
            </div>

            <script src="/js/auth.js"></script>
            <script src="/js/calendar.js"></script>
        </MainLayout>
    );
};
