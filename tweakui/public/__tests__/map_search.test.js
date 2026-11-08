const core = require("../core");
const mapSearch = require("../map_search");

const flush = () => new Promise(r => setTimeout(r, 0));

// Leaflet as far as the control uses it
function fakeLeaflet() {
    return {
        circleMarker: jest.fn((at, options) => ({at, options, addTo(map) { map.layers.push(this); return this; }})),
        Control: {extend: proto => function () { this.options = proto.options; this.onAdd = proto.onAdd; }},
        DomEvent: {disableClickPropagation: jest.fn(), disableScrollPropagation: jest.fn()}
    };
}
function fakeMap() {
    const map = {layers: [], addControl: jest.fn(), flyTo: jest.fn(), flyToBounds: jest.fn(), getZoom: () => 12};
    map.removeLayer = jest.fn(l => { map.layers = map.layers.filter(x => x !== l); });
    return map;
}

const answer = [
    {display_name: "Duluth, St. Louis County, Minnesota, United States", lat: "46.7729", lon: "-92.1251",
        boundingbox: ["46.6505", "46.8636", "-92.3009", "-91.9934"]},
    {display_name: "Duluth, Gwinnett County, Georgia, United States", lat: "34.0029", lon: "-84.1446",
        boundingbox: ["34.0029", "34.0029", "-84.1446", "-84.1446"]}
];
const json = (data, ok = true, status = 200) => Promise.resolve({ok, status, json: () => Promise.resolve(data)});

function control(fetchFn) {
    const L = fakeLeaflet(), map = fakeMap();
    const c = mapSearch.build(document, window, L, map, fetchFn || jest.fn(() => json(answer)));
    document.body.innerHTML = "";
    document.body.appendChild(c.container);
    return Object.assign(c, {L, map, input: c.container.querySelector("input")});
}

beforeAll(() => { core.install(window); });
afterEach(() => { jest.useRealTimers(); });

describe("coordinates", () => {
    const at = text => mapSearch.parseCoordinates(text);
    const near = (c, lat, lon) => {
        expect(c).not.toBeNull();
        expect(c.lat).toBeCloseTo(lat, 5);
        expect(c.lon).toBeCloseTo(lon, 5);
    };

    test("decimal degrees, with a comma or a space, latitude first", () => {
        near(at("46.84, -91.99"), 46.84, -91.99);
        near(at("  46.84 -91.99 "), 46.84, -91.99);
        near(at("-33.8688,151.2093"), -33.8688, 151.2093);
        near(at("+46 +91"), 46, 91);
    });

    test("hemisphere letters before or after, which also set the order", () => {
        near(at("46.84 N 91.99 W"), 46.84, -91.99);
        near(at("46.84n, 91.99w"), 46.84, -91.99);
        near(at("S33.8688 E151.2093"), -33.8688, 151.2093);
        near(at("91.99W 46.84N"), 46.84, -91.99);
        near(at("91, 46.84 N"), 46.84, 91);
    });

    test("degrees, minutes and seconds, or degrees and decimal minutes", () => {
        near(at("46°50'24\"N 91°59'24\"W"), 46.84, -91.99);
        near(at("46° 50′ 24″ N, 91° 59′ 24″ W"), 46.84, -91.99);
        near(at("46 50 24 N 91 59 24 W"), 46.84, -91.99);
        near(at("46°50.4'N 91°59.4'W"), 46.84, -91.99);
        near(at("-46°50'24\" 91°59'24\""), -46.84, 91.99);
    });

    test("anything else is a place to search for", () => {
        ["Duluth", "10 Downing Street, London", "55802", "46.84", "New York", "46.84 N 91.99 N", "N 46.84 W",
            "-46.84 N, 91.99 W", "46 60 00 N 91 00 00 W", "46.5 30 N 91 0 W", "1, 2, 3", ""]
            .forEach(text => expect([text, at(text)]).toEqual([text, null]));
    });

    test("a latitude past 90 or a longitude past 180 isn't coordinates", () => {
        expect(at("91, 10")).toBeNull();
        expect(at("10, 181")).toBeNull();
        near(at("-90, 180"), -90, 180);
    });
});

