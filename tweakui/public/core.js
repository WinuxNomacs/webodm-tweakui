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

    // The WebODM elements the helpers rely on, to check against a new WebODM: the header's links and user icon, the
    // side menu, its About item
    var SELECTORS = {
        header: "#navbar-top > .navbar-header", headerLinks: "#navbar-top .navbar-top-links",
        user: ":scope > li.dropdown > .dropdown-user", sideMenu: "#side-menu", about: "#about-menu"
    };

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

    // Where a header menu goes: before the first of WebODM's header links that `before` finds (else before the
    // user's dropdown, else last), or, in desktop mode (settings.js says so), where WebODM hides its header, in the
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
        var user = links.querySelector(SELECTORS.user);
        return {list: links, before: (before && links.querySelector(before)) || (user ? user.parentNode : null), side: false};
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
        at.list.insertBefore(menu, at.before);
        return true;
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

    var core = {
        report: report, guard: guard, settingsOf: settingsOf, ready: ready, feature: feature, el: el,
        whenElement: whenElement, sideItem: sideItem, sideLink: sideLink, placeMenu: placeMenu, csrfToken: csrfToken,
        copyText: copyText, SELECTORS: SELECTORS
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
