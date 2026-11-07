// 2D Map and 3D Map > Zoom Override. The 2D map zooms 3 steps further than WebODM lets it (zoom 24, Map.jsx), with
// the wheel, the + button and a pinch: the map hook lifts Leaflet's limit (the layers already enlarge their tiles
// past their own zoom). In the 3D view, Potree's orbit controls zoom toward the orbit centre and slow down as they
// near it; with Zoom Override the wheel zooms toward what is under the pointer (the point cloud or the textured
// model; pick3d.js) and the orbit centre moves to that depth, so any surface can be neared. Over nothing, and in
// Potree's other navigation modes, the wheel is Potree's as before. UMD, so Jest can load it.
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
    // notches nearer (or farther); null when it is already as near as it goes. Along the ray, not toward the point
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

    function attach3d(win, viewer) {
        var canvas = viewer.renderer.domElement, area = canvas.parentNode || canvas;
        var wheel = ui.guard(NAME, function (e) {
            if (e.target !== canvas) return;
            var controls = viewer.getControls ? viewer.getControls() : viewer.controls;
            if (!controls || controls !== viewer.orbitControls) return;
            var n = notch(e);
            if (!n) return;
            var hit = pick3d.pick(win, viewer, e.clientX, e.clientY);
            if (!hit) return;
            // Potree's own zoom doesn't run
            e.preventDefault();
            e.stopPropagation();
            var view = viewer.scene.view, pos = view.position;
            var ray = pointerRay(win.THREE, viewer, e.clientX, e.clientY), p = hit.point;
            var distance = (p.x - pos.x) * ray.x + (p.y - pos.y) * ray.y + (p.z - pos.z) * ray.z;
            var to = zoomAlong(pos, ray, distance, n);
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

    function start(doc, win) {
        var settings = ui.settingsOf(win);
        var P = win.PluginsAPI;
        if (settings.zoom_override_2d && P && P.Map && P.Map.didAddControls) {
            P.Map.didAddControls(ui.guard(NAME, function (args) { if (args && args.map) extraZoom(args.map); }));
        }
        if (settings.zoom_override_3d && pick3d) {
            pick3d.whenViewer(doc, win, ui.guard(NAME, function (viewer) {
                if (win.THREE && win.Potree) attach3d(win, viewer);
            }));
        }
    }

    return {start: start, extraZoom: extraZoom, zoomAlong: zoomAlong, notch: notch, attach3d: attach3d, SELECTORS: SELECTORS};
});
