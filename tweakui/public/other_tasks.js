// 2D Map > Other Tasks' Orthophotos: on a task's map (not a project's map, which has every task's layers), a button below Layers
// opens an "Other Tasks" panel: the project's other tasks with an orthophoto, each with a checkbox that shows its
// orthophoto over the task's own layers (cropped as its task is) and an opacity slider. None is shown on opening and
// nothing is remembered. The panel takes the classes of WebODM's Layers panel, so it looks like it (and Movable
// Panels drags it by its title). Leaflet comes from the map hook's dependencies, as WebODM's plugins get it; the
// layers are built as WebODM's map builds an orthophoto's (Map.jsx: 512-px tiles, rescaled to the RGB bands'
// statistics).
// Side By Side: each row's button, WebODM's own (its Layers panel has one on each raster layer), sends
// PluginsAPI.Map.sideBySideChanged(layer, true), and WebODM's map splits itself with its movable divider: that layer
// on the right, the task's own on the left. The other ticked rows' layers are hidden meanwhile, and a row ticked only
// for it is unticked after. One layer at a time, as in WebODM: WebODM's own Side By Side on another layer ends ours.
// UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "other_tasks", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: none (its control comes through the map hook,
    // with the classes of WebODM's Layers control for its look)
    var SELECTORS = {};
    var NAME = "other_tasks";
    var el = ui.el;

    var TILESIZE = 512;
    // Above the task's own layers (WebODM gives them 11 to 14)
    var ZINDEX = 100;
    // WebODM's Side By Side icons (LayersControlLayer.jsx), off and on
    var SIDE_OFF = "fa fa-fw fa-divide fa-rotate-90", SIDE_ON = "fa fa-fw fa-chevron-right";

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

    function getJSON(fetchFn, url) {
        return fetchFn(url, {credentials: "same-origin"}).then(function (res) {
            if (!res.ok) throw new Error("Error " + res.status);
            return res.json();
        });
    }

    // The control: the button, and the panel it opens. Returns {container, open, close}
    function build(doc, L, map, task, fetchFn, P) {
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

        var loaded = false, layers = {}, rows = {};
        // The comparison: {key, layer, hidden (the other layers hidden for it), ticked (its row ticked only for it)}
        var sided = null;

        function sideBySide(layer, side) {
            if (P && P.Map && P.Map.sideBySideChanged) P.Map.sideBySideChanged(layer, side);
        }

        // Ends the comparison: WebODM told (unless it is WebODM that ended it), the hidden layers back, and the row
        // unticked if it was ticked only for it
        function endSide(tell) {
            var s = sided;
            if (!s) return;
            sided = null;
            var r = rows[s.key];
            r.side.querySelector("i").className = SIDE_OFF;
            r.side.setAttribute("aria-pressed", "false");
            if (tell) sideBySide(s.layer, false);
            var container = s.layer.getContainer && s.layer.getContainer();
            if (container) container.style.clip = "";
            if (s.layer.setZIndex) s.layer.setZIndex(s.layer.__tweakuiZIndex);
            s.hidden.forEach(function (key) {
                if (rows[key].checkbox.checked && layers[key]) map.addLayer(layers[key]);
            });
            if (s.ticked) {
                r.checkbox.checked = false;
                map.removeLayer(s.layer);
            }
        }

        function startSide(key, layer, ticked) {
            var hidden = Object.keys(layers).filter(function (k) { return k !== key && map.hasLayer(layers[k]); });
            hidden.forEach(function (k) { map.removeLayer(layers[k]); });
            sided = {key: key, layer: layer, hidden: hidden, ticked: ticked};
            rows[key].side.querySelector("i").className = SIDE_ON;
            rows[key].side.setAttribute("aria-pressed", "true");
            sideBySide(layer, true);
        }

        // The row's Side By Side button: starts its comparison (ending another first), or ends it
        function toggleSide(t, index) {
            var key = String(t.id), r = rows[key];
            if (sided && sided.key === key) return endSide(true);
            endSide(true);
            var ticked = !r.checkbox.checked;
            if (ticked) r.checkbox.checked = true;
            return show(t, index, r.checkbox, r.slider).then(function (layer) {
                if (layer && r.checkbox.checked && !sided) startSide(key, layer, ticked);
            });
        }

        // WebODM's own Side By Side on another layer: ours ends, as WebODM's layers do (after WebODM's own handler)
        if (P && P.Map && P.Map.onSideBySideChanged) {
            P.Map.onSideBySideChanged(ui.guard(NAME, function (layer, side) {
                if (side && sided && layer !== sided.layer) setTimeout(ui.guard(NAME, function () { endSide(true); }), 0);
            }));
        }

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
            // An orthophoto whose metadata can't make a layer (no bounds) fails as one that can't be loaded
            return getJSON(fetchFn, url).then(function (meta) {
                var layer = layerFor(L, t, meta, index);
                layer.__tweakuiZIndex = layer.options.zIndex;
                checkbox.disabled = false;
                layers[key] = layer;
                layer.setOpacity(slider.value / 100);
                if (checkbox.checked) map.addLayer(layer);
                return layer;
            }).then(null, function (e) {
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
            var side = el(doc, "a", "layer-action tweakui-other-task-side");
            side.href = "#";
            side.title = "Side By Side";
            side.setAttribute("role", "button");
            side.setAttribute("aria-pressed", "false");
            side.setAttribute("aria-label", "Side By Side with " + name);
            side.appendChild(el(doc, "i", SIDE_OFF));
            rows[String(t.id)] = {checkbox: checkbox, slider: slider, side: side};
            checkbox.addEventListener("change", function () {
                if (checkbox.checked) return show(t, index, checkbox, slider);
                if (sided && sided.key === String(t.id)) endSide(true);
                if (layers[String(t.id)]) map.removeLayer(layers[String(t.id)]);
            });
            side.addEventListener("click", function (e) {
                e.preventDefault();
                toggleSide(t, index);
            });
            slider.addEventListener("input", function () {
                if (layers[String(t.id)]) layers[String(t.id)].setOpacity(slider.value / 100);
            });
            r.appendChild(label);
            r.appendChild(slider);
            r.appendChild(side);
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

        return {container: container, open: open, close: hide, layers: layers, endSide: endSide};
    }

    // On a task's map, adds the control below the others in the top right corner
    function add(args, L, doc, win) {
        var task = mapTask(args && args.tiles, win.location && win.location.pathname);
        if (!task || !args.map) return null;
        var control = build(doc, L, args.map, task, win.fetch.bind(win), win.PluginsAPI);
        var Control = L.Control.extend({
            options: {position: "topright"},
            onAdd: function () { return control.container; }
        });
        args.map.addControl(new Control());
        return control;
    }

    function start(doc, win) {
        if (!ui.settingsOf(win).other_tasks || !win.PluginsAPI || !win.PluginsAPI.Map) return;
        win.PluginsAPI.Map.didAddControls(["leaflet"], ui.guard(NAME, function (args, L) { add(args, L, doc, win); }));
    }

    return {start: start, add: add, build: build, mapTask: mapTask, tileUrl: tileUrl, SELECTORS: SELECTORS};
});
