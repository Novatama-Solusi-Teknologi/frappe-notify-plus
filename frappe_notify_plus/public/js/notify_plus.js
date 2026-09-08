(() => {
    "use strict";
    if (frappe.notify_plus) return;
    const seen = new Set();
    let audioContext, unlocked = false, activeAudio;
    const storageKey = `notify-plus-muted:${frappe.session.user}`;
    const readMute = () => { try { return localStorage.getItem(storageKey) === "1"; } catch { return false; } };
    let muted = readMute();
    const text = (tag, value, className) => {
        const element = document.createElement(tag);
        element.textContent = value || "";
        if (className) element.className = className;
        return element;
    };
    const slug = value => String(value || "").toLowerCase().replaceAll(" ", "-");
    const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
    const number = (value, fallback, max) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Number(value))) : fallback;
    const control = text("button", "", "np-audio-control");
    control.type = "button";
    const updateControl = () => {
        control.textContent = muted ? __("Unmute notifications") : unlocked ? __("Mute notifications") : __("Enable sound");
        control.title = __("Notify Plus sound settings for this browser");
    };
    async function unlock() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext ||= new AudioContext();
            await audioContext.resume();
            unlocked = audioContext.state === "running";
        } catch { unlocked = false; }
        updateControl();
    }
    control.onclick = async () => {
        if (!unlocked && !muted) await unlock();
        else {
            muted = !muted;
            try { localStorage.setItem(storageKey, muted ? "1" : "0"); } catch { /* Storage may be disabled. */ }
            if (!muted) await unlock();
            else {
                activeAudio?.pause();
                if (audioContext?.state === "running") await audioContext.suspend();
            }
        }
        updateControl();
    };
    function mountControl() {
        if (!control.isConnected) document.body.append(control);
        updateControl();
    }
    async function play(data) {
        if (muted || !unlocked || data.sound === "None") return;
        const volume = number(data.volume, 60, 100) / 100;
        if (data.sound === "Custom") {
            try {
                const url = new URL(data.custom_sound, location.origin);
                if (url.origin !== location.origin || !url.pathname.startsWith("/files/") || !/\.(mp3|wav|ogg)$/i.test(url.pathname)) return;
                activeAudio?.pause();
                activeAudio = new Audio(url.href);
                activeAudio.volume = volume;
                await activeAudio.play();
            } catch { unlocked = false; updateControl(); }
            return;
        }
        const notes = {Chime: [660, 880], Bell: [1046, 784], Pulse: [440, 440, 660]}[data.sound];
        if (!notes || !audioContext) return;
        notes.forEach((frequency, index) => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const start = audioContext.currentTime + index * 0.18;
            oscillator.type = "sine";
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(volume * 0.18, start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            oscillator.connect(gain); gain.connect(audioContext.destination);
            oscillator.start(start); oscillator.stop(start + 0.36);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        });
    }
    function show(data, preview = false) {
        if (!data || typeof data !== "object") return;
        if (!preview && data.id) {
            if (seen.has(data.id)) return;
            seen.add(data.id);
            if (seen.size > 300) seen.delete(seen.values().next().value);
        }
        mountControl();
        const position = slug(choice(data.position, ["Top Right", "Top Left", "Bottom Right", "Bottom Left"], "Top Right"));
        let stack = document.getElementById(`np-${position}`);
        if (!stack) {
            stack = text("div", "", `np-stack np-${position}`);
            stack.id = `np-${position}`;
            stack.setAttribute("aria-label", __("Notifications"));
            document.body.append(stack);
        }
        // Bound visible toasts; history stays available in the notification bell.
        if (stack.children.length >= 5) stack.firstElementChild.npDismiss();
        const style = slug(choice(data.toast_style, ["Minimal", "Accent", "Solid", "Glass", "Banner"], "Accent"));
        const tone = slug(choice(data.tone, ["Info", "Success", "Warning", "Danger"], "Info"));
        const toast = text("article", "", `np-toast np-style-${style} np-tone-${tone}`);
        toast.setAttribute("role", tone === "danger" ? "alert" : "status");
        toast.setAttribute("aria-atomic", "true");
        const icon = text("span", {info:"i", success:"✓", warning:"!", danger:"!"}[tone], "np-icon");
        icon.setAttribute("aria-hidden", "true");
        const body = text("div", "", "np-body");
        body.append(text("strong", String(data.title || __("Notification")).slice(0, 240), "np-title"));
        if (data.message) body.append(text("p", String(data.message).slice(0, 600), "np-message"));
        let timer;
        const dismiss = () => { clearTimeout(timer); toast.remove(); };
        toast.npDismiss = dismiss;
        if (!preview && data.id) {
            const open = text("button", __("Open notification"), "np-open");
            open.type = "button";
            open.onclick = () => { frappe.set_route("Form", "Notification Log", data.id); dismiss(); };
            body.append(open);
        }
        const close = text("button", "×", "np-close");
        close.type = "button";
        close.setAttribute("aria-label", __("Dismiss notification"));
        close.onclick = dismiss;
        toast.onkeydown = event => { if (event.key === "Escape") dismiss(); };
        toast.append(icon, body, close);
        stack.append(toast);
        const duration = number(data.duration, 7, 60) * 1000;
        const schedule = () => {
            clearTimeout(timer);
            if (duration && !toast.matches(":hover") && !toast.contains(document.activeElement)) timer = setTimeout(dismiss, duration);
        };
        toast.onmouseenter = toast.onfocusin = () => clearTimeout(timer);
        toast.onmouseleave = schedule;
        toast.onfocusout = () => setTimeout(schedule, 0);
        schedule();
        void play(data);
    }
    frappe.notify_plus = {
        show,
        preview: async data => { mountControl(); await unlock(); show(data, true); }
    };
    $(function () {
        mountControl();
        frappe.realtime.on("notify_plus", data => show(data));
    });
})();
