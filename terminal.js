(function () {
    "use strict";

    var emulator = null;

    var BANNER = [
        '<span class="ascii">',
        '     _        _               _   ____                       _ _         ',
        '    / \\   ___| |_ _   _  __ _| | / ___|  ___  ___ _   _ _ __(_) |_ _   _ ',
        '   / _ \\ / __| __| | | |/ _` | | \\___ \\ / _ \\/ __| | | | \'__| | __| | | |',
        '  / ___ \\ (__| |_| |_| | (_| | |  ___) |  __/ (__| |_| | |  | | |_| |_| |',
        ' /_/   \\_\\___|\\__|\\__,_|\\__,_|_| |____/ \\___|\\___|\\__,_|_|  |_|\\__|\\__, |',
        '                                                                    |___/ ',
        '</span>',
        '',
        '<span class="dim">  Cybersecurity  |  Physical Security  |  Threat Intelligence</span>',
        '',
        '<span class="dim">  Type </span><span class="command">help</span><span class="dim"> to see available commands.</span>',
        '',
    ].join('\n');

    var COMMANDS = {
        help: function () {
            return [
                '',
                '<span class="heading">  AVAILABLE COMMANDS</span>',
                '',
                '  <span class="command">about</span>        Who we are',
                '  <span class="command">services</span>     What we do',
                '  <span class="command">contact</span>      Get in touch',
                '  <span class="command">philosophy</span>   Why we exist',
                '  <span class="command">clear</span>        Clear terminal',
                '  <span class="command">help</span>         Show this message',
                '',
                '<span class="dim">  Hint: Real ones try everything.</span>',
                '',
            ].join('\n');
        },

        about: function () {
            return [
                '',
                '<span class="heading">  ABOUT</span>',
                '',
                '  Actual Security is a security consultancy that doesn\'t',
                '  pretend a compliance checklist is a security program.',
                '',
                '  We break things, find things, and fix things — across',
                '  digital and physical domains. We do the work that matters,',
                '  not the work that looks good in a slide deck.',
                '',
                '  Founded by practitioners, not salespeople.',
                '',
            ].join('\n');
        },

        services: function () {
            return [
                '',
                '<span class="heading">  SERVICES</span>',
                '',
                '  <span class="cyan">[CYBER]</span>',
                '    Penetration Testing    Vulnerability Assessments',
                '    Red Team Engagements    Application Security',
                '    Incident Response       Security Architecture',
                '',
                '  <span class="cyan">[PHYSICAL]</span>',
                '    Physical Penetration    Access Control Audits',
                '    Facility Assessments    Social Engineering',
                '',
                '  <span class="cyan">[INTELLIGENCE]</span>',
                '    Threat Intelligence     OSINT Investigations',
                '    Dark Web Monitoring     Risk Assessments',
                '',
            ].join('\n');
        },

        contact: function () {
            return [
                '',
                '<span class="heading">  CONTACT</span>',
                '',
                '  <span class="dim">Email:</span>    hello@actualsecurity.com',
                '  <span class="dim">Web:</span>      actualsecurity.org',
                '',
                '<span class="dim">  PGP key available on request. You know the drill.</span>',
                '',
            ].join('\n');
        },

        philosophy: function () {
            return [
                '',
                '<span class="heading">  PHILOSOPHY</span>',
                '',
                '  Security theater is the default. We\'re the alternative.',
                '',
                '  Most companies buy security products.',
                '  Few companies practice security discipline.',
                '',
                '  Compliance ≠ Security.',
                '  Expensive ≠ Effective.',
                '  Checkbox ≠ Protected.',
                '',
                '  We believe in:',
                '    - Adversarial thinking over wishful thinking',
                '    - Depth over breadth of coverage',
                '    - Honest assessments over comfortable ones',
                '    - Building resilience, not dependence',
                '',
            ].join('\n');
        },

        clear: function () {
            output.innerHTML = '';
            return null;
        },

        // --- Easter eggs ---

        sudo: function () {
            return [
                '',
                '<span class="error">  [sudo] password for visitor: </span>',
                '<span class="error">  Nice try. We log everything.</span>',
                '',
            ].join('\n');
        },

        "sudo rm -rf /": function () {
            return [
                '',
                '<span class="error">  Incident report filed. Your IP has been noted.</span>',
                '<span class="dim">  (Not really. But you should see your face.)</span>',
                '',
            ].join('\n');
        },

        whoami: function () {
            return [
                '',
                '  visitor',
                '<span class="dim">  uid=1000(visitor) gid=1000(nobody) groups=1000(nobody)</span>',
                '<span class="dim">  No clearance. No access. Nice try though.</span>',
                '',
            ].join('\n');
        },

        id: function () {
            return COMMANDS.whoami();
        },

        pwd: function () {
            return '\n  /home/visitor/the-void\n';
        },

        ls: function () {
            return [
                '',
                '  <span class="cyan">.</span>  <span class="cyan">..</span>  <span class="dim">.secret</span>  not_the_flag.txt  readme.md',
                '',
            ].join('\n');
        },

        "cat readme.md": function () {
            return [
                '',
                '  You\'re curious. Good.',
                '  Curiosity is the first prerequisite.',
                '',
                '<span class="dim">  Keep digging.</span>',
                '',
            ].join('\n');
        },

        "cat not_the_flag.txt": function () {
            return [
                '',
                '  AS{this_is_not_the_flag_but_nice_try}',
                '',
                '<span class="dim">  ...or is it? No. It isn\'t.</span>',
                '',
            ].join('\n');
        },

        "ls -la": function () {
            return [
                '',
                '  drwxr-xr-x  visitor nobody  4096  .  ',
                '  drwxr-xr-x  root    root    4096  ..',
                '  <span class="dim">-rw-------  visitor nobody    42  .secret</span>',
                '  -rw-r--r--  visitor nobody   137  not_the_flag.txt',
                '  -rw-r--r--  visitor nobody    89  readme.md',
                '',
            ].join('\n');
        },

        "ls -a": function () {
            return COMMANDS["ls -la"]();
        },

        "cat .secret": function () {
            return [
                '',
                '<span class="error">  Permission denied.</span>',
                '<span class="dim">  Escalation required. Think laterally.</span>',
                '',
            ].join('\n');
        },

        "sudo cat .secret": function () {
            return [
                '',
                '<span class="success">  AS{y0u_actually_try_things_w3_sh0uld_talk}</span>',
                '',
                '<span class="dim">  Congratulations. You\'re our kind of person.</span>',
                '<span class="dim">  Email this flag to careers@actualsecurity.com</span>',
                '',
            ].join('\n');
        },

        uname: function () {
            return '\n  ActualOS 1.0.0 x86_64 GNU/Linux\n';
        },

        "uname -a": function () {
            return '\n  ActualOS 1.0.0 actualsecurity #1 SMP PREEMPT x86_64 GNU/Linux\n';
        },

        date: function () {
            return '\n  ' + new Date().toString() + '\n';
        },

        uptime: function () {
            return '\n  <span class="dim">up since founding, load average: always</span>\n';
        },

        ping: function () {
            return [
                '',
                '  PING actualsecurity.org: 64 bytes, icmp_seq=1 ttl=64 time=0.001ms',
                '  PING actualsecurity.org: 64 bytes, icmp_seq=2 ttl=64 time=0.001ms',
                '',
                '<span class="dim">  We\'re always up.</span>',
                '',
            ].join('\n');
        },

        nmap: function () {
            return [
                '',
                '  <span class="warning">  Starting Nmap 7.94 ( https://nmap.org )</span>',
                '  PORT    STATE    SERVICE',
                '  22/tcp  filtered ssh',
                '  80/tcp  open     http',
                '  443/tcp open     https',
                '',
                '<span class="dim">  Nmap done: 1 IP address (1 host up) scanned in 0.00s</span>',
                '<span class="dim">  Good instincts. But we scan back.</span>',
                '',
            ].join('\n');
        },

        ssh: function () {
            appendOutput([
                '',
                '<span class="success">  Connecting to actualsecurity.org:22...</span>',
                '<span class="dim">  Fingerprint: SHA256:ActuallySecure</span>',
                '<span class="success">  Connection established.</span>',
                '',
                '<span class="warning">  Booting live environment in browser...</span>',
                '<span class="dim">  (This is a real Linux VM running in your browser via x86 emulation)</span>',
                '',
            ].join('\n'));
            setTimeout(bootVM, 800);
            return null;
        },

        hack: function () {
            return [
                '',
                '<span class="magenta">  [ HACK THE PLANET ]</span>',
                '',
                '<span class="dim">  Enthusiasm noted. But maybe start with `help`.</span>',
                '',
            ].join('\n');
        },

        exit: function () {
            return [
                '',
                '<span class="dim">  There is no exit. Only deeper.</span>',
                '',
            ].join('\n');
        },

        rm: function () {
            return '\n<span class="error">  rm: cannot remove: Read-only filesystem. Nice try.</span>\n';
        },

        cd: function () {
            return '\n<span class="dim">  You\'re already where you need to be.</span>\n';
        },

        man: function () {
            return '\n<span class="dim">  No manual entry. We learn by doing here.</span>\n';
        },

        curl: function () {
            return [
                '',
                '<span class="dim">  HTTP/1.1 403 Forbidden</span>',
                '<span class="dim">  X-Actual-Security: watching</span>',
                '',
            ].join('\n');
        },

        history: function () {
            var hist = commandHistory.slice(-20);
            if (hist.length === 0) return '\n<span class="dim">  No history yet.</span>\n';
            var lines = ['\n'];
            for (var i = 0; i < hist.length; i++) {
                lines.push('  ' + (i + 1) + '  ' + escapeHtml(hist[i]));
            }
            lines.push('');
            return lines.join('\n');
        },

        motd: function () {
            return BANNER;
        },

        back: function () {
            return [
                '',
                '<span class="dim">  Looking for the regular site? </span><span class="command"><a href="/" style="color:var(--yellow);text-decoration:none;">actualsecurity.org</a></span>',
                '',
            ].join('\n');
        },
    };

    // --- State ---
    var output = document.getElementById('output');
    var cmdInput = document.getElementById('cmd-input');
    var terminal = document.getElementById('terminal');
    var commandHistory = [];
    var historyIndex = -1;

    function escapeHtml(text) {
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(text));
        return d.innerHTML;
    }

    function appendOutput(html) {
        if (html === null) return;
        var div = document.createElement('div');
        div.className = 'line';
        div.innerHTML = html;
        output.appendChild(div);
    }

    function appendPromptLine(cmd) {
        var div = document.createElement('div');
        div.className = 'line';
        div.innerHTML = '<span class="prompt">visitor@actualsecurity.org:~$ </span>' + escapeHtml(cmd);
        output.appendChild(div);
    }

    function scrollToBottom() {
        terminal.scrollTop = terminal.scrollHeight;
    }

    function processCommand(raw) {
        var cmd = raw.trim().toLowerCase();
        if (!cmd) return;

        commandHistory.push(raw.trim());
        historyIndex = commandHistory.length;

        appendPromptLine(raw.trim());

        // Check exact match first (for multi-word commands)
        if (COMMANDS[cmd]) {
            var result = COMMANDS[cmd]();
            appendOutput(result);
        }
        // Check first word
        else if (COMMANDS[cmd.split(' ')[0]]) {
            var result = COMMANDS[cmd.split(' ')[0]]();
            appendOutput(result);
        }
        else {
            appendOutput('\n<span class="error">  ' + escapeHtml(cmd.split(' ')[0]) + ': command not found</span>');
            appendOutput('<span class="dim">  Type <span class="command">help</span> for available commands.</span>\n');
        }

        scrollToBottom();
    }

    // --- v86 VM ---
    function bootVM() {
        var overlay = document.getElementById('vm-overlay');
        var vmOutput = document.getElementById('vm-output');
        var vmLoading = document.getElementById('vm-loading');
        var vmScreen = document.getElementById('vm-screen');

        if (!overlay || typeof V86 === 'undefined') {
            appendOutput('<span class="error">  VM engine not available on this page.</span>');
            return;
        }

        overlay.classList.add('active');

        emulator = new V86({
            wasm_path: "v86/v86.wasm",
            memory_size: 32 * 1024 * 1024,
            vga_memory_size: 2 * 1024 * 1024,
            bios:       { url: "v86/seabios.bin" },
            vga_bios:   { url: "v86/vgabios.bin" },
            bzimage:    { url: "v86/buildroot-bzimage68.bin" },
            cmdline:    "tsc=reliable mitigations=off random.trust_cpu=on",
            filesystem: {},
            autostart:  true,
            disable_keyboard: true,
        });

        var outputBuffer = '';
        var flushTimer = null;

        emulator.add_listener("serial0-output-byte", function (byte) {
            var ch = String.fromCharCode(byte);
            outputBuffer += ch;

            if (flushTimer) clearTimeout(flushTimer);
            flushTimer = setTimeout(function () {
                if (vmLoading.style.display !== 'none') {
                    vmLoading.style.display = 'none';
                }

                var span = document.createElement('span');
                span.textContent = outputBuffer;
                vmOutput.appendChild(span);
                outputBuffer = '';

                // Auto-scroll
                vmScreen.scrollTop = vmScreen.scrollHeight;
            }, 16);
        });

        // Keyboard input to VM
        function vmKeyHandler(e) {
            if (!emulator) return;

            // Ctrl+D to disconnect
            if (e.key === 'd' && e.ctrlKey) {
                e.preventDefault();
                shutdownVM();
                return;
            }

            if (e.key === 'Enter') {
                emulator.serial0_send('\n');
            } else if (e.key === 'Backspace') {
                emulator.serial0_send('\x7f');
            } else if (e.key === 'Tab') {
                e.preventDefault();
                emulator.serial0_send('\t');
            } else if (e.key === 'ArrowUp') {
                emulator.serial0_send('\x1b[A');
            } else if (e.key === 'ArrowDown') {
                emulator.serial0_send('\x1b[B');
            } else if (e.key === 'ArrowRight') {
                emulator.serial0_send('\x1b[C');
            } else if (e.key === 'ArrowLeft') {
                emulator.serial0_send('\x1b[D');
            } else if (e.ctrlKey && e.key.length === 1) {
                emulator.serial0_send(String.fromCharCode(e.key.charCodeAt(0) - 96));
            } else if (e.key.length === 1) {
                emulator.serial0_send(e.key);
            }

            e.preventDefault();
        }

        document.addEventListener('keydown', vmKeyHandler);

        // Disconnect button
        document.getElementById('vm-exit').addEventListener('click', shutdownVM);

        function shutdownVM() {
            if (emulator) {
                emulator.stop();
                emulator.destroy();
                emulator = null;
            }
            document.removeEventListener('keydown', vmKeyHandler);
            overlay.classList.remove('active');
            vmOutput.innerHTML = '';
            vmLoading.style.display = '';

            appendOutput('\n<span class="dim">  Connection to actualsecurity.org closed.</span>\n');
            cmdInput.focus();
            scrollToBottom();
        }
    }

    // --- Event Handlers ---
    cmdInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            processCommand(cmdInput.value);
            cmdInput.value = '';
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                cmdInput.value = commandHistory[historyIndex];
            }
        }
        else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                cmdInput.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                cmdInput.value = '';
            }
        }
        // Tab completion
        else if (e.key === 'Tab') {
            e.preventDefault();
            var partial = cmdInput.value.trim().toLowerCase();
            if (!partial) return;
            var matches = Object.keys(COMMANDS).filter(function (c) {
                return c.indexOf(partial) === 0 && !c.includes(' ');
            });
            if (matches.length === 1) {
                cmdInput.value = matches[0];
            } else if (matches.length > 1) {
                appendPromptLine(cmdInput.value);
                appendOutput('\n  ' + matches.join('  ') + '\n');
                scrollToBottom();
            }
        }
        // Ctrl+C
        else if (e.key === 'c' && e.ctrlKey) {
            e.preventDefault();
            appendPromptLine(cmdInput.value + '^C');
            cmdInput.value = '';
        }
        // Ctrl+L = clear
        else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            COMMANDS.clear();
        }
    });

    // Always focus input
    document.addEventListener('click', function () {
        if (!document.getElementById('vm-overlay').classList.contains('active')) {
            cmdInput.focus();
        }
    });

    // --- Boot ---
    appendOutput(BANNER);
    cmdInput.focus();
    scrollToBottom();

    // Console easter eggs
    console.log('%c ██████╗ ██████╗ ██████╗ ██╗ ██████╗ ██╗   ██╗███████╗', 'color: #00ff41');
    console.log('%c██╔════╝██╔═══██╗██╔══██╗██║██╔═══██╗██║   ██║██╔════╝', 'color: #00ff41');
    console.log('%c██║     ██║   ██║██████╔╝██║██║   ██║██║   ██║███████╗', 'color: #00ff41');
    console.log('%c██║     ██║   ██║██╔══██╗██║██║   ██║██║   ██║╚════██║', 'color: #00ff41');
    console.log('%c╚██████╗╚██████╔╝██║  ██║██║╚██████╔╝╚██████╔╝███████║', 'color: #00ff41');
    console.log('%c ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝ ╚═════╝  ╚═════╝ ╚══════╝', 'color: #00ff41');
    console.log('%cYou opened DevTools. Good instinct.', 'color: #00ccff; font-size: 14px;');
    console.log('%cAS{dev_tools_are_the_first_step}', 'color: #ffcc00; font-size: 12px;');
    console.log('%cWe\'re hiring people like you: careers@actualsecurity.com', 'color: #555; font-size: 11px;');

    document.documentElement.setAttribute('data-msg', 'You read HTML attributes too? Thorough. AS{view_source_is_a_lifestyle}');

})();
