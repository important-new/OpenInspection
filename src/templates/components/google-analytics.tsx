export interface GoogleAnalyticsData {
    GA_MEASUREMENT_ID: string;
}

export function renderGoogleAnalytics(data: GoogleAnalyticsData): JSX.Element | null {
    if (!data.GA_MEASUREMENT_ID) {
        return null;
    }

    const id = data.GA_MEASUREMENT_ID;

    const inlineScript = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            // Default consent to denied
            gtag('consent', 'default', {
                'analytics_storage': 'denied',
                'ad_storage': 'denied'
            });

            gtag('config', '${id}', {
                page_path: window.location.pathname,
            });

            // Track page views on navigation (for SPA-like behavior)
            function trackPageView(url) {
                if (typeof gtag !== 'undefined') {
                    gtag('config', '${id}', {
                        page_path: url,
                    });
                }
            }

            // Listen for navigation changes (if using client-side routing)
            if (typeof window !== 'undefined') {
                // Track initial page view
                trackPageView(window.location.pathname + window.location.search);

                // Track navigation changes
                let currentUrl = window.location.href;
                const observer = new MutationObserver(() => {
                    if (window.location.href !== currentUrl) {
                        currentUrl = window.location.href;
                        trackPageView(window.location.pathname + window.location.search);
                    }
                });

                observer.observe(document, { subtree: true, childList: true });
            }
        `;

    return (
        <>
            {/* Google Analytics */}
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`}></script>
            <script dangerouslySetInnerHTML={{ __html: inlineScript }} />
        </>
    );
}
