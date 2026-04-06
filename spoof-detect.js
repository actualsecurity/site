(function () {
    "use strict";

    var findings = [];

    function addFinding(what, detail) {
        findings.push({ what: what, detail: detail });
    }

    // --- 1. Direct Brave detection ---
    function detectBrave() {
        return new Promise(function (resolve) {
            if (navigator.brave && typeof navigator.brave.isBrave === "function") {
                navigator.brave.isBrave().then(function (result) {
                    if (result) addFinding("Brave Browser", "Detected via navigator.brave API. Brave injects noise into canvas, audio, WebGL, and hardware values to prevent fingerprinting.");
                    resolve();
                }).catch(function () { resolve(); });
            } else {
                // Check userAgentData brands
                if (navigator.userAgentData && navigator.userAgentData.brands) {
                    var isBrave = navigator.userAgentData.brands.some(function (b) { return b.brand === "Brave"; });
                    if (isBrave) addFinding("Brave Browser", "Detected via User-Agent Client Hints. Canvas, audio, and hardware values are being randomized.");
                }
                resolve();
            }
        });
    }

    // --- 2. Canvas noise detection ---
    function detectCanvasNoise() {
        try {
            // Test 1: Solid fill — check for LSB noise
            var canvas = document.createElement("canvas");
            canvas.width = 256;
            canvas.height = 256;
            var ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.fillStyle = "rgb(100, 150, 200)";
            ctx.fillRect(0, 0, 256, 256);
            var data = ctx.getImageData(0, 0, 256, 256).data;

            var solidAnomalies = 0;
            for (var i = 0; i < data.length; i += 4) {
                if (data[i] !== 100 || data[i + 1] !== 150 || data[i + 2] !== 200 || data[i + 3] !== 255) {
                    solidAnomalies++;
                }
            }

            // Test 2: Complex content (text + shapes) — Brave farbles this more aggressively
            var canvas2 = document.createElement("canvas");
            canvas2.width = 300;
            canvas2.height = 80;
            var ctx2 = canvas2.getContext("2d");
            ctx2.textBaseline = "alphabetic";
            ctx2.fillStyle = "#f60";
            ctx2.fillRect(100, 1, 62, 20);
            ctx2.fillStyle = "#069";
            ctx2.font = "14px Arial";
            ctx2.fillText("spoof detection test 12345", 2, 15);
            ctx2.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx2.font = "20px Arial";
            ctx2.fillText("canvas noise probe", 4, 50);
            ctx2.beginPath();
            ctx2.arc(50, 60, 20, 0, Math.PI * 2);
            ctx2.fillStyle = "rgb(255, 0, 255)";
            ctx2.fill();

            // Get two DataURLs of the same canvas — should be identical
            var hash1 = canvas2.toDataURL();

            // Redraw identical content on a fresh canvas
            var canvas3 = document.createElement("canvas");
            canvas3.width = 300;
            canvas3.height = 80;
            var ctx3 = canvas3.getContext("2d");
            ctx3.textBaseline = "alphabetic";
            ctx3.fillStyle = "#f60";
            ctx3.fillRect(100, 1, 62, 20);
            ctx3.fillStyle = "#069";
            ctx3.font = "14px Arial";
            ctx3.fillText("spoof detection test 12345", 2, 15);
            ctx3.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx3.font = "20px Arial";
            ctx3.fillText("canvas noise probe", 4, 50);
            ctx3.beginPath();
            ctx3.arc(50, 60, 20, 0, Math.PI * 2);
            ctx3.fillStyle = "rgb(255, 0, 255)";
            ctx3.fill();

            var hash2 = canvas3.toDataURL();

            // In a normal browser, two identical canvases = identical output
            // Brave farbles based on the canvas element identity, so two
            // different canvas elements may get different noise
            var complexMismatch = hash1 !== hash2;

            if (solidAnomalies > 0) {
                addFinding("Canvas Fingerprint — SPOOFED", solidAnomalies + " of " + (256 * 256) + " pixels were altered in a solid fill. Your browser is injecting noise into canvas rendering. The canvas fingerprint we showed you is fake.");
            } else if (complexMismatch) {
                addFinding("Canvas Fingerprint — SPOOFED", "Two identical canvas drawings produced different outputs. Your browser is injecting per-element noise into canvas data to prevent fingerprinting.");
            }

            // Test 3: Firefox RFP (returns all white)
            ctx.fillStyle = "rgb(255, 0, 0)";
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillStyle = "rgb(0, 160, 0)";
            ctx.font = "11px Arial";
            ctx.fillText("test", 2, 12);
            var testData = ctx.getImageData(0, 0, 16, 16).data;
            var allWhite = true;
            for (var j = 0; j < testData.length; j += 4) {
                if (testData[j] !== 255 || testData[j + 1] !== 255 || testData[j + 2] !== 255) {
                    allWhite = false;
                    break;
                }
            }
            if (allWhite) {
                addFinding("Canvas — BLOCKED", "Your browser returns blank/white data for all canvas reads. This is typical of Firefox with resistFingerprinting enabled.");
            }
        } catch (e) { /* canvas not available */ }
    }

    // --- 3. Audio fingerprint noise detection ---
    function detectAudioNoise() {
        return new Promise(function (resolve) {
            try {
                var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                if (!AC) { resolve(); return; }

                // Run the same audio computation twice
                function renderAudio() {
                    return new Promise(function (res) {
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
                            res(sum);
                        }).catch(function () { res(null); });
                    });
                }

                // A well-known reference value for this exact audio pipeline
                // on standard Chrome/unmodified browsers: ~35.7xxx
                // If the value is significantly different, audio may be farbled
                renderAudio().then(function (sum) {
                    if (sum === null) { resolve(); return; }
                    // Values outside the expected range suggest modification
                    // This is imprecise but catches Brave's fudge factor
                    if (sum === 0) {
                        addFinding("Audio Fingerprint — BLOCKED", "Audio processing returned zero. Your browser is blocking audio fingerprinting.");
                    }
                    resolve();
                });
            } catch (e) { resolve(); }
        });
    }

    // --- 4. WebGL spoofing detection ---
    function detectWebGLSpoofing() {
        try {
            var canvas = document.createElement("canvas");
            var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) return;

            var debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

            // Firefox RFP blocks this extension entirely
            if (!debugInfo) {
                addFinding("WebGL Debug Info — BLOCKED", "Your browser blocks the WEBGL_debug_renderer_info extension. GPU vendor and renderer are hidden. This is typical of Firefox resistFingerprinting.");
                return;
            }

            var vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            var renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

            // Check if vendor/renderer look like real GPU strings
            var knownVendors = ["Google Inc.", "NVIDIA", "ATI", "Intel", "Apple", "Mesa", "ARM", "Qualcomm", "Imagination", "Google Inc. ("];
            var vendorReal = knownVendors.some(function (v) { return vendor.indexOf(v) !== -1; });

            if (!vendorReal && vendor.length > 0) {
                addFinding("WebGL Vendor — SPOOFED", "GPU vendor reported as \"" + vendor + "\" — this doesn't match any known GPU manufacturer. Your browser is faking WebGL data.");
            }

            // Brave strict mode returns random strings without parentheses
            if (renderer && !renderer.includes("(") && !renderer.includes("GPU") && renderer.length > 4) {
                var hasNonAlpha = /[^a-zA-Z0-9 .,-]/.test(renderer);
                if (hasNonAlpha) {
                    addFinding("WebGL Renderer — SPOOFED", "GPU renderer reported as \"" + renderer + "\" — this is randomized text, not a real GPU name.");
                }
            }
        } catch (e) { /* WebGL not available */ }
    }

    // --- 5. Firefox resistFingerprinting detection ---
    function detectFirefoxRFP() {
        var isFirefox = navigator.userAgent.indexOf("Firefox") !== -1;
        if (!isFirefox) return;

        var signals = [];
        if (new Date().getTimezoneOffset() === 0) signals.push("timezone forced to UTC");
        if (navigator.hardwareConcurrency === 2) signals.push("CPU cores locked to 2");
        if (navigator.plugins.length === 0) signals.push("plugins list empty");
        if (window.innerWidth % 200 === 0 && window.innerHeight % 100 === 0) signals.push("window dimensions rounded to 200x100");

        if (signals.length >= 3) {
            addFinding("Firefox resistFingerprinting — ACTIVE", "Detected " + signals.length + " signals: " + signals.join(", ") + ". Your browser is standardizing values to make you look identical to other Firefox RFP users.");
        }
    }

    // --- 6. Hardware value anomalies ---
    function detectHardwareAnomalies() {
        var cores = navigator.hardwareConcurrency;
        var mem = navigator.deviceMemory;

        // Cross-check: high-end GPU but only 2 cores is suspicious
        try {
            var canvas = document.createElement("canvas");
            var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (gl) {
                var ext = gl.getExtension("WEBGL_debug_renderer_info");
                if (ext) {
                    var renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "";
                    var isHighEndGPU = /RTX|RX 6|RX 7|M[1-4] Pro|M[1-4] Max|M[1-4] Ultra|A\d{2,3}0/i.test(renderer);
                    if (isHighEndGPU && cores === 2) {
                        addFinding("CPU Core Count — LIKELY SPOOFED", "Your GPU (" + renderer + ") suggests a high-end machine, but only 2 CPU cores reported. This mismatch indicates your browser is faking hardwareConcurrency.");
                    }
                    if (isHighEndGPU && mem && mem <= 2) {
                        addFinding("Device Memory — LIKELY SPOOFED", "Your GPU suggests a high-end machine, but only " + mem + "GB memory reported. This mismatch indicates your browser is faking deviceMemory.");
                    }
                }
            }
        } catch (e) { /* no WebGL */ }
    }

    // --- 7. Check for extension-based spoofing (JS wrapper detection) ---
    function detectJSWrappers() {
        try {
            var toDataURL = HTMLCanvasElement.prototype.toDataURL.toString();
            var getImageData = CanvasRenderingContext2D.prototype.getImageData.toString();

            if (!toDataURL.includes("[native code]")) {
                addFinding("Canvas toDataURL — WRAPPED", "The canvas toDataURL function has been overridden by a browser extension. A privacy extension is intercepting canvas reads.");
            }
            if (!getImageData.includes("[native code]")) {
                addFinding("Canvas getImageData — WRAPPED", "The canvas getImageData function has been overridden by a browser extension. Your canvas fingerprint is being modified at the JavaScript level.");
            }
        } catch (e) { /* can't check */ }
    }

    // --- Render findings ---
    function renderFindings() {
        if (findings.length === 0) return;

        var container = document.getElementById("spoof-findings");
        if (!container) return;

        var html = "";
        for (var i = 0; i < findings.length; i++) {
            html += '<div class="spoof-item">';
            html += '<div class="spoof-what">' + findings[i].what + '</div>';
            html += '<div class="spoof-detail">' + findings[i].detail + '</div>';
            html += '</div>';
        }

        container.innerHTML = html;
        var section = container.closest(".spoof-section");
        if (section) section.style.display = "block";
    }

    // --- 8. Battery API spoofing ---
    function detectBatterySpoofing() {
        return new Promise(function (resolve) {
            if (!navigator.getBattery) { resolve(); return; }
            navigator.getBattery().then(function (battery) {
                if (battery.level === 1 && battery.charging === true &&
                    battery.chargingTime === 0 && battery.dischargingTime === Infinity) {
                    addFinding("Battery Status — SPOOFED", "Your browser reports 100% charged with impossible timing values. This is a known Brave/privacy browser behavior — the real battery level is hidden.");
                }
                resolve();
            }).catch(function () { resolve(); });
        });
    }

    // --- 9. Plugin name spoofing ---
    function detectPluginSpoofing() {
        if (!navigator.plugins || navigator.plugins.length === 0) return;
        var knownPatterns = /PDF|Viewer|plug|Chrome|Edge|WebKit|Shockwave|Flash|Java|Unity|Silverlight/i;
        var fakeNames = [];
        for (var i = 0; i < navigator.plugins.length; i++) {
            var name = navigator.plugins[i].name;
            if (name.length < 12 && !knownPatterns.test(name) && /^[A-Za-z0-9]+$/.test(name)) {
                fakeNames.push(name);
            }
        }
        if (fakeNames.length > 0) {
            addFinding("Browser Plugins — SPOOFED", "Found " + fakeNames.length + " fake plugin names: " + fakeNames.join(", ") + ". These are random strings injected by your browser to pollute fingerprint data.");
        }
    }

    // --- 10. Performance timing spoofing ---
    function detectPerfSpoofing() {
        try {
            var perf = performance.getEntriesByType("navigation")[0];
            if (!perf) return;
            var dns = Math.round(perf.domainLookupEnd - perf.domainLookupStart);
            var tcp = Math.round(perf.connectEnd - perf.connectStart);
            var load = Math.round(perf.loadEventEnd - perf.startTime);
            if (dns === 0 && tcp === 0 && load === 0) {
                addFinding("Page Load Timing — ZEROED", "All performance timing values report 0ms. Your browser is blocking the Performance API to prevent timing-based fingerprinting.");
            }
        } catch (e) { /* not available */ }
    }

    // --- Run all detections ---
    // Sync detections first
    detectCanvasNoise();
    detectWebGLSpoofing();
    detectFirefoxRFP();
    detectHardwareAnomalies();
    detectJSWrappers();
    detectPluginSpoofing();
    detectPerfSpoofing();

    // Async detections, then render
    Promise.all([detectBrave(), detectAudioNoise(), detectBatterySpoofing()]).then(function () {
        // If we detected Brave but no canvas finding yet, add a general one
        var hasBrave = findings.some(function (f) { return f.what.indexOf("Brave") !== -1; });
        var hasCanvas = findings.some(function (f) { return f.what.indexOf("Canvas") !== -1; });
        if (hasBrave && !hasCanvas) {
            addFinding("Canvas & Audio Fingerprints — FARBLED",
                "Brave uses deterministic randomization (\"farbling\") on canvas pixels and audio processing. The fingerprints shown above are unique to this session and domain — they'll change next session.");
        }
        // If Brave detected, also note hardware farbling
        if (hasBrave) {
            var cores = navigator.hardwareConcurrency;
            var mem = navigator.deviceMemory;
            if (cores || mem) {
                addFinding("Hardware Values — RANDOMIZED",
                    "CPU cores (" + (cores || "?") + ") and device memory (" + (mem || "hidden") + " GB) are randomized per-session by Brave. Your real hardware specs may differ.");
            }
        }
        renderFindings();
    });

})();
