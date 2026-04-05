(function () {
    "use strict";

    // Collect all values for combined fingerprint
    var fingerprintParts = [];

    function set(id, value) {
        var el = document.getElementById(id);
        if (!el) return;
        if (!value || value === "Unavailable" || value === "Hidden by browser" || value === "Blocked" || value === "Unknown" || value === "Unable to determine") {
            var card = el.closest(".recon-card");
            if (card) card.style.display = "none";
            return;
        }
        el.textContent = value;
        fingerprintParts.push(value);
    }

    // --- Hash function ---
    function simpleHash(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var ch = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash = hash & hash;
        }
        return (hash >>> 0).toString(16).padStart(8, "0");
    }

    // Longer hash for device ID
    function longHash(str) {
        var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (var i = 0; i < str.length; i++) {
            var ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
    }

    // --- OS detection ---
    function getOS() {
        var ua = navigator.userAgent;
        if (ua.indexOf("Win") !== -1) {
            if (ua.indexOf("Windows NT 10.0") !== -1) return "Windows 10/11";
            if (ua.indexOf("Windows NT 6.3") !== -1) return "Windows 8.1";
            if (ua.indexOf("Windows NT 6.1") !== -1) return "Windows 7";
            return "Windows";
        }
        if (ua.indexOf("Mac") !== -1) {
            var match = ua.match(/Mac OS X (\d+[._]\d+)/);
            if (match) return "macOS " + match[1].replace(/_/g, ".");
            return "macOS";
        }
        if (ua.indexOf("CrOS") !== -1) return "ChromeOS";
        if (ua.indexOf("Android") !== -1) {
            var v = ua.match(/Android (\d+\.?\d*)/);
            return v ? "Android " + v[1] : "Android";
        }
        if (ua.indexOf("Linux") !== -1) return "Linux";
        if (/iPad|iPhone|iPod/.test(ua)) {
            var iv = ua.match(/OS (\d+_\d+)/);
            return iv ? "iOS " + iv[1].replace(/_/g, ".") : "iOS";
        }
        return "Unknown";
    }

    // --- Browser detection with version ---
    function getBrowser() {
        var ua = navigator.userAgent;
        var match;
        if ((match = ua.match(/Firefox\/(\d+)/))) return "Firefox " + match[1];
        if ((match = ua.match(/Edg\/(\d+)/))) return "Edge " + match[1];
        if ((match = ua.match(/OPR\/(\d+)/))) return "Opera " + match[1];
        if (ua.indexOf("Brave") !== -1) return "Brave";
        if ((match = ua.match(/Chrome\/(\d+)/))) return "Chrome " + match[1];
        if ((match = ua.match(/Version\/(\d+).*Safari/))) return "Safari " + match[1];
        return "Unknown";
    }

    // --- GPU via WebGL ---
    function getGPU() {
        try {
            var canvas = document.createElement("canvas");
            var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) return { renderer: "Unavailable", vendor: "Unavailable", texture: "Unavailable", extensions: 0 };
            var ext = gl.getExtension("WEBGL_debug_renderer_info");
            var exts = gl.getSupportedExtensions();
            return {
                renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "Hidden by browser",
                vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : "Hidden by browser",
                texture: gl.getParameter(gl.MAX_TEXTURE_SIZE) + " px",
                extensions: exts ? exts.length + " extensions" : "Unavailable"
            };
        } catch (e) {
            return { renderer: "Unavailable", vendor: "Unavailable", texture: "Unavailable", extensions: "Unavailable" };
        }
    }

    // --- Canvas fingerprint ---
    function getCanvasFingerprint() {
        try {
            var canvas = document.createElement("canvas");
            canvas.width = 280;
            canvas.height = 60;
            var ctx = canvas.getContext("2d");
            if (!ctx) return "Unavailable";

            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.font = "11pt Arial";
            ctx.fillText("Actual Security <canvas> fp", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.font = "18pt Arial";
            ctx.fillText("Actual Security <canvas> fp", 4, 45);

            ctx.globalCompositeOperation = "multiply";
            ctx.fillStyle = "rgb(255,0,255)";
            ctx.beginPath();
            ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.fill();

            return simpleHash(canvas.toDataURL());
        } catch (e) {
            return "Blocked";
        }
    }

    // --- Audio fingerprint ---
    function getAudioFingerprint() {
        return new Promise(function (resolve) {
            try {
                var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                if (!AC) { resolve("Unavailable"); return; }

                var ctx = new AC(1, 44100, 44100);
                var osc = ctx.createOscillator();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(10000, ctx.currentTime);

                var comp = ctx.createDynamicsCompressor();
                comp.threshold.setValueAtTime(-50, ctx.currentTime);
                comp.knee.setValueAtTime(40, ctx.currentTime);
                comp.ratio.setValueAtTime(12, ctx.currentTime);
                comp.attack.setValueAtTime(0, ctx.currentTime);
                comp.release.setValueAtTime(0.25, ctx.currentTime);

                osc.connect(comp);
                comp.connect(ctx.destination);
                osc.start(0);
                ctx.startRendering().then(function (buffer) {
                    var data = buffer.getChannelData(0);
                    var sum = 0;
                    for (var i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
                    resolve(simpleHash(sum.toString()));
                }).catch(function () { resolve("Blocked"); });
            } catch (e) { resolve("Blocked"); }
        });
    }

    // --- WebRTC local IP leak ---
    function getWebRTCLeak() {
        return new Promise(function (resolve) {
            try {
                var RTC = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
                if (!RTC) { resolve("Unavailable"); return; }

                var pc = new RTC({ iceServers: [] });
                var ips = [];

                pc.createDataChannel("");
                pc.createOffer().then(function (offer) {
                    return pc.setLocalDescription(offer);
                }).catch(function () { resolve("Blocked"); });

                pc.onicecandidate = function (e) {
                    if (!e || !e.candidate || !e.candidate.candidate) return;
                    var ip = e.candidate.candidate.split(" ")[4];
                    if (ip && ips.indexOf(ip) === -1 && ip.indexOf(".local") === -1) ips.push(ip);
                };

                setTimeout(function () {
                    pc.close();
                    resolve(ips.length > 0 ? ips.join(", ") : "Protected / No leak");
                }, 2000);
            } catch (e) { resolve("Blocked"); }
        });
    }

    // --- Font detection ---
    function getInstalledFonts() {
        var baseFonts = ["monospace", "sans-serif", "serif"];
        var testFonts = [
            "Arial", "Arial Black", "Courier New", "Georgia", "Helvetica",
            "Impact", "Lucida Console", "Palatino", "Times New Roman",
            "Trebuchet MS", "Verdana", "Comic Sans MS", "Calibri", "Cambria",
            "Consolas", "Menlo", "Monaco", "SF Pro", "Segoe UI",
            "Roboto", "Fira Code", "Ubuntu", "Cantarell", "Noto Sans",
            "Gill Sans", "Futura", "Optima", "Avenir", "Rockwell",
            "Franklin Gothic", "Century Gothic"
        ];

        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        if (!ctx) return "Unavailable";

        var testStr = "mmmmmmmmmmlli";
        var fontSize = "72px";
        var baseWidths = {};
        for (var b = 0; b < baseFonts.length; b++) {
            ctx.font = fontSize + " " + baseFonts[b];
            baseWidths[baseFonts[b]] = ctx.measureText(testStr).width;
        }

        var detected = [];
        for (var i = 0; i < testFonts.length; i++) {
            for (var j = 0; j < baseFonts.length; j++) {
                ctx.font = fontSize + " '" + testFonts[i] + "'," + baseFonts[j];
                if (ctx.measureText(testStr).width !== baseWidths[baseFonts[j]]) {
                    detected.push(testFonts[i]);
                    break;
                }
            }
        }

        return detected.length > 0
            ? detected.length + " detected (" + detected.slice(0, 5).join(", ") + (detected.length > 5 ? ", ..." : "") + ")"
            : "None detected";
    }

    // --- Ad blocker detection ---
    function detectAdBlocker() {
        return new Promise(function (resolve) {
            var bait = document.createElement("div");
            bait.innerHTML = "&nbsp;";
            bait.className = "adsbox ad-placement ad-banner";
            bait.style.cssText = "position:absolute;top:-10px;left:-10px;width:1px;height:1px;overflow:hidden;";
            document.body.appendChild(bait);
            setTimeout(function () {
                var blocked = bait.offsetHeight === 0 || bait.clientHeight === 0 ||
                              window.getComputedStyle(bait).display === "none";
                document.body.removeChild(bait);
                resolve(blocked ? "Detected" : "Not detected");
            }, 100);
        });
    }

    // --- Incognito detection ---
    function detectIncognito() {
        return new Promise(function (resolve) {
            if (navigator.storage && navigator.storage.estimate) {
                navigator.storage.estimate().then(function (est) {
                    resolve(est.quota / (1024 * 1024 * 1024) < 1 ? "Likely (limited storage quota)" : "No");
                }).catch(function () { resolve("Unable to determine"); });
            } else if (window.webkitRequestFileSystem) {
                window.webkitRequestFileSystem(window.TEMPORARY, 1, function () {
                    resolve("No");
                }, function () { resolve("Likely"); });
            } else {
                resolve("Unable to determine");
            }
        });
    }

    // --- Plugins ---
    function getPlugins() {
        if (!navigator.plugins || navigator.plugins.length === 0) return "None / Hidden";
        var names = [];
        for (var i = 0; i < navigator.plugins.length && i < 10; i++) names.push(navigator.plugins[i].name);
        var extra = navigator.plugins.length > 10 ? " + " + (navigator.plugins.length - 10) + " more" : "";
        return names.join(", ") + extra;
    }

    // --- Media devices (cameras/mics count) ---
    function getMediaDevices() {
        return new Promise(function (resolve) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                resolve({ cameras: "Unavailable", mics: "Unavailable", speakers: "Unavailable" });
                return;
            }
            navigator.mediaDevices.enumerateDevices().then(function (devices) {
                var cams = 0, mics = 0, spk = 0;
                for (var i = 0; i < devices.length; i++) {
                    if (devices[i].kind === "videoinput") cams++;
                    else if (devices[i].kind === "audioinput") mics++;
                    else if (devices[i].kind === "audiooutput") spk++;
                }
                resolve({
                    cameras: cams + " camera" + (cams !== 1 ? "s" : "") + " detected",
                    mics: mics + " microphone" + (mics !== 1 ? "s" : "") + " detected",
                    speakers: spk + " speaker" + (spk !== 1 ? "s" : "") + " detected"
                });
            }).catch(function () {
                resolve({ cameras: "Blocked", mics: "Blocked", speakers: "Blocked" });
            });
        });
    }

    // --- Speech voices (surprisingly unique) ---
    function getSpeechVoices() {
        return new Promise(function (resolve) {
            if (!window.speechSynthesis) { resolve("Unavailable"); return; }

            function check() {
                var voices = speechSynthesis.getVoices();
                if (voices.length === 0) return null;
                var langs = {};
                for (var i = 0; i < voices.length; i++) {
                    var l = voices[i].lang.split("-")[0];
                    langs[l] = (langs[l] || 0) + 1;
                }
                var langList = Object.keys(langs).slice(0, 6).join(", ");
                return voices.length + " voices (" + langList + (Object.keys(langs).length > 6 ? ", ..." : "") + ")";
            }

            var result = check();
            if (result) { resolve(result); return; }

            speechSynthesis.onvoiceschanged = function () {
                resolve(check() || "Unavailable");
            };

            // Timeout fallback
            setTimeout(function () { resolve(check() || "Unavailable"); }, 1000);
        });
    }

    // --- Math fingerprint (engine-specific precision differences) ---
    function getMathFingerprint() {
        try {
            var values = [
                Math.tan(-1e300),
                Math.sinh(1),
                Math.cosh(10),
                Math.atan2(1, 2),
                Math.expm1(1),
                Math.log1p(0.5),
                Math.cbrt(2),
                Math.pow(Math.PI, -100)
            ];
            return simpleHash(values.join(","));
        } catch (e) {
            return "Unavailable";
        }
    }

    // --- WebGL extensions list ---
    function getWebGLExtensions() {
        try {
            var canvas = document.createElement("canvas");
            var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) return "Unavailable";
            var exts = gl.getSupportedExtensions();
            return exts ? exts.length + " extensions" : "Unavailable";
        } catch (e) {
            return "Unavailable";
        }
    }

    // --- Permissions probe (check which APIs are available) ---
    function getPermissions() {
        return new Promise(function (resolve) {
            if (!navigator.permissions) { resolve("Unavailable"); return; }

            var apis = ["camera", "microphone", "geolocation", "notifications", "push", "midi", "clipboard-read", "clipboard-write"];
            var results = [];
            var promises = [];

            for (var i = 0; i < apis.length; i++) {
                (function (api) {
                    promises.push(
                        navigator.permissions.query({ name: api }).then(function (status) {
                            if (status.state !== "prompt") results.push(api + ": " + status.state);
                        }).catch(function () { /* API not supported, skip */ })
                    );
                })(apis[i]);
            }

            Promise.all(promises).then(function () {
                resolve(results.length > 0 ? results.join(", ") : "All default (prompt)");
            });
        });
    }

    // --- Page load performance ---
    function getPerformanceData() {
        try {
            var perf = performance.getEntriesByType("navigation")[0];
            if (!perf) return "Unavailable";
            var dns = Math.round(perf.domainLookupEnd - perf.domainLookupStart) + "ms DNS";
            var tcp = Math.round(perf.connectEnd - perf.connectStart) + "ms TCP";
            var load = Math.round(perf.loadEventEnd - perf.startTime) + "ms total";
            return dns + " / " + tcp + " / " + load;
        } catch (e) {
            return "Unavailable";
        }
    }

    // --- Detect automation / headless ---
    function detectAutomation() {
        var signals = [];
        if (navigator.webdriver) signals.push("webdriver flag");
        if (window._phantom || window.__nightmare) signals.push("headless framework");
        if (/HeadlessChrome/.test(navigator.userAgent)) signals.push("HeadlessChrome");
        if (navigator.languages && navigator.languages.length === 0) signals.push("no languages");
        if (!window.chrome && /Chrome/.test(navigator.userAgent)) signals.push("missing chrome object");

        // Check for devtools protocol
        var start = performance.now();
        // debugger detection removed - too intrusive

        return signals.length > 0 ? "Detected (" + signals.join(", ") + ")" : "Not detected (human-like)";
    }

    // --- Clipboard API access ---
    function checkClipboard() {
        return new Promise(function (resolve) {
            if (!navigator.clipboard) { resolve("API not available"); return; }
            if (!navigator.clipboard.readText) { resolve("Read not available"); return; }
            navigator.permissions.query({ name: "clipboard-read" }).then(function (result) {
                resolve(result.state === "granted" ? "Read access GRANTED" : "Read: " + result.state);
            }).catch(function () {
                resolve("Present but status unknown");
            });
        });
    }

    // --- Gyroscope / motion sensors ---
    function checkSensors() {
        var sensors = [];
        if (window.DeviceOrientationEvent) sensors.push("orientation");
        if (window.DeviceMotionEvent) sensors.push("motion");
        if ("Gyroscope" in window) sensors.push("gyroscope");
        if ("Accelerometer" in window) sensors.push("accelerometer");
        if ("Magnetometer" in window) sensors.push("magnetometer");
        if ("AmbientLightSensor" in window) sensors.push("light");
        if ("ProximitySensor" in window) sensors.push("proximity");
        return sensors.length > 0 ? sensors.join(", ") : "Unavailable";
    }

    // --- Local storage usage ---
    function getStorageEstimate() {
        return new Promise(function (resolve) {
            if (!navigator.storage || !navigator.storage.estimate) { resolve("Unavailable"); return; }
            navigator.storage.estimate().then(function (est) {
                var usedMB = (est.usage / (1024 * 1024)).toFixed(2);
                var quotaGB = (est.quota / (1024 * 1024 * 1024)).toFixed(1);
                resolve(usedMB + " MB used / " + quotaGB + " GB quota");
            }).catch(function () { resolve("Unavailable"); });
        });
    }

    // --- All secondary languages ---
    function getAllLanguages() {
        if (!navigator.languages || navigator.languages.length <= 1) return null;
        return navigator.languages.join(", ");
    }

    // --- Local info (immediate) ---
    function populateLocal() {
        var gpu = getGPU();

        set("r-os", getOS());
        set("r-browser", getBrowser());
        set("r-screen", window.screen.width + " x " + window.screen.height + " @ " + (window.devicePixelRatio || 1) + "x DPR");
        set("r-tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
        set("r-lang", navigator.language || navigator.userLanguage);
        set("r-langs", getAllLanguages());
        set("r-cores", navigator.hardwareConcurrency ? navigator.hardwareConcurrency + " threads" : "Hidden");
        set("r-mem", navigator.deviceMemory ? navigator.deviceMemory + " GB" : "Hidden by browser");
        set("r-gpu", gpu.renderer);
        set("r-glvendor", gpu.vendor);
        set("r-texture", gpu.texture);
        set("r-glext", gpu.extensions);
        set("r-dnt", navigator.doNotTrack === "1" ? "Enabled" : "Not set");
        set("r-cookies", navigator.cookieEnabled ? "Yes" : "No");
        set("r-touch", ("ontouchstart" in window || navigator.maxTouchPoints > 0) ? "Yes (" + navigator.maxTouchPoints + " points)" : "No");
        set("r-referrer", document.referrer || "Direct / None");
        set("r-time", new Date().toLocaleString());
        // Platform removed — redundant with OS and often misleading (e.g. "MacIntel" on ARM)
        set("r-colordepth", window.screen.colorDepth + "-bit");
        set("r-window", window.innerWidth + " x " + window.innerHeight + (window.innerWidth === window.screen.width ? " (Maximized)" : ""));
        set("r-pdf", navigator.pdfViewerEnabled !== undefined ? (navigator.pdfViewerEnabled ? "Built-in" : "None") : "Unknown");
        set("r-canvas", getCanvasFingerprint());
        set("r-math", getMathFingerprint());
        set("r-fonts", getInstalledFonts());
        set("r-plugins", getPlugins());
        set("r-sensors", checkSensors());
        set("r-automation", detectAutomation());
        set("r-storage", (function () {
            try { sessionStorage.setItem("_t", "1"); sessionStorage.removeItem("_t"); return "Available"; }
            catch (e) { return "Blocked"; }
        })());
        set("r-perf", getPerformanceData());

        // Connection info
        var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
            var parts = [];
            if (conn.effectiveType) parts.push(conn.effectiveType.toUpperCase());
            if (conn.downlink) parts.push(conn.downlink + " Mbps");
            if (conn.rtt) parts.push(conn.rtt + "ms RTT");
            if (conn.saveData) parts.push("Data Saver ON");
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
            }).catch(function () { set("r-battery", "Hidden by browser"); });
        } else {
            set("r-battery", "Hidden by browser");
        }
    }

    // --- IP / location with fallback chain ---
    function populateNetwork() {
        fetch("https://ipapi.co/json/")
            .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
            .then(function (data) {
                set("r-ip", data.ip);
                var loc = [];
                if (data.city) loc.push(data.city);
                if (data.region) loc.push(data.region);
                if (data.country_name) loc.push(data.country_name);
                set("r-location", loc.length > 0 ? loc.join(", ") : null);
                set("r-isp", data.org);
            })
            .catch(function () {
                fetch("https://ipinfo.io/json")
                    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
                    .then(function (data) {
                        set("r-ip", data.ip);
                        var loc = [];
                        if (data.city) loc.push(data.city);
                        if (data.region) loc.push(data.region);
                        if (data.country) loc.push(data.country);
                        set("r-location", loc.length > 0 ? loc.join(", ") : null);
                        set("r-isp", data.org);
                    })
                    .catch(function () {
                        fetch("https://api.ipify.org?format=json")
                            .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
                            .then(function (data) {
                                set("r-ip", data.ip);
                                set("r-location", null);
                                set("r-isp", null);
                            })
                            .catch(function () {
                                set("r-ip", null);
                                set("r-location", null);
                                set("r-isp", null);
                            });
                    });
            });
    }

    // --- Async fingerprints (all run in parallel) ---
    function populateAsync() {
        getAudioFingerprint().then(function (fp) { set("r-audio", fp); updateDeviceID(); });
        getWebRTCLeak().then(function (ip) { set("r-webrtc", ip); });
        detectAdBlocker().then(function (r) { set("r-adblock", r); });
        detectIncognito().then(function (r) { set("r-incognito", r); });
        getMediaDevices().then(function (d) {
            set("r-cameras", d.cameras);
            set("r-mics", d.mics);
            set("r-speakers", d.speakers);
        });
        getSpeechVoices().then(function (v) { set("r-voices", v); updateDeviceID(); });
        getPermissions().then(function (p) { set("r-permissions", p); });
        checkClipboard().then(function (c) { set("r-clipboard", c); });
        getStorageEstimate().then(function (s) { set("r-storageq", s); });
    }

    // --- Generate combined device fingerprint ---
    function updateDeviceID() {
        var el = document.getElementById("r-deviceid");
        if (!el) return;
        if (fingerprintParts.length < 10) return; // wait for enough data
        var combined = fingerprintParts.sort().join("|");
        var id = longHash(combined);
        el.textContent = id;
        var banner = el.closest(".device-id-banner");
        if (banner) banner.style.display = "";

        // Update the count
        var countEl = document.getElementById("r-count");
        if (countEl) {
            var visibleCards = document.querySelectorAll(".recon-card:not([style*='display: none'])");
            countEl.textContent = visibleCards.length + " data points";
        }
    }

    // --- Animate in with stagger ---
    function animateCards() {
        var cards = document.querySelectorAll(".recon-card");
        var visible = [];
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].style.display !== "none") visible.push(cards[i]);
        }
        for (var j = 0; j < visible.length; j++) {
            (function (card, delay) {
                setTimeout(function () { card.classList.add("revealed"); }, delay);
            })(visible[j], j * 50);
        }
    }

    // --- Init ---
    populateLocal();
    populateNetwork();
    populateAsync();

    // Animate after a short delay to let async settle
    setTimeout(function () {
        updateDeviceID();
        animateCards();
    }, 600);

})();
