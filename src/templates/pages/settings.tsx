import { MainLayout } from '../layouts/main-layout';
import { BrandingConfig } from '../../types/auth';

export const SettingsPage = ({ branding }: { branding?: BrandingConfig | undefined } = {}): JSX.Element => {
    const siteName = branding?.siteName || 'OpenInspection';
    const primaryColor = branding?.primaryColor || '#6366f1';
    const logoUrl = branding?.logoUrl;
    const gaMeasurementId = branding?.gaMeasurementId || '';

    return (
        <MainLayout title={`${siteName} | Settings`} branding={branding}>
            <div class="max-w-5xl mx-auto space-y-16 animate-fade-in">
                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <span class="inline-flex items-center rounded-lg bg-indigo-600/10 px-3 py-1 text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] ring-1 ring-inset ring-indigo-600/20">System Config</span>
                    </div>
                    <h1 class="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl text-gradient">Settings</h1>
                    <p class="text-lg text-slate-500 max-w-2xl font-semibold leading-relaxed">Configure your workspace branding, professional identity, and platform integrations.</p>
                </div>

                <div class="space-y-12">
                    {/* Branding Section */}
                    <section class="glass-panel p-10 md:p-12 rounded-[3.5rem] shadow-2xl shadow-slate-200/50 space-y-10">
                        <div class="flex items-center gap-5 pb-6 border-b border-slate-100/50">
                            <div class="w-14 h-14 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path></svg>
                            </div>
                            <div>
                                <h2 class="text-2xl font-black text-slate-900 tracking-tightest">Branding</h2>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace Visual Identity</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div class="space-y-3">
                                <label class="block text-xs font-black text-slate-900 ml-1 uppercase tracking-[0.2em]">Workspace Name</label>
                                <div class="relative group">
                                     <div class="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition-opacity"></div>
                                     <input type="text" id="siteName" value={siteName}
                                        class="premium-input relative w-full px-7 py-5 rounded-2xl border-0 ring-2 ring-slate-100 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-sm" />
                                </div>
                            </div>
                            <div class="space-y-3">
                                <label class="block text-xs font-black text-slate-900 ml-1 uppercase tracking-[0.2em]">Primary Theme</label>
                                <div class="flex gap-4">
                                    <input type="color" id="primaryColor" value={primaryColor}
                                        class="h-16 w-24 rounded-2xl border-0 ring-2 ring-slate-100 p-1.5 cursor-pointer bg-white transition-all hover:scale-105" />
                                    <div class="flex-1 relative group">
                                        <input type="text" value={primaryColor} readonly
                                            class="premium-input relative w-full px-7 py-5 rounded-2xl border-0 ring-2 ring-slate-100 bg-slate-50 text-slate-500 font-black text-xs uppercase tracking-widest cursor-default" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <label class="block text-xs font-black text-slate-900 ml-1 uppercase tracking-[0.2em]">Deployment Logo</label>
                            <div class="flex flex-col sm:flex-row items-center gap-10 p-10 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 group hover:border-indigo-300 transition-colors">
                                <div class="w-32 h-32 bg-white rounded-3xl border border-slate-100 shadow-xl flex items-center justify-center overflow-hidden relative">
                                    {logoUrl ? (
                                        <img id="logoPreview" src={logoUrl} class="w-full h-full object-contain p-4" />
                                    ) : (
                                        <div id="logoPlaceholder" class="text-slate-200">
                                            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                        </div>
                                    )}
                                </div>
                                <div class="space-y-4 flex-1 text-center sm:text-left">
                                    <input type="file" id="logoInput" class="hidden" accept="image/*" onchange="handleLogoSelect(event)" />
                                    <button onclick="document.getElementById('logoInput').click()" 
                                        class="premium-button px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:border-indigo-600 hover:text-indigo-600 transition-all active:scale-95">
                                        Upload Asset
                                    </button>
                                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest">Optimization: PNG/SVG (Alpha Channel Advised)</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Integrated Analytics Section */}
                    <section class="glass-panel p-10 md:p-12 rounded-[3.5rem] shadow-xl shadow-slate-100/50 space-y-10">
                        <div class="flex items-center gap-5 pb-6 border-b border-slate-100/50">
                            <div class="w-14 h-14 bg-sky-600/10 text-sky-600 rounded-2xl flex items-center justify-center shadow-sm">
                                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            </div>
                            <div>
                                <h2 class="text-2xl font-black text-slate-900 tracking-tightest">Telemetry</h2>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Usage Monitoring & Insights</p>
                            </div>
                        </div>

                        <div class="space-y-6">
                            <div class="space-y-3">
                                <label class="block text-xs font-black text-slate-900 ml-1 uppercase tracking-[0.2em]">GA Measurement ID</label>
                                <div class="flex flex-col sm:flex-row gap-8">
                                    <div class="flex-1 relative group">
                                         <div class="absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-blue-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition-opacity"></div>
                                         <input type="text" id="gaMeasurementId" value={gaMeasurementId} placeholder="e.g., G-XXXXXXXXXX"
                                            class="premium-input relative w-full px-7 py-5 rounded-2xl border-0 ring-2 ring-slate-100 focus:ring-2 focus:ring-sky-600 outline-none transition-all font-bold text-sm placeholder:text-slate-300" />
                                    </div>
                                    <div class="sm:w-80 p-6 rounded-[2rem] bg-slate-50/50 border border-slate-100 text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest">
                                        Integrate <span class="text-slate-900">Google Analytics 4</span> to enable real-time visitor tracking across public booking channels and portal entries.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Action Footer */}
                    <div class="flex items-center justify-end gap-6 pt-6">
                        <button onclick="location.reload()" class="px-8 py-5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">Discard</button>
                        <button onclick="saveBranding()" id="saveBtn" 
                            class="premium-button px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all active:scale-95 disabled:bg-slate-300">
                            Commit Changes
                        </button>
                    </div>
                </div>

                <script src="/js/settings.js"></script>
            </div>
        </MainLayout>
    );
};
