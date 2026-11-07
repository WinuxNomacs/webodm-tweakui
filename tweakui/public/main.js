// TweakUI, loaded on every WebODM page after core.js: the "tweakui" class on <html>, which scopes the plugin's CSS,
// and TweakUI's items in the side menu. Plain ES5, no build step. The features are scripts of their own.
(function () {
    "use strict";
    document.documentElement.className += " tweakui";

    var ui = window.TweakUI, NAME = "menus";
    var TWEAKUI = "/plugins/tweakui/", DIAGNOSTIC = "/plugins/diagnostic/", STORAGE = "/plugins/tweakui/storage/",
        PUBLISHED = "/plugins/tweakui/admin/themes/";
    // The WebODM elements it relies on, to check against a new WebODM: the side menu, its About item and
    // Administration's Theme item
    var SELECTORS = {sideMenu: "#side-menu", about: "#about-menu", adminTheme: '#side-menu .nav-second-level a[href^="/admin/app/theme/"]'};

    function sideItem(href) { return ui.sideItem(document, href); }

    // WebODM puts plugins' side-menu items right after Dashboard; TweakUI's goes just above About instead.
    // main.css hides it until it is moved (html.tweakui ... :not(.tweakui-menu)), so it doesn't jump.
    function moveMenuItem() {
        var item = sideItem(TWEAKUI);
        if (!item || /\btweakui-menu\b/.test(item.className)) return;
        var about = document.querySelector(SELECTORS.about);
        if (about && about.parentNode === item.parentNode) item.parentNode.insertBefore(item, about);
        item.className += " tweakui-menu";
    }

    // Settings > Storage: the Diagnostic item opens to System (WebODM's page) and Storage; without Diagnostic (an admin
    // disabled it), TweakUI's item opens to Settings and Storage, expanded. WebODM's metisMenu makes a parent item
    // open and close when it starts (end of the page); when it has already started, the item does so itself.
    function storageMenu() {
        var settings = ui.settingsOf(window);
        var menu = document.querySelector(SELECTORS.sideMenu);
        if (!settings.storage_view || !menu || menu.getAttribute("data-tweakui-storage")) return;
        var item = sideItem(DIAGNOSTIC), subs, expanded = false;
        if (item) subs = [["System", DIAGNOSTIC, "fa fa-chart-pie fa-fw"], ["Storage", STORAGE, "fa fa-database fa-fw"]];
        else {
            item = sideItem(TWEAKUI);
            if (!item) return;
            subs = [["Settings", TWEAKUI, "fa fa-sliders-h fa-fw"], ["Storage", STORAGE, "fa fa-database fa-fw"]];
            expanded = true;
        }
        menu.setAttribute("data-tweakui-storage", "1");
        var path = window.location.pathname, link = item.querySelector("a");
        link.setAttribute("href", "#");
        var arrow = document.createElement("span");
        arrow.className = "fa arrow";
        link.appendChild(arrow);
        var list = document.createElement("ul");
        list.className = "nav nav-second-level tweakui-storage-menu";
        subs.forEach(function (s) {
            var li = ui.sideLink(document, s[0], s[1], s[2]);
            if (path === s[1]) { li.firstChild.className = "active"; expanded = true; }
            list.appendChild(li);
        });
        item.appendChild(list);
        if (expanded) item.className += " active";
        var $ = window.jQuery;
        if ($ && $(menu).data("metisMenu")) {
            // metisMenu has started: show the state it would, and open and close on a click
            list.className += " collapse" + (expanded ? " in" : "");
            list.setAttribute("aria-expanded", String(expanded));
            link.addEventListener("click", function (e) {
                e.preventDefault();
                var open = !/\bin\b/.test(list.className);
                list.className = list.className.replace(/\s*\bin\b/g, "") + (open ? " in" : "");
                item.className = item.className.replace(/\s*\bactive\b/g, "") + (open ? " active" : "");
                list.setAttribute("aria-expanded", String(open));
            });
        }
    }

    // Administration > TweakUI Themes, for superusers (settings.js says so): WebODM has no hook in Administration, so
    // the link goes right after its Theme item. On the page itself, Administration is open with the link active.
    function publishedMenu() {
        if (!ui.superuser || document.querySelector(SELECTORS.sideMenu + ' a[href="' + PUBLISHED + '"]')) return;
        var theme = document.querySelector(SELECTORS.adminTheme);
        if (!theme) return;
        var li = ui.sideLink(document, "TweakUI Themes", PUBLISHED, "fa fa-palette fa-fw"), a = li.firstChild;
        var item = theme.parentNode, list = item.parentNode;
        list.insertBefore(li, item.nextSibling);
        if (window.location.pathname === PUBLISHED) {
            a.className = "active";
            var admin = list.parentNode;
            if (!/\bactive\b/.test(admin.className)) admin.className += " active";
            // metisMenu has started: show the list open, as it would for the active item
            var $ = window.jQuery;
            if ($ && $(document.querySelector(SELECTORS.sideMenu)).data("metisMenu")) {
                list.className += " collapse in";
                list.setAttribute("aria-expanded", "true");
            }
        }
    }

    var menus = ui.guard(NAME, function () {
        moveMenuItem();
        storageMenu();
        publishedMenu();
    });

    if (document.readyState === "loading") {
        // The side menu ends with About; it is done before WebODM's metisMenu starts (later in the page). A page
        // without it (signed out) stops waiting once parsed
        var waiting = ui.whenElement(document, window, SELECTORS.about, menus);
        document.addEventListener("DOMContentLoaded", function () {
            if (waiting) waiting.disconnect();
            menus();
        });
    } else menus();
})();
