// General > Task Details > Enhanced Task Details: in a task's details panel on the Dashboard (TaskListItem in WebODM),
// Started and Finished rows and, while the task runs, its current ODM stage follow WebODM's "Created on"; after
// WebODM's one-line Options row come the preset the options match (found as WebODM's Edit dialog does), each option in
// a bubble (WebODM's row then hidden), and the ODX command to run the task by hand, with a copy button. Each of those
// is a setting of its own under Enhanced Task Details.
// WebODM gives the task through PluginsAPI.Dashboard.addTaskActionButton each time a panel opens (no button is
// added); the rows go in after WebODM's rows, found by their text (the Options row is hidden). A MutationObserver
// puts them back after React re-renders. UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.PluginsAPI && root.PluginsAPI.Dashboard && root.PluginsAPI.Dashboard.addTaskActionButton) {
        var settings = (root.TweakUI && root.TweakUI.settings) || {};
        if (settings.enhanced_task_details) api.start(root.document, root, api.parts(settings));
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    // Added by NodeODX to every task when it supports them (the outputs WebODM's viewers need)
    var NODE_OPTIONS = ["pc-ept", "cog", "gltf"];
    var DOCKER = ["docker", "run", "-ti", "--rm", "-v /my/project:/datasets/code", "webodm/odx",
        "--project-path /datasets"];
    // The command line takes a GeoJSON file where WebODM keeps the boundary itself
    var BOUNDARY_FILE = "/datasets/code/boundary.geojson";
    // WebODM's status codes (StatusCodes.js): running, and failed, completed, canceled (a task has ended); a task
    // with no status or queued hasn't started
    var RUNNING = 20, ENDED = [30, 40, 50];
    // How often a task that hasn't ended is fetched again while its panel is open
    var POLL_MS = 5000;
    // ODM's pipeline (stages/odm_app.py), with the names shown; fast-orthophoto leaves out openmvs
    var STAGES = [["dataset", "Load Dataset"], ["split", "Split"], ["merge", "Merge"],
        ["opensfm", "Structure from Motion"], ["openmvs", "Multi-View Stereo"], ["odm_filterpoints", "Filter Points"],
        ["odm_meshing", "Meshing"], ["mvs_texturing", "Texturing"], ["odm_georeferencing", "Georeferencing"],
        ["odm_dem", "Elevation Models"], ["odm_orthophoto", "Orthophoto"], ["odm_report", "Report"],
        ["odm_postprocess", "Post-processing"]];
    // The parts of the panel, each a setting under Enhanced Task Details (all on unless turned off)
    var PARTS = ["times", "preset", "options", "command", "step"];

    function parts(settings) {
        var on = {};
        PARTS.forEach(function (p) { on[p] = !settings || settings["task_details_" + p] !== false; });
        return on;
    }

    function optionValue(options, name) {
        for (var i = 0; i < (options || []).length; i++) if (options[i].name === name) return options[i].value;
        return undefined;
    }

    // The stages ODM runs for these options: [name, shown name]; it stops after end-with's stage (or rerun's)
    function stages(options) {
        var list = STAGES.filter(function (s) {
            return !(s[0] === "openmvs" && optionValue(options, "fast-orthophoto") === true);
        });
        var end = optionValue(options, "end-with") || optionValue(options, "rerun");
        for (var i = 0; i < list.length; i++) if (list[i][0] === end) return list.slice(0, i + 1);
        return list;
    }

    // Reads console lines into a step: {stage: the last stage started (or null), done: ODM has run its last stage}
    function readStep(step, lines) {
        var out = {stage: step ? step.stage : null, done: step ? step.done : false};
        lines.forEach(function (line) {
            var m = /\bRunning (\S+) stage\b/.exec(line);
            if (m) {
                out.stage = m[1];
                out.done = false;
            } else if (/\bNo more stages to run\b/.test(line)) out.done = true;
        });
        return out;
    }

    // The Current Step row's label and value, for a step (undefined: the console not read yet)
    function stepText(options, step) {
        if (!step) return ["Current Step:", "…"];
        if (step.done) return ["Current Step:", "Downloading results"];
        if (!step.stage) return ["Current Step:", "Starting"];
        var list = stages(options);
        for (var i = 0; i < list.length; i++) {
            if (list[i][0] === step.stage) return ["Current Step (" + (i + 1) + "/" + list.length + "):", list[i][1]];
        }
        return ["Current Step:", step.stage];
    }

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

    function ended(task) {
        return ENDED.indexOf(task.status) >= 0;
    }

    // WebODM keeps no start or end time: started is when the task was created (its upload began), finished that plus
    // the node's processing time (which a restart counts again from the new run); null where it doesn't apply
    function times(task) {
        var created = new Date(task.created_at).getTime(), ran = task.processing_time > 0;
        if (isNaN(created)) return {started: null, finished: null, running: false};
        var running = task.status === RUNNING;
        return {
            started: ran || running ? created : null,
            finished: ran && ended(task) ? created + task.processing_time : null,
            running: running
        };
    }

    function dateText(ms) {
        return new Date(ms).toLocaleString();
    }

    // The Started and Finished rows
    function timeRows(doc, task) {
        var t = times(task);
        return [
            row(doc, "Started:", el(doc, "span", "tweakui-task-started", t.started === null ? "—" : dateText(t.started)),
                "started"),
            row(doc, "Finished:", el(doc, "span", "tweakui-task-finished",
                t.finished !== null ? dateText(t.finished) : (t.running ? "Running" : "—")), "finished")
        ];
    }

    function stepRow(doc, task, step) {
        var text = stepText(task.options, step);
        return row(doc, text[0], el(doc, "span", "tweakui-task-step", text[1]), "step");
    }

    // The rows after the Options row, those turned on; preset is a preset, null (no match) or undefined (presets not
    // loaded)
    function rows(doc, win, task, preset, on) {
        on = on || parts();
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

        var all = {preset: row(doc, "Preset:", presetCell, "preset"), options: row(doc, "Options:", bubbles, "options"),
            command: row(doc, "ODX command:", box, "command")};
        return ["preset", "options", "command"].filter(function (p) { return on[p]; }).map(function (p) {
            return all[p];
        });
    }

    // The task id a details panel shows (WebODM's Task ID link)
    function panelTaskId(panel) {
        var link = panel.querySelector(".task-id-link");
        return link ? (link.textContent || "").trim() : null;
    }

    // WebODM's row in a panel's table whose value cell has this text
    function rowWithValue(table, want) {
        var trs = table.querySelectorAll("tbody > tr");
        for (var i = 0; i < trs.length; i++) {
            var cells = trs[i].children;
            if (trs[i].getAttribute("data-tweakui-row") === null && cells.length === 2 &&
                (cells[1].textContent || "").trim() === want) return trs[i];
        }
        return null;
    }

    function removeAll(nodes) {
        for (var i = 0; i < nodes.length; i++) nodes[i].parentNode.removeChild(nodes[i]);
    }

    function insertAfter(target, trs) {
        var next = target.nextSibling;
        trs.forEach(function (tr) { target.parentNode.insertBefore(tr, next); });
    }

    // Whether the rows after anchor are ours, with these names in this order
    function inPlace(anchor, names) {
        var tr = anchor;
        for (var i = 0; i < names.length; i++) {
            tr = tr.nextSibling;
            if (!tr || tr.getAttribute("data-tweakui-row") !== names[i]) return false;
        }
        return true;
    }

    function rowNames(trs) {
        return trs.map(function (tr) { return tr.getAttribute("data-tweakui-row"); });
    }

    // Puts a task's rows in its panel, or brings them up to date: Started, Finished and the current step after WebODM's
    // Created on (when found; else the step goes after the Options row), the others after WebODM's Options row (hidden
    // when the options are shown as bubbles); leaves the panel as WebODM made it when the Options row isn't found.
    // on: the parts turned on (all when not given); step: what the console says (see readStep)
    function enhance(doc, win, panel, task, preset, on, step) {
        on = on || parts();
        var table = panel.querySelector(".info-table");
        if (!table) return false;
        var target = rowWithValue(table, optionsText(task.options)), old = table.querySelectorAll("[data-tweakui-row]");
        if (!target) {
            removeAll(old);
            return false;
        }
        var created = rowWithValue(table, dateText(task.created_at));
        var running = on.step && task.status === RUNNING;
        var key = JSON.stringify([task.options, preset ? preset.id : (preset === null ? "none" : "loading"),
            task.created_at, task.status, task.processing_time, !!created, on, running ? step || null : null]);
        var top = (on.times ? timeRows(doc, task) : []).concat(running ? [stepRow(doc, task, step)] : []);
        var after = rows(doc, win, task, preset, on);
        if (!created) {
            after = top.filter(function (tr) { return tr.getAttribute("data-tweakui-row") === "step"; }).concat(after);
            top = [];
        }
        var hidden = /\btweakui-hidden\b/.test(target.className);
        if (hidden === !!on.options && old.length === top.length + after.length &&
            (!created || inPlace(created, rowNames(top))) && inPlace(target, rowNames(after)) &&
            table.getAttribute("data-tweakui-key") === key) return true;
        removeAll(old);
        if (on.options && !hidden) target.className += " tweakui-hidden";
        if (!on.options && hidden) target.className = target.className.replace(/\s*\btweakui-hidden\b/, "");
        if (created) insertAfter(created, top);
        insertAfter(target, after);
        table.setAttribute("data-tweakui-key", key);
        return true;
    }

    function start(doc, win, on) {
        on = on || parts();
        // steps: per task id, what its console says ({stage, done}) and the next line to read (line)
        var tasks = {}, presets, scheduled = false, refetching = {}, polled = {}, steps = {}, reading = {};

        function update() {
            scheduled = false;
            var panels = doc.querySelectorAll(".expanded-panel");
            for (var i = 0; i < panels.length; i++) {
                var id = panelTaskId(panels[i]), task = id && tasks[id];
                if (!task) continue;
                var preset = presets === undefined ? undefined : matchPreset(presets, task.options || []);
                if (!enhance(doc, win, panels[i], task, preset, on, steps[id])) {
                    if (!refetching[id] && task.project) refetch(task);
                } else if (!ended(task) && task.project) {
                    if (!polled[id]) poll(task);
                    if (on.step && task.status === RUNNING && !steps[id] && !reading[id]) readConsole(task);
                }
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

        // The console's lines from the last one read: the current step. A console shorter than what was read was
        // cleared (a restart): read again from its start
        function readConsole(task) {
            var id = task.id, step = steps[id], line = step ? step.line : 0;
            reading[id] = true;
            return win.fetch("/api/projects/" + task.project + "/tasks/" + id + "/output/?f=json&line=" + line,
                {credentials: "same-origin"})
                .then(function (res) { return res.ok ? res.json() : null; })
                .then(function (out) {
                    reading[id] = false;
                    if (!out || !Array.isArray(out.lines)) return;
                    if (out.count < line) {
                        delete steps[id];
                        return readConsole(task);
                    }
                    var next = readStep(step, out.lines);
                    next.line = out.count;
                    steps[id] = next;
                    later();
                }, function () { reading[id] = false; });
        }

        // A task that hasn't ended, its panel open: fetched again after a while (and its console, while it runs), so
        // the rows follow it
        function poll(task) {
            polled[task.id] = true;
            win.setTimeout(function () {
                win.fetch("/api/projects/" + task.project + "/tasks/" + task.id + "/", {credentials: "same-origin"})
                    .then(function (res) { return res.ok ? res.json() : null; })
                    .then(function (fresh) {
                        if (fresh && tasks[task.id] === task) tasks[task.id] = fresh;
                        var now = tasks[task.id];
                        if (on.step && now.status === RUNNING && steps[task.id] && !reading[task.id]) {
                            return readConsole(now);
                        }
                    })
                    .then(function () {
                        polled[task.id] = false;
                        later();
                    }, function () { polled[task.id] = false; });
            }, POLL_MS);
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
        optionsText: optionsText, shellQuote: shellQuote, times: times, parts: parts, stages: stages,
        readStep: readStep, stepText: stepText};
});
