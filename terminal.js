(function () {
    "use strict";

    var emulator = null;

    function bootVM() {
        var vmLoading = document.getElementById('vm-loading');

        if (typeof V86 === 'undefined') {
            vmLoading.textContent = 'VM engine failed to load.';
            return;
        }

        emulator = new V86({
            wasm_path: "v86/v86.wasm",
            memory_size: 32 * 1024 * 1024,
            vga_memory_size: 2 * 1024 * 1024,
            screen_container: document.getElementById("screen_container"),
            bios:       { url: "v86/seabios.bin" },
            vga_bios:   { url: "v86/vgabios.bin" },
            cdrom:      { url: "v86/linux.iso" },
            autostart:  true,
        });

        // Hide loading message once VGA output starts
        emulator.add_listener("screen-set-size-graphical", function () {
            vmLoading.style.display = 'none';
        });
        emulator.add_listener("screen-put-char", function () {
            vmLoading.style.display = 'none';
        });

        // Scale VGA text to fill viewport width
        var screenContainer = document.getElementById("screen_container");
        var innerDiv = screenContainer.querySelector("div");
        var scaleApplied = false;

        function applyScale() {
            if (!innerDiv || !innerDiv.textContent.trim()) return;
            // Temporarily remove transform so scrollWidth reflects natural size
            innerDiv.style.transform = "none";
            var naturalWidth = innerDiv.scrollWidth;
            var availableWidth = screenContainer.clientWidth;
            if (naturalWidth > 0 && availableWidth > 0) {
                var scale = availableWidth / naturalWidth;
                innerDiv.style.transform = "scale(" + scale + ")";
                // Set container height to match scaled content
                var naturalHeight = innerDiv.scrollHeight;
                screenContainer.style.height = (naturalHeight * scale) + "px";
                scaleApplied = true;
            }
        }

        // Poll until content appears, then scale
        var pollTimer = setInterval(function () {
            if (innerDiv && innerDiv.textContent.trim()) {
                applyScale();
                if (scaleApplied) clearInterval(pollTimer);
            }
        }, 200);

        window.addEventListener("resize", function () {
            if (scaleApplied) applyScale();
        });
    }

    // Auto-start the VM on page load
    bootVM();

})();
