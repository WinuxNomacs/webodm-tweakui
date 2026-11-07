// General > Global Controls > Hide Navigation Pane: a small tab on the divider between the side menu (WebODM's
// navigation pane) and the page, near the top. A click hides the pane, the page takes the whole width and only the
// tab stays, at the left edge; a click again shows it. Remembered in this browser (localStorage), so the next page
// opens the same way. Only where WebODM shows the pane beside the page (768 px wide and more, main.css); narrower,
// the pane is the header's hamburger menu, left as it is. The settings page announces each saved change
// ("tweakuiSettingsChanged"), so turning it on or off there shows or removes the tab at once. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "nav_pane", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: the navigation pane and the header above it
    // (main.css also sizes #page-wrapper, the page beside the pane)
    var SELECTORS = {pane: ".navbar-default.sidebar", header: "#navbar-top"};
    var NAME = "nav_pane", EVENT = "tweakuiSettingsChanged";
    var HIDDEN_KEY = "tweakui-nav-hidden";
    // On <html>: the pane is hidden; the tab is on the page
    var HIDDEN = "tweakui-nav-hidden", TAB = "tweakui-nav-tabbed";
    // Below the header, this far down the divider
    var TAB_GAP = 10;

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

    function start(doc, win) {
        var pane = create(doc, win);
        pane.set(ui.settingsOf(win).hide_nav_pane === true);
        doc.addEventListener(EVENT, ui.guard(NAME, function (e) {
            if (e.detail && "hide_nav_pane" in e.detail) pane.set(e.detail.hide_nav_pane === true);
        }));
        return pane;
    }

    return {start: start, create: create, HIDDEN_KEY: HIDDEN_KEY, SELECTORS: SELECTORS};
});
