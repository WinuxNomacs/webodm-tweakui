// 2D Map > Other Tasks: on a task's map (not a project's map, which has every task's layers), a button below Layers
// opens an "Other Tasks" panel: the project's other tasks with an orthophoto, each with a checkbox that shows its
// orthophoto over the task's own layers (cropped as its task is) and an opacity slider. None is shown on opening and
// nothing is remembered. The panel takes the classes of WebODM's Layers panel, so it looks like it (and Movable
// Controls drags it by its title). Leaflet comes from the map hook's dependencies, as WebODM's plugins get it; the
// layers are built as WebODM's map builds an orthophoto's (Map.jsx: 512-px tiles, rescaled to the RGB bands'
// statistics). UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.document) api.start(root.document, root);
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    var TILESIZE = 512;
    // Above the task's own layers (WebODM gives them 11 to 14)
    var ZINDEX = 100;

    // The task of a task's map (/map/project/<p>/task/<t>/), from the map's tiles; null on any other map
    function mapTask(tiles, pathname) {
        if (!/^\/map\/project\/\d+\/task\/[^/]+\/?$/.test(pathname || "")) return null;
        var task = null;
        for (var i = 0; i < (tiles || []).length; i++) {
            var t = tiles[i] && tiles[i].meta && tiles[i].meta.task;
            if (!t) continue;
            if (task && String(task.id) !== String(t.id)) return null;
            task = t;
        }
        return task && task.project !== undefined ? task : null;
    }

    function hasBands(bands, names) {
        if (!bands) return false;
        return names.every(function (n) {
            return bands.some(function (b) { return b.description && b.description.toLowerCase() === n; });
        });
    }

    // The orthophoto's tile URL with WebODM's parameters: its size, the crop, and the rescale of its values (the RGB
    // bands' min and max when it has them, all bands' otherwise)
    function tileUrl(task, meta) {
        var url = meta.tiles[0], params = {size: TILESIZE};
        var stats = meta.statistics;
        if (stats) {
            if (stats["1"]) {
                var bands = Object.keys(stats), min = Infinity, max = -Infinity;
                if (hasBands(task.orthophoto_bands, ["red", "green", "blue"])) {
                    var names = task.orthophoto_bands.map(function (b) { return (b.description || "").toLowerCase(); });
                    bands = ["red", "green", "blue"].map(function (n) { return String(names.indexOf(n) + 1); });
                }
                bands.forEach(function (b) {
                    if (!stats[b]) return;
                    min = Math.min(min, stats[b].min);
                    max = Math.max(max, stats[b].max);
                });
                params.rescale = min + "," + max;
            } else params.rescale = "-1,1";
        }
        if (task.crop) params.crop = 1;
        var at = url.indexOf("?"), query = at === -1 ? "" : url.slice(at + 1), base = at === -1 ? url : url.slice(0, at);
        var pairs = query ? query.split("&").filter(function (p) {
            return Object.prototype.hasOwnProperty.call(params, decodeURIComponent(p.split("=")[0])) === false;
        }) : [];
        Object.keys(params).forEach(function (k) { pairs.push(k + "=" + encodeURIComponent(params[k])); });
        return base + "?" + pairs.join("&");
    }

    function layerFor(L, task, meta, index) {
        var b = meta.bounds.value;
        return L.tileLayer(tileUrl(task, meta), {
            bounds: L.latLngBounds([[b[1], b[0]], [b[3], b[2]]]),
            minZoom: 0,
            maxZoom: meta.maxzoom + 99,
            maxNativeZoom: meta.maxzoom - 1,
            tileSize: TILESIZE,
            tms: meta.scheme === "tms",
            detectRetina: true,
            zIndex: ZINDEX + index
        });
    }

    function el(doc, tag, className, text) {
        var e = doc.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function getJSON(fetchFn, url) {
        return fetchFn(url, {credentials: "same-origin"}).then(function (res) {
            if (!res.ok) throw new Error("Error " + res.status);
            return res.json();
        });
    }

    // The control: the button, and the panel it opens. Returns {container, open, close}
    function build(doc, L, map, task, fetchFn) {
        var container = el(doc, "div", "leaflet-control-layers-control tweakui-other-tasks leaflet-bar leaflet-control");
        var wrapper = el(doc, "div");
        var button = el(doc, "a", "leaflet-bar-part theme-secondary tweakui-other-tasks-button");
        button.href = "#";
        button.title = "Other Tasks";
        button.setAttribute("role", "button");
        button.appendChild(el(doc, "i", "fa fa-images"));
        var panel = el(doc, "div", "layers-control-panel tweakui-other-tasks-panel");
        var close = el(doc, "span", "close-button");
        close.title = "Close";
        panel.appendChild(close);
        panel.appendChild(el(doc, "div", "title", "Other Tasks"));
        panel.appendChild(el(doc, "hr"));
        var list = el(doc, "div", "tweakui-other-tasks-list");
        panel.appendChild(list);
        wrapper.appendChild(button);
        wrapper.appendChild(panel);
        container.appendChild(wrapper);
        if (L.DomEvent) {
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);
        }

        var loaded = false, layers = {};

        function message(text, className) {
            list.textContent = "";
            list.appendChild(el(doc, "div", "tweakui-other-tasks-message" + (className ? " " + className : ""), text));
        }

        function show(t, index, checkbox, slider) {
            var key = String(t.id);
            if (layers[key]) {
                layers[key].setOpacity(slider.value / 100);
                map.addLayer(layers[key]);
                return Promise.resolve(layers[key]);
            }
            checkbox.disabled = true;
            var url = "/api/projects/" + t.project + "/tasks/" + t.id + "/orthophoto/metadata" + (t.crop ? "?crop=1" : "");
            return getJSON(fetchFn, url).then(function (meta) {
                checkbox.disabled = false;
                var layer = layers[key] = layerFor(L, t, meta, index);
                layer.setOpacity(slider.value / 100);
                if (checkbox.checked) map.addLayer(layer);
                return layer;
            }, function (e) {
                checkbox.disabled = false;
                checkbox.checked = false;
                checkbox.parentNode.title = "Could not load the orthophoto: " + e.message;
            });
        }

        function row(t, index) {
            var name = t.name || ("Task #" + t.id);
            var r = el(doc, "div", "tweakui-other-task");
            r.setAttribute("data-task", t.id);
            var label = el(doc, "label", "tweakui-other-task-name");
            label.title = name;
            var checkbox = el(doc, "input");
            checkbox.type = "checkbox";
            label.appendChild(checkbox);
            label.appendChild(el(doc, "span", "", name));
            var slider = el(doc, "input", "tweakui-other-task-opacity");
            slider.type = "range";
            slider.min = "0";
            slider.max = "100";
            slider.value = "100";
            slider.setAttribute("aria-label", "Opacity of " + name);
            slider.title = "Opacity";
            checkbox.addEventListener("change", function () {
                if (checkbox.checked) show(t, index, checkbox, slider);
                else if (layers[String(t.id)]) map.removeLayer(layers[String(t.id)]);
            });
            slider.addEventListener("input", function () {
                if (layers[String(t.id)]) layers[String(t.id)].setOpacity(slider.value / 100);
            });
            r.appendChild(label);
            r.appendChild(slider);
            return r;
        }

        function load() {
            loaded = true;
            message("Loading…");
            return getJSON(fetchFn, "/api/projects/" + task.project + "/tasks/?available_assets=orthophoto.tif")
                .then(function (tasks) {
                    var others = (Array.isArray(tasks) ? tasks : []).filter(function (t) { return String(t.id) !== String(task.id); });
                    if (!others.length) return message("No other task of this project has an orthophoto.", "text-muted");
                    list.textContent = "";
                    others.forEach(function (t, i) { list.appendChild(row(t, i)); });
                }, function (e) {
                    loaded = false;
                    message("Could not load the tasks: " + e.message, "text-danger");
                });
        }

        function open() {
            wrapper.className = "open";
            return loaded ? Promise.resolve() : load();
        }

        function hide() { wrapper.className = ""; }

        button.addEventListener("click", function (e) { e.preventDefault(); open(); });
        close.addEventListener("click", hide);

        return {container: container, open: open, close: hide, layers: layers};
    }

    // On a task's map, adds the control below the others in the top right corner
    function add(args, L, doc, win) {
        var task = mapTask(args && args.tiles, win.location && win.location.pathname);
        if (!task || !args.map) return null;
        var control = build(doc, L, args.map, task, win.fetch.bind(win));
        var Control = L.Control.extend({
            options: {position: "topright"},
            onAdd: function () { return control.container; }
        });
        args.map.addControl(new Control());
        return control;
    }

    function start(doc, win) {
        var settings = (win.TweakUI && win.TweakUI.settings) || {};
        if (!settings.other_tasks || !win.PluginsAPI || !win.PluginsAPI.Map) return;
        win.PluginsAPI.Map.didAddControls(["leaflet"], function (args, L) { add(args, L, doc, win); });
    }

    return {start: start, add: add, build: build, mapTask: mapTask, tileUrl: tileUrl};
});
