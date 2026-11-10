// 2D Map > Tile Cache and Fewer Tile Requests. WebODM's map asks for its orthophoto, DSM and DTM tiles at
// /api/projects/<p>/tasks/<t>/<type>/tiles/<z>/<x>/<y>, with a random `cache` parameter, and the server renders each
// one every time. With Tile Cache, each such layer asks TweakUI's /api/plugins/tweakui/tiles/<p>/<t>/<type>/... (the
// same parameters, less `cache`), which keeps what WebODM renders (tile_cache.py) and lets the browser reuse its copy.
// The layer's getTileUrl is replaced, not its URL, so it holds when WebODM calls setUrl (a new colour map or
// hillshade). With Fewer Tile Requests, a layer asks for tiles once a zoom ends rather than at each step of it
// (Leaflet's updateWhenZooming), and keeps more tiles around the view (keepBuffer). The map hook comes before WebODM
// adds its layers (after its tiles.json requests return), so the map's addLayer is wrapped; a layer already there is
// changed and redrawn. Other Tasks' Orthophotos' layers are WebODM's tiles too. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = node ? factory(require("./core")) : factory(root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "tile_cache", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: none (the map comes through the map hook)
    var SELECTORS = {};
    var NAME = "tile_cache";

    // WebODM's tile URL (app/api/urls.py), up to the tile's z/x/y: what goes before /api (an origin), the project, the
    // task and the type
    var WEBODM_TILES = /^(.*?)\/api\/projects\/([^/?]+)\/tasks\/([^/?]+)\/(orthophoto|dsm|dtm)\/tiles\//;
    var CACHED_TILES = "/api/plugins/tweakui/tiles/";
    // Leaflet's default is 2 rows of tiles kept beyond the view
    var KEEP_BUFFER = 4;
    var MARK = "__tweakuiTileCache";

    // The URL without its `cache` parameter
    function withoutCacheParam(url) {
        var at = url.indexOf("?");
        if (at === -1) return url;
        var pairs = url.slice(at + 1).split("&").filter(function (p) { return p && p.split("=")[0] !== "cache"; });
        return url.slice(0, at) + (pairs.length ? "?" + pairs.join("&") : "");
    }

    // TweakUI's URL for one of WebODM's tile URLs; null for any other URL
    function cachedUrl(url) {
        var m = typeof url === "string" ? WEBODM_TILES.exec(url) : null;
        if (!m) return null;
        return m[1] + CACHED_TILES + m[2] + "/" + m[3] + "/" + m[4] + "/" + withoutCacheParam(url.slice(m[0].length));
    }

    function isWebODMTiles(layer) {
        return !!layer && typeof layer.getTileUrl === "function" && typeof layer._url === "string" &&
            WEBODM_TILES.test(layer._url);
    }

    // Changes a layer of WebODM's tiles as the settings say ({cache, fewer}); false when it already was
    function tweak(layer, options) {
        if (layer[MARK]) return false;
        layer[MARK] = true;
        if (options.cache) {
            var original = layer.getTileUrl;
            layer.getTileUrl = function (coords) {
                var url = original.call(this, coords);
                return cachedUrl(url) || url;
            };
        }
        if (options.fewer && layer.options) {
            layer.options.updateWhenZooming = false;
            layer.options.keepBuffer = Math.max(layer.options.keepBuffer || 0, KEEP_BUFFER);
        }
        return true;
    }

    function attach(map, options) {
        if (!map || map[MARK]) return;
        map[MARK] = true;
        var addLayer = map.addLayer, change = ui.guard(NAME, tweak);
        map.addLayer = function (layer) {
            if (isWebODMTiles(layer)) change(layer, options);
            return addLayer.apply(this, arguments);
        };
        if (typeof map.eachLayer === "function") {
            map.eachLayer(function (layer) {
                if (isWebODMTiles(layer) && change(layer, options) && options.cache && layer.redraw) layer.redraw();
            });
        }
    }

    function start(doc, win) {
        var settings = ui.settingsOf(win), P = win.PluginsAPI;
        var options = {cache: !!settings.tile_cache, fewer: !!settings.fewer_tile_requests};
        if (!(options.cache || options.fewer) || !P || !P.Map || !P.Map.didAddControls) return;
        P.Map.didAddControls(ui.guard(NAME, function (args) { attach(args && args.map, options); }));
    }

    return {start: start, attach: attach, tweak: tweak, cachedUrl: cachedUrl, withoutCacheParam: withoutCacheParam,
            isWebODMTiles: isWebODMTiles, SELECTORS: SELECTORS};
});
