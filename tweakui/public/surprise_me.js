// General > Just for Fun > Surprise Me: fireworks go off over every page at random moments, until the setting is
// turned off. A show lasts a few seconds, the first comes some seconds after a page opens and the next a minute or so
// later; none starts while the tab is hidden. The fireworks are fireworks-js (vendor/fireworks-js, MIT), loaded only
// when a show starts, on a canvas over the page that clicks go through. The settings page announces each saved
// change ("tweakuiSettingsChanged"), so turning it on there starts a show at once and turning it off ends it at once.
// UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.document) {
        if (root.document.readyState === "loading") {
            root.document.addEventListener("DOMContentLoaded", function () { api.start(root.document, root); });
        } else api.start(root.document, root);
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    var LIBRARY = "/plugins/tweakui/vendor/fireworks-js/fireworks.umd.js", EVENT = "tweakuiSettingsChanged";
    // In seconds: the first show after a page opens, the gap between shows, and how long one lasts
    var FIRST = [5, 20], GAP = [30, 90], LENGTH = [5, 10];
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

    // The shows: set(true) schedules them, set(false) ends the one going and cancels the next. env gives the timers,
    // the randomness and the loader, which tests replace.
    function create(doc, win, env) {
        env = env || {};
        var random = env.random || Math.random, loader = env.load || load;
        var later = env.setTimeout || function (f, ms) { return win.setTimeout(f, ms); };
        var cancel = env.clearTimeout || function (t) { win.clearTimeout(t); };
        var on = false, timer = null, show = null;

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
                var box = doc.createElement("div");
                box.className = "tweakui-fireworks";
                box.setAttribute("aria-hidden", "true");
                doc.body.appendChild(box);
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
        }

        // now: the first show starts at once (turned on in the settings page)
        function set(enabled, now) {
            if (enabled && !on) {
                on = true;
                schedule(now ? [0, 0] : FIRST);
            } else if (!enabled && on) stop();
        }

        return {set: set, stop: stop, showing: function () { return show !== null; }};
    }

    function start(doc, win, env) {
        var shows = create(doc, win, env);
        var settings = (win.TweakUI && win.TweakUI.settings) || {};
        shows.set(settings.surprise_me === true, false);
        doc.addEventListener(EVENT, function (e) {
            shows.set(!!(e.detail && e.detail.surprise_me === true), true);
        });
        return shows;
    }

    return {start: start, create: create, load: load, OPTIONS: OPTIONS, LIBRARY: LIBRARY};
});
