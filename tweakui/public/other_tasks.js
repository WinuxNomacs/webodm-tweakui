// 2D Map > Ortho Overlays: on a task's map (not a project's map, which has every task's layers), a button below Layers
// opens an "Ortho Overlays" panel: the project's other tasks with an orthophoto, each with a checkbox that shows its
// orthophoto over the task's own layers (cropped as its task is) and an opacity slider. None is shown on opening and
// nothing is remembered. The panel takes the classes of WebODM's Layers panel, so it looks like it (and Movable
// Panels drags it by its title). Leaflet comes from the map hook's dependencies, as WebODM's plugins get it; the
// layers are built as WebODM's map builds an orthophoto's (Map.jsx: 512-px tiles, rescaled to the RGB bands'
// statistics).
// Side By Side: each row's button (WebODM's icon, as its Layers panel has on each raster layer) shows that layer on one
// side of a divider (vendor/split/split.js, DJI Thermal's: dragged, upright or across, turned by a right-click on its
// handle) and the task's own on the other; while compared, a line beneath the row chooses the side and turns the
// divider. The other ticked rows' layers are hidden meanwhile, and a row ticked only for it is unticked after. One
// divider at a time: starting tells WebODM's split event (PluginsAPI.Map.sideBySideChanged), which turns WebODM's own
// Side By Side off and DJI Thermal's Inspector's divider too, and either of those starting ends ours.
// UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI, node ? require("./vendor/split/split.js") : root.SplitDivider);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "other_tasks", api.start);
})(typeof window !== "undefined" ? window : this, function (ui, Split) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: none (its control comes through the map hook,
    // with the classes of WebODM's Layers control for its look)
    var SELECTORS = {};
    var NAME = "other_tasks";
    var el = ui.el;
    // Split: the divider (vendor/split/split.js, loaded before this script)

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
        button.title = "Ortho Overlays";
        button.setAttribute("role", "button");
        button.appendChild(el(doc, "i", "fa fa-images"));
        var panel = el(doc, "div", "layers-control-panel tweakui-other-tasks-panel");
        var close = el(doc, "span", "close-button");
        close.title = "Close";
        panel.appendChild(close);
        panel.appendChild(el(doc, "div", "title", "Ortho Overlays"));
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
        // The comparison: {key, layer, hidden (the other layers hidden for it), ticked (its row ticked only for it)};
        // the divider's direction and the compared layer's side are kept from one comparison to the next
        var sided = null, split = null, side = "after", vertical = true;

        function divider() {
            if (!split) {
                split = Split.create(L, map, {doc: doc, vertical: vertical});
                split.on("change", function (e) {
                    vertical = e.vertical;
                    if (e.reason === "turn" && sided) showSplitButtons(rows[sided.key]);
                });
            }
            return split;
        }

        // Told to everyone listening to WebODM's split event (as DJI Thermal's Inspector does): WebODM's own Side By
        // Side turns off, the way its Layers panel turns it off when another layer is sided, and so does another
        // plugin's divider that listens alike; the layer is then taken off WebODM's split again
        function announce(layer) {
            if (!P || !P.Map || !P.Map.sideBySideChanged) return;
            P.Map.sideBySideChanged(layer, true);
            P.Map.sideBySideChanged(layer, false);
            if (layer.setZIndex) layer.setZIndex(layer.__tweakuiZIndex);       // brought to the front there
            setTimeout(ui.guard(NAME, function () { if (split && sided) split.update(); }), 0);   // after WebODM's control is gone
        }

        // The compared row's side and turn buttons, as the divider is now
        function showSplitButtons(r) {
            var name = Split.sideName(side, vertical), other = Split.sideName(side === "before" ? "after" : "before", vertical);
            r.sideButton.innerHTML = '<i class="fa fa-exchange-alt' + (vertical ? "" : " fa-rotate-90") + '"></i> ' + name;
            r.sideButton.title = "It shows " + name.toLowerCase() + " of the divider: click to show it " + other.toLowerCase();
            r.turnButton.innerHTML = '<i class="fa ' + (vertical ? "fa-grip-lines-vertical" : "fa-grip-lines") + '"></i>';
            r.turnButton.title = "Turn the divider " + (vertical ? "horizontal" : "vertical") + " (or right-click its handle)";
            r.splitButtons.hidden = false;
        }

        // Ends the comparison: the divider gone with its clip, the hidden layers back, and the row unticked if it was
        // ticked only for it
        function endSide() {
            var s = sided;
            if (!s) return;
            sided = null;
            var r = rows[s.key];
            r.side.querySelector("i").className = SIDE_OFF;
            r.side.setAttribute("aria-pressed", "false");
            r.splitButtons.hidden = true;
            if (split) split.remove(s.layer);
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
            announce(layer);
            sided = {key: key, layer: layer, hidden: hidden, ticked: ticked};
            rows[key].side.querySelector("i").className = SIDE_ON;
            rows[key].side.setAttribute("aria-pressed", "true");
            divider().add(layer, side);
            showSplitButtons(rows[key]);
        }

        // The row's Side By Side button: starts its comparison (ending another first), or ends it
        function toggleSide(t, index) {
            var key = String(t.id), r = rows[key];
            if (sided && sided.key === key) return endSide();
            endSide();
            var ticked = !r.checkbox.checked;
            if (ticked) r.checkbox.checked = true;
            return show(t, index, r.checkbox, r.slider).then(function (layer) {
                if (layer && r.checkbox.checked && !sided) startSide(key, layer, ticked);
            });
        }

        function swapSide() {
            side = side === "before" ? "after" : "before";
            if (!sided) return;
            divider().setSide(sided.layer, side);
            showSplitButtons(rows[sided.key]);
        }

        // WebODM's own Side By Side on a layer, or another plugin's divider (DJI Thermal's Inspector tells it alike):
        // ours ends. Our own announcement comes before the comparison starts, so it isn't taken for another's
        if (P && P.Map && P.Map.onSideBySideChanged) {
            P.Map.onSideBySideChanged(ui.guard(NAME, function (layer, on) {
                if (on && sided && layer !== sided.layer) endSide();
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
            // While compared, a line beneath: its side of the divider, and the divider's direction
            var splitButtons = el(doc, "div", "tweakui-other-task-split");
            splitButtons.hidden = true;
            var sideButton = el(doc, "button", "btn btn-default btn-xs tweakui-other-task-swap");
            sideButton.type = "button";
            var turnButton = el(doc, "button", "btn btn-default btn-xs tweakui-other-task-turn");
            turnButton.type = "button";
            turnButton.setAttribute("aria-label", "Turn the divider");
            splitButtons.appendChild(sideButton);
            splitButtons.appendChild(turnButton);
            sideButton.addEventListener("click", function () { swapSide(); });
            turnButton.addEventListener("click", function () { divider().turn(); });
            rows[String(t.id)] = {checkbox: checkbox, slider: slider, side: side, splitButtons: splitButtons,
                                  sideButton: sideButton, turnButton: turnButton};
            checkbox.addEventListener("change", function () {
                if (checkbox.checked) return show(t, index, checkbox, slider);
                if (sided && sided.key === String(t.id)) endSide();
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
            r.appendChild(splitButtons);
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

        return {container: container, open: open, close: hide, layers: layers, endSide: endSide,
                divider: function () { return split; }};
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
