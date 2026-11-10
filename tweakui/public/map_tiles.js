// 2D Map > Speed: how WebODM's orthophoto, DSM and DTM layers (Leaflet 1.3.1 tile layers) load and show their tiles.
// - Tile Cache: WebODM's map asks for tiles at /api/projects/<p>/tasks/<t>/<type>/tiles/<z>/<x>/<y> with a random
//   `cache` parameter, and the server renders each one every time. Each such layer asks TweakUI's
//   /api/plugins/tweakui/tiles/<p>/<t>/<type>/... instead (the same parameters, less `cache`), which keeps what WebODM
//   renders (tile_cache.py). The layer's getTileUrl is replaced, not its URL, so it holds when WebODM calls setUrl (a
//   new colour map or hillshade). Reuse Browser Copies: the URL also carries the task's version (asked of
//   .../<p>/<t>/version once per task), and the server lets the browser keep such a tile without asking again.
// - Fewer Tile Requests: a layer asks for tiles once a zoom ends, not at each level on the way (updateWhenZooming).
// - Load Ahead: a layer loads the tiles within a share of the view's size beyond its edges, not only those in view
//   (its _getTiledPixelBounds, private in Leaflet 1.x, grown by that much).
// - Keep More Tiles: a layer keeps that share of the view's size beyond what it loads, in rows of its tiles, besides
//   Leaflet's 2 (its keepBuffer, worked out each time Leaflet reads it, so it follows the view's size and the tiles'
//   size on screen).
// - Fade-in Speed: Leaflet fades a tile in over 200 ms, a number in its _updateOpacity; the layer's own copy of that
//   method takes the setting's.
// The map hook comes before WebODM adds its layers (once its tiles.json requests return), so the map's addLayer is
// wrapped; a layer already there is changed and redrawn. Other Tasks' Orthophotos' layers are WebODM's tiles too.
// UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = node ? factory(require("./core")) : factory(root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "map_tiles", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: none (the map comes through the map hook)
    var SELECTORS = {};
    var NAME = "map_tiles";

    // WebODM's tile URL (app/api/urls.py), up to the tile's z/x/y: what goes before /api (an origin), the project, the
    // task and the type
    var WEBODM_TILES = /^(.*?)\/api\/projects\/([^/?]+)\/tasks\/([^/?]+)\/(orthophoto|dsm|dtm)\/tiles\//;
    var CACHED_TILES = "/api/plugins/tweakui/tiles/";
    // WebODM's own: Leaflet's defaults
    var WEBODM = {keepBuffer: 2, fadeMs: 200, loadAhead: 0, keepMore: 0};
    var MARK = "__tweakuiMapTiles";

    // The settings as this script uses them; null when all are WebODM's own
    function optionsOf(settings) {
        var o = {
            cache: !!settings.tile_cache,
            reuse: !!settings.tile_cache && !!settings.reuse_browser_copies,
            fewer: !!settings.fewer_tile_requests,
            loadAhead: share(settings.load_ahead),
            keepMore: share(settings.keep_more_tiles),
            fadeMs: typeof settings.fade_in_speed === "number" && settings.fade_in_speed >= 0 ? settings.fade_in_speed : WEBODM.fadeMs
        };
        var changed = o.cache || o.fewer || o.loadAhead > 0 || o.keepMore > 0 || o.fadeMs !== WEBODM.fadeMs;
        return changed ? o : null;
    }

    // A percentage setting as a share (0.25 for 25%); 0 when it isn't one
    function share(percent) {
        return typeof percent === "number" && percent > 0 ? percent / 100 : 0;
    }

    // The URL without its `cache` parameter
    function withoutCacheParam(url) {
        var at = url.indexOf("?");
        if (at === -1) return url;
        var pairs = url.slice(at + 1).split("&").filter(function (p) { return p && p.split("=")[0] !== "cache"; });
        return url.slice(0, at) + (pairs.length ? "?" + pairs.join("&") : "");
    }

    // TweakUI's URL for one of WebODM's tile URLs, with the task's version when there is one; null for any other URL
    function cachedUrl(url, version) {
        var m = typeof url === "string" ? WEBODM_TILES.exec(url) : null;
        if (!m) return null;
        var cached = m[1] + CACHED_TILES + m[2] + "/" + m[3] + "/" + m[4] + "/" + withoutCacheParam(url.slice(m[0].length));
        if (version) cached += (cached.indexOf("?") === -1 ? "?" : "&") + "v=" + encodeURIComponent(version);
        return cached;
    }

    // {project, task} of a WebODM tile URL, or null
    function taskOf(url) {
        var m = typeof url === "string" ? WEBODM_TILES.exec(url) : null;
        return m ? {project: m[2], task: m[3]} : null;
    }

    function isWebODMTiles(layer) {
        return !!layer && typeof layer.getTileUrl === "function" && typeof layer._url === "string" &&
            WEBODM_TILES.test(layer._url);
    }

    // Each task's tile version (Reuse Browser Copies), asked once per page; tiles asked for before it comes are
    // checked with the server as without it
    function versions(fetchFn) {
        var known = {}, asked = {};
        return {
            get: function (task) { return known[task] || null; },
            ask: function (project, task) {
                if (!fetchFn || asked[task]) return;
                asked[task] = true;
                fetchFn(CACHED_TILES + encodeURIComponent(project) + "/" + encodeURIComponent(task) + "/version",
                        {credentials: "same-origin"}).then(function (res) {
                    return res.ok ? res.json() : null;
                }).then(function (body) {
                    if (body && typeof body.version === "string") known[task] = body.version;
                }, function () { /* the tiles go without it */ });
            }
        };
    }

    // The view's size in the layer's tile pixels, grown by a share each side (Leaflet's own, plus Load Ahead). A
    // Bounds of Leaflet's prototype (its constructor isn't on it); Leaflet's own bounds should anything fail
    function loadAhead(layer, amount) {
        var original = layer._getTiledPixelBounds;
        if (typeof original !== "function") return;
        layer._getTiledPixelBounds = function (center) {
            var bounds = original.call(this, center), map = this._map;
            try {
                if (!map || !bounds || !bounds.min || !bounds.max) return bounds;
                var zoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom();
                var pad = map.getSize().multiplyBy(amount / map.getZoomScale(zoom, this._tileZoom));
                var grown = Object.create(Object.getPrototypeOf(bounds));
                grown.min = bounds.min.subtract(pad);
                grown.max = bounds.max.add(pad);
                return grown;
            } catch (e) {
                ui.guard(NAME, function () { throw e; })();
                return bounds;
            }
        };
    }

    // Leaflet's 2 rows, plus as many as the share of the view's larger side takes in tiles as they are on screen
    function keepRows(viewPx, tilePx, amount) {
        if (!(amount > 0) || !(viewPx > 0) || !(tilePx > 0)) return WEBODM.keepBuffer;
        return WEBODM.keepBuffer + Math.ceil(viewPx * amount / tilePx);
    }

    function keepMore(layer, amount) {
        var options = layer.options;
        Object.defineProperty(options, "keepBuffer", {
            configurable: true,
            enumerable: true,
            get: function () {
                var map = layer._map;
                if (!map || typeof map.getSize !== "function") return WEBODM.keepBuffer;
                var size = map.getSize(), tile = typeof layer.getTileSize === "function" ? layer.getTileSize() : null;
                return keepRows(Math.max(size.x, size.y), tile ? tile.x : 0, amount);
            },
            set: function () { /* the setting's */ }
        });
    }

    // Leaflet 1.3.1's _updateOpacity (GridLayer), fading a tile in over `ms` (its own 200) or, at 0, showing it at once
    function fadeIn(layer, ms, win) {
        layer._updateOpacity = function () {
            if (!this._map) return;
            this._container.style.opacity = this.options.opacity;
            var now = +new Date(), nextFrame = false, willPrune = false;
            for (var key in this._tiles) {
                var tile = this._tiles[key];
                if (!tile.current || !tile.loaded) continue;
                var fade = ms > 0 ? Math.min(1, (now - tile.loaded) / ms) : 1;
                tile.el.style.opacity = fade;
                if (fade < 1) nextFrame = true;
                else {
                    if (tile.active) willPrune = true;
                    else this._onOpaqueTile(tile);
                    tile.active = true;
                }
            }
            if (willPrune && !this._noPrune) this._pruneTiles();
            if (nextFrame) {
                win.cancelAnimationFrame(this._fadeFrame);
                this._fadeFrame = win.requestAnimationFrame(this._updateOpacity.bind(this));
            }
        };
    }

    // Changes a layer of WebODM's tiles as the settings say; false when it already was
    function tweak(layer, options, known, win) {
        if (layer[MARK]) return false;
        layer[MARK] = true;
        if (options.cache) {
            var original = layer.getTileUrl;
            var from = taskOf(layer._url);
            if (options.reuse && known && from) known.ask(from.project, from.task);
            layer.getTileUrl = function (coords) {
                var url = original.call(this, coords), at = options.reuse && known ? taskOf(url) : null;
                return cachedUrl(url, at ? known.get(at.task) : null) || url;
            };
        }
        if (options.fewer && layer.options) layer.options.updateWhenZooming = false;
        if (options.loadAhead > 0) loadAhead(layer, options.loadAhead);
        if (options.keepMore > 0 && layer.options) keepMore(layer, options.keepMore);
        if (options.fadeMs !== WEBODM.fadeMs) fadeIn(layer, options.fadeMs, win || (typeof window !== "undefined" ? window : null));
        return true;
    }

    function attach(map, options, known, win) {
        if (!map || map[MARK]) return;
        map[MARK] = true;
        var addLayer = map.addLayer, change = ui.guard(NAME, tweak);
        map.addLayer = function (layer) {
            if (isWebODMTiles(layer)) change(layer, options, known, win);
            return addLayer.apply(this, arguments);
        };
        if (typeof map.eachLayer === "function") {
            map.eachLayer(function (layer) {
                if (isWebODMTiles(layer) && change(layer, options, known, win) && layer.redraw) layer.redraw();
            });
        }
    }

    function start(doc, win) {
        var options = optionsOf(ui.settingsOf(win)), P = win.PluginsAPI;
        if (!options || !P || !P.Map || !P.Map.didAddControls) return;
        var known = options.reuse && win.fetch ? versions(win.fetch.bind(win)) : null;
        P.Map.didAddControls(ui.guard(NAME, function (args) {
            // The map's tasks' versions, asked while WebODM asks for their tiles.json
            if (known && args && args.tiles) {
                args.tiles.forEach(function (t) {
                    var task = t && t.meta && t.meta.task;
                    if (task && task.id && task.project !== undefined) known.ask(String(task.project), String(task.id));
                });
            }
            attach(args && args.map, options, known, win);
        }));
    }

    return {start: start, attach: attach, tweak: tweak, optionsOf: optionsOf, cachedUrl: cachedUrl, taskOf: taskOf,
            withoutCacheParam: withoutCacheParam, isWebODMTiles: isWebODMTiles, keepRows: keepRows, versions: versions,
            SELECTORS: SELECTORS};
});
