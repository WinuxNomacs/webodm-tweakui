// Diagnostic > Performance (templates/performance.html): verdicts at the top, then a card per processing node the
// user may use (what it says of itself: cores, memory, queue), the server's disk and memory, and the recent finished
// tasks (an admin's: every user's) with their time per photo, figures from their report, notes from their log and a
// trend (performance.py and task_log.py through the plugin's API). Areas and errors are in WebODM's unit system (the
// maps' choice, Units.js's localStorage "unit_system"), redrawn when it changes.
// Asked on opening and with Refresh. The server's CPU load and memory and the nodes' memory are asked again every
// Refresh Every seconds (a setting, also on the page), the disk every 10 seconds, while the browser tab is shown.
// UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "performance_page", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    var REQUIREMENTS = "https://docs.webodm.org/installation/#hardware-requirements";
    var ICONS = {success: "fa-check-circle", warning: "fa-exclamation-triangle", danger: "fa-times-circle"};
    // A bar turns to a warning past this share used, and to danger past the next
    var FULL_WARNING = 0.8, FULL_DANGER = 0.95;
    var NAME = "performance_page";
    // The live figures: the first asked this long after the report (a load needs two readings), the disk this often
    var FIRST_LIVE = 1000, DISK_EVERY = 10000;
    // Refresh Every's range and default (features.py), when the page doesn't say
    var EVERY_MIN = 1, EVERY_MAX = 10, EVERY_DEFAULT = 3;
    // WebODM's unit system (Units.js): where it keeps it and the event it fires when it changes
    var UNIT_KEY = "unit_system", UNIT_EVENT = "onUnitSystemChanged";
    var FT = 3.28083989501, FT2_ACRE = 43560;
    // Recent Processing's columns (a notes row spans them all)
    var TASK_COLUMNS = 11;

    function escapeHtml(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
        });
    }

    // Bytes as WebODM shows sizes: in KB, MB, GB or TB (1024 each)
    function formatBytes(n) {
        n = Number(n) || 0;
        var units = ["B", "KB", "MB", "GB", "TB"], i = 0;
        while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
        return (i === 0 ? String(Math.round(n)) : n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "")) + " " + units[i];
    }

    // Seconds as "2h 5m", "13m 22s" or "42s"
    function formatDuration(s) {
        if (s === null || s === undefined || isNaN(s)) return "";
        s = Math.round(s);
        var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
        if (h) return h + "h " + m + "m";
        if (m) return m + "m " + sec + "s";
        return sec + "s";
    }

    function formatNumber(n) {
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // An area (m²) in the unit system: m² or hectares, ft² or acres
    function formatArea(m2, system) {
        if (m2 === null || m2 === undefined || isNaN(m2)) return "";
        if (system && system !== "metric") {
            var ft2 = m2 * FT * FT;
            return ft2 >= FT2_ACRE ? (ft2 / FT2_ACRE).toFixed(2) + " ac" : formatNumber(Math.round(ft2)) + " ft\u00b2";
        }
        return m2 >= 10000 ? (m2 / 10000).toFixed(2) + " ha" : formatNumber(Math.round(m2)) + " m\u00b2";
    }

    // A length (m) in the unit system: cm or m, inches or feet
    function formatLength(m, system) {
        if (m === null || m === undefined || isNaN(m)) return "";
        if (system && system !== "metric") {
            var ft = m * FT;
            return ft < 1 ? (ft * 12).toFixed(1) + " in" : ft.toFixed(2) + " ft";
        }
        return m < 1 ? (m * 100).toFixed(1) + " cm" : m.toFixed(2) + " m";
    }

    function unitSystem(win) {
        try {
            return (win && win.localStorage && win.localStorage.getItem(UNIT_KEY)) || "metric";
        } catch (e) {
            return "metric";
        }
    }

    function formatDate(iso) {
        var d = iso ? new Date(iso) : null;
        return d && !isNaN(d) ? d.toLocaleString() : "";
    }

    // A used-of-total bar: the share used, coloured as it fills; plain (a CPU's, busy by nature while processing)
    // always in the theme's colour for bars (theme.css colours only progress-bar-success)
    function barHtml(used, total, plain) {
        var share = total > 0 ? Math.min(Math.max(used / total, 0), 1) : 0;
        var kind = " progress-bar-" + (plain || share < FULL_WARNING ? "success" : share >= FULL_DANGER ? "danger" : "warning");
        return '<div class="progress tweakui-performance-progress" title="' + Math.round(share * 100) + (plain ? "% busy" : "% used") + '">' +
            '<div class="progress-bar' + kind + '" style="width: ' + (share * 100).toFixed(0) + '%"></div></div>';
    }

    function percent(share) {
        return Math.round(share * 100) + "%";
    }

    // The CPU's busy shares between two readings of its counters ({total: [busy, total], cores: [...]}, the API's):
    // {total, cores}, each from 0 to 1, or null where the counters didn't move; null without two readings
    function cpuShares(prev, next) {
        if (!prev || !next) return null;
        function share(a, b) {
            var all = a && b ? b[1] - a[1] : 0;
            return all > 0 ? Math.min(Math.max((b[0] - a[0]) / all, 0), 1) : null;
        }
        return {total: share(prev.total, next.total), cores: (next.cores || []).map(function (c, i) {
            return prev.cores && prev.cores[i] ? share(prev.cores[i], c) : null;
        })};
    }

    function rowHtml(label, value, extra) {
        return "<tr><th>" + escapeHtml(label) + "</th><td>" + value + (extra || "") + "</td></tr>";
    }

    function freeOf(free, total) {
        return escapeHtml(formatBytes(free)) + " free of " + escapeHtml(formatBytes(total));
    }

    function memoryHtml(free, total) {
        return freeOf(free, total) + barHtml(total - free, total);
    }

    function verdictsHtml(verdicts) {
        if (!verdicts.length) return "";
        return '<ul class="tweakui-performance-verdicts list-unstyled">' + verdicts.map(function (v) {
            return '<li data-level="' + escapeHtml(v.level) + '"><i class="fa ' + (ICONS[v.level] || ICONS.warning) +
                " fa-fw text-" + escapeHtml(v.level) + '"></i> ' + escapeHtml(v.text) + "</li>";
        }).join("") + "</ul>";
    }

    function nodeHtml(n) {
        var rows = "";
        var engine = [n.engine ? String(n.engine).toUpperCase() : "", n.engine_version && n.engine_version !== "?" ? n.engine_version : ""]
            .join(" ").trim();
        if (engine) rows += rowHtml("Engine", escapeHtml(engine) + (n.version && n.version !== "?" ? ' <span class="text-muted">(API ' + escapeHtml(n.version) + ")</span>" : ""));
        if (n.online) {
            if (n.cpu_cores) rows += rowHtml("CPU Cores", escapeHtml(n.cpu_cores));
            if (n.total_memory) rows += '<tr><th>Memory</th><td data-memory>' + memoryHtml(n.available_memory, n.total_memory) + "</td></tr>";
            var parallel = n.max_parallel_tasks || 1;
            rows += rowHtml("Queue", escapeHtml((n.queue || 0) + (n.queue === 1 ? " task" : " tasks")) +
                ' <span class="text-muted">(' + escapeHtml(parallel) + " at a time)</span>");
            rows += rowHtml("Max Photos", n.max_images ? escapeHtml(formatNumber(n.max_images)) : "No limit");
            if (n.suits_images !== undefined && n.total_memory) {
                rows += rowHtml("Suits", n.suits_images === null ? "More than 5,000 photos per task"
                    : n.suits_images === 0 ? '<span class="text-danger">Under 40 photos per task</span>'
                        : "About " + escapeHtml(formatNumber(n.suits_images)) + " photos per task");
            }
        } else {
            rows += rowHtml("Last Seen", n.last_refreshed ? escapeHtml(formatDate(n.last_refreshed)) : "Never");
        }
        return '<div class="tweakui-performance-card theme-border" data-node="' + escapeHtml(n.id) + '">' +
            '<h5><i class="fa fa-server fa-fw"></i> ' + escapeHtml(n.name) + " " +
            (n.online ? '<span class="label label-success">Online</span>' : '<span class="label label-danger">Not Answering</span>') +
            '</h5><table class="tweakui-performance-facts">' + rows + "</table></div>";
    }

    function nodesHtml(nodes) {
        var html = "<h4>Processing Nodes</h4>";
        if (!nodes.length) return html + '<p class="text-muted">No processing node is available to you.</p>';
        return html + '<div class="tweakui-performance-cards">' + nodes.map(nodeHtml).join("") + "</div>";
    }

    // A core in htop's grid: its number, a bar and its share
    function coreHtml(share, i) {
        var known = share !== null && share !== undefined;
        return '<div class="tweakui-performance-core" title="Core ' + (i + 1) + ": " + (known ? percent(share) : "?") + ' busy">' +
            '<span class="tweakui-performance-core-name text-muted">' + (i + 1) + "</span>" + barHtml(known ? share : 0, 1, true) +
            '<span class="tweakui-performance-core-value">' + (known ? percent(share) : "") + "</span></div>";
    }

    // CPU Load (the total, a bar per core) once two readings give it, and the load averages where the system keeps them
    function cpuRows(cpu, load) {
        if (!cpu) return "";
        var cores = cpu.cores ? cpu.cores.length : 0, rows;
        if (load && load.total !== null) {
            rows = rowHtml("CPU Load", '<span data-cpu-total>' + percent(load.total) + "</span>" +
                (cores ? ' <span class="text-muted">of ' + cores + (cores === 1 ? " core" : " cores") + "</span>" : ""), barHtml(load.total, 1, true));
            if (load.cores.length) rows += '<tr><td colspan="2"><div class="tweakui-performance-cores">' + load.cores.map(coreHtml).join("") + "</div></td></tr>";
        } else {
            rows = rowHtml("CPU Load", '<span class="text-muted">Measuring...</span>');
        }
        if (cpu.load) {
            rows += rowHtml("Load Average", escapeHtml(cpu.load.map(function (n) { return Number(n).toFixed(2); }).join(", ")) +
                ' <span class="text-muted">(1, 5 and 15 minutes)</span>');
        }
        return rows;
    }

    // The server's card: CPU Load (of the machine WebODM runs on), disk and memory; "" when it says nothing
    function serverCardHtml(server, load) {
        var rows = cpuRows(server.cpu, load);
        if (server.disk) rows += rowHtml("Disk", memoryHtml(server.disk.free, server.disk.total));
        if (server.memory) rows += rowHtml("Memory", memoryHtml(server.memory.free, server.memory.total));
        if (!rows) return "";
        return '<div class="tweakui-performance-card tweakui-performance-server theme-border" data-server>' +
            '<h5><i class="fa fa-hdd fa-fw"></i> WebODM</h5><table class="tweakui-performance-facts">' + rows + "</table>" +
            (server.cpu ? '<p class="text-muted small tweakui-performance-cpu-note">The CPU load of the machine WebODM runs on: ' +
                "processing nodes don't report theirs. A node on the same machine shares it.</p>" : "") + "</div>";
    }

    function serverHtml(server, load) {
        var card = serverCardHtml(server, load);
        return card ? '<h4>Server</h4><div class="tweakui-performance-cards">' + card + "</div>" : "";
    }

    // The trend in a sentence: recent tasks' median time per photo against earlier ones'
    function trendText(trend) {
        if (!trend) return "";
        var recent = trend.recent.toFixed(1) + "s", earlier = trend.earlier.toFixed(1) + "s";
        if (trend.same) return "Recent tasks took about as long per photo as earlier ones (" + recent + " against " + earlier + ").";
        var perc = Math.round(Math.abs(trend.change) * 100);
        return "Recent tasks took " + perc + "% " + (trend.change < 0 ? "less" : "more") + " time per photo than earlier ones (" +
            recent + " against " + earlier + "). Photos and options differ from task to task, so take this as a hint.";
    }

    function plural(n, one, many) {
        return formatNumber(n) + " " + (n === 1 ? one : many);
    }

    // The photos: those placed in the reconstruction of those given (a warning colour when some were left out), or
    // just the photos when the report doesn't say
    function photosHtml(t) {
        var given = t.photos_given || t.images;
        if (t.photos_reconstructed === null || t.photos_reconstructed === undefined || !given) {
            return escapeHtml(t.images ? formatNumber(t.images) : "");
        }
        var text = escapeHtml(formatNumber(t.photos_reconstructed) + " of " + formatNumber(given));
        return t.photos_reconstructed < given ? '<span class="text-warning" title="Photos placed in the reconstruction, of those given">' + text + "</span>" : text;
    }

    function reconstructionsHtml(t) {
        if (!t.reconstructions) return "";
        return t.reconstructions > 1 ? '<span class="text-warning">' + escapeHtml(t.reconstructions) + "</span>" : escapeHtml(t.reconstructions);
    }

    function errorText(t, system) {
        var e = t.position_error;
        return e ? formatLength(e.meters, system) + " " + (e.kind === "gcp" ? "GCP" : "GPS") : "";
    }

    function gpuText(t) {
        return t.gpu === true ? "Yes" : t.gpu === false ? "No" : "";
    }

    // The worst of the notes' levels, for the button's icon
    function worstLevel(notes) {
        var levels = notes.map(function (n) { return n.level; });
        return levels.indexOf("danger") >= 0 ? "danger" : levels.indexOf("warning") >= 0 ? "warning" : "info";
    }

    function notesButtonHtml(t, open) {
        var notes = t.notes || [], other = t.other || [];
        if (!notes.length && !other.length) return "";
        var level = notes.length ? worstLevel(notes) : "info";
        var icon = level === "info" ? "fa-info-circle" : ICONS[level];
        var label = notes.length ? plural(notes.length, "Note", "Notes") : plural(other.length + (t.more || 0), "Message", "Messages");
        return ' <button type="button" class="btn btn-default btn-xs tweakui-performance-notes-button" data-act="notes" aria-expanded="' +
            open + '" aria-controls="tweakui-performance-notes-' + escapeHtml(t.id) + '"><i class="fa ' + icon + " text-" + level +
            '"></i> ' + escapeHtml(label) + "</button>";
    }

    // A task's notes from its log, each with its line, and the log's other messages in a list that opens
    function notesHtml(t) {
        var notes = t.notes || [], other = t.other || [];
        var html = notes.length ? '<ul class="list-unstyled tweakui-performance-notes">' + notes.map(function (n) {
            var icon = n.level === "info" ? "fa-info-circle" : ICONS[n.level] || ICONS.warning;
            return '<li data-note="' + escapeHtml(n.key) + '"><i class="fa ' + icon + " fa-fw text-" + escapeHtml(n.level) + '"></i> ' +
                escapeHtml(n.text) + (n.line ? '<div class="text-muted small tweakui-performance-line"><code>' + escapeHtml(n.line) + "</code></div>" : "") + "</li>";
        }).join("") + "</ul>" : "";
        if (other.length) {
            var count = other.length + (t.more || 0);
            html += '<details class="tweakui-performance-other"><summary>Other Messages (' + escapeHtml(formatNumber(count)) + ")</summary>" +
                '<ul class="list-unstyled small">' + other.map(function (m) {
                    return "<li><code>" + escapeHtml(m.text) + "</code>" + (m.count > 1 ? ' <span class="text-muted">(' + escapeHtml(formatNumber(m.count)) + " times)</span>" : "") + "</li>";
                }).join("") + (t.more ? '<li class="text-muted">' + escapeHtml(plural(t.more, "more message", "more messages")) + " not shown.</li>" : "") +
                "</ul></details>";
        }
        return html;
    }

    function statusHtml(t) {
        if (t.status === "failed") {
            return '<div class="text-danger small" data-status="failed"><i class="fa ' + ICONS.danger + '"></i> Failed' +
                (t.error ? ": " + escapeHtml(t.error) : "") + "</div>";
        }
        if (t.status === "canceled") return '<div class="text-muted small" data-status="canceled"><i class="fa fa-ban"></i> Canceled</div>';
        return "";
    }

    // At phone width the wide columns are hidden; their figures come in a line under the task's name
    function detailHtml(t, system) {
        var parts = [];
        if (t.created_at) parts.push(new Date(t.created_at).toLocaleDateString());
        if (t.slowest_step) parts.push("Slowest " + t.slowest_step.name + " " + formatDuration(t.slowest_step.seconds));
        if (t.area !== null && t.area !== undefined) parts.push(formatArea(t.area, system));
        if (t.reconstructions) parts.push(plural(t.reconstructions, "reconstruction", "reconstructions"));
        if (t.position_error) parts.push(errorText(t, system) + " error");
        if (gpuText(t)) parts.push("GPU: " + gpuText(t));
        if (t.node) parts.push(t.node);
        return parts.length ? '<div class="text-muted small tweakui-performance-detail">' + escapeHtml(parts.join(" \u00b7 ")) + "</div>" : "";
    }

    function taskHtml(t, system) {
        var name = t.name || "Task of " + (t.created_at ? t.created_at.slice(0, 10) : "?");
        var where = escapeHtml(t.project.name) + (t.owner ? " of " + escapeHtml(t.owner) : "");
        var open = t.status === "failed";
        var notes = notesButtonHtml(t, open);
        var wide = "tweakui-performance-wide ";
        return '<tr data-task="' + escapeHtml(t.id) + '"' + (t.status ? ' data-status="' + escapeHtml(t.status) + '"' : "") + '><td><a href="/map/project/' +
            escapeHtml(t.project.id) + "/task/" + escapeHtml(t.id) + '/">' + escapeHtml(name) + "</a>" + notes +
            '<div class="text-muted small">' + where + "</div>" + statusHtml(t) + detailHtml(t, system) + "</td>" +
            '<td class="' + wide + 'tweakui-performance-date">' + escapeHtml(t.created_at ? new Date(t.created_at).toLocaleDateString() : "") + "</td>" +
            '<td class="tweakui-performance-number">' + photosHtml(t) + "</td>" +
            '<td class="tweakui-performance-number">' + escapeHtml(formatDuration(t.seconds)) + "</td>" +
            '<td class="tweakui-performance-number">' + escapeHtml(t.seconds_per_image ? t.seconds_per_image.toFixed(1) + "s" : "") + "</td>" +
            '<td class="' + wide + 'tweakui-performance-step">' + (t.slowest_step ? escapeHtml(t.slowest_step.name) + ' <span class="text-muted">' +
                escapeHtml(formatDuration(t.slowest_step.seconds)) + "</span>" : "") + "</td>" +
            '<td class="' + wide + 'tweakui-performance-number">' + escapeHtml(formatArea(t.area, system)) + "</td>" +
            '<td class="' + wide + 'tweakui-performance-number">' + reconstructionsHtml(t) + "</td>" +
            '<td class="' + wide + 'tweakui-performance-number">' + escapeHtml(errorText(t, system)) + "</td>" +
            '<td class="' + wide + 'tweakui-performance-gpu">' + escapeHtml(gpuText(t)) + "</td>" +
            '<td class="' + wide + 'tweakui-performance-node">' + escapeHtml(t.node || "") + "</td></tr>" +
            (notes ? '<tr class="tweakui-performance-notes-row" id="tweakui-performance-notes-' + escapeHtml(t.id) + '"' + (open ? "" : " hidden") +
                '><td colspan="' + TASK_COLUMNS + '">' + notesHtml(t) + "</td></tr>" : "");
    }

    function tasksHtml(report, system) {
        var html = "<h4>Recent Processing</h4>";
        if (!report.tasks.length) return html + '<p class="text-muted">No finished tasks yet.</p>';
        var trend = trendText(report.trend);
        var wide = ' class="tweakui-performance-wide ';
        return html + '<p class="text-muted">The last ' + report.tasks.length + " finished " + (report.tasks.length === 1 ? "task" : "tasks") +
            (report.admin ? " on this server" : " of yours") + " (completed, failed or canceled), newest first.</p>" +
            (trend ? '<p class="tweakui-performance-trend">' + escapeHtml(trend) + "</p>" : "") +
            '<div class="tweakui-performance-scroll"><table class="table tweakui-performance-table"><thead><tr><th>Task</th>' +
            "<th" + wide + 'tweakui-performance-date">Created</th>' +
            '<th class="tweakui-performance-number" title="Photos placed in the reconstruction, of those given">Photos</th>' +
            '<th class="tweakui-performance-number">Time</th><th class="tweakui-performance-number">Per Photo</th>' +
            "<th" + wide + 'tweakui-performance-step" title="Of the structure-from-motion steps ODM times in its report (stats.json); the later steps are not timed one by one">Slowest SfM Step</th>' +
            "<th" + wide + 'tweakui-performance-number" title="The area the photos cover, from the task\'s report">Area</th>' +
            "<th" + wide + 'tweakui-performance-number" title="Separate reconstructions the photos made before they were merged: more than one means some areas did not overlap enough">Reconstructions</th>' +
            "<th" + wide + 'tweakui-performance-number" title="The reconstruction\'s average distance from the photos\' GPS positions, or from the ground control points when the task had them">Position Error</th>' +
            "<th" + wide + 'tweakui-performance-gpu" title="Whether the node used a GPU, from the task\'s log">GPU</th>' +
            "<th" + wide + 'tweakui-performance-node">Node</th></tr></thead><tbody>' +
            report.tasks.map(function (t) { return taskHtml(t, system); }).join("") + "</tbody></table></div>";
    }

    function render(page, report, load, system) {
        page.querySelector(".tweakui-performance-body").innerHTML = verdictsHtml(report.verdicts) + nodesHtml(report.nodes) +
            serverHtml(report.server, load) + tasksHtml(report, system) +
            '<p class="text-muted small tweakui-performance-note">Memory sizing follows <a href="' + REQUIREMENTS +
            '" target="_blank" rel="noopener noreferrer">WebODM\'s hardware requirements</a>, which are conservative. ' +
            "In Docker, a node has the memory Docker gives it.</p>";
    }

    // Refresh Every on the page: a slider and a box, each change applied at once (apply(seconds)) and saved to the
    // user's settings when the slider is let go or the box left; a box not a whole number in range, or a save refused,
    // puts back the saved value and says why
    function everyControl(doc, win, page, apply, fetchFn) {
        var slider = page.querySelector(".tweakui-performance-every-slider");
        var input = page.querySelector("#tweakui-performance-refresh");
        var status = page.querySelector(".tweakui-performance-every-status");
        if (!slider || !input) return null;
        var min = Number(input.min) || EVERY_MIN, max = Number(input.max) || EVERY_MAX;
        var value = ui.wholeNumber(input.value, min, max), saved = typeof value === "number" ? value : EVERY_DEFAULT;
        function say(text) { if (status) status.textContent = text || ""; }
        function show(v) { slider.value = v; input.value = v; }
        function putBack(reason) {
            show(saved);
            apply(saved);
            say("Not saved: " + reason);
        }
        function commit(v) {
            if (v === saved) return Promise.resolve();
            return ui.saveSettings(doc, win, {performance_refresh: v}, fetchFn).then(function () {
                saved = v;
                say("");
            }, function (e) { putBack(e.message); });
        }
        slider.addEventListener("input", ui.guard(NAME, function () {
            input.value = slider.value;
            say("");
            apply(Number(slider.value));
        }));
        slider.addEventListener("change", ui.guard(NAME, function () { return commit(Number(slider.value)); }));
        input.addEventListener("input", ui.guard(NAME, function () {
            var v = ui.wholeNumber(input.value, min, max);
            if (typeof v !== "number") return;
            slider.value = v;
            say("");
            apply(v);
        }));
        input.addEventListener("change", ui.guard(NAME, function () {
            var v = ui.wholeNumber(input.value, min, max);
            return typeof v === "number" ? commit(v) : putBack(v);
        }));
        return {seconds: saved, slider: slider, input: input, commit: commit};
    }

    function start(doc, win, fetchFn) {
        var page = doc.getElementById("tweakui-performance");
        if (!page || !page.querySelector(".tweakui-performance-body")) return null;
        fetchFn = fetchFn || (win.fetch && win.fetch.bind(win));
        var api = page.getAttribute("data-api"), button = page.querySelector("[data-act=refresh]");
        var status = page.querySelector(".tweakui-performance-status");
        var state = {report: null, cpu: null, load: null, seconds: EVERY_DEFAULT, diskAt: 0, timer: null, busy: false,
            looping: false, stopped: false};

        function ask(path) {
            return fetchFn(api + path, {credentials: "same-origin"}).then(function (res) {
                if (!res.ok) throw new Error(res.status);
                return res.json();
            });
        }

        // A new reading of the CPU counters: the load since the last one
        function reading(cpu) {
            state.load = cpuShares(state.cpu, cpu);
            state.cpu = cpu || null;
        }

        // The next live refresh in `delay` ms, none while the tab is hidden or once stopped
        function schedule(delay) {
            if (state.timer) win.clearTimeout(state.timer);
            state.timer = null;
            if (state.stopped || doc.hidden) return;
            state.timer = win.setTimeout(ui.guard(NAME, tick), delay);
        }

        function redrawServer() {
            var card = page.querySelector("[data-server]"), html = serverCardHtml(state.report.server, state.load);
            if (card && html) card.outerHTML = html;
        }

        function applyLive(data) {
            var server = state.report.server;
            reading(data.cpu);
            server.cpu = data.cpu || null;
            if (data.memory) server.memory = data.memory;
            if ("disk" in data) {
                if (data.disk) server.disk = data.disk;
                state.diskAt = Date.now();
            }
            redrawServer();
            (data.nodes || []).forEach(function (n) {
                var cell = page.querySelector('[data-node="' + String(n.id).replace(/["\\]/g, "") + '"] [data-memory]');
                if (cell && n.online && n.total_memory) cell.innerHTML = memoryHtml(n.available_memory, n.total_memory);
            });
        }

        // The live figures; the next is asked once this one is answered, so a slow server is never asked twice at once
        function tick() {
            state.timer = null;
            var disk = Date.now() - state.diskAt >= DISK_EVERY;
            state.busy = true;
            return ask("performance/live" + (disk ? "?disk=1" : "")).then(function (data) {
                if (state.report && !state.stopped) applyLive(data);
            }, function () {
                // The last figures stay; the next refresh tries again
            }).then(function () {
                state.busy = false;
                schedule(state.seconds * 1000);
            });
        }

        function load() {
            if (button) button.disabled = true;
            if (status) status.textContent = state.report ? "Refreshing..." : "";
            return ask("performance").then(function (report) {
                state.report = report;
                reading(report.server && report.server.cpu);
                state.diskAt = Date.now();
                render(page, report, state.load, unitSystem(win));
                if (status) status.textContent = "Updated " + new Date().toLocaleTimeString();
                if (!state.looping) {
                    state.looping = true;
                    schedule(Math.min(FIRST_LIVE, state.seconds * 1000));
                }
            }, function () {
                if (state.report) {
                    if (status) status.textContent = "Could not refresh.";
                } else {
                    page.querySelector(".tweakui-performance-body").innerHTML = '<p class="text-danger">Could not load the performance report.</p>';
                }
            }).then(function () {
                if (button) button.disabled = false;
            });
        }

        var every = everyControl(doc, win, page, function (seconds) {
            state.seconds = seconds;
            if (state.timer) schedule(seconds * 1000);
        }, fetchFn);
        if (every) state.seconds = every.seconds;

        var onVisibility = ui.guard(NAME, function () {
            if (doc.hidden) schedule(0);
            else if (state.looping && !state.busy) schedule(0);
        });
        doc.addEventListener("visibilitychange", onVisibility);

        // The maps' unit system changed (in another tab, or Units in Header): the figures again in it
        var onUnits = ui.guard(NAME, function () {
            if (state.report) render(page, state.report, state.load, unitSystem(win));
        });
        doc.addEventListener(UNIT_EVENT, onUnits);

        function stop() {
            state.stopped = true;
            schedule(0);
            doc.removeEventListener("visibilitychange", onVisibility);
            doc.removeEventListener(UNIT_EVENT, onUnits);
        }

        // A task's Notes button opens and closes the row of its notes below it
        page.addEventListener("click", ui.guard(NAME, function (e) {
            var toggle = e.target && e.target.closest ? e.target.closest("[data-act=notes]") : null;
            if (!toggle) return;
            var row = doc.getElementById(toggle.getAttribute("aria-controls"));
            if (!row) return;
            var open = toggle.getAttribute("aria-expanded") !== "true";
            toggle.setAttribute("aria-expanded", String(open));
            row.hidden = !open;
        }));

        if (button) button.addEventListener("click", ui.guard(NAME, load));
        var loaded = load();
        return {state: state, load: load, loaded: loaded, tick: tick, stop: stop, every: every};
    }

    return {start: start, formatBytes: formatBytes, formatDuration: formatDuration, formatNumber: formatNumber,
        trendText: trendText, verdictsHtml: verdictsHtml, formatArea: formatArea, formatLength: formatLength,
        tasksHtml: tasksHtml, notesHtml: notesHtml, nodeHtml: nodeHtml, barHtml: barHtml, cpuShares: cpuShares, cpuRows: cpuRows};
});
