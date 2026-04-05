(function () {
    "use strict";

    var banner = document.getElementById("cookie-banner");
    var reveal = document.getElementById("phish-reveal");
    var results = document.getElementById("phish-results");
    if (!banner || !reveal || !results) return;

    // Dismiss on reject or settings
    document.getElementById("cookie-reject").addEventListener("click", function () {
        banner.classList.add("hidden");
    });

    document.getElementById("cookie-settings").addEventListener("click", function () {
        banner.classList.add("hidden");
    });

    // The main event — "Accept All" triggers permission grabs
    document.getElementById("cookie-accept").addEventListener("click", function () {
        banner.classList.add("hidden");

        var granted = [];
        var promises = [];

        // 1. Camera + Microphone
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            promises.push(
                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then(function (stream) {
                        // Take a snapshot to prove we had access
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

                                    // Count audio tracks
                                    var audioTracks = stream.getAudioTracks();
                                    var videoTracks = stream.getVideoTracks();

                                    granted.push({
                                        name: "Camera & Microphone",
                                        icon: "camera",
                                        detail: videoTracks.length + " camera, " + audioTracks.length + " mic accessed",
                                        snapshot: snapshot,
                                        scary: "A malicious site could now silently record video and audio."
                                    });

                                    // Stop all tracks immediately
                                    stream.getTracks().forEach(function (t) { t.stop(); });
                                    resolve();
                                }, 500);
                            };
                        });
                    })
                    .catch(function () { /* denied — that's fine */ })
            );
        }

        // 2. Geolocation
        if (navigator.geolocation) {
            promises.push(
                new Promise(function (resolve) {
                    navigator.geolocation.getCurrentPosition(
                        function (pos) {
                            granted.push({
                                name: "Precise Location",
                                icon: "location",
                                detail: pos.coords.latitude.toFixed(6) + ", " + pos.coords.longitude.toFixed(6) +
                                    " (±" + Math.round(pos.coords.accuracy) + "m)",
                                scary: "Your exact GPS coordinates. Accurate enough to find your building."
                            });
                            resolve();
                        },
                        function () { resolve(); },
                        { enableHighAccuracy: true, timeout: 10000 }
                    );
                })
            );
        }

        // 3. Notifications
        if ("Notification" in window && Notification.permission !== "denied") {
            promises.push(
                Notification.requestPermission().then(function (perm) {
                    if (perm === "granted") {
                        granted.push({
                            name: "Notifications",
                            icon: "notification",
                            detail: "Push notifications enabled",
                            scary: "We can now send you notifications anytime — even when this tab is closed."
                        });
                    }
                }).catch(function () {})
            );
        }

        // 4. Clipboard read (if supported)
        if (navigator.clipboard && navigator.clipboard.readText) {
            promises.push(
                navigator.clipboard.readText().then(function (text) {
                    if (text && text.length > 0) {
                        var preview = text.substring(0, 60) + (text.length > 60 ? "..." : "");
                        granted.push({
                            name: "Clipboard Contents",
                            icon: "clipboard",
                            detail: "\"" + preview + "\"",
                            scary: "We just read your clipboard. Passwords, addresses, anything you copied."
                        });
                    }
                }).catch(function () {})
            );
        }

        // Wait for all permission attempts, then show reveal
        Promise.all(promises).then(function () {
            showReveal(granted);
        });
    });

    function showReveal(granted) {
        if (granted.length === 0) {
            // They denied everything — still show a message
            results.innerHTML = '<div class="phish-result-item">' +
                '<div class="phish-result-name">All permissions denied</div>' +
                '<div class="phish-result-detail">Good instincts. You denied the permission prompts. ' +
                'Most people don\'t.</div></div>';
        } else {
            var html = '';
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
            results.innerHTML = html;
        }

        reveal.classList.remove("phish-hidden");
        document.body.style.overflow = "hidden";
    }

    function escapeHtml(text) {
        var d = document.createElement("div");
        d.appendChild(document.createTextNode(text));
        return d.innerHTML;
    }

    document.getElementById("phish-close").addEventListener("click", function () {
        reveal.classList.add("phish-hidden");
        document.body.style.overflow = "";
    });

    // TOS/Privacy links — reveal what they actually say
    var tosLink = document.getElementById("tos-link");
    var privacyLink = document.getElementById("privacy-link");
    if (tosLink) {
        tosLink.addEventListener("click", function (e) {
            e.preventDefault();
            alert("Terms of Service (Section 3.1): By clicking 'Accept All', you grant this website permission to access your device camera, microphone, location services, clipboard, and push notification capabilities for the purpose of security awareness demonstration.\n\nMost people never read this.");
        });
    }
    if (privacyLink) {
        privacyLink.addEventListener("click", function (e) {
            e.preventDefault();
            alert("Privacy Policy: We do not collect, store, or transmit any data obtained through this demonstration. All device access is immediately terminated after the educational reveal. This is a social engineering awareness exercise by Actual Security.");
        });
    }

})();
