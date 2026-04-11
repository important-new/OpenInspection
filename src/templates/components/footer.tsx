import { BrandingConfig } from '../../types/auth';

export const renderFooter = ({ branding }: { branding?: BrandingConfig | undefined } = {}): JSX.Element => {
    const siteName = branding?.siteName || 'OpenInspection';
    const logoUrl = branding?.logoUrl;
    const year = new Date().getFullYear();

    return (
        <footer class="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
                    {/* Brand */}
                    <div>
                        <div class="flex items-center gap-2 mb-4">
                            {logoUrl ? (
                                <img src={logoUrl} alt={siteName} class="h-6 w-auto object-contain" />
                            ) : (
                                <div class="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                            )}
                            <span class="text-lg font-bold text-white">{siteName}</span>
                        </div>
                        <p class="text-sm text-slate-400 leading-relaxed">
                            Professional property inspections. Comprehensive reports delivered digitally, same-day.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Quick Links</h4>
                        <ul class="space-y-2 text-sm">
                            <li><a href="/" class="hover:text-indigo-400 transition-colors">Home</a></li>
                            <li><a href="/book" class="hover:text-indigo-400 transition-colors">Book an Inspection</a></li>
                            <li><a href="/login" class="hover:text-indigo-400 transition-colors">Inspector Login</a></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 class="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Legal</h4>
                        <ul class="space-y-2 text-sm">
                            <li><a href="/privacy" class="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
                            <li><a href="/terms" class="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
                        </ul>
                    </div>
                </div>

                <div class="border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
                    &copy; {year} {siteName}. All rights reserved.
                </div>
            </div>
        </footer>
    );
};
