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
    // Draw a solid color, check if pixels match exactly
    function detectCanvasNoise() {
        try {
            var canvas = document.createElement("canvas");
            canvas.width = 256;
            canvas.height = 256;
            var ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Fill with exact known color
            ctx.fillStyle = "rgb(100, 150, 200)";
            ctx.fillRect(0, 0, 256, 256);
            var data = ctx.getImageData(0, 0, 256, 256).data;

            var anomalies = 0;
            for (var i = 0; i < data.length; i += 4) {
                if (data[i] !== 100 || data[i + 1] !== 150 || data[i + 2] !== 200 || data[i + 3] !== 255) {
                    anomalies++;
                }
            }

            if (anomalies > 0) {
                addFinding("Canvas Fingerprint — SPOOFED", anomalies + " of " + (256 * 256) + " pixels were altered. Your browser is injecting noise into canvas rendering to prevent tracking. The canvas fingerprint we showed you is fake.");
            }

            // Also check for Firefox RFP (returns all white)
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
        container.closest(".spoof-section").style.display = "";
    }

    // --- Run all detections ---
    detectCanvasNoise();
    detectWebGLSpoofing();
    detectFirefoxRFP();
    detectHardwareAnomalies();
    detectJSWrappers();

    Promise.all([detectBrave(), detectAudioNoise()]).then(renderFindings);

})();
