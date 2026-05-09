import { SettingsLayout } from '../components/settings-layout';
import type { BrandingConfig } from '../../types/auth';

interface Props {
    branding?: BrandingConfig | undefined;
    /**
     * Booking #7 Sprint A — current value of users.slug for the signed-in
     * inspector. `null` when they haven't picked one yet, in which case the
     * slug card renders an empty input + a helper hint instead of the live
     * booking-link preview.
     */
    currentSlug?: string | null;
    /**
     * Booking #7 Sprint A — used to render the booking-link preview as
     * `<subdomain>.inspectorhub.io/book/<slug>`. The route handler resolves
     * this from the tenants table on the request path.
     */
    tenantSubdomain?: string;
}

/**
 * Settings → Profile
 * Inspector identity (name / phone / license #) plus — Booking #7 Sprint A —
 * the per-inspector booking slug card. The slug input wires into
 * `/api/public/check/slug` for live availability and posts to
 * `/api/profile/slug` to save.
 */
export const SettingsProfilePage = ({ branding, currentSlug, tenantSubdomain }: Props): JSX.Element => {
    const slug = currentSlug ?? null;
    const subdomain = tenantSubdomain ?? '';
    const bookingLink = slug && subdomain
        ? `${subdomain}.inspectorhub.io/book/${slug}`
        : null;
    return (
        <SettingsLayout
            branding={branding}
            title="Settings | Profile"
            group="profile"
            subPage="profile"
            pageTitle="Profile"
            pageSubtitle="Inspector identity that appears on every report you generate."
        >
            <section class="bg-white rounded-lg border border-surface-200 p-6 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div class="space-y-2">
                        <label for="profileName" class="block text-xs font-bold text-ink-700 uppercase tracking-[0.2em]">Full Name</label>
                        <input type="text" id="profileName" placeholder="John Smith"
                            class="w-full px-3 py-2 rounded-md border border-surface-200 focus:border-blueprint-500 focus:ring-1 focus:ring-blueprint-500 outline-none transition-all font-medium text-sm placeholder:text-ink-300" />
                        <p class="text-[11px] text-ink-500">Displayed on inspection reports.</p>
                    </div>
                    <div class="space-y-2">
                        <label for="profilePhone" class="block text-xs font-bold text-ink-700 uppercase tracking-[0.2em]">Phone</label>
                        <input type="tel" id="profilePhone" placeholder="(555) 123-4567"
                            class="w-full px-3 py-2 rounded-md border border-surface-200 focus:border-blueprint-500 focus:ring-1 focus:ring-blueprint-500 outline-none transition-all font-medium text-sm placeholder:text-ink-300" />
                    </div>
                    <div class="space-y-2">
                        <label for="profileLicense" class="block text-xs font-bold text-ink-700 uppercase tracking-[0.2em]">License #</label>
                        <input type="text" id="profileLicense" placeholder="HI-12345"
                            class="w-full px-3 py-2 rounded-md border border-surface-200 focus:border-blueprint-500 focus:ring-1 focus:ring-blueprint-500 outline-none transition-all font-medium text-sm placeholder:text-ink-300" />
                        <p class="text-[11px] text-ink-500">State inspector license number.</p>
                    </div>
                </div>

                <div class="flex justify-end pt-2 border-t border-surface-200">
                    <button onclick="saveProfile()" id="saveProfileBtn"
                        class="px-4 py-2 bg-blueprint-500 text-white rounded-md font-bold text-sm hover:bg-blueprint-700 active:scale-[.98] transition-all disabled:bg-surface-200 disabled:cursor-not-allowed">
                        Save Profile
                    </button>
                </div>
            </section>

            {/* Booking #7 Sprint A — booking slug card. */}
            <section class="bg-white rounded-lg border border-surface-200 p-6 space-y-6 mt-6">
                <header class="space-y-1">
                    <h3 class="text-[11px] font-bold text-ink-500 uppercase tracking-[0.2em]">Booking link</h3>
                    <p class="text-xs text-ink-500">
                        Customers visit this URL to book inspections directly with you.
                    </p>
                </header>

                <label class="block">
                    <span class="block text-[13px] font-semibold text-ink-900 mb-1">Slug</span>
                    <input
                        type="text"
                        id="profileSlug"
                        name="slug"
                        data-testid="settings-slug-input"
                        value={slug ?? ''}
                        placeholder="your-public-username"
                        autocomplete="off"
                        class="block w-full rounded-md border border-surface-200 px-3 py-2 text-sm focus:border-blueprint-500 focus:ring-2 focus:ring-blueprint-200 outline-none transition-colors"
                    />
                    <p
                        id="profileSlugStatus"
                        data-testid="settings-slug-status"
                        class="mt-1 text-xs text-ink-500"
                    >Lowercase letters, numbers, and hyphens (3-32 chars).</p>
                </label>

                {bookingLink ? (
                    <div class="rounded-md bg-surface-50 px-4 py-3 flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-xs uppercase tracking-wider text-ink-500 mb-1">Your booking link</p>
                            <code
                                data-testid="settings-slug-link"
                                class="text-sm font-mono text-ink-900 break-all"
                            >{bookingLink}</code>
                        </div>
                        <button
                            type="button"
                            id="profileSlugCopy"
                            data-testid="settings-slug-copy"
                            class="text-xs font-semibold text-blueprint-600 hover:underline whitespace-nowrap"
                        >Copy</button>
                    </div>
                ) : (
                    <p data-testid="settings-slug-empty-hint" class="text-xs text-ink-500">
                        Customers visit this URL to book inspections directly with you. Pick a slug to publish your booking page.
                    </p>
                )}

                <div class="flex justify-end pt-2 border-t border-surface-200">
                    <button
                        type="button"
                        id="saveProfileSlugBtn"
                        class="px-4 py-2 bg-blueprint-500 text-white rounded-md font-bold text-sm hover:bg-blueprint-700 active:scale-[.98] transition-all disabled:bg-surface-200 disabled:cursor-not-allowed"
                    >Save Slug</button>
                </div>
            </section>

            <script src="/js/auth.js"></script>
            <script src="/js/settings.js"></script>
            <script src="/js/settings-profile-slug.js"></script>
        </SettingsLayout>
    );
};
