// General > Global Controls > Units Menu: a units menu in the header, left of the paintbrush (or of the user
// icon), a shortcut to the unit system the 2D map and 3D view offer. It is WebODM's own preference (Units.js): the
// browser's localStorage "unit_system" and the document event "onUnitSystemChanged", which measurements, histograms
// and the 3D view follow. WebODM's selectors on the maps (select.unit-selector) read it only when they appear, so a
// choice here also sets theirs; a choice there fires the event, which updates this menu. Bootstrap's dropdown opens
// and closes the menu. Where WebODM hides its header (desktop mode), it is an item of the side menu, after the theme
// menu (core.js's placeMenu). UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) {
        root.TweakUI.feature(root, "units_menu", api.start, {ready: true, when: function (s) { return s.units_in_header; }});
    }
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: the maps' unit selectors (core.js's placeMenu
    // finds the header and the side menu)
    var SELECTORS = {unitSelector: "select.unit-selector"};

    var el = ui.el;
    var KEY = "unit_system", EVENT = "onUnitSystemChanged";
    // WebODM's systems (Units.js), in its order and with its names
    var SYSTEMS = [["metric", "Metric"], ["imperial", "Imperial"], ["imperialUS", "Imperial (US)"]];

    function name(system) {
        for (var i = 0; i < SYSTEMS.length; i++) if (SYSTEMS[i][0] === system) return SYSTEMS[i][1];
        return SYSTEMS[0][1];
    }

    // WebODM's current system, as Units.js reads it (metric when unset or unreadable)
    function current(win) {
        try {
            return win.localStorage.getItem(KEY) || "metric";
        } catch (e) {
            return "metric";
        }
    }

    // As Units.js's setUnitSystem: stores it and, when it changed, fires the event
    function choose(doc, win, system) {
        var before = current(win);
        try {
            win.localStorage.setItem(KEY, system);
        } catch (e) { /* the page still follows the event */ }
        if (before !== system) doc.dispatchEvent(new win.CustomEvent(EVENT, {detail: system}));
    }

    // The menu and WebODM's selectors on the page show the system
    function show(doc, menu, system) {
        menu.querySelector(".tweakui-units-name").textContent = name(system);
        Array.prototype.forEach.call(menu.querySelectorAll("a[data-units]"), function (a) {
            var on = a.getAttribute("data-units") === system;
            a.setAttribute("aria-checked", on ? "true" : "false");
            a.querySelector(".fa-check").classList.toggle("tweakui-unchecked", !on);
        });
        Array.prototype.forEach.call(doc.querySelectorAll(SELECTORS.unitSelector), function (select) {
            if (select.value !== system) select.value = system;
        });
    }

    // The menu's li, before the theme menu or the user's dropdown (or in the side menu, after the theme menu); null
    // without a place for it or when already there
    function build(doc, win) {
        if (doc.querySelector(".tweakui-units-menu")) return null;
        var menu = el(doc, "li", "dropdown tweakui-units-menu");
        var toggle = el(doc, "a", "dropdown-toggle");
        toggle.href = "#";
        toggle.title = "Units";
        toggle.setAttribute("data-toggle", "dropdown");
        toggle.setAttribute("aria-label", "Units");
        toggle.appendChild(el(doc, "i", "fa fa-ruler fa-fw"));
        toggle.appendChild(doc.createTextNode(" "));
        toggle.appendChild(el(doc, "span", "tweakui-units-name"));
        toggle.appendChild(doc.createTextNode(" "));
        toggle.appendChild(el(doc, "i", "fa fa-caret-down"));
        var list = el(doc, "ul", "dropdown-menu dropdown-menu-right tweakui-units-list");
        list.setAttribute("role", "menu");
        list.appendChild(el(doc, "li", "dropdown-header", "Units"));
        SYSTEMS.forEach(function (s) {
            var li = el(doc, "li"), a = el(doc, "a", "tweakui-units-item");
            a.href = "#";
            a.setAttribute("data-units", s[0]);
            a.setAttribute("role", "menuitemradio");
            a.appendChild(el(doc, "i", "fa fa-check fa-fw"));
            a.appendChild(doc.createTextNode(" " + s[1]));
            li.appendChild(a);
            list.appendChild(li);
        });
        menu.appendChild(toggle);
        menu.appendChild(list);
        if (!ui.placeMenu(doc, win, menu, "Units:", {before: "li.tweakui-theme-menu"})) return null;
        show(doc, menu, current(win));
        return menu;
    }

    function start(doc, win) {
        var menu = build(doc, win);
        if (!menu) return null;
        function onClick(e) {
            var a = e.target.closest ? e.target.closest("a[data-units]") : null;
            if (!a) return;
            e.preventDefault();
            choose(doc, win, a.getAttribute("data-units"));
            show(doc, menu, current(win));
        }
        var sync = ui.guard("units_menu", function () { show(doc, menu, current(win)); });
        // Another tab's change: WebODM's pages don't follow it, but the menu does
        var onStorage = ui.guard("units_menu", function (e) { if (e.key === KEY) sync(); });
        menu.addEventListener("click", onClick);
        doc.addEventListener(EVENT, sync);
        win.addEventListener("storage", onStorage);
        return {
            menu: menu,
            stop: function () {
                menu.removeEventListener("click", onClick);
                doc.removeEventListener(EVENT, sync);
                win.removeEventListener("storage", onStorage);
            }
        };
    }

    return {start: start, build: build, choose: choose, current: current, SYSTEMS: SYSTEMS, SELECTORS: SELECTORS};
});
