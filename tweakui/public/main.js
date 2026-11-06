// TweakUI, loaded on every WebODM page. Plain ES5, no build step. Features hook in through window.PluginsAPI
// (WebODM's app/static/app/js/classes/plugins); the "tweakui" class on <html> scopes the plugin's CSS.
(function () {
    "use strict";
    document.documentElement.className += " tweakui";
})();
