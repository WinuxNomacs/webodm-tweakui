// TweakUI, loaded on every WebODM page. Plain ES5, no build step. Features hook in through window.PluginsAPI
// (WebODM's app/static/app/js/classes/plugins); the "tweakui" class on <html> scopes the plugin's CSS.
(function () {
    "use strict";
    document.documentElement.className += " tweakui";

    var TWEAKUI = "/plugins/tweakui/", DIAGNOSTIC = "/plugins/diagnostic/", STORAGE = "/plugins/tweakui/storage/";

    function sideItem(href) {
        var link = document.querySelector('#side-menu > li > a[href="' + href + '"]');
        return link ? link.parentNode : null;
    }

    // WebODM puts plugins' side-menu items right after Dashboard; TweakUI's goes just above About instead.
    // main.css hides it until it is moved (html.tweakui ... :not(.tweakui-menu)), so it doesn't jump.
    function moveMenuItem() {
        var item = sideItem(TWEAKUI);
        if (!item || /\btweakui-menu\b/.test(item.className)) return;
        var about = document.getElementById("about-menu");
        if (about && about.parentNode === item.parentNode) item.parentNode.insertBefore(item, about);
        item.className += " tweakui-menu";
    }

    // Settings > Storage: the Diagnostic item opens to System (WebODM's page) and Storage; without Diagnostic (an admin
    // disabled it), TweakUI's item opens to Settings and Storage, expanded. WebODM's metisMenu makes a parent item
    // open and close when it starts (end of the page); when it has already started, the item does so itself.
    function storageMenu() {
        var settings = (window.TweakUI && window.TweakUI.settings) || {};
        var menu = document.getElementById("side-menu");
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
            var li = document.createElement("li"), a = document.createElement("a"), i = document.createElement("i");
            a.setAttribute("href", s[1]);
            i.className = s[2];
            a.appendChild(i);
            a.appendChild(document.createTextNode(" " + s[0]));
            if (path === s[1]) { a.className = "active"; expanded = true; }
            li.appendChild(a);
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

    function menus() {
        moveMenuItem();
        storageMenu();
    }

    if (document.readyState === "loading") {
        // The side menu ends with About; it is done before WebODM's metisMenu starts (later in the page)
        if (window.MutationObserver) {
            var observer = new MutationObserver(function () {
                if (document.getElementById("about-menu")) { observer.disconnect(); menus(); }
            });
            observer.observe(document.documentElement, {childList: true, subtree: true});
            document.addEventListener("DOMContentLoaded", function () { observer.disconnect(); });
        }
        document.addEventListener("DOMContentLoaded", menus);
    } else menus();
})();
