(function () {
    "use strict";

    var DB_NAME = "as_fp";
    var STORE_NAME = "fingerprints";
    var STORAGE_KEY = "as_device_fp";
    var VISIT_KEY = "as_visit_data";
    var COOKIE_NAMES = ["_as_fp", "_as_sid", "_as_ref"];
    var CACHE_NAME = "as-fp-cache";
    var CACHE_URL = "/as-fp-store";
    var CSS_CACHE_PREFIX = "/as-css-fp-";

    // --- Helpers ---

    function setCookie(name, value, days) {
        var d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        var paths = ["/", "/index.html", "/recon"];
        for (var i = 0; i < paths.length; i++) {
            document.cookie = name + "_" + i + "=" + encodeURIComponent(value) +
                ";expires=" + d.toUTCString() +
                ";path=" + paths[i] +
                ";SameSite=Lax";
        }
    }

    function getCookie(name) {
        var cookies = document.cookie.split(";");
        for (var i = 0; i < cookies.length; i++) {
            var c = cookies[i].trim();
            // Check all path variants
            for (var p = 0; p < 3; p++) {
                var key = name + "_" + p + "=";
                if (c.indexOf(key) === 0) {
                    return decodeURIComponent(c.substring(key.length));
                }
            }
        }
        return null;
    }

    // --- 1. localStorage ---

    function persistLocalStorage(id) {
        try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* blocked */ }
    }

    function recoverLocalStorage() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    // --- 2. sessionStorage ---

    function persistSessionStorage(id) {
        try { sessionStorage.setItem(STORAGE_KEY, id); } catch (e) { /* blocked */ }
    }

    function recoverSessionStorage() {
        try { return sessionStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    // --- 3. IndexedDB ---

    function openDB() {
        return new Promise(function (resolve, reject) {
            try {
                var req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = function (e) {
                    var db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: "key" });
                    }
                };
                req.onsuccess = function (e) { resolve(e.target.result); };
                req.onerror = function () { reject(new Error("IndexedDB open failed")); };
            } catch (e) { reject(e); }
        });
    }

    function persistIndexedDB(id) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(STORE_NAME, "readwrite");
                var store = tx.objectStore(STORE_NAME);
                store.put({ key: "fingerprint", value: id });
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(); };
            });
        }).catch(function () { /* IndexedDB not available */ });
    }

    function recoverIndexedDB() {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(STORE_NAME, "readonly");
                var store = tx.objectStore(STORE_NAME);
                var req = store.get("fingerprint");
                req.onsuccess = function () {
                    resolve(req.result ? req.result.value : null);
                };
                req.onerror = function () { resolve(null); };
            });
        }).catch(function () { return null; });
    }

    // --- 4. Multiple cookies ---

    function persistCookies(id) {
        try {
            for (var i = 0; i < COOKIE_NAMES.length; i++) {
                setCookie(COOKIE_NAMES[i], id, 365);
            }
        } catch (e) { /* cookies blocked */ }
    }

    function recoverCookies() {
        try {
            for (var i = 0; i < COOKIE_NAMES.length; i++) {
                var val = getCookie(COOKIE_NAMES[i]);
                if (val) return val;
            }
        } catch (e) { /* */ }
        return null;
    }

    // --- 5. Cache API ---

    function persistCacheAPI(id) {
        if (!window.caches) return Promise.resolve();
        return caches.open(CACHE_NAME).then(function (cache) {
            var response = new Response(JSON.stringify({ fingerprint: id }), {
                headers: { "Content-Type": "application/json" }
            });
            return cache.put(CACHE_URL, response);
        }).catch(function () { /* Cache API not available */ });
    }

    function recoverCacheAPI() {
        if (!window.caches) return Promise.resolve(null);
        return caches.open(CACHE_NAME).then(function (cache) {
            return cache.match(CACHE_URL);
        }).then(function (response) {
            if (!response) return null;
            return response.json().then(function (data) {
                return data.fingerprint || null;
            });
        }).catch(function () { return null; });
    }

    // --- 6. CSS cache fingerprint ---

    function persistCSSCache(id) {
        if (!window.caches) return Promise.resolve();
        var url = CSS_CACHE_PREFIX + id + ".css";
        return caches.open(CACHE_NAME).then(function (cache) {
            var response = new Response("/* fp:" + id + " */", {
                headers: { "Content-Type": "text/css" }
            });
            return cache.put(url, response);
        }).catch(function () { /* */ });
    }

    function recoverCSSCache() {
        if (!window.caches) return Promise.resolve(null);
        return caches.open(CACHE_NAME).then(function (cache) {
            return cache.keys();
        }).then(function (keys) {
            for (var i = 0; i < keys.length; i++) {
                var url = keys[i].url;
                var idx = url.indexOf(CSS_CACHE_PREFIX);
                if (idx !== -1) {
                    var rest = url.substring(idx + CSS_CACHE_PREFIX.length);
                    var fpId = rest.replace(".css", "");
                    if (fpId && fpId.length > 0) return fpId;
                }
            }
            return null;
        }).catch(function () { return null; });
    }

    // --- Visit tracking ---

    function getVisitData() {
        try {
            var raw = localStorage.getItem(VISIT_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* */ }
        // Try cookies as fallback
        try {
            var cookie = getCookie("_as_visits");
            if (cookie) return JSON.parse(decodeURIComponent(cookie));
        } catch (e) { /* */ }
        return null;
    }

    function saveVisitData(data) {
        try {
            var str = JSON.stringify(data);
            localStorage.setItem(VISIT_KEY, str);
        } catch (e) { /* */ }
        try {
            setCookie("_as_visits", JSON.stringify(data), 365);
        } catch (e) { /* */ }
    }

    // --- Public API ---

    function persistFingerprint(id) {
        if (!id) return;

        // Synchronous stores
        persistLocalStorage(id);
        persistSessionStorage(id);
        persistCookies(id);

        // Async stores
        persistIndexedDB(id);
        persistCacheAPI(id);
        persistCSSCache(id);

        // Update visit data
        var visitData = getVisitData();
        if (!visitData) {
            visitData = {
                firstSeen: new Date().toISOString(),
                visitCount: 1,
                lastSeen: new Date().toISOString(),
                id: id
            };
        } else {
            visitData.visitCount = (visitData.visitCount || 0) + 1;
            visitData.lastSeen = new Date().toISOString();
            if (!visitData.id) visitData.id = id;
        }
        saveVisitData(visitData);
    }

    function recoverFingerprint() {
        // Try synchronous sources first
        var id = recoverLocalStorage();
        if (id) return Promise.resolve({ id: id, source: "localStorage" });

        id = recoverSessionStorage();
        if (id) return Promise.resolve({ id: id, source: "sessionStorage" });

        id = recoverCookies();
        if (id) return Promise.resolve({ id: id, source: "cookies" });

        // Try async sources
        return recoverIndexedDB().then(function (val) {
            if (val) return { id: val, source: "IndexedDB" };
            return recoverCacheAPI();
        }).then(function (result) {
            if (result && result.source) return result;
            if (result) return { id: result, source: "Cache API" };
            return recoverCSSCache();
        }).then(function (result) {
            if (result && result.source) return result;
            if (result) return { id: result, source: "CSS cache" };
            return null;
        }).catch(function () { return null; });
    }

    // --- Display returning visitor ---

    function showReturningVisitor(recoveredId, source) {
        var visitData = getVisitData();
        if (!visitData) return;

        var rvEl = document.getElementById("returning-visitor");
        var rvDetail = document.getElementById("rv-detail");
        if (!rvEl || !rvDetail) return;

        var firstSeen = "unknown";
        if (visitData.firstSeen) {
            try {
                var d = new Date(visitData.firstSeen);
                firstSeen = d.toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric"
                });
            } catch (e) { firstSeen = visitData.firstSeen; }
        }

        var visitNum = visitData.visitCount || 1;

        var lines = [];
        lines.push("Visit #" + visitNum + "  &middot;  First seen: " + firstSeen);
        lines.push("Recovered via: <strong>" + source + "</strong>");
        lines.push("<span class=\"rv-warning\">Your fingerprint persists even if you clear cookies.</span>");

        rvDetail.innerHTML = lines.join("<br>");
        rvEl.style.display = "";
        setTimeout(function () { rvEl.classList.add("rv-revealed"); }, 50);
    }

    // --- Init: attempt recovery, then hook into fingerprint generation ---

    // Expose for recon.js to call after computing fingerprint
    window.__persistFingerprint = persistFingerprint;

    // Attempt recovery on load
    recoverFingerprint().then(function (result) {
        if (result && result.id) {
            showReturningVisitor(result.id, result.source);
            // Re-persist to all stores (some may have been cleared)
            persistFingerprint(result.id);
        }
    });

    // Watch for the fingerprint element to be populated by recon.js
    // Then persist it everywhere
    var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var el = mutations[i].target;
            if (el.id === "r-deviceid" && el.textContent && el.textContent !== "Generating...") {
                var newId = el.textContent.trim();
                if (newId.length > 0) {
                    persistFingerprint(newId);
                    observer.disconnect();

                    // Check if this is a returning visitor whose recovered ID matches
                    recoverFingerprint().then(function (result) {
                        if (result && result.id) {
                            showReturningVisitor(result.id, result.source);
                        }
                    });
                }
                break;
            }
        }
    });

    var target = document.getElementById("r-deviceid");
    if (target) {
        observer.observe(target, { childList: true, characterData: true, subtree: true });
    }

})();
