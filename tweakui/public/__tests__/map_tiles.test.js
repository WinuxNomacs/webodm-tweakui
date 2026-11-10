const mapTiles = require("../map_tiles");

const TILES = "/api/projects/3/tasks/ab-12/orthophoto/tiles/{z}/{x}/{y}?rescale=0%2C255&size=512&cache=123456&crop=1";
const OFF = {tile_cache: false, reuse_browser_copies: false, fewer_tile_requests: false, load_ahead_on: false, load_ahead: 25,
             keep_more_tiles_on: false, keep_more_tiles: 50, fade_in_speed_on: false, fade_in_speed: 0};
// The settings with these changes; a number given ticks its checkbox, unless its checkbox is given too
const ON = {load_ahead: "load_ahead_on", keep_more_tiles: "keep_more_tiles_on", fade_in_speed: "fade_in_speed_on"};
const settingsWith = changes => {
    const s = Object.assign({}, OFF, changes);
    Object.keys(ON).forEach(n => { if (n in changes && !(ON[n] in changes)) s[ON[n]] = true; });
    return s;
};
const opts = changes => mapTiles.optionsOf(settingsWith(changes));
const flush = () => new Promise(r => setTimeout(r, 0));

// Leaflet's Point and Bounds as far as Load Ahead uses them
function Point(x, y) { this.x = x; this.y = y; }
Point.prototype.add = function (p) { return new Point(this.x + p.x, this.y + p.y); };
Point.prototype.subtract = function (p) { return new Point(this.x - p.x, this.y - p.y); };
Point.prototype.multiplyBy = function (n) { return new Point(this.x * n, this.y * n); };
// Leaflet's Bounds: its prototype an object of its own, so its constructor isn't Bounds
function Bounds(min, max) { this.min = min; this.max = max; }
Bounds.prototype = {
    getCenter() { return new Point((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2); },
    contains(p) { return p.x >= this.min.x && p.x <= this.max.x && p.y >= this.min.y && p.y <= this.max.y; }
};

// A Leaflet tile layer as far as the script uses it: getTileUrl fills the template
function fakeLayer(url, options) {
    return {
        _url: url,
        options: Object.assign({updateWhenZooming: true, keepBuffer: 2, opacity: 1}, options),
        redraw: jest.fn(),
        getTileUrl(c) { return this._url.replace("{z}", c.z).replace("{x}", c.x).replace("{y}", c.y); },
        setUrl(u) { this._url = u; },
        getTileSize() { return new Point(512, 512); },
        _getTiledPixelBounds(center) { return new Bounds(new Point(center.x - 700, center.y - 450), new Point(center.x + 700, center.y + 450)); }
    };
}
function fakeMap(layers) {
    return {
        added: [],
        addLayer(layer) { this.added.push(layer); layer._map = this; return this; },
        eachLayer(fn) { (layers || []).forEach(l => { l._map = this; fn(l); }); },
        getSize() { return new Point(1400, 900); },
        getZoom() { return 18; },
        getZoomScale() { return 1; }
    };
}
const at = {z: 18, x: 64084, y: 92370};

test("all at WebODM's own (each checkbox off, whatever its number) changes nothing", () => {
    expect(opts({})).toBeNull();
    expect(opts({load_ahead_on: false, load_ahead: 100, keep_more_tiles_on: false, keep_more_tiles: 200,
                 fade_in_speed_on: false, fade_in_speed: 400})).toBeNull();
    expect(opts({load_ahead_on: true, keep_more_tiles_on: true, fade_in_speed_on: true}))
        .toMatchObject({loadAhead: 0.25, keepMore: 0.5, fadeMs: 0});
    expect(opts({reuse_browser_copies: true})).toBeNull();
    expect(opts({fade_in_speed: 200, load_ahead: 0})).toBeNull();
    expect(opts({fade_in_speed: 0})).toMatchObject({fadeMs: 0});
    expect(opts({load_ahead: 25})).toMatchObject({loadAhead: 0.25, keepMore: 0, cache: false});
    expect(opts({tile_cache: true, reuse_browser_copies: true})).toMatchObject({cache: true, reuse: true});
});

test("a WebODM tile URL becomes TweakUI's, with its parameters but the cache buster, and the task's version when given", () => {
    expect(mapTiles.cachedUrl("/api/projects/3/tasks/ab-12/orthophoto/tiles/18/1/2?rescale=0%2C255&size=512&cache=99&crop=1"))
        .toBe("/api/plugins/tweakui/tiles/3/ab-12/orthophoto/18/1/2?rescale=0%2C255&size=512&crop=1");
    expect(mapTiles.cachedUrl("http://host:8000/api/projects/3/tasks/t/dsm/tiles/18/1/2.png?cache=1"))
        .toBe("http://host:8000/api/plugins/tweakui/tiles/3/t/dsm/18/1/2.png");
    expect(mapTiles.cachedUrl("/api/projects/3/tasks/t/dtm/tiles/18/1/2@2x.webp", "abc"))
        .toBe("/api/plugins/tweakui/tiles/3/t/dtm/18/1/2@2x.webp?v=abc");
    expect(mapTiles.cachedUrl("/api/projects/3/tasks/t/dtm/tiles/18/1/2?size=512", "abc"))
        .toBe("/api/plugins/tweakui/tiles/3/t/dtm/18/1/2?size=512&v=abc");
    expect(mapTiles.cachedUrl("https://tile.openstreetmap.org/18/1/2.png")).toBeNull();
    expect(mapTiles.cachedUrl("/api/projects/3/tasks/t/textured_model/tiles/1/2/3")).toBeNull();
    expect(mapTiles.taskOf(TILES)).toEqual({project: "3", task: "ab-12"});
    expect(mapTiles.withoutCacheParam("/a?cached=1&cache=2")).toBe("/a?cached=1");
});

test("Tile Cache: a layer WebODM adds asks TweakUI for its tiles, also after WebODM gives it a new URL; a base map doesn't", () => {
    const map = fakeMap(), layer = fakeLayer(TILES), basemap = fakeLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    mapTiles.attach(map, opts({tile_cache: true}));
    map.addLayer(layer);
    map.addLayer(basemap);
    expect(map.added).toEqual([layer, basemap]);
    expect(layer.getTileUrl(at)).toBe("/api/plugins/tweakui/tiles/3/ab-12/orthophoto/18/64084/92370?rescale=0%2C255&size=512&crop=1");
    expect(basemap.getTileUrl(at)).toBe("https://tile.openstreetmap.org/18/64084/92370.png");
    layer.setUrl("/api/projects/3/tasks/ab-12/orthophoto/tiles/{z}/{x}/{y}?color_map=viridis&cache=5");
    expect(layer.getTileUrl(at)).toBe("/api/plugins/tweakui/tiles/3/ab-12/orthophoto/18/64084/92370?color_map=viridis");
    expect(layer.options.updateWhenZooming).toBe(true);
    expect(layer.options.keepBuffer).toBe(2);
});

test("Reuse Browser Copies: the task's version is asked once, and the tiles asked for once it comes carry it", async () => {
    const fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({version: "0123abcd"})}));
    const known = mapTiles.versions(fetch), map = fakeMap(), layer = fakeLayer(TILES), again = fakeLayer(TILES);
    mapTiles.attach(map, opts({tile_cache: true, reuse_browser_copies: true}), known);
    map.addLayer(layer);
    expect(layer.getTileUrl(at)).not.toMatch(/v=/);
    await flush();
    map.addLayer(again);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/plugins/tweakui/tiles/3/ab-12/version");
    expect(layer.getTileUrl(at)).toBe("/api/plugins/tweakui/tiles/3/ab-12/orthophoto/18/64084/92370?rescale=0%2C255&size=512&crop=1&v=0123abcd");
});

