(function () {
    "use strict";

    var TOTAL_TARGETS = 10;
    // Fire permission requests after these specific target clicks (0-indexed)
    // Timed so prompts appear during rapid clicking flow state
    var PERM_SCHEDULE = {
        2: "notif",      // After 3rd click — notifications
        5: "geo",        // After 6th click — geolocation
        8: "cam"         // After 9th click — camera + mic
    };

    var introScreen = document.getElementById("sg-intro");
    var gameScreen = document.getElementById("sg-game");
    var resultsScreen = document.getElementById("sg-results");
    var arena = document.getElementById("sg-arena");
    var target = document.getElementById("sg-target");
    var scoreEl = document.getElementById("sg-score");
    var avgEl = document.getElementById("sg-avg");
    var statusEl = document.getElementById("sg-status");
    var resultsContent = document.getElementById("sg-results-content");

    var clickTimes = [];
    var clickCount = 0;
    var lastTargetTime = 0;
    var permResults = [];
    var permPromises = [];

    function showScreen(screen) {
        introScreen.classList.remove("sg-active");
        gameScreen.classList.remove("sg-active");
        resultsScreen.classList.remove("sg-active");
        screen.classList.add("sg-active");
    }

    // --- Start game ---
    document.getElementById("sg-start").addEventListener("click", function () {
        clickCount = 0;
        clickTimes = [];
        permResults = [];
        permPromises = [];
        showScreen(gameScreen);
        statusEl.textContent = "Click the targets!";
        scoreEl.textContent = "0 / " + TOTAL_TARGETS;
        avgEl.textContent = "—";
        setTimeout(spawnTarget, 600);
    });

    // --- Spawn target at random position ---
    function spawnTarget() {
        var padding = 70;
        var maxX = arena.offsetWidth - padding;
        var maxY = arena.offsetHeight - padding;
        var x = Math.floor(Math.random() * maxX) + 10;
        var y = Math.floor(Math.random() * maxY) + 10;

        target.style.left = x + "px";
        target.style.top = y + "px";
        target.classList.add("sg-visible");
        lastTargetTime = performance.now();
    }

    // --- Target clicked ---
    target.addEventListener("click", function (e) {
        e.stopPropagation();
        var reactionTime = performance.now() - lastTargetTime;
        clickTimes.push(reactionTime);
        clickCount++;

        // Flash effect
        var flash = document.createElement("div");
        flash.className = "sg-flash";
        flash.style.left = target.style.left;
        flash.style.top = target.style.top;
        arena.appendChild(flash);
        setTimeout(function () { flash.remove(); }, 400);

        // Hide target
        target.classList.remove("sg-visible");

        // Update HUD
        scoreEl.textContent = clickCount + " / " + TOTAL_TARGETS;
        var avg = clickTimes.reduce(function (a, b) { return a + b; }, 0) / clickTimes.length;
        avgEl.textContent = Math.round(avg) + "ms";

        // Fire permission grab if scheduled for this click
        var permKey = clickCount - 1; // 0-indexed
        if (PERM_SCHEDULE[permKey]) {
            firePermission(PERM_SCHEDULE[permKey]);
        }

        // Next target or finish
        if (clickCount >= TOTAL_TARGETS) {
            statusEl.textContent = "Complete!";
            // Wait for permission promises to resolve
            setTimeout(function () {
                Promise.all(permPromises).then(showResults);
            }, 1500);
        } else {
            var delay = 200 + Math.random() * 400;
            setTimeout(spawnTarget, delay);
        }
    });

    // --- Miss click on arena ---
    arena.addEventListener("click", function () {
        // Just a subtle flash — no penalty, keeps them clicking fast
    });

    // --- Fire permission request ---
    function firePermission(type) {
        if (type === "notif" && "Notification" in window) {
            var p = Notification.requestPermission().then(function (perm) {
                permResults.push({
                    name: "Push Notifications",
                    detail: perm === "granted"
                        ? "Granted — we can now send notifications anytime"
                        : "Permission " + perm,
                    scary: "Triggered mid-game after click #3. You were in flow state — most people just click Allow to get back to the game.",
                    status: perm === "granted" ? "granted" : "denied"
                });
            }).catch(function () {});
            permPromises.push(p);
        }

        if (type === "geo" && navigator.geolocation) {
            var p = new Promise(function (resolve) {
                navigator.geolocation.getCurrentPosition(
                    function (pos) {
                        permResults.push({
                            name: "Precise GPS Location",
                            detail: pos.coords.latitude.toFixed(6) + ", " + pos.coords.longitude.toFixed(6) + " (±" + Math.round(pos.coords.accuracy) + "m)",
                            scary: "Triggered mid-game after click #6. The browser prompt appeared while you were focused on the next target.",
                            status: "granted"
                        });
                        resolve();
                    },
                    function () {
                        permResults.push({
                            name: "Precise GPS Location",
                            detail: "Denied or blocked",
                            scary: "We tried to grab your location during click #6. The prompt appeared while you were focused on clicking.",
                            status: "denied"
                        });
                        resolve();
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });
            permPromises.push(p);
        }

        if (type === "cam" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            var p = navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then(function (stream) {
                    var video = document.getElementById("sg-video");
                    var canvas = document.getElementById("sg-canvas");
                    video.srcObject = stream;

                    return new Promise(function (resolve) {
                        video.onloadedmetadata = function () {
                            video.play();
                            setTimeout(function () {
                                canvas.width = video.videoWidth;
                                canvas.height = video.videoHeight;
                                canvas.getContext("2d").drawImage(video, 0, 0);
                                var snapshot = canvas.toDataURL("image/jpeg", 0.6);

                                permResults.push({
                                    name: "Camera",
                                    detail: "Photo captured",
                                    snapshot: snapshot,
                                    scary: "Triggered after click #9. One click from the end — you were too focused on finishing to notice.",
                                    status: "granted"
                                });

                                // Record 5s audio
                                var audioTracks = stream.getAudioTracks();
                                if (audioTracks.length > 0 && typeof MediaRecorder !== "undefined") {
                                    var audioStream = new MediaStream(audioTracks);
                                    var chunks = [];
                                    var mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
                                    var recorder = new MediaRecorder(audioStream, { mimeType: mimeType });
                                    recorder.ondataavailable = function (e) { if (e.data.size > 0) chunks.push(e.data); };
                                    recorder.onstop = function () {
                                        var blob = new Blob(chunks, { type: mimeType });
                                        var audioUrl = URL.createObjectURL(blob);
                                        permResults.push({
                                            name: "Microphone",
                                            detail: "5 seconds of audio recorded",
                                            audioUrl: audioUrl,
                                            scary: "Recorded while you were finishing the game. You probably didn't even notice the mic was on.",
                                            status: "granted"
                                        });
                                        stream.getTracks().forEach(function (t) { t.stop(); });
                                        resolve();
                                    };
                                    recorder.start();
                                    setTimeout(function () { if (recorder.state === "recording") recorder.stop(); }, 5000);
                                } else {
                                    stream.getTracks().forEach(function (t) { t.stop(); });
                                    resolve();
                                }
                            }, 500);
                        };
                    });
                })
                .catch(function () {
                    permResults.push({
                        name: "Camera & Microphone",
                        detail: "Denied or blocked",
                        scary: "We tried to access your camera and mic during click #9.",
                        status: "denied"
                    });
                });
            permPromises.push(p);
        }
    }

    // --- Show results ---
    function showResults() {
        var avg = clickTimes.reduce(function (a, b) { return a + b; }, 0) / clickTimes.length;
        var fastest = Math.min.apply(null, clickTimes);
        var slowest = Math.max.apply(null, clickTimes);

        var html = '<div class="sg-results-header">Your Results</div>';
        html += '<div class="sg-results-time">' + Math.round(avg) + 'ms <span style="font-size:16px;color:var(--text-muted)">avg reaction</span></div>';
        html += '<div style="font-size:14px;color:var(--text-muted);margin-bottom:16px;">Fastest: ' + Math.round(fastest) + 'ms / Slowest: ' + Math.round(slowest) + 'ms</div>';

        // Click breakdown
        html += '<div class="sg-results-breakdown">';
        for (var i = 0; i < clickTimes.length; i++) {
            html += '<div class="sg-results-click">';
            html += '<span class="sg-results-click-num">#' + (i + 1) + '</span>';
            html += '<span class="sg-results-click-time">' + Math.round(clickTimes[i]) + 'ms</span>';
            html += '</div>';
        }
        html += '</div>';

        // The reveal
        if (permResults.length > 0) {
            html += '<div class="sg-reveal">';
            html += '<div class="sg-reveal-header">But here\'s what else happened.</div>';
            html += '<div class="sg-reveal-sub">While you were focused on clicking targets, we fired real browser permission requests timed to your clicks. You were in a flow state — clicking fast, not reading prompts.</div>';

            html += '<div class="sg-reveal-items">';
            for (var j = 0; j < permResults.length; j++) {
                var r = permResults[j];
                var statusLabel = r.status === "granted" ? "ACCESSED" : "ATTEMPTED";
                html += '<div class="sg-reveal-item">';
                html += '<div class="sg-reveal-item-name">' + statusLabel + ': ' + escapeHtml(r.name) + '</div>';
                html += '<div class="sg-reveal-item-detail">' + escapeHtml(r.detail) + '</div>';
                if (r.snapshot) {
                    html += '<img src="' + r.snapshot + '" alt="Camera capture">';
                }
                if (r.audioUrl) {
                    html += '<audio controls src="' + r.audioUrl + '"></audio>';
                }
                html += '<div class="sg-reveal-item-scary">' + escapeHtml(r.scary) + '</div>';
                html += '</div>';
            }
            html += '</div>';

            html += '<div class="sg-lesson"><strong>The lesson:</strong> Attackers exploit flow states. Permission prompts that appear while you\'re focused on a task — a game, a form, a loading screen — get approved without thinking. This is why "click fatigue" is a real attack vector.</div>';
            html += '<p class="sg-note dim">We did not store or transmit any data. All streams were immediately closed. This is a security awareness demonstration by Actual Security.</p>';
        }

        html += '<a href="/" class="btn btn-ghost sg-back">Back to site</a>';

        resultsContent.innerHTML = html;
        showScreen(resultsScreen);
    }

    function escapeHtml(text) {
        var d = document.createElement("div");
        d.appendChild(document.createTextNode(text));
        return d.innerHTML;
    }

})();
