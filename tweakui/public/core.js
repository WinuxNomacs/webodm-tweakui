// TweakUI's shared helpers, as window.TweakUI (with the settings settings.js puts there): loaded on every WebODM page
// right after settings.js and before every feature's script. A feature's script starts through feature(), which
// keeps an error in it from stopping the others, and wraps with guard() every function it gives WebODM to call (a
// PluginsAPI hook's callback runs inside WebODM's own code: a throw there would break WebODM's map or task panel) and
// its observers and page-wide listeners. Plain ES5, no build step. UMD, so Jest can load it.
(function (root, factory) {
    var core = factory();
    if (typeof module === "object" && module.exports) module.exports = core;
    else if (root.document) core.install(root);
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    // The WebODM elements the helpers rely on, to check against a new WebODM: the header's links, the app's name beside
    // the logo, the side menu, its About item
    var SELECTORS = {
        header: "#navbar-top > .navbar-header", headerLinks: "#navbar-top .navbar-top-links",
        appName: "#navbar-top > .navbar-header .navbar-text", sideMenu: "#side-menu", about: "#about-menu"
    };

    // The class of TweakUI's menus in the header, how often keepFirst moves them back to the front on a page, and the
    // page's classes when the header is crowded (fitHeader)
    var HEADER_MENU = "tweakui-header-menu", MOVES_MAX = 10;
    var COMPACT = "tweakui-header-compact", NAMELESS = "tweakui-header-nameless";

    // Errors: logged with the feature's name, then the page goes on

    function report(name, e) {
        if (typeof console !== "undefined" && console.error) console.error("TweakUI " + name + ":", e);
    }

    // fn, but an error in it is logged and goes no further (it returns undefined then)
    function guard(name, fn) {
        return function () {
            try {
                return fn.apply(this, arguments);
            } catch (e) {
                report(name, e);
            }
        };
    }

    // The user's TweakUI settings (settings.js); the defaults are there for a signed-out page
    function settingsOf(win) {
        return (win.TweakUI && win.TweakUI.settings) || {};
    }

    // Calls fn once the page is parsed (at once when it already is). The scripts load in the page's head
    function ready(doc, fn) {
        if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", fn);
        else fn();
    }

    // Starts a feature's script: start(doc, win), at once (to catch WebODM's hooks, which fire as its pages start)
    // or, with options.ready, once the page is parsed; only when options.when(settings, win) says so, if given.
    // An error in it is logged as "TweakUI <name>:" and stops only this feature
    function feature(win, name, start, options) {
        options = options || {};
        var run = guard(name, function () {
            if (options.when && !options.when(settingsOf(win), win)) return;
            start(win.document, win);
        });
        if (options.ready) ready(win.document, run);
        else run();
    }

    // Building the page

    // An element with a class and a text (set as text, never as HTML)
    function el(doc, tag, className, text) {
        var e = doc.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined && text !== null) e.textContent = text;
        return e;
    }

    // Calls back with the element a selector finds, at once when it's there, else as soon as it appears; returns
    // the observer (to stop waiting) or null
    function whenElement(doc, win, selector, callback) {
        var found = doc.querySelector(selector);
        if (found) {
            callback(found);
            return null;
        }
        if (!win.MutationObserver) return null;
        var observer = new win.MutationObserver(function () {
            var now = doc.querySelector(selector);
            if (!now) return;
            observer.disconnect();
            callback(now);
        });
        observer.observe(doc.documentElement, {childList: true, subtree: true});
        return observer;
    }

    // The side menu's top-level item that links to href, or null
    function sideItem(doc, href) {
        var link = doc.querySelector(SELECTORS.sideMenu + ' > li > a[href="' + href + '"]');
        return link ? link.parentNode : null;
    }

    // A side-menu item, as WebODM's: li > a > i (a Font Awesome icon) and the label
    function sideLink(doc, label, href, iconClass) {
        var li = el(doc, "li"), a = el(doc, "a");
        a.setAttribute("href", href);
        a.appendChild(el(doc, "i", iconClass));
        a.appendChild(doc.createTextNode(" " + label));
        li.appendChild(a);
        return li;
    }

    // Where a header menu goes: before the first of the header's links that `before` finds, else after TweakUI's
    // other menus, ahead of every other item (another plugin's menus, the user's dropdown), or, in desktop mode (settings.js says so), where WebODM hides its header, in the
    // side menu before `sideBefore`'s item (else just above TweakUI's). In single-user mode WebODM leaves out the
    // header links with the user icon: a list of TweakUI's own goes where WebODM's would. null on a page without the
    // side menu (signed out)
    function menuSpot(doc, win, before, sideBefore) {
        var side = doc.querySelector(SELECTORS.sideMenu);
        if (!side) return null;
        if (win.TweakUI && win.TweakUI.desktop) {
            var tweakui = side.querySelector(':scope > li > a[href="/plugins/tweakui/"]');
            var next = (sideBefore && side.querySelector(":scope > " + sideBefore)) ||
                (tweakui ? tweakui.parentNode : doc.querySelector(SELECTORS.about));
            return {list: side, before: next, side: true};
        }
        var links = doc.querySelector(SELECTORS.headerLinks);
        if (!links) {
            var header = doc.querySelector(SELECTORS.header);
            if (!header) return null;
            links = el(doc, "ul", "nav navbar-top-links navbar-right");
            header.insertBefore(links, header.querySelector(".navbar-brand"));
        }
        return {list: links, before: (before && links.querySelector(before)) || firstOther(links), side: false};
    }

    // The header list's first item that isn't one of TweakUI's menus (null when there is none)
    function firstOther(list) {
        return list.querySelector(":scope > :not(." + HEADER_MENU + ")");
    }

    // Keeps TweakUI's header menus ahead of the items other plugins add later (DJI Thermal puts its Temperature Unit
    // first in the list), so the order is the same on every load: TweakUI's, then the others', then the user icon.
    // At most MOVES_MAX moves on a page, should another plugin keep moving its own menus to the front too. And keeps
    // the list clear of the app's name as items come and the window changes (fitHeader)
    function keepFirst(win, list) {
        if (list.tweakuiKeepFirst) return;
        list.tweakuiKeepFirst = true;
        var doc = list.ownerDocument, moves = 0;
        if (win.addEventListener) win.addEventListener("resize", guard("header menus", function () { fitHeader(doc, list); }));
        if (!win.MutationObserver) return;
        new win.MutationObserver(guard("header menus", function () {
            fitHeader(doc, list);
            var other = firstOther(list), ours = list.querySelectorAll(":scope > ." + HEADER_MENU);
            if (!other || !ours.length || !(other.compareDocumentPosition(ours[ours.length - 1]) & 4)) return;
            if (++moves > MOVES_MAX) return;
            Array.prototype.forEach.call(ours, function (menu) { list.insertBefore(menu, other); });
        })).observe(list, {childList: true});
    }

    // On a phone the header's list fills the header's row, over WebODM's name beside the logo: with more menus than
    // fit (TweakUI's, another plugin's, the user icon), the menus get narrower (COMPACT), and if that isn't enough the
    // name is left out (NAMELESS; the logo still leads home)
    function fitHeader(doc, list) {
        var name = doc.querySelector(SELECTORS.appName), html = doc.documentElement;
        html.classList.remove(COMPACT, NAMELESS);
        if (!name || !crowded(list, name)) return;
        html.classList.add(COMPACT);
        if (crowded(list, name)) html.classList.add(NAMELESS);
    }

    // Whether the list's first item reaches the name, on the same row
    function crowded(list, name) {
        var first = list.firstElementChild;
        if (!first) return false;
        var a = first.getBoundingClientRect(), b = name.getBoundingClientRect();
        return b.width > 0 && a.width > 0 && a.top < b.bottom && b.top < a.bottom && a.left < b.right + 4;
    }

    // Puts a header menu (li.dropdown > a.dropdown-toggle + ul.dropdown-menu) in its spot (menuSpot); in the side
    // menu, as an item named label that opens its list below it, as WebODM's side menu does (metisMenu has started by
    // then, so the item opens and closes itself). options: {before, sideBefore}, selectors of the items it goes
    // before in the header and in the side menu. false when it has no spot
    function placeMenu(doc, win, menu, label, options) {
        options = options || {};
        var at = menuSpot(doc, win, options.before, options.sideBefore);
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
        else {
            menu.className += " " + HEADER_MENU;
            keepFirst(win, at.list);
        }
        at.list.insertBefore(menu, at.before);
        if (!at.side) fitHeader(doc, at.list);
        return true;
    }

    // A number setting's box: its whole number when it is one from min to max, else what it should be (a message)
    function wholeNumber(text, min, max) {
        text = String(text).trim();
        if (!/^-?\d+$/.test(text) || Number(text) < min || Number(text) > max) {
            return "a whole number from " + min + " to " + max;
        }
        return Number(text);
    }

    // Talking to WebODM

    // The session's CSRF token, which WebODM's API (and TweakUI's) wants with a POST, PATCH or DELETE: the page's
    // form field when it has one, else the cookie
    function csrfToken(doc) {
        var input = doc.querySelector("input[name=csrfmiddlewaretoken]");
        if (input && input.value) return input.value;
        var m = (doc.cookie || "").match(/(?:^|;\s*)csrftoken=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : "";
    }

    // Saves some of the user's settings ({name: value}); a promise of the saved settings, which also become
    // window.TweakUI.settings, refused with the reason (the API's detail)
    function saveSettings(doc, win, changes, fetchFn) {
        fetchFn = fetchFn || function (url, options) { return win.fetch(url, options); };
        return fetchFn("/api/plugins/tweakui/settings", {
            method: "PATCH",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json", "X-CSRFToken": csrfToken(doc)},
            body: JSON.stringify(changes)
        }).then(function (res) {
            return res.json().then(null, function () { return {}; }).then(function (body) {
                if (!res.ok) throw new Error(body.detail || ("Error " + res.status));
                if (win.TweakUI) win.TweakUI.settings = body;
                return body;
            });
        });
    }

    // Copies text to the clipboard; a promise
    function copyText(text, doc, win) {
        if (win.navigator && win.navigator.clipboard && win.navigator.clipboard.writeText) {
            return win.navigator.clipboard.writeText(text);
        }
        // Not a secure context (plain http on another host): the old way
        var area = el(doc, "textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        doc.body.appendChild(area);
        area.select();
        var ok = doc.execCommand && doc.execCommand("copy");
        doc.body.removeChild(area);
        return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
    }

    // A row's "•••" menu, as on WebODM's Dashboard: a button data-act="menu" in a .tweakui-row-menu with its
    // .dropdown-menu, anywhere in root. It opens over the page (fixed, so a table's scrolling box doesn't cut it off),
    // its right edge under its button's, below it or above it where there is no room below, and follows its button as
    // the page scrolls or resizes; a click anywhere, Escape or its button leaving the window closes it, arrow keys move
    // through its items. Returns {close(focus), stop()}
    function rowMenu(doc, win, root, name) {
        var open = null;
        function toggleOf(group) { return group.querySelector("[data-act=menu]"); }
        function close(focus) {
            if (!open) return;
            var group = open, toggle = toggleOf(group);
            open = null;
            group.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
            if (focus && toggle.isConnected) toggle.focus();
        }
        function place() {
            if (!open.isConnected) {
                open = null;
                return;
            }
            var toggle = toggleOf(open), list = open.querySelector(".dropdown-menu");
            var box = toggle.getBoundingClientRect(), high = win.innerHeight || 0, wide = win.innerWidth || 0;
            if (high && (box.bottom < 0 || box.top > high)) return close();
            var top = box.bottom + 2;
            if (high && top + list.offsetHeight > high - 8 && box.top - list.offsetHeight - 2 >= 8) top = box.top - list.offsetHeight - 2;
            var left = box.right - list.offsetWidth;
            if (wide) left = Math.min(left, wide - list.offsetWidth - 8);
            list.style.top = Math.round(top) + "px";
            list.style.left = Math.round(Math.max(8, left)) + "px";
        }
        function show(toggle) {
            var group = toggle.parentNode;
            if (open === group) return close();
            close();
            group.classList.add("open");
            toggle.setAttribute("aria-expanded", "true");
            open = group;
            place();
            // Focused without scrolling a table's box to the menu
            var first = group.querySelector(".dropdown-menu a");
            if (first) first.focus({preventScroll: true});
        }
        var onClick = guard(name, function (e) {
            var toggle = e.target && e.target.closest ? e.target.closest("[data-act=menu]") : null;
            if (toggle && root.contains(toggle)) show(toggle);
            else close();
        });
        var onKey = guard(name, function (e) {
            if (!open) return;
            if (e.key === "Escape") {
                close(true);
                return;
            }
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            var items = Array.prototype.slice.call(open.querySelectorAll(".dropdown-menu a"));
            if (!items.length) return;
            var at = items.indexOf(doc.activeElement);
            e.preventDefault();
            items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus({preventScroll: true});
        });
        var onMove = guard(name, function () { if (open) place(); });
        doc.addEventListener("click", onClick);
        doc.addEventListener("keydown", onKey);
        win.addEventListener("scroll", onMove, true);
        win.addEventListener("resize", onMove);
        return {close: close, stop: function () {
            close();
            doc.removeEventListener("click", onClick);
            doc.removeEventListener("keydown", onKey);
            win.removeEventListener("scroll", onMove, true);
            win.removeEventListener("resize", onMove);
        }};
    }

    // A row's "•••" button and its menu (items: the menu's <li>s), for rowMenu
    function rowMenuHtml(items, disabled) {
        return '<div class="btn-group tweakui-row-menu"><button type="button" class="btn btn-default btn-xs dropdown-toggle" data-act="menu" ' +
            'aria-haspopup="true" aria-expanded="false" aria-label="Actions" title="Actions"' + (disabled ? " disabled" : "") +
            '><i class="fa fa-ellipsis-h"></i></button><ul class="dropdown-menu">' + items.join("") + "</ul></div>";
    }

    var core = {
        report: report, guard: guard, settingsOf: settingsOf, ready: ready, feature: feature, el: el,
        whenElement: whenElement, sideItem: sideItem, sideLink: sideLink, placeMenu: placeMenu, csrfToken: csrfToken,
        copyText: copyText, wholeNumber: wholeNumber, saveSettings: saveSettings, rowMenu: rowMenu, rowMenuHtml: rowMenuHtml,
        SELECTORS: SELECTORS
    };

    // Puts the helpers on window.TweakUI, beside what settings.js put there
    // (never over its settings, themes or flags: no helper takes their names)
    core.install = function (win) {
        win.TweakUI = win.TweakUI || {};
        Object.keys(core).forEach(function (k) {
            if (k !== "install" && !(k in win.TweakUI && typeof win.TweakUI[k] !== "function")) win.TweakUI[k] = core[k];
        });
        return win.TweakUI;
    };

    return core;
});
