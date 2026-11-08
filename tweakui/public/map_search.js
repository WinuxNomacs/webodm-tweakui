// 2D Map > Add Search Button: a magnifier button above the map's zoom buttons (bottom left) opens a search box.
// Coordinates (decimal degrees or degrees, minutes and seconds, with or without N/S/E/W) go straight there, with no
// request; anything else is asked of OpenStreetMap's Nominatim (which WebODM already asks for a photo's place name)
// when Enter is pressed, never as one types, and at most once a second, as its usage policy asks. Up to five results
// are listed and the first is shown. The map flies to the place, with a marker that goes when the box closes; Escape
// closes it. Leaflet comes from the map hook's dependencies, as WebODM's plugins get it. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "map_search", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: none (its control comes through the map hook,
    // with Leaflet's classes for its look)
    var SELECTORS = {};
    var NAME = "map_search";
    var el = ui.el;

    var NOMINATIM = "https://nominatim.openstreetmap.org/search";
    var LIMIT = 5;
    // Nominatim's usage policy: at most one request a second
    var INTERVAL = 1000;
    // How close a point (coordinates, or a result without a box) is shown
    var POINT_ZOOM = 18;
    // The flight there, in seconds, however far it goes (Leaflet's own takes longer the further it is)
    var FLIGHT = 1.5;

    // Coordinates

    // The text with its symbols made plain: upper case, one kind of degree, minute and second mark
    function normalize(text) {
        return String(text == null ? "" : text).toUpperCase()
            .replace(/[º˚]/g, "°").replace(/[′’‘`´]/g, "'").replace(/[″“”]|''/g, '"')
            .replace(/\s+/g, " ").trim();
    }

    // One coordinate: degrees, perhaps minutes and seconds, a sign or a hemisphere letter. {value, axis} or null
    var PART = /^([NSEW])?\s*([-+])?\s*(\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*'?\s*(?:(\d+(?:\.\d+)?)\s*"?)?)?\s*([NSEW])?$/;
    function parsePart(text) {
        var m = PART.exec(text.trim());
        if (!m || (m[1] && m[6]) || ((m[1] || m[6]) && m[2] === "-")) return null;
        var deg = parseFloat(m[3]), min = m[4] ? parseFloat(m[4]) : 0, sec = m[5] ? parseFloat(m[5]) : 0;
        // Minutes and seconds are under 60, and only the last part given may have decimals
        if (min >= 60 || sec >= 60) return null;
        if ((m[4] && m[3].indexOf(".") !== -1) || (m[5] && m[4].indexOf(".") !== -1)) return null;
        var letter = m[1] || m[6] || "";
        var value = deg + min / 60 + sec / 3600;
        if (m[2] === "-" || letter === "S" || letter === "W") value = -value;
        return {value: value, axis: letter === "N" || letter === "S" ? "lat" : letter ? "lon" : ""};
    }

    // The text cut into its two coordinates, or null
    function halves(s) {
        if (s.indexOf(",") !== -1) {
            var parts = s.split(",");
            return parts.length === 2 ? parts : null;
        }
        var letters = /[NSEW]/g, found = [], m;
        while ((m = letters.exec(s))) found.push(m.index);
        if (found.length === 2) {
            // Letters first ("N 46 W 91") or last ("46 N 91 W")
            var at = found[0] === 0 ? found[1] : found[0] + 1;
            return [s.slice(0, at), s.slice(at)];
        }
        if (found.length) return null;
        var degrees = [], d = /[-+]?\s*\d+(?:\.\d+)?\s*°/g;
        while ((m = d.exec(s))) degrees.push(m.index);
        if (degrees.length === 2) return [s.slice(0, degrees[1]), s.slice(degrees[1])];
        var words = s.split(" ");
        return words.length === 2 ? words : null;
    }

    // "46.84, -91.99", "46.84N 91.99W", "46°50'24"N 91°59'24"W" and the like as {lat, lon}; null when it isn't
    // coordinates (then it's a place to search for). Latitude comes first unless the letters say otherwise
    function parseCoordinates(text) {
        var s = normalize(text);
        var parts = s && halves(s);
        if (!parts) return null;
        var a = parsePart(parts[0]), b = parsePart(parts[1]);
        if (!a || !b) return null;
        if (a.axis === "lon" || b.axis === "lat") {
            if (a.axis === "lat" || b.axis === "lon") return null;
            var t = a; a = b; b = t;
        }
        if (Math.abs(a.value) > 90 || Math.abs(b.value) > 180) return null;
        return {lat: a.value, lon: b.value};
    }

    function formatCoordinates(c) {
        return c.lat.toFixed(6).replace(/\.?0+$/, "") + ", " + c.lon.toFixed(6).replace(/\.?0+$/, "");
    }

    // Nominatim

    function searchUrl(query) {
        return NOMINATIM + "?format=jsonv2&limit=" + LIMIT + "&q=" + encodeURIComponent(query);
    }

    // Nominatim's answer as places: {name, lat, lon, bounds: [[south, west], [north, east]] or null}
    function places(results) {
        return (Array.isArray(results) ? results : []).slice(0, LIMIT).map(function (r) {
            var b = r.boundingbox;
            var bounds = b && b.length === 4 ? [[+b[0], +b[2]], [+b[1], +b[3]]] : null;
            if (bounds && bounds.some(function (p) { return isNaN(p[0]) || isNaN(p[1]); })) bounds = null;
            return {name: r.display_name || r.name || "", lat: +r.lat, lon: +r.lon, bounds: bounds};
        }).filter(function (p) { return !isNaN(p.lat) && !isNaN(p.lon); });
    }

    // The control: the button, and the box it opens. Returns {container, open, close, search, state}
    function build(doc, win, L, map, fetchFn) {
        var container = el(doc, "div", "tweakui-map-search leaflet-bar leaflet-control");
        var button = el(doc, "a", "tweakui-map-search-button");
        button.href = "#";
        button.title = "Search";
        button.setAttribute("role", "button");
        button.setAttribute("aria-label", "Search");
        button.appendChild(el(doc, "i", "fa fa-search"));
        var box = el(doc, "form", "tweakui-map-search-box theme-background-highlight");
        box.setAttribute("role", "search");
        var row = el(doc, "div", "tweakui-map-search-row");
        var input = el(doc, "input", "form-control input-sm tweakui-map-search-input");
        input.type = "search";
        input.placeholder = "Address or Coordinates";
        input.setAttribute("aria-label", "Address or Coordinates");
        input.autocomplete = "off";
        var go = el(doc, "button", "btn btn-sm btn-primary tweakui-map-search-go");
        go.type = "submit";
        go.title = "Search";
        go.appendChild(el(doc, "i", "fa fa-search"));
        var close = el(doc, "button", "btn btn-sm btn-default tweakui-map-search-close");
        close.type = "button";
        close.title = "Close";
        close.setAttribute("aria-label", "Close");
        close.appendChild(el(doc, "i", "fa fa-times"));
        row.appendChild(input);
        row.appendChild(go);
        row.appendChild(close);
        var status = el(doc, "div", "tweakui-map-search-status");
        status.setAttribute("aria-live", "polite");
        var list = el(doc, "ul", "tweakui-map-search-results list-unstyled");
        box.appendChild(row);
        box.appendChild(status);
        box.appendChild(list);
        container.appendChild(button);
        container.appendChild(box);
        if (L.DomEvent) {
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);
        }

        var state = {open: false, marker: null, results: [], last: 0, cache: {}, pending: null};

        function setStatus(text, className) {
            status.textContent = text || "";
            status.className = "tweakui-map-search-status" + (className ? " " + className : "");
        }

        function clearMarker() {
            if (state.marker) map.removeLayer(state.marker);
            state.marker = null;
        }

        function show(place) {
            clearMarker();
            // Yellow, as Source Frames' spot on the map: it must show on any imagery, not follow the theme
            state.marker = L.circleMarker([place.lat, place.lon], {
                radius: 10, color: "#ffeb3b", weight: 4, fillOpacity: 0.3, interactive: false, className: "tweakui-map-search-marker"
            }).addTo(map);
            if (place.bounds && (place.bounds[0][0] !== place.bounds[1][0] || place.bounds[0][1] !== place.bounds[1][1])) {
                map.flyToBounds(place.bounds, {maxZoom: POINT_ZOOM, duration: FLIGHT});
            } else {
                map.flyTo([place.lat, place.lon], Math.max(map.getZoom(), POINT_ZOOM), {duration: FLIGHT});
            }
        }

        function choose(i) {
            var items = list.children;
            for (var j = 0; j < items.length; j++) items[j].className = j === i ? "active" : "";
            show(state.results[i]);
        }

        function listResults(results) {
            state.results = results;
            list.textContent = "";
            results.forEach(function (place, i) {
                var item = el(doc, "li");
                var link = el(doc, "a", "", place.name);
                link.href = "#";
                link.title = place.name;
                link.addEventListener("click", function (e) { e.preventDefault(); choose(i); });
                item.appendChild(link);
                list.appendChild(item);
            });
        }

        function found(results) {
            listResults(results);
            if (!results.length) return setStatus("Nothing found.", "text-muted");
            setStatus("Search by OpenStreetMap Nominatim", "text-muted small");
            choose(0);
        }

        // Asks Nominatim, waiting first when the last request was under a second ago
        function ask(query) {
            if (state.cache[query]) return Promise.resolve(found(state.cache[query]));
            var wait = Math.max(0, state.last + INTERVAL - Date.now());
            setStatus("Searching...", "text-muted");
            go.disabled = true;
            var mine = state.pending = {};
            return new Promise(function (resolve) { win.setTimeout(resolve, wait); }).then(function () {
                if (state.pending !== mine) return null;
                state.last = Date.now();
                return fetchFn(searchUrl(query), {headers: {Accept: "application/json"}}).then(function (res) {
                    if (!res.ok) throw new Error("Error " + res.status);
                    return res.json();
                }).then(function (json) {
                    if (state.pending !== mine) return;
                    state.cache[query] = places(json);
                    found(state.cache[query]);
                }, function (e) {
                    if (state.pending !== mine) return;
                    listResults([]);
                    setStatus("Could not search: " + e.message, "text-danger");
                });
            }).then(function () {
                if (state.pending === mine) {
                    state.pending = null;
                    go.disabled = false;
                }
            });
        }

        function search(text) {
            var query = String(text == null ? input.value : text).trim();
            if (!query) return Promise.resolve();
            var c = parseCoordinates(query);
            if (c) {
                state.pending = null;
                go.disabled = false;
                listResults([]);
                setStatus(formatCoordinates(c), "text-muted");
                show({lat: c.lat, lon: c.lon, bounds: null});
                return Promise.resolve();
            }
            return ask(query);
        }

        function open() {
            state.open = true;
            container.className = "tweakui-map-search leaflet-bar leaflet-control open";
            input.focus();
        }

        function hide() {
            state.open = false;
            state.pending = null;
            go.disabled = false;
            container.className = "tweakui-map-search leaflet-bar leaflet-control";
            clearMarker();
        }

        button.addEventListener("click", ui.guard(NAME, function (e) { e.preventDefault(); open(); }));
        close.addEventListener("click", ui.guard(NAME, hide));
        box.addEventListener("submit", ui.guard(NAME, function (e) { e.preventDefault(); search(); }));
        box.addEventListener("keydown", ui.guard(NAME, function (e) {
            if (e.key === "Escape" || e.key === "Esc") {
                e.preventDefault();
                hide();
                button.focus();
            }
        }));

        return {container: container, open: open, close: hide, search: search, state: state};
    }

    // On any 2D map, adds the control above the zoom buttons (Leaflet stacks a bottom corner's later controls on top)
    function add(args, L, doc, win) {
        if (!args || !args.map) return null;
        var control = build(doc, win, L, args.map, function (url, options) { return win.fetch(url, options); });
        var Control = L.Control.extend({
            options: {position: "bottomleft"},
            onAdd: function () { return control.container; }
        });
        args.map.addControl(new Control());
        return control;
    }

    function start(doc, win) {
        if (!ui.settingsOf(win).map_search || !win.PluginsAPI || !win.PluginsAPI.Map) return;
        win.PluginsAPI.Map.didAddControls(["leaflet"], ui.guard(NAME, function (args, L) { add(args, L, doc, win); }));
    }

    return {start: start, add: add, build: build, parseCoordinates: parseCoordinates, places: places,
        searchUrl: searchUrl, SELECTORS: SELECTORS};
});
