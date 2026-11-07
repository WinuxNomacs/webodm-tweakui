// The header's theme menu (unless Settings > Themes turns it off): a paintbrush left of the user icon opens a list of the themes (window.TweakUI.themes,
// from settings.js): the current one, WebODM's theme, then the others. Choosing one saves it as the user's theme,
// the same setting as Settings > Themes, and reloads the page in it. Bootstrap's dropdown (jQuery's data API)
// opens and closes the menu. The user's own themes (Settings > Themes > My Themes) come after the presets.
// Where WebODM hides its header (desktop mode, its Windows app), the menu is an item of the side menu instead, just above
// TweakUI's (place(), which the units menu uses too). UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.document) {
        root.TweakUI = root.TweakUI || {};
        root.TweakUI.placeMenu = api.place;
        if (root.document.readyState === "loading") {
            root.document.addEventListener("DOMContentLoaded", function () { api.start(root.document, root); });
        } else api.start(root.document, root);
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    var DEFAULT = "webodm";

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

    function csrfToken(doc) {
        var m = (doc.cookie || "").match(/(?:^|;\s*)csrftoken=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : "";
    }

    function el(doc, tag, className, text) {
        var e = doc.createElement(tag);
        if (className) e.className = className;
        if (text) e.textContent = text;
        return e;
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

    // Where a header menu goes: before the given item of WebODM's header links (else before the user's dropdown, else
    // last), or, in desktop mode (settings.js says so), where WebODM hides its header, in the side menu just above
    // TweakUI's item. In single-user mode WebODM leaves out the header links with the user icon: a list of TweakUI's own
    // goes where WebODM's would. null on a page without the side menu (signed out).
    function spot(doc, win, before) {
        var side = doc.getElementById("side-menu");
        if (!side) return null;
        if (win.TweakUI && win.TweakUI.desktop) {
            var tweakui = side.querySelector(':scope > li > a[href="/plugins/tweakui/"]');
            return {list: side, before: tweakui ? tweakui.parentNode : doc.getElementById("about-menu"), side: true};
        }
        var links = doc.querySelector("#navbar-top .navbar-top-links");
        if (!links) {
            var header = doc.querySelector("#navbar-top > .navbar-header");
            if (!header) return null;
            links = el(doc, "ul", "nav navbar-top-links navbar-right");
            header.insertBefore(links, header.querySelector(".navbar-brand"));
        }
        var user = links.querySelector(":scope > li.dropdown > .dropdown-user");
        return {list: links, before: links.querySelector(before || null) || (user ? user.parentNode : null), side: false};
    }

    // Puts a header menu (li.dropdown > a.dropdown-toggle + ul.dropdown-menu) in its spot; in the side menu, as an item
    // named label that opens its list below it, as WebODM's side menu does (metisMenu has started by then, so the item
    // opens and closes itself). before: a selector of the header item it goes before. false when it has no spot.
    function place(doc, win, menu, label, before) {
        var at = spot(doc, win, before);
        if (!at) return false;
        if (at.side) {
            var toggle = menu.querySelector(".dropdown-toggle"), list = menu.querySelector(".dropdown-menu");
            menu.className = menu.className.replace(/\bdropdown\b/, "tweakui-side-item");
            toggle.className = "";
            toggle.removeAttribute("data-toggle");
            toggle.setAttribute("aria-expanded", "false");
            var caret = toggle.querySelector(".fa-caret-down");
            if (caret) toggle.removeChild(caret);
            toggle.insertBefore(doc.createTextNode(" " + label), toggle.firstChild.nextSibling);
            toggle.appendChild(el(doc, "span", "fa arrow"));
            list.className = list.className.replace(/\bdropdown-menu(-right)?\b/g, "").replace(/\s+/g, " ").trim() +
                " nav nav-second-level collapse";
            Array.prototype.forEach.call(list.querySelectorAll(":scope > li.dropdown-header"), function (h) {
                list.removeChild(h);
            });
            toggle.addEventListener("click", function (e) {
                e.preventDefault();
                var open = !/\bin\b/.test(list.className);
                list.className = list.className.replace(/\s*\bin\b/g, "") + (open ? " in" : "");
                menu.className = menu.className.replace(/\s*\bactive\b/g, "") + (open ? " active" : "");
                toggle.setAttribute("aria-expanded", String(open));
            });
        }
        at.list.insertBefore(menu, at.before);
        return true;
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
        return place(doc, win, menu, "Theme") ? menu : null;
    }

    // Saves the chosen theme and reloads; a failure is shown in the menu, kept open, and changes nothing
    function choose(menu, id, fetchFn, doc, win) {
        var status = menu.querySelector(".tweakui-theme-status");
        status.hidden = true;
        if (id === win.TweakUI.settings.theme) return Promise.resolve();
        return fetchFn("/api/plugins/tweakui/settings", {
            method: "PATCH",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json", "X-CSRFToken": csrfToken(doc)},
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

    return {start: start, build: build, choose: choose, ordered: ordered, place: place};
});
