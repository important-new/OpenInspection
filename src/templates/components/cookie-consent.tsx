import { BrandingConfig } from '../../types/auth';

const cookieScript = `
            (function() {
                // Cookie consent functionality
                const banner = document.getElementById('cookie-consent-banner');
                const modal = document.getElementById('cookie-preferences-modal');
                const customizeBtn = document.getElementById('cookie-customize-btn');
                const acceptAllBtn = document.getElementById('cookie-accept-all-btn');
                const declineAllBtn = document.getElementById('cookie-decline-all-btn');
                const modalCloseBtn = document.getElementById('cookie-modal-close-btn');
                const modalBackdrop = document.getElementById('cookie-modal-backdrop');
                const savePreferencesBtn = document.getElementById('cookie-save-preferences-btn');
                const cancelBtn = document.getElementById('cookie-cancel-btn');
                const analyticsCheckbox = document.getElementById('analytics-checkbox');
                const marketingCheckbox = document.getElementById('marketing-checkbox');
                const analyticsPreference = document.getElementById('analytics-preference');
                const marketingPreference = document.getElementById('marketing-preference');

                // Initialize preferences
                let preferences = {
                    analytics: true,
                    marketing: false
                };

                // Update gtag consent
                function updateGtag(prefs) {
                    if (typeof window !== 'undefined' && window.gtag) {
                        window.gtag('consent', 'update', {
                            'analytics_storage': prefs.analytics ? 'granted' : 'denied',
                            'ad_storage': prefs.marketing ? 'granted' : 'denied'
                        });
                    }
                }

                // Show banner if no consent stored
                function initializeCookieConsent() {
                    const storedConsent = localStorage.getItem('cookie-consent');

                    if (!storedConsent) {
                        setTimeout(() => {
                            banner.style.display = 'block';
                        }, 100);
                    } else if (storedConsent === 'accepted') {
                        // Legacy: if previously "accepted" (all), grant all
                        updateGtag({ analytics: true, marketing: true });
                    } else if (storedConsent === 'declined') {
                        // Legacy: if previously "declined", deny all
                        updateGtag({ analytics: false, marketing: false });
                    } else {
                        // New granular format: stored as JSON string
                        try {
                            const parsed = JSON.parse(storedConsent);
                            if (parsed && typeof parsed === 'object') {
                                const newPrefs = {
                                    analytics: !!parsed.analytics,
                                    marketing: !!parsed.marketing
                                };
                                preferences = newPrefs;
                                updateGtag(newPrefs);
                            }
                        } catch {
                            // If parse fails, treat as new visitor
                            banner.style.display = 'block';
                        }
                    }
                }

                // Event handlers
                function handleAcceptAll() {
                    const allGranted = { analytics: true, marketing: true };
                    localStorage.setItem('cookie-consent', JSON.stringify(allGranted));
                    preferences = allGranted;
                    updateGtag(allGranted);
                    banner.style.display = 'none';
                }

                function handleDeclineAll() {
                    const allDenied = { analytics: false, marketing: false };
                    localStorage.setItem('cookie-consent', JSON.stringify(allDenied));
                    preferences = allDenied;
                    updateGtag(allDenied);
                    banner.style.display = 'none';
                }

                function showPreferences() {
                    // Update checkboxes with current preferences
                    analyticsCheckbox.checked = preferences.analytics;
                    marketingCheckbox.checked = preferences.marketing;
                    modal.style.display = 'block';
                }

                function hidePreferences() {
                    modal.style.display = 'none';
                }

                function handleSavePreferences() {
                    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
                    updateGtag(preferences);
                    hidePreferences();
                    banner.style.display = 'none';
                }

                function togglePreference(key) {
                    preferences[key] = !preferences[key];
                    if (key === 'analytics') {
                        analyticsCheckbox.checked = preferences.analytics;
                    } else if (key === 'marketing') {
                        marketingCheckbox.checked = preferences.marketing;
                    }
                }

                // Bind events
                if (acceptAllBtn) acceptAllBtn.addEventListener('click', handleAcceptAll);
                if (declineAllBtn) declineAllBtn.addEventListener('click', handleDeclineAll);
                if (customizeBtn) customizeBtn.addEventListener('click', showPreferences);
                if (modalCloseBtn) modalCloseBtn.addEventListener('click', hidePreferences);
                if (modalBackdrop) modalBackdrop.addEventListener('click', hidePreferences);
                if (savePreferencesBtn) savePreferencesBtn.addEventListener('click', handleSavePreferences);
                if (cancelBtn) cancelBtn.addEventListener('click', hidePreferences);

                // Toggle preferences on click
                if (analyticsPreference) {
                    analyticsPreference.addEventListener('click', () => togglePreference('analytics'));
                }
                if (marketingPreference) {
                    marketingPreference.addEventListener('click', () => togglePreference('marketing'));
                }

                // Also handle checkbox clicks directly
                if (analyticsCheckbox) {
                    analyticsCheckbox.addEventListener('change', () => {
                        preferences.analytics = analyticsCheckbox.checked;
                    });
                }
                if (marketingCheckbox) {
                    marketingCheckbox.addEventListener('change', () => {
                        preferences.marketing = marketingCheckbox.checked;
                    });
                }

                // Initialize on page load
                initializeCookieConsent();
            })();
        `;

