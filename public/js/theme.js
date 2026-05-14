/**
 * Color scheme — auto / dark / light.
 * Reads/writes localStorage key 'ih-color-scheme'.
 *   null / absent → auto  (follow OS prefers-color-scheme)
 *   'dark'        → dark
 *   'light'       → light
 *
 * Public API:
 *   window.setColorScheme(mode)  — set 'auto'|'dark'|'light' explicitly
 *   window.themeMenu()           — Alpine factory for the sidebar dropdown
 *
 * The html[data-color-scheme] attribute is set by an inline <script> in
 * <head> before stylesheets load to prevent FOUC.
 */
(function () {
    function currentMode() {
        var s = localStorage.getItem('ih-color-scheme');
        return s === 'dark' || s === 'light' ? s : 'auto';
    }

    function isDark() {
        return document.documentElement.getAttribute('data-color-scheme') === 'dark';
    }

    function applyMode(mode) {
        if (mode === 'auto') {
            localStorage.removeItem('ih-color-scheme');
            var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-color-scheme', sysDark ? 'dark' : 'light');
        } else {
            localStorage.setItem('ih-color-scheme', mode);
            document.documentElement.setAttribute('data-color-scheme', mode);
        }
    }

    function effectiveLabel() {
        var mode = currentMode();
        var dark = isDark();
        if (mode === 'auto') return 'Auto · ' + (dark ? 'Dark' : 'Light');
        return dark ? 'Dark' : 'Light';
    }

    function updateUI() {
        var mode = currentMode();
        var label = effectiveLabel();

        // Desktop icons
        var moon = document.getElementById('themeMoonIcon');
        var sun  = document.getElementById('themeSunIcon');
        var auto = document.getElementById('themeAutoIcon');
        var lbl  = document.getElementById('themeToggleLabel');
        if (moon) moon.classList.toggle('hidden', mode !== 'dark');
        if (sun)  sun.classList.toggle('hidden', mode !== 'light');
        if (auto) auto.classList.toggle('hidden', mode !== 'auto');
        if (lbl)  lbl.textContent = label;

        // Mobile icons
        var mmoon = document.getElementById('mobileThemeMoonIcon');
        var msun  = document.getElementById('mobileThemeSunIcon');
        var mauto = document.getElementById('mobileThemeAutoIcon');
        var mlbl  = document.getElementById('mobileThemeLabel');
        if (mmoon) mmoon.classList.toggle('hidden', mode !== 'dark');
        if (msun)  msun.classList.toggle('hidden', mode !== 'light');
        if (mauto) mauto.classList.toggle('hidden', mode !== 'auto');
        if (mlbl)  mlbl.textContent = label;
    }

    window.setColorScheme = function (mode) {
        applyMode(mode);
        updateUI();
    };

    // Alpine factory for the sidebar dropdown
    window.themeMenu = function () {
        return {
            open: false,
            get mode() { return currentMode(); },
            set: function (m) {
                this.open = false;
                window.setColorScheme(m);
            },
        };
    };

    // Sync UI on first paint (icons may not be in DOM during <head> script)
    document.addEventListener('DOMContentLoaded', updateUI);

    // React to OS-level changes when user is in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (currentMode() === 'auto') {
            document.documentElement.setAttribute('data-color-scheme', e.matches ? 'dark' : 'light');
            updateUI();
        }
    });
})();
