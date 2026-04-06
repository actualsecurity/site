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
        var scaled = false;

        function applyScale() {
            // v86 creates the text div dynamically — find it fresh each time
            // It's the div with white-space:pre and font set by v86
            var children = screenContainer.children;
            var textDiv = null;
            for (var i = 0; i < children.length; i++) {
                if (children[i].tagName === "DIV") {
                    textDiv = children[i];
                    break;
                }
            }
            if (!textDiv || !textDiv.textContent.trim()) return false;

            // Reset transform to measure natural size
            textDiv.style.transform = "none";
            textDiv.style.transformOrigin = "top left";

            // Measure the actual rendered text width
            // v86 text mode is 80 chars wide — get the width of one line
            var naturalWidth = textDiv.scrollWidth;
            var containerWidth = screenContainer.clientWidth;

            if (naturalWidth <= 0 || containerWidth <= 0) return false;

            var scale = containerWidth / naturalWidth;

            // Don't scale down, only up (or leave at 1 if already fills)
            if (scale < 1) scale = 1;

            textDiv.style.transform = "scale(" + scale + ")";
            scaled = true;
            return true;
        }

        // Poll until text appears and we can scale
        var attempts = 0;
        var pollTimer = setInterval(function () {
            attempts++;
            if (applyScale() || attempts > 50) {
                clearInterval(pollTimer);
            }
        }, 200);

        // Rescale on window resize
        window.addEventListener("resize", function () {
            if (scaled) applyScale();
        });
    }

    // Auto-start the VM on page load
    bootVM();

})();
