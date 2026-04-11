import { BareLayout } from '../layouts/main-layout';
import { BrandingConfig } from '../../types/auth';

export const LoginPage = ({ branding }: { branding?: BrandingConfig | undefined } = {}): JSX.Element => {
    const siteName = branding?.siteName || 'OpenInspection';
    
    return (
        <BareLayout title={`Sign in | ${siteName}`} branding={branding}>
            <div class="relative min-h-screen flex flex-col justify-center py-12 px-6 lg:px-8 overflow-hidden font-sans">
                {/* Background Atmosphere */}
                <div class="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
                    <div class="absolute top-[-10%] right-[-10%] w-[50%] h-[60%] bg-indigo-50 rounded-full blur-[120px] animate-float"></div>
                    <div class="absolute bottom-[-10%] left-[-10%] w-[40%] h-[50%] bg-blue-50 rounded-full blur-[100px] animate-float" style="animation-delay: -3s;"></div>
                </div>

                <div class="sm:mx-auto sm:w-full sm:max-w-md animate-fade-in">
                    <div class="flex justify-center mb-8">
                        <div class="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-200 ring-8 ring-white">
                             <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        </div>
                    </div>
                    <h2 class="text-center text-4xl font-black tracking-tight text-slate-900 leading-tight">{siteName}</h2>
                    <p class="mt-4 text-center text-sm font-semibold text-slate-500 uppercase tracking-widest">Workspace Personnel Entry</p>
                </div>

                <div class="mt-12 sm:mx-auto sm:w-full sm:max-w-[480px] animate-fade-in" style="animation-delay: 0.1s;">
                    <div class="glass-panel px-10 py-16 rounded-[3rem]">
                        <form id="loginForm" class="space-y-8">
                            <div>
                                <label for="email" class="block text-sm font-black text-slate-900 tracking-tight ml-1 mb-3 uppercase">Account Email</label>
                                <div class="relative group">
                                    <div class="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition-opacity"></div>
                                    <input id="email" name="email" type="email" autocomplete="email" required placeholder="name@company.com"
                                        class="premium-input relative block w-full rounded-2xl border-0 py-5 text-slate-900 ring-2 ring-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 pl-6 transition-all" />
                                </div>
                            </div>

                            <div>
                                <div class="flex items-center justify-between ml-1 mb-3">
                                    <label for="password" class="block text-sm font-black text-slate-900 tracking-tight uppercase">Password</label>
                                    <div class="text-xs">
                                        <a href="#" class="font-bold text-indigo-600 hover:underline tracking-tight">Forgot access?</a>
                                    </div>
                                </div>
                                <div class="relative group">
                                    <div class="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition-opacity"></div>
                                    <input id="password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"
                                        class="premium-input relative block w-full rounded-2xl border-0 py-5 text-slate-900 ring-2 ring-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6 pl-6 transition-all" />
                                </div>
                            </div>

                            <div>
                                <button type="submit" id="submitBtn" 
                                    class="premium-button flex w-full justify-center rounded-2xl bg-indigo-600 px-6 py-5 text-base font-bold text-white shadow-xl shadow-indigo-100 hover:bg-slate-900 hover:shadow-indigo-200 active:scale-95 disabled:bg-slate-300 transition-all">
                                    Authorize Entry
                                </button>
                            </div>
                        </form>
                        
                        <div id="errorMsg" class="mt-6 p-4 rounded-xl bg-red-50 text-center text-sm text-red-600 font-bold border border-red-100 hidden animate-fade-in"></div>

                        <div class="mt-12 flex items-center justify-center gap-2">
                             <div class="h-px bg-slate-100 flex-1"></div>
                             <span class="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-4">New here?</span>
                             <div class="h-px bg-slate-100 flex-1"></div>
                        </div>

                        <p class="mt-8 text-center text-sm">
                            <a href="/book" class="inline-flex items-center gap-2 font-bold text-indigo-600 hover:text-slate-900 transition-colors">
                                <span>Register for an Inspection</span>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                            </a>
                        </p>
                    </div>
                </div>
            </div>
            <script src="/js/login.js"></script>
        </BareLayout>
    );
};
