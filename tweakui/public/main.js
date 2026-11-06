// TweakUI, loaded on every WebODM page. Plain ES5, no build step. Features hook in through window.PluginsAPI
// (WebODM's app/static/app/js/classes/plugins); the "tweakui" class on <html> scopes the plugin's CSS.
(function () {
    "use strict";
    document.documentElement.className += " tweakui";

    // WebODM puts plugins' side-menu items right after Dashboard; TweakUI's goes just above About instead.
    // main.css hides it until it is moved (html.tweakui ... :not(.tweakui-menu)), so it doesn't jump.
    function moveMenuItem() {
        var link = document.querySelector('#side-menu > li > a[href="/plugins/tweakui/"]');
        if (!link) return;
        var item = link.parentNode;
        var about = document.getElementById("about-menu");
        if (about && about.parentNode === item.parentNode) item.parentNode.insertBefore(item, about);
        item.className += " tweakui-menu";
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", moveMenuItem);
    else moveMenuItem();
})();
