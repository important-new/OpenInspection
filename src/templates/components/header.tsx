import { alpineEvents } from '../../types/alpine-events';
import { BrandingConfig } from '../../types/auth';

export const renderHeader = ({ branding }: { branding?: BrandingConfig | undefined } = {}): JSX.Element => {
    const siteName = branding?.siteName || 'OpenInspection';
    const logoUrl = branding?.logoUrl;
    
    const MenuIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block h-6 w-6">
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
    );
    const XIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="block h-6 w-6">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    );

    return (
        <header class="bg-white border-b border-slate-200 sticky top-0 z-50" x-data="{ mobileMenuOpen: false }">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    {/* Logo */}
                    <div class="flex-shrink-0 flex items-center">
                        <a href="/" class="flex items-center gap-2">
                            <img src={logoUrl || '/logo.svg'} alt={siteName} class="h-8 w-auto object-contain" />
                            <span class="text-xl font-bold tracking-tight text-slate-900">{siteName}</span>
                        </a>
                    </div>

                    {/* Desktop Navigation */}
                    <nav class="hidden md:flex items-center space-x-8">
                        <a href="/" class="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Home</a>
                        <a href="/book" class="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Book Inspection</a>
                    </nav>

                    {/* CTA Button */}
                    <div class="hidden md:flex items-center">
                        <a href="/book" class="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-all">
                            Book Now
                        </a>
                    </div>

                    {/* Mobile Menu Button */}
                    <div class="flex items-center md:hidden">
                        <button type="button" class="p-2 -mr-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none" {...alpineEvents({ click: "mobileMenuOpen = !mobileMenuOpen" })}>
                            <span x-show="!mobileMenuOpen">{MenuIcon}</span>
                            <span x-show="mobileMenuOpen" style="display: none;">{XIcon}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <div x-show="mobileMenuOpen" class="md:hidden bg-white border-t border-slate-200" style="display: none;" x-transition>
                <div class="pt-2 pb-3 space-y-1 px-4 sm:px-6">
                    <a href="/" class="block py-2 text-base font-medium text-slate-700 hover:text-indigo-600">Home</a>
                    <a href="/book" class="block py-2 text-base font-medium text-slate-700 hover:text-indigo-600">Book Inspection</a>
                </div>
                <div class="pt-4 pb-6 border-t border-slate-200 px-4 sm:px-6">
                    <a href="/book" class="flex justify-center w-full py-2.5 rounded-xl text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                        Book Now
                    </a>
                </div>
            </div>
        </header>
    );
};
