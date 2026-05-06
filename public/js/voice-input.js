// Phase T — Web Speech API mic button helper.
// Usage:
//   <button data-mic-target="textarea-id-or-#selector">🎤</button>
// Click toggles recording; transcript appended to target's value as the user speaks.
// Hides itself if browser does not support SpeechRecognition.
//
// i18n: defaults to en-US. Set window.__voice_lang to a BCP-47 tag to override.

(function() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('[data-mic-target]').forEach((btn) => { btn.style.display = 'none'; });
        });
        return;
    }

    function attachMic(button) {
        if (button.getAttribute('data-mic-bound') === '1') return;
        button.setAttribute('data-mic-bound', '1');

        const targetSel = button.getAttribute('data-mic-target');
        let recog = null;
        let active = false;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            const target = targetSel.startsWith('#') || targetSel.startsWith('.')
                ? document.querySelector(targetSel)
                : document.getElementById(targetSel);
            if (!target) return;

            if (active) {
                if (recog) try { recog.stop(); } catch { /* ignore */ }
                return;
            }

            recog = new Recognition();
            recog.lang = window.__voice_lang || 'en-US';
            recog.continuous = true;
            recog.interimResults = true;

            const baseValue = target.value || '';
            let finalAppend = '';

            recog.onresult = (event) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) finalAppend += transcript + ' ';
                    else interim += transcript;
                }
                const sep = baseValue && (finalAppend || interim) ? ' ' : '';
                target.value = (baseValue + sep + finalAppend + interim).trim();
                target.dispatchEvent(new Event('input', { bubbles: true }));
            };

            recog.onerror = () => { setActive(false); };
            recog.onend = () => { setActive(false); };
            try {
                recog.start();
                setActive(true);
            } catch {
                setActive(false);
            }
        });

        function setActive(on) {
            active = on;
            button.classList.toggle('mic-recording', on);
            button.setAttribute('aria-pressed', String(on));
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-mic-target]').forEach(attachMic);
    });

    // Re-scan when Alpine renders new content (e.g. after tab switch, modal open).
    document.addEventListener('alpine:initialized', () => {
        document.querySelectorAll('[data-mic-target]').forEach(attachMic);
    });

    // Public hook for code that adds buttons after initial load.
    window.__rebindMicButtons = function() {
        document.querySelectorAll('[data-mic-target]').forEach(attachMic);
    };
})();
