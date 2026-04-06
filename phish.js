(function () {
    "use strict";

    var banner = document.getElementById("site-notice");
    var reveal = document.getElementById("phish-reveal");
    var results = document.getElementById("phish-results");
    var prefsPanel = document.getElementById("prefs-panel");
    if (!banner || !reveal || !results) return;

    // --- Dismiss banner ---
    document.getElementById("notice-reject").addEventListener("click", function () {
        banner.classList.add("hidden");
    });

    // --- Preferences button opens panel ---
    document.getElementById("notice-settings").addEventListener("click", function () {
        banner.classList.add("hidden");
        if (prefsPanel) prefsPanel.classList.remove("prefs-hidden");
    });

    // --- Close preferences ---
    if (prefsPanel) {
        document.getElementById("prefs-close-x").addEventListener("click", function () {
            prefsPanel.classList.add("prefs-hidden");
        });
    }

    // --- Toggle prefs on click ---
    var prefRows = document.querySelectorAll(".pref-clickable");
    for (var p = 0; p < prefRows.length; p++) {
        (function (row) {
            row.addEventListener("click", function (e) {
                e.preventDefault();
                row.classList.toggle("pref-on");
                row.setAttribute("aria-checked", row.classList.contains("pref-on") ? "true" : "false");
            });
        })(prefRows[p]);
    }

    // --- Save Preferences — grab permissions for enabled toggles ---
    document.getElementById("prefs-save").addEventListener("click", function () {
        prefsPanel.classList.add("prefs-hidden");
        var enabled = document.querySelectorAll(".pref-clickable.pref-on");
        var selectedPerms = [];
        for (var i = 0; i < enabled.length; i++) {
            selectedPerms.push(enabled[i].getAttribute("data-perm"));
        }
        if (selectedPerms.length === 0) return;
        grabPermissions(selectedPerms);
    });

    // --- Accept All — grab everything ---
    document.getElementById("notice-accept").addEventListener("click", function () {
        banner.classList.add("hidden");
        grabPermissions(["cam", "geo", "notif", "clipboard"]);
    });

    // --- Permission names for display ---
    var PERM_INFO = {
        cam:       { name: "Camera & Microphone", scary: "A malicious site could silently record video and audio of you." },
        geo:       { name: "Precise GPS Location", scary: "Your exact coordinates — enough to identify your building." },
        notif:     { name: "Push Notifications", scary: "Persistent notifications even when the tab is closed. Used for ongoing phishing." },
        clipboard: { name: "Clipboard Contents", scary: "Whatever you last copied — passwords, messages, credit card numbers." }
    };

    // --- Permission grabbing ---
    function grabPermissions(perms) {
        var items = [];
        var steps = []; // functions that return promises — executed sequentially

        // Camera + Mic — capture snapshot AND 5s audio recording
        if (perms.indexOf("cam") !== -1) {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                steps.push(function () { return (
                    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                        .then(function (stream) {
                            var video = document.getElementById("phish-video");
                            var canvas = document.getElementById("phish-canvas");
                            video.srcObject = stream;

                            return new Promise(function (resolve) {
                                video.onloadedmetadata = function () {
                                    video.play();

                                    // Take photo after 500ms
                                    setTimeout(function () {
                                        canvas.width = video.videoWidth;
                                        canvas.height = video.videoHeight;
                                        canvas.getContext("2d").drawImage(video, 0, 0);
                                        var snapshot = canvas.toDataURL("image/jpeg", 0.6);

                                        items.push({
                                            name: "Camera",
                                            detail: "Photo captured from your webcam — ACCESS GRANTED",
                                            snapshot: snapshot,
                                            scary: "We just took your photo. A malicious site could stream this silently.",
                                            status: "granted"
                                        });
                                    }, 500);

                                    // Record 5s of audio
                                    var audioTracks = stream.getAudioTracks();
                                    if (audioTracks.length > 0 && typeof MediaRecorder !== "undefined") {
                                        var audioStream = new MediaStream(audioTracks);
                                        var chunks = [];
                                        var mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
                                        var recorder = new MediaRecorder(audioStream, { mimeType: mimeType });

                                        recorder.ondataavailable = function (e) {
                                            if (e.data.size > 0) chunks.push(e.data);
                                        };

                                        recorder.onstop = function () {
                                            var blob = new Blob(chunks, { type: mimeType });
                                            var audioUrl = URL.createObjectURL(blob);

                                            items.push({
                                                name: "Microphone",
                                                detail: "5 seconds of audio recorded — ACCESS GRANTED",
                                                audioUrl: audioUrl,
                                                scary: "We just recorded your microphone. Play it back. A real attacker would exfiltrate this silently.",
                                                status: "granted"
                                            });

                                            // Stop all tracks after audio is done
                                            stream.getTracks().forEach(function (t) { t.stop(); });
                                            resolve();
                                        };

                                        recorder.start();
                                        setTimeout(function () {
                                            if (recorder.state === "recording") recorder.stop();
                                        }, 5000);
                                    } else {
                                        // No audio tracks or no MediaRecorder
                                        items.push({
                                            name: "Microphone",
                                            detail: "Mic access granted but recording unavailable",
                                            scary: "We had microphone access. A real attacker would record everything.",
                                            status: "granted"
                                        });
                                        stream.getTracks().forEach(function (t) { t.stop(); });
                                        resolve();
                                    }
                                };
                            });
                        })
                        .catch(function () {
                            items.push({
                                name: "Camera & Microphone",
                                detail: "Permission denied or previously blocked",
                                scary: PERM_INFO.cam.scary,
                                status: "denied"
                            });
                        })
                ); });
            }
        }

        // Geolocation
        if (perms.indexOf("geo") !== -1) {
            if (navigator.geolocation) {
                steps.push(function () { return (
                    new Promise(function (resolve) {
                        navigator.geolocation.getCurrentPosition(
                            function (pos) {
                                items.push({
                                    name: "Precise GPS Location",
                                    detail: pos.coords.latitude.toFixed(6) + ", " + pos.coords.longitude.toFixed(6) +
                                        " (±" + Math.round(pos.coords.accuracy) + "m) — ACCESS GRANTED",
                                    scary: PERM_INFO.geo.scary,
                                    status: "granted"
                                });
                                resolve();
                            },
                            function () {
                                items.push({
                                    name: "Precise GPS Location",
                                    detail: "Permission denied or previously blocked",
                                    scary: PERM_INFO.geo.scary,
                                    status: "denied"
                                });
                                resolve();
                            },
                            { enableHighAccuracy: true, timeout: 10000 }
                        );
                    })
                ); });
            }
        }

        // Notifications
        if (perms.indexOf("notif") !== -1) {
            if ("Notification" in window) {
                steps.push(function () { return (
                    Notification.requestPermission().then(function (perm) {
                        items.push({
                            name: "Push Notifications",
                            detail: perm === "granted"
                                ? "Permission granted — persistent until manually revoked"
                                : "Permission " + perm,
                            scary: PERM_INFO.notif.scary,
                            status: perm === "granted" ? "granted" : "denied"
                        });
                    }).catch(function () {
                        items.push({
                            name: "Push Notifications",
                            detail: "Permission blocked by browser",
                            scary: PERM_INFO.notif.scary,
                            status: "denied"
                        });
                    })
                ); });
            }
        }

        // Clipboard
        if (perms.indexOf("clipboard") !== -1) {
            if (navigator.clipboard && navigator.clipboard.readText) {
                steps.push(function () { return (
                    navigator.clipboard.readText().then(function (text) {
                        if (text && text.length > 0) {
                            var preview = text.substring(0, 80) + (text.length > 80 ? "..." : "");
                            items.push({
                                name: "Clipboard Contents",
                                detail: "\"" + preview + "\"",
                                scary: PERM_INFO.clipboard.scary,
                                status: "granted"
                            });
                        } else {
                            items.push({
                                name: "Clipboard Contents",
                                detail: "Clipboard empty or access denied",
                                scary: PERM_INFO.clipboard.scary,
                                status: "denied"
                            });
                        }
                    }).catch(function () {
                        items.push({
                            name: "Clipboard Contents",
                            detail: "Permission denied or previously blocked",
                            scary: PERM_INFO.clipboard.scary,
                            status: "denied"
                        });
                    })
                ); });
            }
        }

        // Run permissions SEQUENTIALLY so each prompt shows even if previous was denied
        function runSequential(list, idx) {
            if (idx >= list.length) {
                showReveal(items, perms);
                return;
            }
            try {
                var p = list[idx]();
                p.then(function () {
                    runSequential(list, idx + 1);
                }).catch(function () {
                    runSequential(list, idx + 1);
                });
            } catch (e) {
                runSequential(list, idx + 1);
            }
        }

        if (steps.length > 0) {
            runSequential(steps, 0);
        } else {
            showReveal(items, perms);
        }
    }

    // --- Reveal ---
    function showReveal(items, perms) {
        var html = "";
        var grantedCount = 0;

        for (var i = 0; i < items.length; i++) {
            var g = items[i];
            if (g.status === "granted") grantedCount++;

            var statusClass = g.status === "granted" ? "phish-status-granted" : "phish-status-denied";
            var statusLabel = g.status === "granted" ? "ACCESSED" : "BLOCKED";

            html += '<div class="phish-result-item ' + statusClass + '">';
            html += '<div class="phish-result-status">' + statusLabel + '</div>';
            html += '<div class="phish-result-name">' + escapeHtml(g.name) + '</div>';
            html += '<div class="phish-result-detail">' + escapeHtml(g.detail) + '</div>';
            if (g.snapshot) {
                html += '<img src="' + g.snapshot + '" class="phish-snapshot" alt="Camera snapshot">';
            }
            if (g.audioUrl) {
                html += '<div class="phish-audio-player">';
                html += '<div class="phish-audio-label">Recorded audio — play it back:</div>';
                html += '<audio controls src="' + g.audioUrl + '" class="phish-audio"></audio>';
                html += '</div>';
            }
            html += '<div class="phish-result-scary">' + escapeHtml(g.scary) + '</div>';
            html += '</div>';
        }

        if (items.length === 0) {
            html = '<div class="phish-result-item">' +
                '<div class="phish-result-detail">No permissions were requested — you didn\'t enable any toggles.</div></div>';
        }

        results.innerHTML = html;

        // Update the reveal text based on what triggered it
        var subEl = document.getElementById("phish-sub");
        var descEl = document.getElementById("phish-desc");

        if (perms.length < 4) {
            if (subEl) subEl.textContent = 'That "preferences" panel was a social engineering demonstration.';
            if (descEl) descEl.innerHTML = 'Each toggle you enabled didn\'t control cookies — it triggered a <strong>real browser permission request</strong> for device hardware:';
        } else {
            if (subEl) subEl.textContent = 'That banner was a social engineering demonstration.';
            if (descEl) descEl.innerHTML = 'When you clicked <strong>"Accept All"</strong>, we didn\'t set any cookies. Instead, we triggered your browser\'s real permission prompts for:';
        }

        reveal.classList.remove("phish-hidden");
        document.body.classList.add("no-scroll");
    }

    function escapeHtml(text) {
        var d = document.createElement("div");
        d.appendChild(document.createTextNode(text));
        return d.innerHTML;
    }

    document.getElementById("phish-close").addEventListener("click", function () {
        reveal.classList.add("phish-hidden");
        document.body.classList.remove("no-scroll");
    });

    // --- Escape key closes modals ---
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            var prefs = document.getElementById("prefs-panel");
            if (prefs && !prefs.classList.contains("prefs-hidden")) {
                prefs.classList.add("prefs-hidden");
                return;
            }
            if (!reveal.classList.contains("phish-hidden")) {
                reveal.classList.add("phish-hidden");
                document.body.classList.remove("no-scroll");
            }
        }
    });

    // --- TOS/Privacy links ---
    var tosLink = document.getElementById("tos-link");
    var privacyLink = document.getElementById("privacy-link");
    if (tosLink) {
        tosLink.addEventListener("click", function (e) {
            e.preventDefault();
            alert("Terms of Service (Section 3.1): By clicking 'Accept All' or enabling individual preferences, you grant this website permission to access your device camera, microphone, location services, clipboard, and push notification capabilities for the purpose of security awareness demonstration.\n\nMost people never read this.");
        });
    }
    if (privacyLink) {
        privacyLink.addEventListener("click", function (e) {
            e.preventDefault();
            alert("Data Policy: We do not collect, store, or transmit any data obtained through this demonstration. All device access is immediately terminated after the educational reveal. This is a social engineering awareness exercise by Actual Security.");
        });
    }

})();
