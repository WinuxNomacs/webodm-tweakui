// General > Global Controls > Hide Navigation Pane: a small tab on the divider between the side menu (WebODM's
// navigation pane) and the page, near the top. A click hides the pane, the page takes the whole width and only the
// tab stays, at the left edge. The tab cycles: the pane at WebODM's width -> its icons alone (the same view as Resize
// Navigation Pane's narrowest) -> hidden -> WebODM's width again. Remembered in this browser (localStorage), so the
// next page opens the same way. Only where WebODM shows the pane beside the page (768 px wide and more, main.css); narrower,
// the pane is the header's hamburger menu, left as it is. The settings page announces each saved change
// ("tweakuiSettingsChanged"), so turning it on or off there shows or removes the tab at once.
// General > Global Controls > Resize Navigation Pane: the divider is a handle; dragging it sets the side menu's width,
// from its icons' column to half the window, and a double click puts back WebODM's 250 px. Narrower than SNAP, it
// snaps to the icons alone: labels and submenu arrows hidden, each link's name as its tooltip, submenu items unindented
// so their icons line up. Remembered in this browser too.
// General > Global Controls > Hide Navigation Pane > Auto-hide Navigation Pane: the pane stays hidden until the
// pointer nears the window's left edge (or the keyboard's focus goes into it), then shows over the page, which keeps
// its size (no resize: the maps don't redraw), at its remembered width (Resize Navigation Pane's, else WebODM's); it
// hides again Hide Delay after the pointer leaves it and the tab (or at once with Escape). The tab then pins the pane
// open beside the page, as without auto-hide, and a second click unpins it; remembered in this browser. UMD, so Jest
// can load it.
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
    var HIDDEN_KEY = "tweakui-nav-hidden", WIDTH_KEY = "tweakui-nav-width", PINNED_KEY = "tweakui-nav-pinned";
    // On <html>: the pane is hidden; the tab is on the page
    var HIDDEN = "tweakui-nav-hidden", TAB = "tweakui-nav-tabbed";
    // Below the header, this far down the divider
    var TAB_GAP = 10;
    // On <html>: the pane has a width of its own (--tweakui-nav-width); it shows its icons only; a drag is on
    var SIZED = "tweakui-nav-sized", ICONS = "tweakui-nav-icons", DRAGGING = "tweakui-nav-dragging";
    // WebODM's width (sb-admin-2.css); the icons' column (a link's 15 px padding each side of an 18.75 px icon); a
    // width under SNAP shows only cut-off labels, so it snaps to the icons; a keyboard step
    var DEFAULT_WIDTH = 250, MIN_WIDTH = 50, SNAP_WIDTH = 120, KEY_STEP = 20;
    // On <html>: auto-hide is on; the hidden pane shows over the page. The pointer this near the left edge shows it;
    // WebODM's pane is beside the page from this width (sb-admin-2.css); Hide Delay's default and range (features.py)
    var AUTO = "tweakui-nav-auto", PEEK = "tweakui-nav-peek", EDGE = 6, WIDE = 768;
    var DEFAULT_DELAY = 500, MIN_DELAY = 200, MAX_DELAY = 3000;

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

    function create(doc, win, sizer) {
        var html = doc.documentElement, tab = null, enabled = false, auto = false, delay = DEFAULT_DELAY;
        var pinned = read(win, PINNED_KEY) === "1", timer = null, watching = false, on = {};
        sizer = sizer || createResize(doc, win);

        function hidden() { return html.classList.contains(HIDDEN); }
        function peeking() { return html.classList.contains(PEEK); }

        // What a click does next: shown at full width -> its icons alone -> hidden -> shown at WebODM's width; with
        // auto-hide, pin or unpin
        function label() {
            if (!tab) return;
            var icons = html.classList.contains(ICONS), text, glyph;
            if (auto) {
                text = pinned ? "Unpin Navigation Pane" : "Pin Navigation Pane";
                glyph = "fa-thumbtack";
                tab.setAttribute("aria-pressed", pinned ? "true" : "false");
            } else {
                text = hidden() ? "Show Navigation Pane" : icons ? "Hide Navigation Pane" : "Show Icons Only";
                glyph = hidden() ? "fa-chevron-right" : "fa-chevron-left";
                tab.removeAttribute("aria-pressed");
            }
            tab.setAttribute("title", text);
            tab.setAttribute("aria-label", text);
            tab.setAttribute("aria-expanded", hidden() && !peeking() ? "false" : "true");
            tab.firstChild.className = "fa " + glyph;
        }
        sizer.onChange(label);

        function cycle() {
            if (auto) {
                pinned = !pinned;
                write(win, PINNED_KEY, pinned ? "1" : null);
                refresh();
            } else if (hidden()) {
                // Quietly: showing the pane tells the maps
                if (sizer.width() !== DEFAULT_WIDTH) sizer.choose(DEFAULT_WIDTH, true);
                setHidden(false, true);
            } else if (html.classList.contains(ICONS)) setHidden(true, true);
            else sizer.choose(MIN_WIDTH);
        }

        function setHidden(on, remember) {
            if (on === hidden()) return;
            html.classList.toggle(HIDDEN, on);
            if (remember) write(win, HIDDEN_KEY, on ? "1" : null);
            label();
            resized(win);
        }

        // Auto-hide: the pane over the page, below the header (0 high in WebODM's desktop mode)
        function cancelHide() {
            if (timer !== null) win.clearTimeout(timer);
            timer = null;
        }

        function peek() {
            cancelHide();
            if (peeking()) return;
            var header = doc.querySelector(SELECTORS.header);
            html.style.setProperty("--tweakui-nav-top", (header ? header.offsetHeight : 0) + "px");
            html.classList.add(PEEK);
            label();
        }

        function unpeek() {
            cancelHide();
            if (!peeking()) return;
            html.classList.remove(PEEK);
            label();
        }

        function hideSoon() {
            if (timer === null && peeking()) timer = win.setTimeout(function () { timer = null; unpeek(); }, delay);
        }

        // Whether a point is on the shown pane or the tab
        function over(x, y) {
            var pane = doc.querySelector(SELECTORS.pane);
            return [pane, tab].some(function (el) {
                if (!el) return false;
                var r = el.getBoundingClientRect();
                return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
            });
        }

        on.move = ui.guard(NAME, function (e) {
            if (win.innerWidth < WIDE) return;
            if (peeking()) {
                if (over(e.clientX, e.clientY)) cancelHide();
                else hideSoon();
                return;
            }
            var header = doc.querySelector(SELECTORS.header), top = header ? header.offsetHeight : 0;
            if (e.clientX <= EDGE && e.clientY >= top) peek();
        });
        // The pointer out of the window
        on.out = ui.guard(NAME, function (e) { if (!e.relatedTarget) hideSoon(); });
        // The keyboard: Tab into the pane shows it, out of it hides it, Escape at once
        on.focusin = ui.guard(NAME, function (e) {
            var pane = doc.querySelector(SELECTORS.pane);
            if (pane && pane.contains(e.target) && win.innerWidth >= WIDE) peek();
            else if (peeking() && !(tab && tab.contains(e.target))) hideSoon();
        });
        on.key = ui.guard(NAME, function (e) { if (e.key === "Escape" && peeking()) unpeek(); });

        function watch(want) {
            if (want === watching) return;
            watching = want;
            var method = want ? "addEventListener" : "removeEventListener";
            doc[method]("mousemove", on.move, true);
            doc[method]("mouseout", on.out, true);
            doc[method]("focusin", on.focusin, true);
            doc[method]("keydown", on.key, true);
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
            tab.addEventListener("click", cycle);
            label();
            parent.appendChild(tab);
            html.classList.add(TAB);
        }

        function removeTab() {
            if (tab && tab.parentNode) tab.parentNode.removeChild(tab);
            tab = null;
            html.classList.remove(TAB);
        }

        // The pane as the settings and the pin want it. Hide Navigation Pane on: hidden or icons only as last time
        // (at once, before the page is drawn, so a hidden pane doesn't flash) and the tab once the page is parsed;
        // with auto-hide, hidden unless pinned (and never icons only: the tab pins instead of cycling). Off: the pane
        // shown, no tab (and WebODM's width, unless Resize Navigation Pane keeps another)
        function refresh() {
            var autoHide = enabled && auto;
            html.classList.toggle(AUTO, autoHide);
            sizer.allowIcons(enabled && !auto);
            unpeek();
            watch(autoHide && !pinned);
            if (autoHide) setHidden(!pinned, false);
            else if (enabled) setHidden(read(win, HIDDEN_KEY) === "1", false);
            else setHidden(false, false);
            if (enabled) {
                // Only on a page with the pane (a signed-out page has none)
                ui.ready(doc, function () { if (enabled && doc.querySelector(SELECTORS.pane)) addTab(); });
            } else removeTab();
            label();
        }

        function set(isEnabled, autoHide, hideDelay) {
            enabled = isEnabled;
            if (autoHide !== undefined) auto = autoHide === true;
            if (hideDelay !== undefined) delay = typeof hideDelay === "number" && hideDelay >= MIN_DELAY && hideDelay <= MAX_DELAY ? hideDelay : DEFAULT_DELAY;
            refresh();
        }

        return {set: set, setHidden: setHidden, hidden: hidden, peeking: peeking, peek: peek,
            pinned: function () { return pinned; }, tab: function () { return tab; }};
    }

    // Resize Navigation Pane: the handle on the divider, and the pane's width
    // Also the pane's width for the tab's icons only, with or without the handle
    function createResize(doc, win) {
        var html = doc.documentElement, handle = null, width = DEFAULT_WIDTH, listeners = {};
        var frame = null, custom = false, iconsOk = false, changed = function () {}, titling = false;

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
            if (icons() && !titling) {
                titling = true;
                doc.addEventListener("mouseover", ui.guard(NAME, title));
            }
            if (wasIcons !== icons()) changed();
            if (handle) {
                handle.setAttribute("aria-valuenow", String(w));
                handle.setAttribute("aria-valuemax", String(Math.max(DEFAULT_WIDTH, Math.floor(win.innerWidth / 2))));
            }
        }

        function remember() { write(win, WIDTH_KEY, width === DEFAULT_WIDTH ? null : String(width)); }

        // A width chosen at once (the tab, the keyboard, a double click): remembered, and the maps told unless quiet
        function choose(w, quiet) {
            apply(w);
            remember();
            if (!quiet) resized(win);
        }

        // The width remembered, as far as the settings allow: any with the handle, the icons alone with the tab
        function restore() {
            var saved = parseInt(read(win, WIDTH_KEY), 10), w = DEFAULT_WIDTH;
            if (custom && !isNaN(saved)) w = clampWidth(saved, win.innerWidth);
            else if (iconsOk && saved === MIN_WIDTH) w = MIN_WIDTH;
            if (w !== width) {
                apply(w);
                resized(win);
            }
        }

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
            listeners.reset = function () { choose(DEFAULT_WIDTH); };
            // From the keyboard: the arrows widen and narrow it, Home gives the icons, End WebODM's width
            listeners.key = function (e) {
                var w = null;
                if (e.key === "ArrowLeft") w = width - KEY_STEP;
                else if (e.key === "ArrowRight") w = width === MIN_WIDTH ? SNAP_WIDTH : width + KEY_STEP;
                else if (e.key === "Home") w = MIN_WIDTH;
                else if (e.key === "End") w = DEFAULT_WIDTH;
                if (w === null) return;
                e.preventDefault();
                choose(clampWidth(w, win.innerWidth));
            };
            handle.addEventListener("pointerdown", ui.guard(NAME, listeners.down));
            handle.addEventListener("pointermove", ui.guard(NAME, listeners.move));
            handle.addEventListener("pointerup", ui.guard(NAME, listeners.up));
            handle.addEventListener("pointercancel", ui.guard(NAME, listeners.up));
            handle.addEventListener("dblclick", ui.guard(NAME, listeners.reset));
            handle.addEventListener("keydown", ui.guard(NAME, listeners.key));
            doc.body.appendChild(handle);
            apply(width);
        }

        function removeHandle() {
            if (!handle) return;
            if (handle.parentNode) handle.parentNode.removeChild(handle);
            handle = null;
            html.classList.remove(DRAGGING);
        }

        // Turned on: the width as last time, at once (before the page is drawn), and the handle once the page is
        // parsed; turned off: no handle, and WebODM's width unless the tab keeps the icons alone (the width is kept
        // for when it is turned on again)
        function set(enabled) {
            custom = enabled;
            restore();
            if (enabled) ui.ready(doc, addHandle);
            else removeHandle();
        }

        // Hide Navigation Pane on or off: its tab may keep the icons alone
        function allowIcons(enabled) {
            iconsOk = enabled;
            restore();
        }

        return {set: set, apply: apply, choose: choose, allowIcons: allowIcons, width: function () { return width; },
            handle: function () { return handle; }, onChange: function (fn) { changed = fn; }};
    }

    function start(doc, win) {
        var resize = createResize(doc, win), pane = create(doc, win, resize), settings = ui.settingsOf(win);
        pane.set(settings.hide_nav_pane === true, settings.auto_hide_nav_pane === true, settings.auto_hide_delay);
        resize.set(settings.resize_nav_pane === true);
        doc.addEventListener(EVENT, ui.guard(NAME, function (e) {
            if (!e.detail) return;
            if ("hide_nav_pane" in e.detail) {
                pane.set(e.detail.hide_nav_pane === true, e.detail.auto_hide_nav_pane, e.detail.auto_hide_delay);
            }
            if ("resize_nav_pane" in e.detail) resize.set(e.detail.resize_nav_pane === true);
        }));
        return {hide: pane, resize: resize};
    }

    return {start: start, create: create, createResize: createResize, clampWidth: clampWidth, HIDDEN_KEY: HIDDEN_KEY,
        WIDTH_KEY: WIDTH_KEY, PINNED_KEY: PINNED_KEY, MIN_WIDTH: MIN_WIDTH, DEFAULT_WIDTH: DEFAULT_WIDTH, SELECTORS: SELECTORS};
});
