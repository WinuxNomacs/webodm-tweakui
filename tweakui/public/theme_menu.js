// Themes > Theme Menu: a paintbrush left of the user icon opens a list of the themes
// (window.TweakUI.themes, from settings.js): the current one, WebODM's theme, then the others. Choosing one saves it
// as the user's theme, the same setting as Settings > Themes, and reloads the page in it. Bootstrap's dropdown
// (jQuery's data API) opens and closes the menu. The user's own themes (Settings > Themes > My Themes) come after the
// presets. Where WebODM hides its header (desktop mode, its Windows app), the menu is an item of the side menu
// instead, just above TweakUI's (core.js's placeMenu). UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "theme_menu", api.start, {ready: true});
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: none of its own (core.js's placeMenu finds
    // the header and the side menu)
    var SELECTORS = {};

    var DEFAULT = "webodm";
    var el = ui.el;

    // The themes in the menu's order: the current one and WebODM's theme on top, then the others as listed
    function ordered(themes, current) {
        var top = [], rest = [], webodm = null;
        themes.forEach(function (t) {
            if (t.id === current) top.unshift(t);
            else if (t.id === DEFAULT) webodm = t;
            else rest.push(t);
        });
        if (webodm) top.push(webodm);
        return {top: top, rest: rest};
    }

    function item(doc, theme, current) {
        var li = el(doc, "li"), a = el(doc, "a", "tweakui-theme-item");
        a.href = "#";
        a.setAttribute("data-theme", theme.id);
        a.setAttribute("role", "menuitemradio");
        a.setAttribute("aria-checked", theme.id === current ? "true" : "false");
        a.appendChild(el(doc, "i", "fa fa-check fa-fw" + (theme.id === current ? "" : " tweakui-unchecked")));
        var swatch = el(doc, "span", "tweakui-swatch theme-border");
        (theme.swatch || []).forEach(function (color) {
            var i = el(doc, "i");
            i.style.background = color;
            swatch.appendChild(i);
        });
        a.appendChild(swatch);
        a.appendChild(el(doc, "span", "tweakui-theme-name", theme.name));
        li.appendChild(a);
        return li;
    }

    // The menu's li, put before the user's dropdown (or in the side menu); null when it is turned off or the page has
    // no place for it or no themes
    function build(doc, win) {
        var tw = win.TweakUI;
        if (!tw || !tw.themes || !tw.settings || tw.settings.show_theme_menu === false ||
            doc.querySelector(".tweakui-theme-menu")) return null;
        var current = tw.settings.theme, groups = ordered(tw.themes, current);
        var menu = el(doc, "li", "dropdown tweakui-theme-menu");
        var toggle = el(doc, "a", "dropdown-toggle");
        toggle.href = "#";
        toggle.title = "Themes";
        toggle.setAttribute("data-toggle", "dropdown");
        toggle.setAttribute("aria-label", "Themes");
        toggle.appendChild(el(doc, "i", "fa fa-paint-brush fa-fw"));
        toggle.appendChild(doc.createTextNode(" "));
        toggle.appendChild(el(doc, "i", "fa fa-caret-down"));
        var list = el(doc, "ul", "dropdown-menu dropdown-menu-right tweakui-theme-list");
        list.setAttribute("role", "menu");
        list.appendChild(el(doc, "li", "dropdown-header", "Themes"));
        groups.top.forEach(function (t) { list.appendChild(item(doc, t, current)); });
        if (groups.rest.length) list.appendChild(el(doc, "li", "divider"));
        // The presets, then each further group (your own themes) after a divider of its own
        groups.rest.forEach(function (t, i) {
            if (i && t.group !== groups.rest[i - 1].group) list.appendChild(el(doc, "li", "divider"));
            list.appendChild(item(doc, t, current));
        });
        var status = el(doc, "li", "tweakui-theme-status text-danger");
        status.hidden = true;
        list.appendChild(status);
        menu.appendChild(toggle);
        menu.appendChild(list);
        return ui.placeMenu(doc, win, menu, "Theme", {sideBefore: "li.tweakui-units-menu"}) ? menu : null;
    }

    // Saves the chosen theme and reloads; a failure is shown in the menu, kept open, and changes nothing
    function choose(menu, id, fetchFn, doc, win) {
        var status = menu.querySelector(".tweakui-theme-status");
        status.hidden = true;
        if (id === win.TweakUI.settings.theme) return Promise.resolve();
        return fetchFn("/api/plugins/tweakui/settings", {
            method: "PATCH",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json", "X-CSRFToken": ui.csrfToken(doc)},
            body: JSON.stringify({theme: id})
        }).then(function (res) {
            return res.json().then(null, function () { return {}; }).then(function (body) {
                if (!res.ok) throw new Error(body.detail || ("Error " + res.status));
                win.TweakUI.settings = body;
                win.location.reload();
            });
        }).then(null, function (e) {
            status.textContent = "Not saved: " + e.message;
            status.hidden = false;
            if (!/\b(open|tweakui-side-item)\b/.test(menu.className)) menu.className += " open";
        });
    }

    function start(doc, win) {
        var menu = build(doc, win);
        if (!menu) return;
        menu.querySelector(".tweakui-theme-list").addEventListener("click", function (e) {
            var a = e.target.closest ? e.target.closest("a[data-theme]") : null;
            if (!a) return;
            e.preventDefault();
            choose(menu, a.getAttribute("data-theme"), win.fetch.bind(win), doc, win);
        });
    }

    return {start: start, build: build, choose: choose, ordered: ordered, SELECTORS: SELECTORS};
});
