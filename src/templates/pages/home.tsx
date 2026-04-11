import { BareLayout } from '../layouts/main-layout';
import { BrandingConfig } from '../../types/auth';

export const HomePage = ({ branding }: { branding?: BrandingConfig | undefined } = {}): JSX.Element => {
    const siteName = branding?.siteName || 'OpenInspection';
    
    return (
        <BareLayout title={siteName} branding={branding}>
            <div class="relative overflow-hidden font-sans">
                {/* Background Atmosphere */}
                <div class="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
                    <div class="absolute top-[-20%] left-[-10%] w-[60%] h-[80%] bg-indigo-100/40 rounded-full blur-[120px] animate-float"></div>
                    <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[70%] bg-blue-100/30 rounded-full blur-[100px] animate-float" style="animation-delay: -2s;"></div>
                </div>

                <div class="mx-auto max-w-7xl px-8 pb-32 pt-20 lg:pt-32">
                    <div class="lg:flex lg:items-center lg:gap-x-12">
                        {/* Left Content */}
                        <div class="mx-auto max-w-2xl lg:mx-0 lg:flex-auto animate-fade-in">
                            <div class="mb-10 flex">
                                <div class="relative rounded-full px-4 py-1.5 text-sm leading-6 text-indigo-600 ring-2 ring-indigo-600/10 hover:ring-indigo-600/20 glass transition-all font-bold tracking-tight">
                                    <span class="mr-2 uppercase text-[10px] tracking-widest text-white px-2 py-0.5 bg-indigo-600 rounded-md">New</span>
                                    Introducing AI-Powered Field Reports <a href="#" class="ml-2 font-bold text-slate-900"><span class="absolute inset-0" aria-hidden="true"></span>Read more <span aria-hidden="true">&rarr;</span></a>
                                </div>
                            </div>
                            <h1 class="text-gradient text-5xl font-black tracking-tight sm:text-7xl leading-[1.05]">
                                The Future of <br/>
                                <span class="relative">
                                    <span class="relative z-10 text-indigo-600">Home Inspection</span>
                                    <svg class="absolute -bottom-2 left-0 w-full h-3 text-indigo-200 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" stroke-width="8" fill="none" /></svg>
                                </span>
                            </h1>
                            <p class="mt-8 text-xl leading-relaxed text-slate-600 max-w-lg">
                                Professional, mobile-first property analysis tools for modern inspectors. Generate stunning reports, manage your team, and wow your clients.
                            </p>
                            <div class="mt-12 flex items-center gap-x-8">
                                <a href="/login" class="premium-button rounded-2xl bg-indigo-600 px-10 py-5 text-base font-bold text-white shadow-2xl shadow-indigo-200 hover:bg-slate-900 hover:shadow-indigo-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-95">Get Started Free</a>
                                <a href="/book" class="group text-base font-bold leading-6 text-slate-900 flex items-center gap-2">
                                    Book an Inspection 
                                    <span class="group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
                                </a>
                            </div>

                            <div class="mt-16 flex items-center gap-6 grayscale opacity-60">
                                <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">Trusted by leading firms</span>
                                <div class="flex gap-4 font-black text-xl text-slate-400">
                                    <span>REALTY</span>
                                    <span>•</span>
                                    <span>SAFEHOME</span>
                                    <span>•</span>
                                    <span>ELITE</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Right Visual */}
                        <div class="mt-20 lg:mt-0 lg:flex-shrink-0 lg:flex-grow animate-fade-in" style="animation-delay: 0.2s;">
                            <div class="relative group">
                                <div class="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                                <div class="relative rounded-[2rem] bg-slate-900/5 p-4 ring-1 ring-inset ring-slate-900/10 glass">
                                    <img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=2400&q=80" alt="App screenshot" width="2432" height="1442" class="w-[48rem] rounded-2xl shadow-2xl ring-1 ring-slate-900/10" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div class="bg-indigo-600/5 py-32">
                    <div class="mx-auto max-w-7xl px-8">
                        <div class="mx-auto max-w-2xl lg:text-center mb-20 animate-fade-in">
                            <h2 class="text-sm font-black leading-7 text-indigo-600 uppercase tracking-[0.3em]">Everything you need</h2>
                            <p class="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Professional grade utility.</p>
                            <p class="mt-6 text-lg leading-8 text-slate-600">
                                Integrated cloud storage, real-time sync, and professional PDF generation designed for the field.
                            </p>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { title: 'Rapid Reporting', desc: 'Generate complete PDF reports in minutes, not hours, right from your phone.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                                { title: 'Team Collaboration', desc: 'Seamlessly manage inspectors, assign tasks, and track progress in real-time.', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
                                { title: 'Client Experience', desc: 'Secure booking portal and interactive reports that clients and agents love.', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
                            ].map((f, i) => (
                                <div class="glass-card p-10 rounded-[2.5rem] animate-fade-in" style={`animation-delay: ${0.3 + i * 0.1}s`}>
                                    <div class="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-indigo-200">
                                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={f.icon}></path></svg>
                                    </div>
                                    <h3 class="text-xl font-extrabold text-slate-900 mb-4">{f.title}</h3>
                                    <p class="text-slate-600 leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </BareLayout>
    );
};