test("a version that can't be had leaves the tiles as with Tile Cache alone", async () => {
    const known = mapTiles.versions(jest.fn(() => Promise.resolve({ok: false, status: 403})));
    known.ask("3", "ab-12");
    await flush();
    expect(known.get("ab-12")).toBeNull();
});

test("a layer already on the map is changed and redrawn, once, and a map is wrapped once", () => {
    const layer = fakeLayer(TILES), map = fakeMap([layer]);
    mapTiles.attach(map, opts({tile_cache: true}));
    mapTiles.attach(map, opts({tile_cache: true}));
    expect(layer.redraw).toHaveBeenCalledTimes(1);
    map.addLayer(layer);
    expect(layer.getTileUrl(at)).toMatch(/^\/api\/plugins\/tweakui\/tiles\/3\/ab-12\/orthophoto\/18\/64084\/92370\?/);
});

test("Fewer Tile Requests: a layer waits for a zoom to end, its URL and kept tiles WebODM's", () => {
    const map = fakeMap(), layer = fakeLayer(TILES);
    mapTiles.attach(map, opts({fewer_tile_requests: true}));
    map.addLayer(layer);
    expect(layer.options.updateWhenZooming).toBe(false);
    expect(layer.options.keepBuffer).toBe(2);
    expect(layer.getTileUrl(at)).toMatch(/^\/api\/projects\/3\//);
});

test("Load Ahead: a layer loads the tiles within that share of the view beyond each edge", () => {
    const map = fakeMap(), layer = fakeLayer(TILES);
    mapTiles.attach(map, opts({load_ahead: 50}));
    map.addLayer(layer);
    const b = layer._getTiledPixelBounds(new Point(10000, 10000));
    expect([b.min.x, b.min.y, b.max.x, b.max.y]).toEqual([10000 - 700 - 700, 10000 - 450 - 450, 10000 + 700 + 700, 10000 + 450 + 450]);
    expect(b.getCenter()).toEqual(new Point(10000, 10000));
    // Between zoom levels, in the layer's own tile pixels
    map.getZoomScale = () => 2;
    const half = layer._getTiledPixelBounds(new Point(0, 0));
    expect(half.max.x).toBe(700 + 350);
    // Anything amiss: Leaflet's own bounds, the error logged
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    map.getSize = () => { throw new Error("no size"); };
    expect(layer._getTiledPixelBounds(new Point(0, 0)).max.x).toBe(700);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
});

// Events as Leaflet's layers and map have them
function events(obj) {
    const on = {};
    obj.on = function (type, fn) {
        if (typeof type === "object") Object.keys(type).forEach(t => this.on(t, type[t]));
        else (on[type] = on[type] || []).push(fn);
        return this;
    };
    obj.off = function (type) {
        if (typeof type === "object") Object.keys(type).forEach(t => { on[t] = (on[t] || []).filter(f => f !== type[t]); });
        return this;
    };
    obj.fire = function (type) { (on[type] || []).slice().forEach(fn => fn.call(this)); return this; };
    return obj;
}

test("Load Ahead: the tiles in view load first, those beyond once they have, and a move cancels those beyond still loading", () => {
    // A layer whose _update creates tiles as Leaflet 1.3.1's does: those in its _getTiledPixelBounds' range that
    // _isValidTile allows and that it doesn't have yet
    const layer = events(Object.assign(fakeLayer(TILES), {
        _tiles: {}, _tileZoom: 18, removed: [],
        _tileCoordsToKey(c) { return c.x + ":" + c.y + ":" + c.z; },
        _pxBoundsToTileRange(b) {
            return new Bounds(new Point(Math.floor(b.min.x / 512), Math.floor(b.min.y / 512)),
                              new Point(Math.ceil(b.max.x / 512) - 1, Math.ceil(b.max.y / 512) - 1));
        },
        _isValidTile() { return true; },
        _noTilesToLoad() { return Object.values(this._tiles).every(t => t.loaded); },
        _removeTile(key) { this.removed.push(key); delete this._tiles[key]; },
        _update(center) {
            const r = this._pxBoundsToTileRange(this._getTiledPixelBounds(center || this._map.getCenter()));
            for (let y = r.min.y; y <= r.max.y; y++) {
                for (let x = r.min.x; x <= r.max.x; x++) {
                    const c = new Point(x, y); c.z = this._tileZoom;
                    if (this._isValidTile(c) && !this._tiles[this._tileCoordsToKey(c)]) this._tiles[this._tileCoordsToKey(c)] = {coords: c, loaded: 0};
                }
            }
        }
    }));
    const map = events(fakeMap());
    map.getCenter = () => new Point(5120, 5120);
    const loadAll = () => { Object.values(layer._tiles).forEach(t => { t.loaded = 1; }); layer.fire("load"); };
    mapTiles.attach(map, opts({load_ahead: 50}), null, {setTimeout: fn => fn()});
    map.addLayer(layer);
    layer.fire("add");
    // In view: tiles 8 to 11 across, 9 and 10 down; beyond, half the view more each side: 7 to 12 and 8 to 11
    layer._update();
    expect(Object.keys(layer._tiles)).toHaveLength(4 * 2);
    loadAll();
    expect(Object.keys(layer._tiles)).toHaveLength(6 * 4);
    // A move: the 16 beyond still loading are cancelled, and none beyond is asked for while it lasts
    map.fire("movestart");
    expect(layer.removed).toHaveLength(16);
    layer._update();
    expect(Object.keys(layer._tiles)).toHaveLength(8);
    // Once it ends with nothing left to load, those beyond again; loaded ones beyond stay through the next move
    map.fire("moveend");
    expect(Object.keys(layer._tiles)).toHaveLength(24);
    loadAll();
    map.fire("movestart");
    expect(layer.removed).toHaveLength(16);
    expect(Object.keys(layer._tiles)).toHaveLength(24);
    // Off the map, the map's moves are none of its business
    layer.fire("remove");
    map.fire("moveend");
    map.fire("movestart");
    expect(layer.removed).toHaveLength(16);
});

test("Keep More Tiles: WebODM's 2 rows plus that share of the view's larger side in tiles, as the view and tiles are now", () => {
    expect(mapTiles.keepRows(1400, 512, 0)).toBe(2);
    expect(mapTiles.keepRows(1400, 512, 0.25)).toBe(3);
    expect(mapTiles.keepRows(1400, 256, 1)).toBe(2 + 6);
    const map = fakeMap(), layer = fakeLayer(TILES);
    mapTiles.attach(map, opts({keep_more_tiles: 100}));
    map.addLayer(layer);
    expect(layer.options.keepBuffer).toBe(2 + 3);
    layer.getTileSize = () => new Point(256, 256);
    expect(layer.options.keepBuffer).toBe(2 + 6);
    layer.options.keepBuffer = 9;
    expect(layer.options.keepBuffer).toBe(2 + 6);
});

describe("Fade-in Speed", () => {
    function fading(ms) {
        const frames = [];
        const win = {requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame: jest.fn()};
        const map = fakeMap(), layer = fakeLayer(TILES);
        mapTiles.attach(map, opts({fade_in_speed: ms}), null, win);
        map.addLayer(layer);
        const tile = {current: true, loaded: Date.now() - 60, el: {style: {}}};
        Object.assign(layer, {_container: {style: {}}, _tiles: {a: tile}, _noPrune: false, _onOpaqueTile: jest.fn(), _pruneTiles: jest.fn()});
        layer._updateOpacity();
        return {layer, tile, frames};
    }

    test("at 0 a tile shows at once", () => {
        const {tile, frames, layer} = fading(0);
        expect(tile.el.style.opacity).toBe(1);
        expect(tile.active).toBe(true);
        expect(layer._onOpaqueTile).toHaveBeenCalledWith(tile);
        expect(frames).toHaveLength(0);
    });

    test("at 100 ms a tile 60 ms old is part way and fades on the next frame", () => {
        const {tile, frames} = fading(100);
        expect(tile.el.style.opacity).toBeCloseTo(0.6, 1);
        expect(tile.active).toBeUndefined();
        expect(frames).toHaveLength(1);
    });

    test("at 200 ms, WebODM's own, Leaflet's method is left alone", () => {
        const layer = fakeLayer(TILES), own = function () {};
        layer._updateOpacity = own;
        const map = fakeMap();
        mapTiles.attach(map, opts({fade_in_speed: 200, tile_cache: true}));
        map.addLayer(layer);
        expect(layer._updateOpacity).toBe(own);
    });
});

test("the map hook is used only when a setting differs from WebODM's own, and asks the map's tasks' versions", async () => {
    const hook = jest.fn();
    const fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({version: "v1"})}));
    const win = settings => ({TweakUI: {settings: settingsWith(settings)}, PluginsAPI: {Map: {didAddControls: hook}}, document: {}, fetch});
    mapTiles.start({}, win({}));
    mapTiles.start({}, win({reuse_browser_copies: true}));
    expect(hook).not.toHaveBeenCalled();
    mapTiles.start({}, win({fade_in_speed: 50}));
    mapTiles.start({}, win({tile_cache: true, reuse_browser_copies: true}));
    expect(hook).toHaveBeenCalledTimes(2);
    const map = fakeMap(), layer = fakeLayer(TILES);
    hook.mock.calls[1][0]({map, tiles: [{meta: {task: {id: "ab-12", project: 3}}}]});
    expect(fetch).toHaveBeenCalledWith("/api/plugins/tweakui/tiles/3/ab-12/version", {credentials: "same-origin"});
    await flush();
    map.addLayer(layer);
    expect(layer.getTileUrl(at)).toMatch(/&v=v1$/);
    expect(fetch).toHaveBeenCalledTimes(1);
});
