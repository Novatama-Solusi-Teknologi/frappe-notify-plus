(() => {
    "use strict";
    function initialize() {
        if (frappe.notify_plus) return;
        // app_include_js may execute before Desk populates frappe.session.user.
        const user = frappe.boot?.user?.name || frappe.session?.user;
        if (!user || user === "Guest") return;
        const seen = new Set();
        let audioContext, unlocked = false, activeAudio;
        const storageKey = `notify-plus-sound:${user}`;
        const legacyKey = `notify-plus-muted:${user}`;
        const readPreference = () => {
            try {
                const saved = localStorage.getItem(storageKey);
                if (["enabled", "muted", "disabled"].includes(saved)) return saved;
                const legacy = localStorage.getItem(legacyKey);
                return legacy === "1" ? "muted" : legacy === "0" ? "enabled" : "disabled";
            } catch { return "disabled"; }
        };
        let preference = readPreference();
        const savePreference = value => {
            preference = value;
            try {
                localStorage.setItem(storageKey, value);
            } catch {
                frappe.show_alert({
                    message: __("Sound preference could not be saved. Allow browser storage for this site to keep it after reload."),
                    indicator: "orange"
                });
            }
        };
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
            control.textContent = preference === "muted" ? __("Unmute notifications") : preference === "enabled" ? __("Mute notifications") : __("Enable sound");
            control.title = __("Notify Plus sound settings for this browser");
        };
        function unlock() {
            if (preference !== "enabled") return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioContext ||= new AudioContext();
                // Autoplay permission is transient; it must never overwrite user preference.
                // Do not await resume: browsers can keep its promise pending until a gesture.
                unlocked = audioContext.state === "running";
                void audioContext.resume().then(() => {
                    unlocked = audioContext.state === "running";
                    if (preference !== "enabled") stopAudio();
                }).catch(() => { unlocked = false; });
            } catch { unlocked = false; }
        }
        function stopAudio() {
            activeAudio?.pause();
            unlocked = false;
            if (audioContext?.state === "running") void audioContext.suspend().catch(() => {});
        }
        control.onclick = () => {
            savePreference(preference === "enabled" ? "muted" : "enabled");
            if (preference === "enabled") unlock();
            else stopAudio();
            updateControl();
        };
        // Restore audio automatically on ordinary Desk interaction if autoplay is blocked.
        for (const event of ["pointerdown", "keydown"]) {
            document.addEventListener(event, () => {
                if (preference === "enabled" && (!unlocked || audioContext?.state !== "running")) unlock();
            }, {capture: true});
        }
        window.addEventListener("storage", event => {
            if (event.key !== storageKey && event.key !== null) return;
            preference = readPreference();
            if (preference === "enabled") unlock();
            else stopAudio();
            updateControl();
        });
        function mountControl() {
            if (!control.isConnected) document.body.append(control);
            updateControl();
        }
        async function play(data) {
            if (preference !== "enabled" || !unlocked || data.sound === "None") return;
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
            const hasRecord = typeof data.document_type === "string" && data.document_type.trim()
                && typeof data.document_name === "string" && data.document_name.trim();
            if (!preview && (hasRecord || data.id)) {
                const navigate = () => {
                    if (hasRecord) frappe.set_route("Form", data.document_type, data.document_name);
                    else frappe.set_route("Form", "Notification Log", data.id);
                    dismiss();
                };
                const open = text("button", hasRecord ? __("Open document") : __("Open notification"), "np-open");
                open.type = "button";
                open.onclick = navigate;
                body.append(open);
                toast.classList.add("np-clickable");
                toast.onclick = event => {
                    if (!event.target.closest("button")) navigate();
                };
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
            version: "0.1.2",
            show,
            preview: data => {
                if (preference === "disabled") savePreference("enabled");
                mountControl(); unlock(); show(data, true);
            }
        };
        mountControl();
        if (preference === "enabled") unlock();
        frappe.realtime.on("notify_plus", data => show(data));
    }
    // app_ready handles late Desk startup; ready handles assets loaded after that event.
    $(document).on("app_ready", initialize);
    $(initialize);
})();
