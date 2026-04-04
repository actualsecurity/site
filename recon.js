(function () {
    "use strict";

    function set(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value || "Unavailable";
    }

    // --- OS detection ---
    function getOS() {
        var ua = navigator.userAgent;
        if (ua.indexOf("Win") !== -1) return "Windows";
        if (ua.indexOf("Mac") !== -1) return "macOS";
        if (ua.indexOf("CrOS") !== -1) return "ChromeOS";
        if (ua.indexOf("Linux") !== -1) return "Linux";
        if (ua.indexOf("Android") !== -1) return "Android";
        if (/iPad|iPhone|iPod/.test(ua)) return "iOS";
        return "Unknown";
    }

    // --- Browser detection ---
    function getBrowser() {
        var ua = navigator.userAgent;
        if (ua.indexOf("Firefox") !== -1) return "Firefox";
        if (ua.indexOf("Edg/") !== -1) return "Edge";
        if (ua.indexOf("OPR/") !== -1 || ua.indexOf("Opera") !== -1) return "Opera";
        if (ua.indexOf("Brave") !== -1) return "Brave";
        if (ua.indexOf("Chrome") !== -1) return "Chrome";
        if (ua.indexOf("Safari") !== -1) return "Safari";
        return "Unknown";
    }

    // --- GPU via WebGL ---
    function getGPU() {
        try {
            var canvas = document.createElement("canvas");
            var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) return "Unavailable";
            var ext = gl.getExtension("WEBGL_debug_renderer_info");
            if (!ext) return "Hidden by browser";
            return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        } catch (e) {
            return "Unavailable";
        }
    }

    // --- Local info (immediate) ---
    function populateLocal() {
        set("r-os", getOS());
        set("r-browser", getBrowser());
        set("r-screen", window.screen.width + " x " + window.screen.height + " @ " + (window.devicePixelRatio || 1) + "x");
        set("r-tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
        set("r-lang", navigator.language || navigator.userLanguage);
        set("r-cores", navigator.hardwareConcurrency ? navigator.hardwareConcurrency + " threads" : "Hidden");
        set("r-mem", navigator.deviceMemory ? navigator.deviceMemory + " GB" : "Hidden by browser");
        set("r-gpu", getGPU());
        set("r-dnt", navigator.doNotTrack === "1" ? "Enabled" : "Not set");
        set("r-cookies", navigator.cookieEnabled ? "Yes" : "No");
        set("r-touch", ("ontouchstart" in window || navigator.maxTouchPoints > 0) ? "Yes (" + navigator.maxTouchPoints + " points)" : "No");
        set("r-referrer", document.referrer || "Direct / None");
        set("r-time", new Date().toLocaleString());

        // Connection info
        var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
            var parts = [];
            if (conn.effectiveType) parts.push(conn.effectiveType.toUpperCase());
            if (conn.downlink) parts.push(conn.downlink + " Mbps");
            if (conn.rtt) parts.push(conn.rtt + "ms RTT");
            set("r-connection", parts.join(" / ") || "Unknown");
        } else {
            set("r-connection", "Hidden by browser");
        }

        // Battery
        if (navigator.getBattery) {
            navigator.getBattery().then(function (battery) {
                var level = Math.round(battery.level * 100) + "%";
                var charging = battery.charging ? " (Charging)" : " (Discharging)";
                set("r-battery", level + charging);
            }).catch(function () {
                set("r-battery", "Hidden by browser");
            });
        } else {
            set("r-battery", "Hidden by browser");
        }
    }

    // --- IP / location via ipapi.co ---
    function populateNetwork() {
        fetch("https://ipapi.co/json/")
            .then(function (r) { return r.json(); })
            .then(function (data) {
                set("r-ip", data.ip || "Unavailable");
                var loc = [];
                if (data.city) loc.push(data.city);
                if (data.region) loc.push(data.region);
                if (data.country_name) loc.push(data.country_name);
                set("r-location", loc.join(", ") || "Unavailable");
                set("r-isp", data.org || "Unavailable");
            })
            .catch(function () {
                set("r-ip", "Blocked / VPN");
                set("r-location", "Blocked / VPN");
                set("r-isp", "Blocked / VPN");
            });
    }

    // --- Animate in with stagger ---
    function animateCards() {
        var cards = document.querySelectorAll(".recon-card");
        for (var i = 0; i < cards.length; i++) {
            (function (card, delay) {
                setTimeout(function () {
                    card.classList.add("revealed");
                }, delay);
            })(cards[i], i * 80);
        }
    }

    // --- Init ---
    populateLocal();
    populateNetwork();
    setTimeout(animateCards, 300);

})();
