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
    }

    // Auto-start the VM on page load
    bootVM();

})();
