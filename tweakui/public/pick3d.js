// WebODM's 3D view, for Source Frames and Zoom Override (loaded before them, as window.TweakUI.pick3d): the point
// under the pointer, on the point cloud (Potree's pick) or on a mesh shown (the textured model), whichever is nearer
// (not on the photos' frustums, Potree's measurements or TweakUI's own marks); and the viewer once the page has it.
// UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.document) {
        root.TweakUI = root.TweakUI || {};
        root.TweakUI.pick3d = api;
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: the 3D view (ModelView, which also sets
    // window.viewer, Potree's viewer) and its row of action buttons
    var SELECTORS = {modelView: "[data-modelview]", actionButtons: ".model-action-buttons"};

    // TweakUI's marks in the 3D scene (Source Frames' place) are a group of this name
    var MARKS = "tweakui-source-frames";

    function skipped(o, Potree) {
        for (var p = o; p; p = p.parent) {
            if (p._feat || p.name === MARKS || (Potree.Measure && p instanceof Potree.Measure)) return true;
        }
        return false;
    }

    // {point, distance} under the pointer at (clientX, clientY), or null
    function pick(win, viewer, clientX, clientY) {
        var Potree = win.Potree, THREE = win.THREE;
        var dom = viewer.renderer.domElement, rect = dom.getBoundingClientRect();
        var mouse = {x: clientX - rect.left, y: clientY - rect.top};
        var camera = viewer.scene.getActiveCamera();
        var best = null;
        var clouds = (viewer.scene.pointclouds || []).filter(function (p) { return p.visible; });
        if (clouds.length && Potree.Utils && Potree.Utils.getMousePointCloudIntersection) {
            var hit = Potree.Utils.getMousePointCloudIntersection(mouse, camera, viewer, clouds, {pickClipped: false});
            if (hit) best = {point: hit.location, distance: camera.position.distanceTo(hit.location)};
        }
        var raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouse.x / rect.width * 2 - 1, -(mouse.y / rect.height) * 2 + 1), camera);
        var meshes = [];
        viewer.scene.scene.traverseVisible(function (o) {
            if (o.isMesh && !skipped(o, Potree)) meshes.push(o);
        });
        var hits = raycaster.intersectObjects(meshes, false);
        if (hits.length && (!best || hits[0].distance < best.distance)) best = {point: hits[0].point, distance: hits[0].distance};
        return best;
    }

    // Calls back with the 3D view's Potree viewer and its action buttons' row, once WebODM's 3D page has both
    // (window.viewer, set as the view mounts); nothing on other pages. Not through PluginsAPI.ModelView's
    // addActionButton: WebODM keeps only the buttons that answer first, so an answer of TweakUI's would push out
    // Snapshot's (which loads a library first), or the reverse
    function whenViewer(doc, win, callback) {
        var tries = 0;
        function check() {
            if (!doc.querySelector(SELECTORS.modelView)) return;
            var viewer = win.viewer, buttons = doc.querySelector(SELECTORS.actionButtons);
            if (viewer && viewer.renderer && viewer.scene && buttons) callback(viewer, buttons);
            else if (++tries < 400) win.setTimeout(check, 300);
        }
        if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", check);
        else check();
    }

    return {pick: pick, skipped: skipped, whenViewer: whenViewer, MARKS: MARKS, SELECTORS: SELECTORS};
});
