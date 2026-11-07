// 2D Map > Movable Controls: the 2D map's popup panels (Layers, Base Maps, Measure, Contours, Object Detection,
// TweakUI's Other Tasks, ...) can be dragged by their title, with the mouse or a finger, within the map. A panel that
// closes has its position cleared, so it reopens where WebODM puts it. Each panel is a Leaflet control in a corner of
// the map: the whole control is moved (a CSS transform, which leaves the other controls in place). Leaflet stops
// the pointer events of its controls from reaching the map, so the drag listens on the document in the capture
// phase. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "movable_controls", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: the map (Leaflet) and its controls, and the
    // title bars a panel is dragged by: WebODM's panels' .title (Layers, Contours, Object Detection), Base Maps'
    // title and Measure's heading
    var SELECTORS = {
        map: ".leaflet-container", control: ".leaflet-control", corner: ".leaflet-control-container",
        handles: ".leaflet-control .title, .leaflet-control .leaflet-control-autolayers-title, .leaflet-control-measure h3",
        titles: ".title, .leaflet-control-autolayers-title, h3"
    };
    var HANDLES = SELECTORS.handles;
    var NAME = "movable_controls";
    var MOVED = "tweakui-moved";
    // How far the pointer goes before a press becomes a drag (a click on a title stays a click)
    var SLOP = 3;

    function shownByLayout(el) { return el.offsetParent !== null; }

    // The control a press starts dragging, or null
    function controlFor(target) {
        if (!target || !target.closest) return null;
        var handle = target.closest(HANDLES);
        if (!handle) return null;
        var control = handle.closest(SELECTORS.control);
        return control && control.closest(SELECTORS.map) ? control : null;
    }

    // Whether a moved control is still open: one of its title bars is shown
    function isOpen(control, shown) {
        if (!control.isConnected) return false;
        var handles = control.querySelectorAll(SELECTORS.titles);
        for (var i = 0; i < handles.length; i++) if (shown(handles[i])) return true;
        return false;
    }

    // The offset that keeps a control's box (without any offset, `base`) inside the map's (`area`), with its top left
    // corner shown when it is bigger than the map
    function clamp(dx, dy, base, area) {
        dx = Math.max(Math.min(dx, area.right - base.right), area.left - base.left);
        dy = Math.max(Math.min(dy, area.bottom - base.bottom), area.top - base.top);
        return {x: Math.round(dx), y: Math.round(dy)};
    }

    function offsetOf(control) {
        return {x: Number(control.getAttribute("data-tweakui-x")) || 0, y: Number(control.getAttribute("data-tweakui-y")) || 0};
    }

    function place(control, x, y) {
        control.setAttribute("data-tweakui-x", x);
        control.setAttribute("data-tweakui-y", y);
        control.style.transform = "translate(" + x + "px, " + y + "px)";
        if (!control.classList.contains(MOVED)) control.classList.add(MOVED);
    }

    function reset(control) {
        control.removeAttribute("data-tweakui-x");
        control.removeAttribute("data-tweakui-y");
        control.style.transform = "";
        control.classList.remove(MOVED);
    }

    // Starts listening; `shown` tells whether an element is laid out (jsdom lays nothing out, so tests give their own)
    function start(doc, win, shown) {
        if (!ui.settingsOf(win).movable_controls) return null;
        shown = shown || shownByLayout;
        var moved = [], observed = [], drag = null, swallowUntil = 0;

        // A moved control that has closed goes back to its place
        function check() {
            moved = moved.filter(function (control) {
                if (isOpen(control, shown)) return true;
                reset(control);
                return false;
            });
        }

        function observe(control) {
            var corner = control.closest(SELECTORS.corner) || control.parentNode;
            if (!win.MutationObserver || observed.indexOf(corner) !== -1) return;
            observed.push(corner);
            new win.MutationObserver(ui.guard(NAME, check)).observe(corner, {
                attributes: true, attributeFilter: ["class", "style"], childList: true, subtree: true
            });
        }

        var listeners = {};
        listeners.pointerdown = function (e) {
            if (e.button !== 0 && e.pointerType === "mouse") return;
            var control = controlFor(e.target);
            if (!control) return;
            // Not a drag of the map too (Base Maps lets presses through to the map on touch screens)
            e.stopPropagation();
            var offset = offsetOf(control);
            drag = {control: control, startX: e.clientX, startY: e.clientY, x: offset.x, y: offset.y, moving: false};
        };

        listeners.pointermove = function (e) {
            if (!drag) return;
            var dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
            if (!drag.moving) {
                if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
                drag.moving = true;
                // The box the control has without an offset, and the map's, measured once per drag
                var box = drag.control.getBoundingClientRect();
                drag.base = {left: box.left - drag.x, right: box.right - drag.x, top: box.top - drag.y, bottom: box.bottom - drag.y};
                drag.area = drag.control.closest(SELECTORS.map).getBoundingClientRect();
                doc.documentElement.classList.add("tweakui-dragging");
                if (moved.indexOf(drag.control) === -1) moved.push(drag.control);
                observe(drag.control);
            }
            e.preventDefault();
            var to = clamp(drag.x + dx, drag.y + dy, drag.base, drag.area);
            place(drag.control, to.x, to.y);
        };

        function end() {
            if (!drag) return;
            // A click follows the release only when it ends where it began, so it is ignored for a moment only
            if (drag.moving) swallowUntil = Date.now() + 400;
            doc.documentElement.classList.remove("tweakui-dragging");
            drag = null;
        }
        listeners.pointerup = listeners.pointercancel = end;
        // Leaflet drags the map from mousedown and touchstart: a press on a title bar doesn't reach it
        listeners.mousedown = listeners.touchstart = function (e) { if (controlFor(e.target)) e.stopPropagation(); };

        // The release of a drag is not a click on the title (Base Maps' title switches its tab on a click)
        listeners.click = function (e) {
            if (Date.now() > swallowUntil) return;
            swallowUntil = 0;
            e.stopPropagation();
            e.preventDefault();
        };

        Object.keys(listeners).forEach(function (type) { listeners[type] = ui.guard(NAME, listeners[type]); });
        Object.keys(listeners).forEach(function (type) { doc.addEventListener(type, listeners[type], true); });
        doc.documentElement.classList.add("tweakui-movable");
        return {
            check: check,
            stop: function () {
                Object.keys(listeners).forEach(function (type) { doc.removeEventListener(type, listeners[type], true); });
                doc.documentElement.classList.remove("tweakui-movable");
            }
        };
    }

    return {start: start, clamp: clamp, controlFor: controlFor, isOpen: isOpen, HANDLES: HANDLES, SELECTORS: SELECTORS};
});
