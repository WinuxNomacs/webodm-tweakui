const tileCache = require("../tile_cache");

const TILES = "/api/projects/3/tasks/ab-12/orthophoto/tiles/{z}/{x}/{y}?rescale=0%2C255&size=512&cache=123456&crop=1";

// A Leaflet tile layer as far as the script uses it: getTileUrl fills the template
function fakeLayer(url, options) {
    return {
        _url: url,
        options: Object.assign({updateWhenZooming: true, keepBuffer: 2}, options),
        redraw: jest.fn(),
        getTileUrl(c) { return this._url.replace("{z}", c.z).replace("{x}", c.x).replace("{y}", c.y); },
        setUrl(u) { this._url = u; }
    };
}
function fakeMap(layers) {
    return {
        added: [],
        addLayer(layer) { this.added.push(layer); return this; },
        eachLayer(fn) { (layers || []).forEach(fn); }
    };
}
const at = {z: 18, x: 64084, y: 92370};

test("a WebODM tile URL becomes TweakUI's, with its parameters but the cache buster", () => {
    expect(tileCache.cachedUrl("/api/projects/3/tasks/ab-12/orthophoto/tiles/18/1/2?rescale=0%2C255&size=512&cache=99&crop=1"))
        .toBe("/api/plugins/tweakui/tiles/3/ab-12/orthophoto/18/1/2?rescale=0%2C255&size=512&crop=1");
    expect(tileCache.cachedUrl("http://host:8000/api/projects/3/tasks/t/dsm/tiles/18/1/2.png?cache=1"))
        .toBe("http://host:8000/api/plugins/tweakui/tiles/3/t/dsm/18/1/2.png");
    expect(tileCache.cachedUrl("/api/projects/3/tasks/t/dtm/tiles/18/1/2@2x.webp"))
        .toBe("/api/plugins/tweakui/tiles/3/t/dtm/18/1/2@2x.webp");
    expect(tileCache.cachedUrl("https://tile.openstreetmap.org/18/1/2.png")).toBeNull();
    expect(tileCache.cachedUrl("/api/projects/3/tasks/t/textured_model/tiles/1/2/3")).toBeNull();
    expect(tileCache.withoutCacheParam("/a?cache=1")).toBe("/a");
    expect(tileCache.withoutCacheParam("/a?cached=1&cache=2")).toBe("/a?cached=1");
});

test("Tile Cache: a layer WebODM adds asks TweakUI for its tiles, also after WebODM gives it a new URL", () => {
    const map = fakeMap(), layer = fakeLayer(TILES), basemap = fakeLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    tileCache.attach(map, {cache: true, fewer: false});
    map.addLayer(layer);
    map.addLayer(basemap);
    expect(map.added).toEqual([layer, basemap]);
    expect(layer.getTileUrl(at)).toBe("/api/plugins/tweakui/tiles/3/ab-12/orthophoto/18/64084/92370?rescale=0%2C255&size=512&crop=1");
    expect(basemap.getTileUrl(at)).toBe("https://tile.openstreetmap.org/18/64084/92370.png");
    layer.setUrl("/api/projects/3/tasks/ab-12/orthophoto/tiles/{z}/{x}/{y}?color_map=viridis&cache=5");
    expect(layer.getTileUrl(at)).toBe("/api/plugins/tweakui/tiles/3/ab-12/orthophoto/18/64084/92370?color_map=viridis");
    expect(layer.options).toEqual({updateWhenZooming: true, keepBuffer: 2});
});

test("a layer already on the map is changed and redrawn, once, and a map is wrapped once", () => {
    const layer = fakeLayer(TILES), map = fakeMap([layer]);
    tileCache.attach(map, {cache: true, fewer: false});
    tileCache.attach(map, {cache: true, fewer: false});
    expect(layer.redraw).toHaveBeenCalledTimes(1);
    map.addLayer(layer);
    expect(layer.getTileUrl(at)).toMatch(/^\/api\/plugins\/tweakui\/tiles\/3\/ab-12\/orthophoto\/18\/64084\/92370\?/);
});

test("Fewer Tile Requests: a layer waits for a zoom to end and keeps more tiles around the view, its URL WebODM's", () => {
    const map = fakeMap(), layer = fakeLayer(TILES);
    tileCache.attach(map, {cache: false, fewer: true});
    map.addLayer(layer);
    expect(layer.options).toEqual({updateWhenZooming: false, keepBuffer: 4});
    expect(layer.getTileUrl(at)).toBe("/api/projects/3/tasks/ab-12/orthophoto/tiles/18/64084/92370?rescale=0%2C255&size=512&cache=123456&crop=1");
    const already = fakeLayer(TILES), other = fakeMap([already]);
    tileCache.attach(other, {cache: false, fewer: true});
    expect(already.options.updateWhenZooming).toBe(false);
    expect(already.redraw).not.toHaveBeenCalled();
});

test("the map hook is used only when one of the two settings is on", () => {
    const hook = jest.fn();
    const win = (settings) => ({TweakUI: {settings}, PluginsAPI: {Map: {didAddControls: hook}}, document: {}});
    tileCache.start({}, win({tile_cache: false, fewer_tile_requests: false}));
    expect(hook).not.toHaveBeenCalled();
    tileCache.start({}, win({tile_cache: true}));
    tileCache.start({}, win({fewer_tile_requests: true}));
    expect(hook).toHaveBeenCalledTimes(2);
    const map = fakeMap(), layer = fakeLayer(TILES);
    hook.mock.calls[0][0]({map});
    map.addLayer(layer);
    expect(layer.getTileUrl(at)).toMatch(/^\/api\/plugins\/tweakui\/tiles\//);
});
