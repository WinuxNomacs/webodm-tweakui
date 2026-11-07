// General > Global Controls > Hide Navigation Pane: a small tab on the divider between the side menu (WebODM's
// navigation pane) and the page, near the top. A click hides the pane, the page takes the whole width and only the
// tab stays, at the left edge; a click again shows it. Remembered in this browser (localStorage), so the next page
// opens the same way. Only where WebODM shows the pane beside the page (768 px wide and more, main.css); narrower,
// the pane is the header's hamburger menu, left as it is. The settings page announces each saved change
// ("tweakuiSettingsChanged"), so turning it on or off there shows or removes the tab at once.
// General > Global Controls > Resize Navigation Pane: the divider is a handle; dragging it sets the side menu's width,
// from its icons' column to half the window, and a double click puts back WebODM's 250 px. Narrower than SNAP, it
// snaps to the icons alone: labels and submenu arrows hidden, each link's name as its tooltip, submenu items unindented
// so their icons line up. Remembered in this browser too. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "nav_pane", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: the navigation pane and the header above it
    // (main.css also sizes #page-wrapper, the page beside the pane)
    var SELECTORS = {pane: ".navbar-default.sidebar", header: "#navbar-top", menu: "#side-menu",
        links: "#side-menu > li > a, #side-menu .nav-second-level > li > a, #side-menu .nav-third-level > li > a"};
    var NAME = "nav_pane", EVENT = "tweakuiSettingsChanged";
    var HIDDEN_KEY = "tweakui-nav-hidden", WIDTH_KEY = "tweakui-nav-width";
    // On <html>: the pane is hidden; the tab is on the page
    var HIDDEN = "tweakui-nav-hidden", TAB = "tweakui-nav-tabbed";
    // Below the header, this far down the divider
    var TAB_GAP = 10;
    // On <html>: the pane has a width of its own (--tweakui-nav-width); it shows its icons only; a drag is on
    var SIZED = "tweakui-nav-sized", ICONS = "tweakui-nav-icons", DRAGGING = "tweakui-nav-dragging";
    // WebODM's width (sb-admin-2.css); the icons' column (a link's 15 px padding each side of an 18.75 px icon); a
    // width under SNAP shows only cut-off labels, so it snaps to the icons; a keyboard step
    var DEFAULT_WIDTH = 250, MIN_WIDTH = 50, SNAP_WIDTH = 120, KEY_STEP = 20;

    function read(win, key) {
        try {
            return win.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function write(win, key, value) {
        try {
            if (value === null) win.localStorage.removeItem(key);
            else win.localStorage.setItem(key, value);
        } catch (e) { /* not remembered: the next page shows the pane */ }
    }

    // Tells the maps (Leaflet, Potree), which follow the window's size, that the page beside the pane changed width
    function resized(win) {
        var e;
        if (typeof win.Event === "function") e = new win.Event("resize");
        else {
            e = win.document.createEvent("Event");
            e.initEvent("resize", false, false);
        }
        win.dispatchEvent(e);
    }

    // A width the pane may have: under SNAP_WIDTH its icons alone, at most half the window (never less than WebODM's)
    function clampWidth(width, windowWidth) {
        if (typeof width !== "number" || isNaN(width)) return DEFAULT_WIDTH;
        if (width < SNAP_WIDTH) return MIN_WIDTH;
        return Math.min(Math.round(width), Math.max(DEFAULT_WIDTH, Math.floor(windowWidth / 2)));
    }

    function create(doc, win) {
        var html = doc.documentElement, tab = null;

        function hidden() { return html.classList.contains(HIDDEN); }

        function label() {
            var text = hidden() ? "Show Navigation Pane" : "Hide Navigation Pane";
            tab.setAttribute("title", text);
            tab.setAttribute("aria-label", text);
            tab.setAttribute("aria-expanded", hidden() ? "false" : "true");
            tab.firstChild.className = "fa " + (hidden() ? "fa-chevron-right" : "fa-chevron-left");
        }

        function setHidden(on, remember) {
            if (on === hidden()) return;
            html.classList.toggle(HIDDEN, on);
            if (remember) write(win, HIDDEN_KEY, on ? "1" : null);
            if (tab) label();
            resized(win);
        }

        // The tab, once the page has its header: fixed just below it (the header's height is 0 in WebODM's desktop
        // mode, where the pane starts at the top). In the header, which holds the pane: the header is above the page
        // (z-index 99999), so a tab outside it would be under the pane
        function addTab() {
            var header = doc.querySelector(SELECTORS.header), parent = header || doc.body;
            if (tab || !parent) return;
            tab = ui.el(doc, "button", "tweakui-nav-tab theme-border theme-background-highlight");
            tab.type = "button";
            tab.appendChild(ui.el(doc, "i"));
            tab.style.top = ((header ? header.offsetHeight : 0) + TAB_GAP) + "px";
            tab.addEventListener("click", function () { setHidden(!hidden(), true); });
            label();
            parent.appendChild(tab);
            html.classList.add(TAB);
        }

        function removeTab() {
            if (tab && tab.parentNode) tab.parentNode.removeChild(tab);
            tab = null;
            html.classList.remove(TAB);
        }

        // Turned on: hidden as last time, and the tab once the page is parsed; turned off: the pane shown, no tab
        function set(enabled) {
            if (enabled) {
                // At once, before the page is drawn, so a hidden pane doesn't flash
                if (read(win, HIDDEN_KEY) === "1") setHidden(true, false);
                // Only on a page with the pane (a signed-out page has none)
                ui.ready(doc, function () { if (doc.querySelector(SELECTORS.pane)) addTab(); });
            } else {
                removeTab();
                setHidden(false, false);
            }
        }

        return {set: set, setHidden: setHidden, hidden: hidden, tab: function () { return tab; }};
    }

    // Resize Navigation Pane: the handle on the divider, and the pane's width
    function createResize(doc, win) {
        var html = doc.documentElement, handle = null, width = DEFAULT_WIDTH, listeners = {};
        var frame = null;

        function icons() { return html.classList.contains(ICONS); }

        // The pane's width, on <html> (main.css sizes the pane and the page from it); WebODM's own needs nothing
        function apply(w) {
            width = w;
            var wasIcons = icons();
            if (w === DEFAULT_WIDTH) {
                html.classList.remove(SIZED, ICONS);
                html.style.removeProperty("--tweakui-nav-width");
            } else {
                html.classList.add(SIZED);
                html.classList.toggle(ICONS, w === MIN_WIDTH);
                html.style.setProperty("--tweakui-nav-width", w + "px");
            }
            if (wasIcons && !icons()) untitle();
            if (handle) {
                handle.setAttribute("aria-valuenow", String(w));
                handle.setAttribute("aria-valuemax", String(Math.max(DEFAULT_WIDTH, Math.floor(win.innerWidth / 2))));
            }
        }

        function remember() { write(win, WIDTH_KEY, width === DEFAULT_WIDTH ? null : String(width)); }

        // The maps follow at most once a frame while dragging
        function resizedSoon() {
            if (frame !== null) return;
            var later = win.requestAnimationFrame || function (fn) { return win.setTimeout(fn, 16); };
            frame = later(function () {
                frame = null;
                resized(win);
            });
        }

        // Icons only: each link's name as its tooltip, given when the pointer comes to it (items other scripts add
        // later get one too); taken away again with the icons-only width
        function title(e) {
            if (!icons() || !e.target || !e.target.closest) return;
            var link = e.target.closest(SELECTORS.links);
            if (!link || link.hasAttribute("title")) return;
            link.setAttribute("title", link.textContent.replace(/\s+/g, " ").trim());
            link.setAttribute("data-tweakui-nav-title", "");
        }

        function untitle() {
            Array.prototype.forEach.call(doc.querySelectorAll("[data-tweakui-nav-title]"), function (link) {
                link.removeAttribute("title");
                link.removeAttribute("data-tweakui-nav-title");
            });
        }

        function addHandle() {
            if (handle || !doc.body || !doc.querySelector(SELECTORS.pane)) return;
            handle = ui.el(doc, "div", "tweakui-nav-handle");
            handle.setAttribute("role", "separator");
            handle.setAttribute("aria-orientation", "vertical");
            handle.setAttribute("aria-label", "Resize Navigation Pane");
            handle.setAttribute("aria-valuemin", String(MIN_WIDTH));
            handle.setAttribute("title", "Drag to resize, double-click for the usual width");
            handle.tabIndex = 0;
            var header = doc.querySelector(SELECTORS.header);
            handle.style.top = (header ? header.offsetHeight : 0) + "px";
            var menu = doc.querySelector(SELECTORS.menu);
            // The icons' size when the labels go (font-size 0 on the links): the menu's own
            if (menu && win.getComputedStyle) html.style.setProperty("--tweakui-nav-icon-size", win.getComputedStyle(menu).fontSize);

            var drag = null;
            listeners.down = function (e) {
                if (e.button !== 0) return;
                e.preventDefault();
                drag = {id: e.pointerId};
                if (handle.setPointerCapture && e.pointerId !== undefined) handle.setPointerCapture(e.pointerId);
                html.classList.add(DRAGGING);
            };
            listeners.move = function (e) {
                if (!drag) return;
                var w = clampWidth(e.clientX, win.innerWidth);
                if (w !== width) {
                    apply(w);
                    resizedSoon();
                }
            };
            listeners.up = function () {
                if (!drag) return;
                drag = null;
                html.classList.remove(DRAGGING);
                remember();
                resized(win);
            };
            listeners.reset = function () {
                apply(DEFAULT_WIDTH);
                remember();
                resized(win);
            };
            // From the keyboard: the arrows widen and narrow it, Home gives the icons, End WebODM's width
            listeners.key = function (e) {
                var w = null;
                if (e.key === "ArrowLeft") w = width - KEY_STEP;
                else if (e.key === "ArrowRight") w = width === MIN_WIDTH ? SNAP_WIDTH : width + KEY_STEP;
                else if (e.key === "Home") w = MIN_WIDTH;
                else if (e.key === "End") w = DEFAULT_WIDTH;
                if (w === null) return;
                e.preventDefault();
                apply(clampWidth(w, win.innerWidth));
                remember();
                resized(win);
            };
            listeners.over = ui.guard(NAME, title);
            handle.addEventListener("pointerdown", ui.guard(NAME, listeners.down));
            handle.addEventListener("pointermove", ui.guard(NAME, listeners.move));
            handle.addEventListener("pointerup", ui.guard(NAME, listeners.up));
            handle.addEventListener("pointercancel", ui.guard(NAME, listeners.up));
            handle.addEventListener("dblclick", ui.guard(NAME, listeners.reset));
            handle.addEventListener("keydown", ui.guard(NAME, listeners.key));
            doc.addEventListener("mouseover", listeners.over);
            doc.body.appendChild(handle);
            apply(width);
        }

        function removeHandle() {
            if (!handle) return;
            if (handle.parentNode) handle.parentNode.removeChild(handle);
            doc.removeEventListener("mouseover", listeners.over);
            handle = null;
            html.classList.remove(DRAGGING);
        }

        // Turned on: the width as last time, at once (before the page is drawn), and the handle once the page is
        // parsed; turned off: WebODM's width, no handle (the width is kept for when it is turned on again)
        function set(enabled) {
            if (enabled) {
                var saved = parseInt(read(win, WIDTH_KEY), 10), w = isNaN(saved) ? DEFAULT_WIDTH : clampWidth(saved, win.innerWidth);
                if (w !== width) {
                    apply(w);
                    resized(win);
                }
                ui.ready(doc, addHandle);
            } else {
                removeHandle();
                if (width !== DEFAULT_WIDTH) {
                    apply(DEFAULT_WIDTH);
                    resized(win);
                }
            }
        }

        return {set: set, apply: apply, width: function () { return width; }, handle: function () { return handle; }};
    }

    function start(doc, win) {
        var pane = create(doc, win), resize = createResize(doc, win), settings = ui.settingsOf(win);
        pane.set(settings.hide_nav_pane === true);
        resize.set(settings.resize_nav_pane === true);
        doc.addEventListener(EVENT, ui.guard(NAME, function (e) {
            if (!e.detail) return;
            if ("hide_nav_pane" in e.detail) pane.set(e.detail.hide_nav_pane === true);
            if ("resize_nav_pane" in e.detail) resize.set(e.detail.resize_nav_pane === true);
        }));
        return {hide: pane, resize: resize};
    }

    return {start: start, create: create, createResize: createResize, clampWidth: clampWidth, HIDDEN_KEY: HIDDEN_KEY,
        WIDTH_KEY: WIDTH_KEY, MIN_WIDTH: MIN_WIDTH, DEFAULT_WIDTH: DEFAULT_WIDTH, SELECTORS: SELECTORS};
});