export const renderCookieConsent = ({ branding: _branding }: { branding?: BrandingConfig | undefined } = {}): JSX.Element => {
    return (
        <>
            {/* Cookie Consent Banner */}
            <div id="cookie-consent-banner" class="fixed bottom-0 inset-x-0 pb-2 sm:pb-5 z-50" style="display: none;">
                <div class="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
                    <div class="p-2 rounded-lg bg-gray-900 shadow-lg sm:p-3 border border-gray-800">
                        <div class="flex items-center justify-between flex-wrap gap-4">
                            <div class="w-full flex-1 flex items-center sm:w-0">
                                <span class="flex p-2 rounded-lg bg-gray-800">
                                    <span class="text-xl">??</span>
                                </span>
                                <div class="ml-3 font-medium text-gray-200">
                                    <span class="md:hidden">We use cookies to improve your experience.</span>
                                    <span class="hidden md:inline">
                                        We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic.
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                                <button
                                    id="cookie-customize-btn"
                                    class="text-sm text-gray-400 hover:text-white underline decoration-dotted underline-offset-4"
                                >
                                    Customize
                                </button>
                                <div class="flex gap-2 w-full sm:w-auto">
                                    <button
                                        id="cookie-decline-all-btn"
                                        class="flex-1 sm:flex-none justify-center px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-transparent hover:bg-gray-800 transition-colors"
                                    >
                                        Decline All
                                    </button>
                                    <button
                                        id="cookie-accept-all-btn"
                                        class="flex-1 sm:flex-none justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-900 bg-white hover:bg-gray-100 transition-colors"
                                    >
                                        Accept All
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cookie Preferences Modal */}
            <div id="cookie-preferences-modal" class="fixed inset-0 z-60 overflow-y-auto" style="display: none;" role="dialog" aria-modal="true">
                <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div class="fixed inset-0 bg-gray-900/75 transition-opacity" id="cookie-modal-backdrop"></div>

                    <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

                    <div class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div class="flex justify-between items-start mb-4">
                                <h3 class="text-lg leading-6 font-medium text-gray-900">
                                    Cookie Preferences
                                </h3>
                                <button
                                    id="cookie-modal-close-btn"
                                    class="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                                >
                                    <span class="sr-only">Close</span>
                                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div class="mt-2 text-sm text-gray-500 mb-6">
                                Customize your cookie preferences. Essential cookies are necessary for the website to function properly and cannot be disabled.
                            </div>

                            <div class="space-y-4">
                                {/* Essential */}
                                <div class="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2">
                                            <h4 class="text-sm font-medium text-gray-900">Essential</h4>
                                            <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Required</span>
                                        </div>
                                        <p class="text-xs text-gray-500 mt-1">Necessary for the website to function (e.g., security, verify identity).</p>
                                    </div>
                                    <div class="ml-4 flex items-center h-5">
                                        <input
                                            type="checkbox"
                                            checked
                                            disabled
                                            class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 opacity-50 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* Analytics */}
                                <div class="flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors cursor-pointer" id="analytics-preference">
                                    <div class="flex-1">
                                        <h4 class="text-sm font-medium text-gray-900">Analytics</h4>
                                        <p class="text-xs text-gray-500 mt-1">
                                            Helps us understand how visitors interact with the website.
                                        </p>
                                    </div>
                                    <div class="ml-4 flex items-center h-5">
                                        <input
                                            type="checkbox"
                                            id="analytics-checkbox"
                                            checked
                                            class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                {/* Marketing */}
                                <div class="flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors cursor-pointer" id="marketing-preference">
                                    <div class="flex-1">
                                        <h4 class="text-sm font-medium text-gray-900">Marketing & Advertisement</h4>
                                        <p class="text-xs text-gray-500 mt-1">
                                            Used to display relevant ads and track ad performance.
                                        </p>
                                    </div>
                                    <div class="ml-4 flex items-center h-5">
                                        <input
                                            type="checkbox"
                                            id="marketing-checkbox"
                                            class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                            <button
                                type="button"
                                id="cookie-save-preferences-btn"
                                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                            >
                                Save Preferences
                            </button>
                            <button
                                type="button"
                                id="cookie-cancel-btn"
                                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <script dangerouslySetInnerHTML={{ __html: cookieScript }} />
        </>
    );
};
