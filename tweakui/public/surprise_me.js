// General > Just for Fun > Surprise Me: fireworks go off over every page at random moments, until the setting is
// turned off. A show lasts a few seconds and the next follows 4 to 8 seconds later; none starts while the tab is
// hidden. A right-click (also a Mac's Ctrl+click) sends a rocket that bursts where the pointer is, instead of the
// browser's menu (which text fields and Shift + right-click still get); a right-drag (the 3D view's pan) sends none. The fireworks are fireworks-js (vendor/fireworks-js, MIT), loaded only
// when a show starts, on a canvas over the page that clicks go through. The settings page announces each saved
// change ("tweakuiSettingsChanged"), so turning it on there starts a show at once and turning it off ends it at once.
// UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    // On every page whether on or off: the settings page turns it on and off as it saves
    else if (root.document) root.TweakUI.feature(root, "surprise_me", api.start, {ready: true});
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: none (it draws over the whole page)
    var SELECTORS = {};
    var NAME = "surprise_me";

    var LIBRARY = "/plugins/tweakui/vendor/fireworks-js/fireworks.umd.js", EVENT = "tweakuiSettingsChanged";
    // In seconds: the first show after a page opens, the gap between shows, and how long one lasts
    var FIRST = [4, 8], GAP = [4, 8], LENGTH = [5, 10];
    // In pixels: how far the pointer may move between a right button's press and release for a right-click
    var SLOP = 5;
    // In milliseconds: on Windows the contextmenu event comes after the release; how long after it it still belongs to
    // the right-click (and gets no browser menu)
    var MENU_AFTER = 1000;
    // Silent, and the mouse doesn't launch rockets (clicks go to the page)
    var OPTIONS = {
        autoresize: true, sound: {enabled: false}, mouse: {click: false, move: false, max: 1},
        hue: {min: 0, max: 360}, rocketsPoint: {min: 10, max: 90}, delay: {min: 30, max: 60},
        opacity: 0.5, acceleration: 1.05, friction: 0.97, gravity: 1.5, particles: 60, explosion: 6,
        intensity: 30, flickering: 50, traceLength: 3, traceSpeed: 10,
        brightness: {min: 45, max: 65}, decay: {min: 0.015, max: 0.03},
        lineWidth: {explosion: {min: 2, max: 4}, trace: {min: 1, max: 2}}
    };

    var loading = null;

    // fireworks-js's Fireworks class, its script added to the page the first time
    function load(doc, win) {
        if (win.Fireworks && win.Fireworks.Fireworks) return Promise.resolve(win.Fireworks.Fireworks);
        if (!loading) {
            loading = new Promise(function (resolve, reject) {
                var script = doc.createElement("script");
                script.src = LIBRARY;
                script.onload = function () {
                    if (win.Fireworks && win.Fireworks.Fireworks) resolve(win.Fireworks.Fireworks);
                    else reject(new Error("fireworks-js did not load"));
                };
                script.onerror = function () { reject(new Error("fireworks-js did not load")); };
                doc.head.appendChild(script);
            }).then(null, function (e) {
                loading = null;
                throw e;
            });
        }
        return loading;
    }

    // Milliseconds within a range of seconds
    function between(range, random) {
        return Math.round((range[0] + (range[1] - range[0]) * random()) * 1000);
    }

    // A full-page layer for a fireworks canvas, which clicks go through
    function overlay(doc) {
        var box = doc.createElement("div");
        box.className = "tweakui-fireworks";
        box.setAttribute("aria-hidden", "true");
        doc.body.appendChild(box);
        return box;
    }

    // One rocket from the bottom of the page to (x, y) in the viewport. fireworks-js 2.10.8 aims its rockets at its
    // mouse position while that is active (Fireworks.mouse, not part of its documented API); launch() starts the
    // fireworks if they aren't going and stops them once the bursts fade.
    function aim(fireworks, x, y) {
        var mouse = fireworks.mouse;
        mouse.x = x;
        mouse.y = y;
        mouse.active = true;
        try {
            fireworks.launch(1);
        } finally {
            mouse.active = false;
        }
    }

    function editable(target) {
        return !!(target && target.closest && target.closest("input, textarea, select, [contenteditable]"));
    }

    // The shows: set(true) schedules them, set(false) ends the one going and cancels the next. env gives the timers,
    // the randomness and the loader, which tests replace.
    function create(doc, win, env) {
        env = env || {};
        var random = env.random || Math.random, loader = env.load || load;
        var later = env.setTimeout || function (f, ms) { return win.setTimeout(f, ms); };
        var cancel = env.clearTimeout || function (t) { win.clearTimeout(t); };
        var now = env.now || function () { return Date.now(); };
        var on = false, timer = null, show = null, clicks = null, press = null, released = null;

        function schedule(range) {
            if (timer !== null) cancel(timer);
            timer = later(burst, between(range, random));
        }

        function burst() {
            timer = null;
            if (!on || show) return;
            if (doc.hidden) return schedule(GAP);
            loader(doc, win).then(function (Fireworks) {
                if (!on || show) return;
                var box = overlay(doc);
                var fireworks = new Fireworks(box, OPTIONS);
                fireworks.start();
                show = {box: box, fireworks: fireworks, timer: later(end, between(LENGTH, random))};
            }, function () {
                if (on) schedule(GAP);
            });
        }

        function remove(box) {
            if (box.parentNode) box.parentNode.removeChild(box);
        }

        // No more rockets; the last ones burst and fade before the canvas goes
        function end() {
            var s = show;
            show = null;
            if (!s) return;
            Promise.resolve(s.fireworks.waitStop(true)).then(function () { remove(s.box); });
            if (on) schedule(GAP);
        }

        function stop() {
            on = false;
            if (timer !== null) cancel(timer);
            timer = null;
            if (show) {
                cancel(show.timer);
                show.fireworks.stop(true);
                remove(show.box);
                show = null;
            }
            press = null;
            if (clicks) {
                clicks.fireworks.stop(true);
                remove(clicks.box);
                clicks = null;
            }
        }

        // Right-clicks have a layer of their own, kept until the setting is turned off, so they don't end a show
        function rocket(x, y) {
            loader(doc, win).then(function (Fireworks) {
                if (!on) return;
                if (!clicks) {
                    var box = overlay(doc);
                    clicks = {box: box, fireworks: new Fireworks(box, OPTIONS)};
                } else if (!clicks.fireworks.isRunning) clicks.fireworks.updateSize();
                aim(clicks.fireworks, x, y);
            }, function () { /* no rocket this time */ });
        }

        // A right button pressed outside a text field, without Shift, and released where it was pressed is a
        // right-click; its contextmenu event gets no browser menu. That event comes on the press (Linux, Mac) or
        // after the release (Windows): a release with no contextmenu yet leaves `released`, so the one that follows
        // is the right-click's too, and a menu key pressed later still gets its menu. On a Mac,
        // Ctrl+click is a right-click too: a left press with Ctrl that the browser follows with a contextmenu event;
        // its rocket goes then, as there may be no mouseup. Elsewhere Ctrl+click has no contextmenu, so no rocket.
        function mousedown(e) {
            var right = e.button === 2 || (e.button === 0 && e.ctrlKey);
            released = null;
            press = on && right && !e.shiftKey && !editable(e.target) ? {x: e.clientX, y: e.clientY, ctrl: e.button === 0} : null;
        }

        function contextmenu(e) {
            var late = !press && released !== null && now() - released <= MENU_AFTER;
            released = null;
            if (!on || e.shiftKey || !(press || late)) return;
            e.preventDefault();
            if (!press) return;
            press.menu = true;
            if (press.ctrl) {
                var p = press;
                press = null;
                rocket(p.x, p.y);
            }
        }

        function mouseup(e) {
            // A Ctrl+click released with no contextmenu (Windows, Linux) is over: a later menu key gets its menu
            if (press && press.ctrl && e.button === 0) press = null;
            if (e.button !== 2 || !press || press.ctrl) return;
            var p = press;
            press = null;
            if (!p.menu) released = now();
            if (on && Math.abs(e.clientX - p.x) <= SLOP && Math.abs(e.clientY - p.y) <= SLOP) rocket(e.clientX, e.clientY);
        }

        // now: the first show starts at once (turned on in the settings page)
        function set(enabled, now) {
            if (enabled && !on) {
                on = true;
                schedule(now ? [0, 0] : FIRST);
            } else if (!enabled && on) stop();
        }

        return {
            set: set, stop: stop, showing: function () { return show !== null; },
            mouse: {mousedown: mousedown, contextmenu: contextmenu, mouseup: mouseup}
        };
    }

    function start(doc, win, env) {
        var shows = create(doc, win, env);
        var settings = ui.settingsOf(win), mouse = {};
        var changed = ui.guard(NAME, function (e) {
            shows.set(!!(e.detail && e.detail.surprise_me === true), true);
        });
        shows.set(settings.surprise_me === true, false);
        Object.keys(shows.mouse).forEach(function (type) { mouse[type] = ui.guard(NAME, shows.mouse[type]); });
        // Captured, so a page that stops a click's propagation (a map) still gets its rocket
        Object.keys(mouse).forEach(function (type) { doc.addEventListener(type, mouse[type], true); });
        doc.addEventListener(EVENT, changed);
        return {
            set: shows.set, showing: shows.showing,
            // Ends the shows and stops listening
            stop: function () {
                shows.stop();
                Object.keys(mouse).forEach(function (type) { doc.removeEventListener(type, mouse[type], true); });
                doc.removeEventListener(EVENT, changed);
            }
        };
    }

    return {start: start, create: create, load: load, OPTIONS: OPTIONS, LIBRARY: LIBRARY, SELECTORS: SELECTORS};
});
