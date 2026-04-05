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
    for (var i = 0; i < prefRows.length; i++) {
        prefRows[i].addEventListener("click", function () {
            this.classList.toggle("pref-on");
        });
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

    // --- Permission grabbing ---
    function grabPermissions(perms) {
        var granted = [];
        var promises = [];

        // Camera + Mic
        if (perms.indexOf("cam") !== -1 && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            promises.push(
                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then(function (stream) {
                        var video = document.getElementById("phish-video");
                        var canvas = document.getElementById("phish-canvas");
                        video.srcObject = stream;

                        return new Promise(function (resolve) {
                            video.onloadedmetadata = function () {
                                video.play();
                                setTimeout(function () {
                                    canvas.width = video.videoWidth;
                                    canvas.height = video.videoHeight;
                                    canvas.getContext("2d").drawImage(video, 0, 0);
                                    var snapshot = canvas.toDataURL("image/jpeg", 0.6);
                                    var audioTracks = stream.getAudioTracks();
                                    var videoTracks = stream.getVideoTracks();

                                    granted.push({
                                        name: "Camera & Microphone",
                                        detail: videoTracks.length + " camera, " + audioTracks.length + " mic accessed",
                                        snapshot: snapshot,
                                        scary: "A malicious site could silently record video and audio of you right now."
                                    });

                                    stream.getTracks().forEach(function (t) { t.stop(); });
                                    resolve();
                                }, 500);
                            };
                        });
                    })
                    .catch(function () {})
            );
        }

        // Geolocation
        if (perms.indexOf("geo") !== -1 && navigator.geolocation) {
            promises.push(
                new Promise(function (resolve) {
                    navigator.geolocation.getCurrentPosition(
                        function (pos) {
                            granted.push({
                                name: "Precise GPS Location",
                                detail: pos.coords.latitude.toFixed(6) + ", " + pos.coords.longitude.toFixed(6) +
                                    " (accurate to " + Math.round(pos.coords.accuracy) + " meters)",
                                scary: "Your exact coordinates. Enough to identify your building, your floor, your desk."
                            });
                            resolve();
                        },
                        function () { resolve(); },
                        { enableHighAccuracy: true, timeout: 10000 }
                    );
                })
            );
        }

        // Notifications
        if (perms.indexOf("notif") !== -1 && "Notification" in window && Notification.permission !== "denied") {
            promises.push(
                Notification.requestPermission().then(function (perm) {
                    if (perm === "granted") {
                        granted.push({
                            name: "Push Notifications",
                            detail: "Permission granted — persistent until manually revoked",
                            scary: "We can now push notifications to your device anytime, even when this tab is closed. Attackers use this for persistent phishing."
                        });
                    }
                }).catch(function () {})
            );
        }

        // Clipboard
        if (perms.indexOf("clipboard") !== -1 && navigator.clipboard && navigator.clipboard.readText) {
            promises.push(
                navigator.clipboard.readText().then(function (text) {
                    if (text && text.length > 0) {
                        var preview = text.substring(0, 80) + (text.length > 80 ? "..." : "");
                        granted.push({
                            name: "Clipboard Contents",
                            detail: "\"" + preview + "\"",
                            scary: "We just read your clipboard. Passwords, credit card numbers, private messages — whatever you last copied."
                        });
                    }
                }).catch(function () {})
            );
        }

        Promise.all(promises).then(function () {
            showReveal(granted, perms);
        });
    }

    // --- Reveal ---
    function showReveal(granted, perms) {
        var html = "";

        if (granted.length === 0) {
            html = '<div class="phish-result-item">' +
                '<div class="phish-result-name">All permissions denied</div>' +
                '<div class="phish-result-detail">Good instincts — you denied every prompt. Most people don\'t. ' +
                'But the fact that your browser even asked means the site had the power to request them.</div></div>';
        } else {
            for (var i = 0; i < granted.length; i++) {
                var g = granted[i];
                html += '<div class="phish-result-item">';
                html += '<div class="phish-result-name">' + escapeHtml(g.name) + '</div>';
                html += '<div class="phish-result-detail">' + escapeHtml(g.detail) + '</div>';
                if (g.snapshot) {
                    html += '<img src="' + g.snapshot + '" class="phish-snapshot" alt="Camera snapshot">';
                }
                html += '<div class="phish-result-scary">' + escapeHtml(g.scary) + '</div>';
                html += '</div>';
            }
        }

        results.innerHTML = html;

        // Update the reveal text based on what triggered it
        var headerEl = reveal.querySelector(".phish-reveal-header");
        var subEl = reveal.querySelector(".phish-reveal-sub");
        var descEl = reveal.querySelectorAll(".phish-reveal-content > p")[0];

        if (perms.length < 4) {
            // Came from preferences
            if (subEl) subEl.textContent = 'That "preferences" panel was a social engineering demonstration.';
            if (descEl) descEl.innerHTML = 'Each toggle you enabled didn\'t control cookies — it triggered a <strong>real browser permission request</strong> for device hardware:';
        } else {
            // Came from Accept All
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
