// General > Task Options > Enhanced Task Details: in a task's details panel on the Dashboard (TaskListItem in WebODM),
// WebODM's one-line Options row gives way to three rows: the preset the options match (found as WebODM's Edit dialog
// does), each option in a bubble, and the ODX command to run the task by hand, with a copy button.
// WebODM gives the task through PluginsAPI.Dashboard.addTaskActionButton each time a panel opens (no button is
// added); the rows go in after WebODM's Options row, found by its text, which is hidden. A MutationObserver puts
// them back after React re-renders. UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.PluginsAPI && root.PluginsAPI.Dashboard && root.PluginsAPI.Dashboard.addTaskActionButton) {
        var settings = (root.TweakUI && root.TweakUI.settings) || {};
        if (settings.enhanced_task_details) api.start(root.document, root);
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    // Added by NodeODX to every task when it supports them (the outputs WebODM's viewers need)
    var NODE_OPTIONS = ["pc-ept", "cog", "gltf"];
    var DOCKER = ["docker", "run", "-ti", "--rm", "-v /my/project:/datasets/code", "webodm/odx",
        "--project-path /datasets"];
    // The command line takes a GeoJSON file where WebODM keeps the boundary itself
    var BOUNDARY_FILE = "/datasets/code/boundary.geojson";

    // WebODM's own text of the Options row (TaskListItem.optionsToList)
    function optionsText(options) {
        if (!Array.isArray(options)) return "";
        if (options.length === 0) return "Default";
        return options.map(function (o) {
            return o.name === "boundary" ? o.name + ":geojson" : o.name + ":" + o.value;
        }).join(", ");
    }

    // WebODM's EditTaskForm.findFirstPresetMatching: the first preset with exactly the task's options and values
    function matchPreset(presets, options) {
        for (var i = 0; i < presets.length; i++) {
            var preset = presets[i];
            if (!Array.isArray(preset.options) || preset.options.length !== options.length) continue;
            var values = {};
            options.forEach(function (o) { values[o.name] = o.value; });
            var all = preset.options.every(function (o) { return values[o.name] === o.value; });
            if (all) return preset;
        }
        return null;
    }

    function shellQuote(value) {
        var s = String(value);
        return /^[A-Za-z0-9_.,:/=+@%-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'";
    }

    // The ODX command the node runs for these options, in the docker form of WebODM's docs: the task's options
    // (false booleans left out, booleans as a bare flag), then the node's own; as its words, each flag with its value
    function commandParts(options) {
        var parts = DOCKER.slice(), names = {};
        options.forEach(function (o) {
            names[o.name] = true;
            if (o.value === false) return;
            if (o.name === "boundary") parts.push("--boundary " + BOUNDARY_FILE);
            else parts.push("--" + o.name + (o.value === true ? "" : " " + shellQuote(o.value)));
        });
        NODE_OPTIONS.forEach(function (n) { if (!names[n]) parts.push("--" + n); });
        return parts;
    }

    function command(options) {
        return commandParts(options).join(" ");
    }

    function el(doc, tag, className, text) {
        var e = doc.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function row(doc, label, content, name) {
        var tr = el(doc, "tr", "tweakui-task-row"), th = el(doc, "td"), td = el(doc, "td");
        tr.setAttribute("data-tweakui-row", name);
        th.appendChild(el(doc, "strong", null, label));
        td.appendChild(content);
        tr.appendChild(th);
        tr.appendChild(td);
        return tr;
    }

    function copyText(text, doc, win) {
        if (win.navigator && win.navigator.clipboard && win.navigator.clipboard.writeText) {
            return win.navigator.clipboard.writeText(text);
        }
        // Not a secure context (plain http on another host): the old way
        var area = el(doc, "textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        doc.body.appendChild(area);
        area.select();
        var ok = doc.execCommand && doc.execCommand("copy");
        doc.body.removeChild(area);
        return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
    }

    // The three rows for a task; preset is a preset, null (no match) or undefined (presets not loaded)
    function rows(doc, win, task, preset) {
        var options = task.options || [];
        var name = preset ? preset.name : (preset === undefined ? "…" : (options.length ? "Custom" : "None"));
        var presetCell = el(doc, "span", "tweakui-task-preset", name);

        var bubbles = el(doc, "span", "tweakui-option-bubbles");
        if (!options.length) bubbles.appendChild(el(doc, "span", "text-muted", "Default"));
        options.forEach(function (o) {
            var b = el(doc, "span", "tweakui-option-bubble theme-border theme-background-highlight");
            b.appendChild(el(doc, "span", "tweakui-option-name", o.name));
            if (o.value !== true) {
                b.appendChild(el(doc, "span", "tweakui-option-value",
                    o.name === "boundary" ? "geojson" : String(o.value)));
            }
            bubbles.appendChild(b);
        });

        var text = command(options);
        var box = el(doc, "span", "tweakui-odx-command");
        // Each flag with its value in a span that wraps as one, so a line doesn't break inside a flag
        var code = el(doc, "code", "theme-border");
        commandParts(options).forEach(function (part, i) {
            if (i) code.appendChild(doc.createTextNode(" "));
            code.appendChild(el(doc, "span", null, part));
        });
        var copy = el(doc, "button", "btn btn-default btn-xs tweakui-odx-copy");
        copy.type = "button";
        copy.title = "Copy to clipboard";
        copy.setAttribute("aria-label", "Copy to clipboard");
        copy.appendChild(el(doc, "i", "far fa-clipboard"));
        copy.addEventListener("click", function () {
            copyText(text, doc, win).then(function () {
                copy.firstChild.className = "fa fa-check";
                win.setTimeout(function () { copy.firstChild.className = "far fa-clipboard"; }, 2000);
            }, function () {
                copy.firstChild.className = "fa fa-times";
            });
        });
        box.appendChild(code);
        box.appendChild(copy);

        return [row(doc, "Preset:", presetCell, "preset"), row(doc, "Options:", bubbles, "options"),
            row(doc, "ODX command:", box, "command")];
    }

    // The task id a details panel shows (WebODM's Task ID link)
    function panelTaskId(panel) {
        var link = panel.querySelector(".task-id-link");
        return link ? (link.textContent || "").trim() : null;
    }

    // WebODM's Options row in a panel's table: the row whose value cell has the task's options text
    function optionsRow(table, task) {
        var want = optionsText(task.options), trs = table.querySelectorAll("tbody > tr");
        for (var i = 0; i < trs.length; i++) {
            var cells = trs[i].children;
            if (trs[i].getAttribute("data-tweakui-row") === null && cells.length === 2 &&
                (cells[1].textContent || "").trim() === want) return trs[i];
        }
        return null;
    }

    // Puts a task's rows in its panel after WebODM's Options row (hidden), or brings them up to date; leaves the
    // panel as WebODM made it when the Options row isn't found
    function enhance(doc, win, panel, task, preset) {
        var table = panel.querySelector(".info-table");
        if (!table) return false;
        var target = optionsRow(table, task), old = table.querySelectorAll("[data-tweakui-row]");
        var key = JSON.stringify([task.options, preset ? preset.id : (preset === null ? "none" : "loading")]);
        if (!target) {
            for (var j = 0; j < old.length; j++) old[j].parentNode.removeChild(old[j]);
            return false;
        }
        if (/\btweakui-hidden\b/.test(target.className) && old.length === 3 && old[0] === target.nextSibling &&
            table.getAttribute("data-tweakui-key") === key) return true;
        for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
        if (!/\btweakui-hidden\b/.test(target.className)) target.className += " tweakui-hidden";
        var next = target.nextSibling;
        rows(doc, win, task, preset).forEach(function (tr) { target.parentNode.insertBefore(tr, next); });
        table.setAttribute("data-tweakui-key", key);
        return true;
    }

    function start(doc, win) {
        var tasks = {}, presets, scheduled = false, refetching = {};

        function update() {
            scheduled = false;
            var panels = doc.querySelectorAll(".expanded-panel");
            for (var i = 0; i < panels.length; i++) {
                var id = panelTaskId(panels[i]), task = id && tasks[id];
                if (!task) continue;
                var preset = presets === undefined ? undefined : matchPreset(presets, task.options || []);
                if (!enhance(doc, win, panels[i], task, preset) && !refetching[id] && task.project) refetch(task);
            }
        }

        function later() {
            if (!scheduled) {
                scheduled = true;
                win.setTimeout(update, 0);
            }
        }

        // The panel shows other options than the task given when it opened (a restart's rerun-from): fetch it again
        function refetch(task) {
            refetching[task.id] = true;
            win.fetch("/api/projects/" + task.project + "/tasks/" + task.id + "/", {credentials: "same-origin"})
                .then(function (res) { return res.ok ? res.json() : null; })
                .then(function (fresh) {
                    if (fresh && JSON.stringify(fresh.options) !== JSON.stringify(task.options)) {
                        tasks[task.id] = fresh;
                        refetching[task.id] = false;
                        later();
                    }
                }, function () {});
        }

        win.PluginsAPI.Dashboard.addTaskActionButton(function (args) {
            if (args && args.task && args.task.id) {
                tasks[args.task.id] = args.task;
                refetching[args.task.id] = false;
                later();
            }
            return null;
        });

        win.fetch("/api/presets/?ordering=-system,-created_at", {credentials: "same-origin"})
            .then(function (res) { return res.ok ? res.json() : []; })
            .then(function (list) { presets = Array.isArray(list) ? list : []; later(); },
                function () { presets = []; later(); });

        if (win.MutationObserver) {
            new win.MutationObserver(later).observe(doc.body || doc.documentElement, {
                childList: true, subtree: true, characterData: true
            });
        }
    }

    return {start: start, enhance: enhance, rows: rows, command: command, matchPreset: matchPreset,
        optionsText: optionsText, shellQuote: shellQuote};
});