describe("the search box", () => {
    test("the button opens the box with its field focused; Close and Escape close it", () => {
        const c = control();
        c.container.querySelector(".tweakui-map-search-button").click();
        expect(c.container.classList.contains("open")).toBe(true);
        expect(document.activeElement).toBe(c.input);
        expect(c.input.placeholder).toBe("Address or Coordinates");
        c.container.querySelector(".tweakui-map-search-close").click();
        expect(c.container.classList.contains("open")).toBe(false);
        c.open();
        c.input.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
        expect(c.container.classList.contains("open")).toBe(false);
    });

    test("coordinates fly there with a marker and send no request", async () => {
        const fetchFn = jest.fn();
        const c = control(fetchFn);
        c.open();
        c.input.value = "46°50'24\"N 91°59'24\"W";
        c.container.querySelector("form").dispatchEvent(new Event("submit", {cancelable: true}));
        await flush();
        expect(fetchFn).not.toHaveBeenCalled();
        expect(c.map.flyTo).toHaveBeenCalledWith([expect.closeTo(46.84, 5), expect.closeTo(-91.99, 5)], 18, {duration: 1.5});
        expect(c.map.layers).toHaveLength(1);
        expect(c.container.querySelector(".tweakui-map-search-status").textContent).toBe("46.84, -91.99");
    });

    test("a place is asked of Nominatim, its results listed, and the first one's box shown", async () => {
        const fetchFn = jest.fn(() => json(answer));
        const c = control(fetchFn);
        c.open();
        await c.search("Duluth & Co");
        expect(fetchFn).toHaveBeenCalledWith("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=Duluth%20%26%20Co",
            {headers: {Accept: "application/json"}});
        const links = Array.from(c.container.querySelectorAll(".tweakui-map-search-results a"));
        expect(links.map(a => a.textContent)).toEqual([answer[0].display_name, answer[1].display_name]);
        expect(c.container.querySelector("li.active a")).toBe(links[0]);
        expect(c.map.flyToBounds).toHaveBeenCalledWith([[46.6505, -92.3009], [46.8636, -91.9934]], {maxZoom: 18, duration: 1.5});
        expect(c.container.querySelector(".tweakui-map-search-status").textContent).toBe("Search by OpenStreetMap Nominatim");
        // Another result: its point (its box is a point), with the marker moved there
        links[1].click();
        expect(c.map.flyTo).toHaveBeenCalledWith([34.0029, -84.1446], 18, {duration: 1.5});
        expect(c.map.layers).toHaveLength(1);
        expect(c.map.layers[0].at).toEqual([34.0029, -84.1446]);
        // Closing takes the marker away
        c.close();
        expect(c.map.layers).toHaveLength(0);
    });

    test("searches are at least a second apart, and a search asked again is answered from memory", async () => {
        jest.useFakeTimers();
        const fetchFn = jest.fn(() => json(answer));
        const c = control(fetchFn);
        await jest.advanceTimersByTimeAsync(0);
        const first = c.search("Duluth");
        await jest.advanceTimersByTimeAsync(0);
        await first;
        expect(fetchFn).toHaveBeenCalledTimes(1);
        const second = c.search("Superior");
        await jest.advanceTimersByTimeAsync(500);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(c.container.querySelector(".tweakui-map-search-go").disabled).toBe(true);
        await jest.advanceTimersByTimeAsync(600);
        await second;
        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(c.container.querySelector(".tweakui-map-search-go").disabled).toBe(false);
        await c.search("Duluth");
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    test("nothing found and a failed search say so", async () => {
        const c = control(jest.fn(() => json([])));
        await c.search("Nowhere at all");
        expect(c.container.querySelector(".tweakui-map-search-status").textContent).toBe("Nothing found.");
        expect(c.map.flyTo).not.toHaveBeenCalled();
        const d = control(jest.fn(() => json({}, false, 503)));
        await d.search("Duluth");
        expect(d.container.querySelector(".tweakui-map-search-status").textContent).toBe("Could not search: Error 503");
        expect(d.container.querySelector(".tweakui-map-search-go").disabled).toBe(false);
    });

    test("result names are set as text", async () => {
        const c = control(jest.fn(() => json([{display_name: "<b>x</b>", lat: "1", lon: "2"}])));
        await c.search("x");
        expect(c.container.querySelector("b")).toBeNull();
        expect(c.container.querySelector(".tweakui-map-search-results a").textContent).toBe("<b>x</b>");
    });
});

describe("on the map", () => {
    test("the control goes in the bottom left corner, above the zoom buttons", () => {
        const L = fakeLeaflet(), map = fakeMap();
        const c = mapSearch.add({map}, L, document, window);
        const added = map.addControl.mock.calls[0][0];
        expect(added.options.position).toBe("bottomleft");
        expect(added.onAdd()).toBe(c.container);
        expect(mapSearch.add({}, L, document, window)).toBeNull();
    });

    test("it waits for the map hook only when the setting is on", () => {
        const hook = jest.fn();
        mapSearch.start(document, {TweakUI: {settings: {map_search: false}}, PluginsAPI: {Map: {didAddControls: hook}}});
        expect(hook).not.toHaveBeenCalled();
        mapSearch.start(document, {TweakUI: {settings: {map_search: true}}, PluginsAPI: {Map: {didAddControls: hook}}});
        expect(hook).toHaveBeenCalledWith(["leaflet"], expect.any(Function));
    });
});
