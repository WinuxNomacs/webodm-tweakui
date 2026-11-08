// 2D Map and 3D Map > Zoom Override. The 2D map zooms 3 steps further than WebODM lets it (zoom 24, Map.jsx), with
// the wheel, the + button and a pinch: the map hook lifts Leaflet's limit (the layers already enlarge their tiles
// past their own zoom). In the 3D view, Potree's orbit controls zoom toward the orbit centre and slow down as they
// near it; with Zoom Override the wheel zooms toward what is under the pointer (the point cloud or the textured
// model; pick3d.js) and the orbit centre moves to that depth, so any surface can be neared. Over nothing, and in
// Potree's other navigation modes, the wheel is Potree's as before. Zoom Sensitivity (a part of each) scales how far
// a wheel notch zooms: on the 2D map TweakUI's own wheel replaces Leaflet's while it isn't 100%; in the 3D view the
// share of the way a notch goes. A button on each map (beside the zoom buttons; in the 3D view's action buttons)
// opens a slider and a box that change it at once and save it. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = node ? factory(require("./core"), require("./pick3d")) : factory(root.TweakUI, root.TweakUI.pick3d);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "zoom_override", api.start);
})(typeof window !== "undefined" ? window : this, function (ui, pick3d) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: none of its own (the 2D map comes through the
    // map hook, the 3D view through pick3d.js)
    var SELECTORS = {};
    var NAME = "zoom_override";

    var EXTRA_STEPS = 3, WEBODM_MAX_ZOOM = 24;
    // A wheel notch goes this share of the way to the point, as Potree's own wheel does to the orbit centre
    var STEP = 0.1;
    // Never nearer the point than this (metres, the task's units)
    var MIN_DISTANCE = 0.05;
    // A pick tests every triangle of the textured model (about 20 ms at ODM's default mesh size), and a trackpad's
    // scroll sends dozens of wheel events a second: while the pointer stays within this many pixels, an event this soon
    // after the last reuses its point. Exact, since the camera moves along the ray through that point
    var REUSE_PX = 3, REUSE_MS = 250;
    // Zoom Sensitivity, in percent: its range, the slider's step, and 100% as WebODM's own
    var MIN_SENSITIVITY = 10, MAX_SENSITIVITY = 200, SENSITIVITY_STEP = 10, NORMAL = 100;
    // The 2D wheel: a notch is 100 pixels (Chrome's 100 or 120, Firefox's 3 lines), counted at most one per event; a
    // trackpad's small events are each a share of one. Events this close together add up, as Leaflet's wheel does
    var NOTCH_PX = 100, LINE_PX = 100 / 3, PAGE_PX = 800, WHEEL_MS = 40;
    var SETTING = {"2d": "zoom_sensitivity_2d", "3d": "zoom_sensitivity_3d"};

    function extraZoom(map) {
        var max = map.options && typeof map.options.maxZoom === "number" ? map.options.maxZoom : WEBODM_MAX_ZOOM;
        map.setMaxZoom(max + EXTRA_STEPS);
        return max + EXTRA_STEPS;
    }

    // Potree's wheel events (mousewheel, 120 a notch; DOMMouseScroll in Firefox, 3 lines a notch): how many notches,
    // in (+) or out (-), at most one. A trackpad's two-finger scroll sends many small events, each a share of a notch,
    // so it zooms as far as it scrolls; Potree's own wheel counts each as a whole notch, far too fast on a trackpad
    function notch(e) {
        var n = e.wheelDelta !== undefined ? e.wheelDelta / 120 : (e.detail !== undefined ? -e.detail / 3 : 0);
        return Math.max(-1, Math.min(1, n));
    }

    // Where the camera goes: along the pointer's ray (a unit direction) toward the surface `distance` away on it, `n`
    // notches nearer (or farther; Zoom Sensitivity makes a notch a share or a multiple of one); null when it is already as near as it goes. Along the ray, not toward the point
    // picked: on a sparse point cloud that is a point beside the ray, and the view would drift
    function zoomAlong(position, dir, distance, n) {
        if (!(distance > 0) || (n > 0 && distance <= MIN_DISTANCE)) return null;
        var move = distance - Math.max(distance * Math.pow(1 - STEP, n), MIN_DISTANCE);
        return {x: position.x + dir.x * move, y: position.y + dir.y * move, z: position.z + dir.z * move};
    }

    // The unit direction of the pointer's ray from the camera
    function pointerRay(THREE, viewer, clientX, clientY) {
        var rect = viewer.renderer.domElement.getBoundingClientRect(), camera = viewer.scene.getActiveCamera();
        var ndc = new THREE.Vector3((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1, 0.5);
        return ndc.unproject(camera).sub(camera.position).normalize();
    }

    // A sensitivity from the settings: a whole number within the range, else 100%
    function sensitivity(value) {
        return typeof value === "number" && value % 1 === 0 && value >= MIN_SENSITIVITY && value <= MAX_SENSITIVITY ? value : NORMAL;
    }

    // A 2D wheel event's notches, in (+) or out (-), at most one
    function wheelNotch(e) {
        var px = e.deltaY || 0;
        if (e.deltaMode === 1) px *= LINE_PX;
        else if (e.deltaMode === 2) px *= PAGE_PX;
        return Math.max(-1, Math.min(1, -px / NOTCH_PX));
    }

    // How many zoom steps Leaflet's own wheel takes for a whole notch: its scroll handler's curve on the event's pixels
    // (Leaflet 1.3.1, rounded up), which differ by browser: Chrome on Windows halves them (one step a notch), on Linux
    // and macOS it doesn't (two steps). A share of a notch (a trackpad's) counts against one step
    function leafletSteps(win, map, e) {
        var L = win.L, px = L && L.DomEvent && L.DomEvent.getWheelDelta ? Math.abs(L.DomEvent.getWheelDelta(e)) : 0;
        if (!px) return 1;
        var d2 = px / ((map.options.wheelPxPerZoomLevel || 60) * 4);
        var d3 = 4 * Math.log(2 / (1 + Math.exp(-d2))) / Math.LN2;
        return Math.max(1, Math.ceil(d3 - 1e-9));
    }

    // The 2D map's wheel at a sensitivity: Leaflet's own at 100% (WebODM's feel: a notch is always whole steps);
    // otherwise TweakUI's, a notch zooming that share of Leaflet's steps toward the pointer, the map free to rest
    // between steps
    function wheel2d(win, map) {
        var snap = map.options.zoomSnap, s = NORMAL, sum = 0, at = null, timer = null;
        var box = map.getContainer();
        function zoom() {
            timer = null;
            var from = map._animatingZoom && typeof map._animateToZoom === "number" ? map._animateToZoom : map.getZoom();
            var by = sum * s / NORMAL;
            sum = 0;
            if (by) map.setZoomAround(at, from + by);
        }
        var wheel = ui.guard(NAME, function (e) {
            e.preventDefault();
            var n = wheelNotch(e);
            sum += Math.abs(n) === 1 ? n * leafletSteps(win, map, e) : n;
            at = map.mouseEventToContainerPoint(e);
            if (!timer) timer = win.setTimeout(zoom, WHEEL_MS);
        });
        function set(value) {
            var was = s;
            s = sensitivity(value);
            if ((was === NORMAL) === (s === NORMAL)) return;
            if (s === NORMAL) {
                box.removeEventListener("wheel", wheel);
                map.options.zoomSnap = snap;
                if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
            } else {
                if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
                map.options.zoomSnap = 0;
                box.addEventListener("wheel", wheel, {passive: false});
            }
        }
        return {set: set, get: function () { return s; }};
    }

    function attach3d(win, viewer, sensitivityNow) {
        var canvas = viewer.renderer.domElement, area = canvas.parentNode || canvas;
        var last = null;
        function pickAt(x, y) {
            var now = Date.now();
            if (last && now - last.time < REUSE_MS && Math.abs(x - last.x) <= REUSE_PX && Math.abs(y - last.y) <= REUSE_PX) {
                last.time = now;
                return last.hit;
            }
            var hit = pick3d.pick(win, viewer, x, y);
            last = hit ? {x: x, y: y, time: now, hit: hit} : null;
            return hit;
        }
        var wheel = ui.guard(NAME, function (e) {
            if (e.target !== canvas) return;
            var controls = viewer.getControls ? viewer.getControls() : viewer.controls;
            if (!controls || controls !== viewer.orbitControls) return;
            var n = notch(e);
            if (!n) return;
            var hit = pickAt(e.clientX, e.clientY);
            if (!hit) return;
            // Potree's own zoom doesn't run
            e.preventDefault();
            e.stopPropagation();
            var view = viewer.scene.view, pos = view.position;
            var ray = pointerRay(win.THREE, viewer, e.clientX, e.clientY), p = hit.point;
            var distance = (p.x - pos.x) * ray.x + (p.y - pos.y) * ray.y + (p.z - pos.z) * ray.z;
            var to = zoomAlong(pos, ray, distance, n * (sensitivityNow ? sensitivityNow() : NORMAL) / NORMAL);
            if (!to) return;
            view.position.set(to.x, to.y, to.z);
            // The orbit centre: on the screen's centre line, as deep as the surface
            var dir = view.direction;
            var depth = (p.x - to.x) * dir.x + (p.y - to.y) * dir.y + (p.z - to.z) * dir.z;
            view.radius = Math.max(depth, MIN_DISTANCE);
            controls.radiusDelta = 0;
            if (controls.stopTweens) controls.stopTweens();
        });
        ["mousewheel", "DOMMouseScroll"].forEach(function (type) { area.addEventListener(type, wheel, {capture: true, passive: false}); });
        return function () {
            ["mousewheel", "DOMMouseScroll"].forEach(function (type) { area.removeEventListener(type, wheel, {capture: true}); });
        };
    }

    // Saves a sensitivity to the user's settings; a promise of the saved settings, refused with the reason
    function save(doc, win, which, value, fetchFn) {
        var changes = {};
        changes[SETTING[which]] = value;
        return fetchFn("/api/plugins/tweakui/settings", {
            method: "PATCH",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json", "X-CSRFToken": ui.csrfToken(doc)},
            body: JSON.stringify(changes)
        }).then(function (res) {
            return res.json().then(null, function () { return {}; }).then(function (body) {
                if (!res.ok) throw new Error(body.detail || ("Error " + res.status));
                if (win.TweakUI) win.TweakUI.settings = body;
                return body;
            });
        });
    }

    // The Zoom Sensitivity button and its panel: a slider in steps of 10 and a box for any whole number from 10 to
    // 200 (%). Each change is applied at once (apply(value)); the slider let go, or the box left or Entered, saves it.
    // A box not a whole number in range, or a save refused, puts back the saved value and says why. The button opens
    // and closes the panel, as do Escape and a click outside it. `which` "2d" looks like a Leaflet control, "3d" like
    // an action button
    function panel(doc, win, which, saved, apply, fetchFn) {
        var el = ui.el, map = which === "2d";
        var container = el(doc, "div", "tweakui-zoom-sensitivity tweakui-zoom-sensitivity-" + which +
            (map ? " leaflet-bar leaflet-control" : ""));
        var button = el(doc, map ? "a" : "button", map ? "tweakui-zoom-sensitivity-button" : "btn btn-sm btn-secondary tweakui-zoom-sensitivity-button");
        if (map) {
            button.href = "#";
            button.setAttribute("role", "button");
        } else button.type = "button";
        button.title = "Zoom Sensitivity";
        button.setAttribute("aria-label", "Zoom Sensitivity");
        button.setAttribute("aria-expanded", "false");
        button.appendChild(el(doc, "i", "fa fa-tachometer-alt"));
        var box = el(doc, "div", "tweakui-zoom-sensitivity-box theme-background-highlight theme-border");
        var id = "tweakui-zoom-sensitivity-" + which;
        var label = el(doc, "label", "tweakui-zoom-sensitivity-label");
        label.htmlFor = id;
        label.textContent = "Zoom Sensitivity";
        var row = el(doc, "div", "tweakui-number");
        var slider = el(doc, "input", "tweakui-zoom-sensitivity-slider");
        slider.type = "range";
        slider.min = MIN_SENSITIVITY;
        slider.max = MAX_SENSITIVITY;
        slider.step = SENSITIVITY_STEP;
        slider.setAttribute("aria-label", "Zoom Sensitivity");
        var input = el(doc, "input", "form-control input-sm theme-border tweakui-zoom-sensitivity-input");
        input.type = "number";
        input.id = id;
        input.min = MIN_SENSITIVITY;
        input.max = MAX_SENSITIVITY;
        input.step = 1;
        var unit = el(doc, "span", "tweakui-number-unit");
        unit.textContent = "%";
        var status = el(doc, "div", "tweakui-zoom-sensitivity-status text-danger");
        status.setAttribute("aria-live", "polite");
        row.appendChild(slider);
        row.appendChild(input);
        row.appendChild(unit);
        box.appendChild(label);
        box.appendChild(row);
        box.appendChild(status);
        container.appendChild(button);
        container.appendChild(box);
        if (map && win.L && win.L.DomEvent) {
            win.L.DomEvent.disableClickPropagation(container);
            win.L.DomEvent.disableScrollPropagation(container);
        }

        var state = {saved: sensitivity(saved), open: false};
        function show(value) {
            slider.value = value;
            input.value = value;
        }
        show(state.saved);
        function say(text) { status.textContent = text || ""; }
        function putBack(reason) {
            show(state.saved);
            apply(state.saved);
            say("Not saved: " + reason);
        }
        function commit(value) {
            if (value === state.saved) return Promise.resolve();
            return save(doc, win, which, value, fetchFn).then(function () {
                state.saved = value;
                say("");
            }, function (e) { putBack(e.message); });
        }
        slider.addEventListener("input", ui.guard(NAME, function () {
            input.value = slider.value;
            say("");
            apply(Number(slider.value));
        }));
        slider.addEventListener("change", ui.guard(NAME, function () { commit(Number(slider.value)); }));
        input.addEventListener("input", ui.guard(NAME, function () {
            var value = ui.wholeNumber(input.value, MIN_SENSITIVITY, MAX_SENSITIVITY);
            if (typeof value !== "number") return;
            slider.value = value;
            say("");
            apply(value);
        }));
        input.addEventListener("change", ui.guard(NAME, function () {
            var value = ui.wholeNumber(input.value, MIN_SENSITIVITY, MAX_SENSITIVITY);
            if (typeof value === "number") commit(value);
            else putBack(value);
        }));

        function onDoc(e) {
            if (e.type === "keydown" ? e.key === "Escape" : !container.contains(e.target)) close();
        }
        function open() {
            if (state.open) return;
            state.open = true;
            container.classList.add("open");
            button.setAttribute("aria-expanded", "true");
            doc.addEventListener("pointerdown", onDoc, true);
            doc.addEventListener("keydown", onDoc, true);
            slider.focus();
        }
        function close() {
            if (!state.open) return;
            state.open = false;
            container.classList.remove("open");
            button.setAttribute("aria-expanded", "false");
            doc.removeEventListener("pointerdown", onDoc, true);
            doc.removeEventListener("keydown", onDoc, true);
        }
        button.addEventListener("click", ui.guard(NAME, function (e) {
            e.preventDefault();
            if (state.open) close();
            else open();
        }));
        return {container: container, button: button, slider: slider, input: input, status: status, open: open, close: close,
            saved: function () { return state.saved; }};
    }

    function start(doc, win) {
        var settings = ui.settingsOf(win);
        var P = win.PluginsAPI;
        var fetchFn = function (url, options) { return win.fetch(url, options); };
        if (settings.zoom_override_2d && P && P.Map && P.Map.didAddControls) {
            P.Map.didAddControls(ui.guard(NAME, function (args) {
                if (!args || !args.map) return;
                var map = args.map, L = win.L;
                extraZoom(map);
                var wheel = wheel2d(win, map);
                var saved = sensitivity(ui.settingsOf(win).zoom_sensitivity_2d);
                wheel.set(saved);
                if (!L || !L.Control || !map.addControl) return;
                var p = panel(doc, win, "2d", saved, wheel.set, fetchFn);
                var Control = L.Control.extend({options: {position: "bottomleft"}, onAdd: function () { return p.container; }});
                map.addControl(new Control());
            }));
        }
        if (settings.zoom_override_3d && pick3d) {
            pick3d.whenViewer(doc, win, ui.guard(NAME, function (viewer, row) {
                if (!win.THREE || !win.Potree) return;
                var s = sensitivity(ui.settingsOf(win).zoom_sensitivity_3d);
                attach3d(win, viewer, function () { return s; });
                if (!row || row.querySelector(".tweakui-zoom-sensitivity")) return;
                var p = panel(doc, win, "3d", s, function (value) { s = sensitivity(value); }, fetchFn);
                pick3d.beforeShare(row, p.container);
            }));
        }
    }

    return {start: start, extraZoom: extraZoom, zoomAlong: zoomAlong, notch: notch, attach3d: attach3d,
        sensitivity: sensitivity, wheelNotch: wheelNotch, leafletSteps: leafletSteps, wheel2d: wheel2d, panel: panel, save: save, SELECTORS: SELECTORS};
});
