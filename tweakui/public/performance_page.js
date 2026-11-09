// Diagnostic > Performance (templates/performance.html): verdicts at the top, then a card per processing node the
// user may use (what it says of itself: cores, memory, queue), the server's disk and memory, and the recent finished
// tasks (an admin's: every user's) with their time per photo, figures from their report, notes from their log and a
// trend (performance.py and task_log.py through the plugin's API). Areas and errors are in WebODM's unit system (the
// maps' choice, Units.js's localStorage "unit_system"), redrawn when it changes.
// Asked on opening and with Refresh. The server's CPU load and memory, each drive's activity and the nodes' memory
// are asked again every Refresh Every seconds (a setting, also on the page), the disk's free space every 10 seconds,
// while the browser tab is shown.
// UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "performance_page", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    var REQUIREMENTS = "https://docs.webodm.org/installation/#hardware-requirements";
    var ICONS = {success: "fa-check-circle", warning: "fa-exclamation-triangle", danger: "fa-times-circle", info: "fa-info-circle"};
    // General Assessment's edge takes its worst line's level, in this order
    var LEVELS = ["danger", "warning", "info", "success"];
    // A bar turns to a warning past this share used, and to danger past the next
    var FULL_WARNING = 0.8, FULL_DANGER = 0.95;
    var NAME = "performance_page";
    // The live figures: the first asked this long after the report (a load needs two readings), the disk this often
    var FIRST_LIVE = 1000, DISK_EVERY = 10000;
    // Refresh Every's and History Length's defaults (features.py), when the page doesn't say
    var EVERY_DEFAULT = 3, HISTORY_DEFAULT = 5;
    // The graphs: the readings kept (History Length's longest), the drawing's size (stretched to the card's width), and
    // a line broken where readings stopped for this many refreshes (the tab hidden), or at least this long
    var HISTORY_KEEP = 30 * 60000, GRAPH_W = 300, GRAPH_H = 44, GAP_REFRESHES = 3, GAP_MIN = 15000;
    // The readings kept for the tab over a reload (sessionStorage): the key, saved at most this often while the page is
    // open (and when it is hidden or left)
    var SAVED_KEY = "tweakui.performance.readings", SAVE_EVERY = 5000;
    // WebODM's unit system (Units.js): where it keeps it and the event it fires when it changes
    var UNIT_KEY = "unit_system", UNIT_EVENT = "onUnitSystemChanged";
    var FT = 3.28083989501, FT2_ACRE = 43560;
    // Recent Task History's columns (a notes row spans them all)
    var TASK_COLUMNS = 11;
    // Photos Left Out: a name opens the photo this large (WebODM's thumbnail: its download is an attachment), and
    // hovering it shows it this large
    var PHOTO_OPEN = 2048, PHOTO_HOVER = 256;
    var REASONS = {no_features: "No features", no_gps: "No GPS"};
    var RESTART_QUESTION = "Restart this task from Load Dataset? Its results are replaced when it finishes.";
    // Process View (superusers): on or off kept for the tab (sessionStorage, as the graphs' readings), and what it says
    // when WebODM's server runs in a container
    var PROCESSES_KEY = "tweakui.performance.processes";
    var CONTAINER_NOTE = "Processes WebODM's server can see. In Docker that is its own container: the processing node's " +
        "work runs in its own and isn't listed.";

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
    // always in the theme's colour for bars (theme.css colours only progress-bar-success); its title says "busy" for
    // plain bars and when told (a disk's, coloured as it fills: a disk always busy holds the work up)
    function barHtml(used, total, plain, busy) {
        var share = total > 0 ? Math.min(Math.max(used / total, 0), 1) : 0;
        var kind = " progress-bar-" + (plain || share < FULL_WARNING ? "success" : share >= FULL_DANGER ? "danger" : "warning");
        return '<div class="progress tweakui-performance-progress" title="' + Math.round(share * 100) + (plain || busy ? "% busy" : "% used") + '">' +
            '<div class="progress-bar' + kind + '" style="width: ' + (share * 100).toFixed(0) + '%"></div></div>';
    }

    function percent(share) {
        return Math.round(share * 100) + "%";
    }

    // The warning colours a bar took, for a share shown as a figure beside its graph
    function levelClass(share) {
        return share >= FULL_DANGER ? "text-danger" : share >= FULL_WARNING ? "text-warning" : "";
    }

    // A reading [time, value] added to its series in history ({key: [[time, value], ...]}), readings older than
    // HISTORY_KEEP dropped
    function record(history, key, time, value) {
        if (value === null || value === undefined || isNaN(value)) return;
        var list = history[key] || (history[key] = []);
        list.push([time, value]);
        while (list.length && list[0][0] < time - HISTORY_KEEP) list.shift();
    }

    // What the page keeps over a reload: its readings (values rounded, which is all a graph shows) and the last CPU and
    // disk counters, with when they were saved
    function packReadings(state, now) {
        var history = {};
        Object.keys(state.history).forEach(function (key) {
            history[key] = state.history[key].map(function (p) { return [p[0], Math.round(p[1] * 10000) / 10000]; });
        });
        return {at: now, history: history, cpu: state.cpu, io: state.io};
    }

    // What packReadings kept, read back at now: {history, cpu, io}, the readings older than HISTORY_KEEP dropped, and the
    // counters only when they were saved within gap ms (else a load would span the time the page was closed); null for
    // anything else (none saved, or not what packReadings writes)
    function unpackReadings(data, now, gap) {
        if (!data || typeof data !== "object" || typeof data.at !== "number" || !data.history || typeof data.history !== "object") return null;
        var history = {};
        Object.keys(data.history).forEach(function (key) {
            var list = data.history[key];
            if (!Array.isArray(list)) return;
            list = list.filter(function (p) {
                return Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number" && p[0] >= now - HISTORY_KEEP && p[0] <= now;
            });
            if (list.length) history[key] = list;
        });
        var recent = now - data.at >= 0 && now - data.at <= gap;
        return {history: history, cpu: recent && data.cpu ? data.cpu : null, io: recent && data.io ? data.io : null};
    }

    // A scale's top for the highest value: 1, 2 or 5 times a power of ten, at least 1
    function niceCeil(n) {
        if (!(n > 1)) return 1;
        var power = Math.pow(10, Math.floor(Math.log(n) / Math.LN10));
        var steps = [1, 2, 5, 10];
        for (var i = 0; i < steps.length; i++) if (steps[i] * power >= n) return steps[i] * power;
        return 10 * power;
    }

    // A series' readings in the window as runs, a run broken where readings stopped for longer than gap
    function runs(list, from, gap) {
        var out = [], run = null, last = null;
        list.forEach(function (p) {
            if (p[0] < from - gap) return;
            if (!run || p[0] - last > gap) out.push(run = []);
            run.push(p);
            last = p[0];
        });
        return out;
    }

    function graphValue(kind, v) {
        return kind === "rate" ? formatRate(v) : percent(v);
    }

    // How far back a graph's window starts, as its time line says: "5 min ago"
    function spanText(ms) {
        var minutes = Math.round(ms / 60000);
        return minutes >= 1 ? formatNumber(minutes) + " min ago" : Math.round(ms / 1000) + " s ago";
    }

    // A graph of one or two series over the last view.span ms (view: {history, now, span, gap}; none draws an empty
    // one): the newest at the right, a percent graph from 0 to 100%, a rate graph up to its highest reading in the window.
    // Its scale is inside it: the top (100%, or the rate's top once it has readings) at top left, 0 at bottom left and a
    // faint line at half height; under it, its time line (the window's start, Now) and, for two series, a legend. The
    // first series is in the theme's link colour (the bars' colour, start's accent) with a light fill under it, the
    // second in its text colour. Hovering it shows the readings under the pointer (start's hover)
    function graphHtml(view, id, series, kind) {
        var from = view ? view.now - view.span : 0, span = view ? view.span : 1, gap = view ? view.gap : 0;
        var lists = series.map(function (s) { return view ? runs(view.history[s.key] || [], from, gap) : []; });
        var max = 1, top = 0, any = false;
        lists.forEach(function (rs) { rs.forEach(function (r) { r.forEach(function (p) { if (p[0] >= from) { any = true; top = Math.max(top, p[1]); } }); }); });
        if (kind === "rate") max = niceCeil(top);
        function x(t) { return ((t - from) / span * GRAPH_W).toFixed(1); }
        function y(v) { return (GRAPH_H - 1 - Math.min(Math.max(v / max, 0), 1) * (GRAPH_H - 2)).toFixed(1); }
        var paths = lists.map(function (rs, i) {
            var html = rs.map(function (r) {
                var line = "M" + r.map(function (p) { return x(p[0]) + " " + y(p[1]); }).join(" L") + (r.length === 1 ? " h0" : "");
                var area = i === 0 && r.length > 1 ? '<path class="tweakui-performance-graph-area" d="' + line + " L" + x(r[r.length - 1][0]) +
                    " " + GRAPH_H + " L" + x(r[0][0]) + " " + GRAPH_H + ' Z"></path>' : "";
                return area + '<path d="' + line + '"></path>';
            }).join("");
            return '<g class="' + (i === 0 ? "tweakui-performance-accent" : "theme-color-primary") + '">' + html + "</g>";
        }).join("");
        return '<div class="tweakui-performance-graph theme-border" data-graph="' + escapeHtml(id) + '" data-kind="' + kind +
            '" data-series="' + escapeHtml(series.map(function (s) { return s.key; }).join(" ")) + '" data-labels="' +
            escapeHtml(series.map(function (s) { return s.label || ""; }).join("|")) + '">' +
            (kind === "percent" || any ? '<span class="tweakui-performance-graph-max text-muted" aria-hidden="true">' +
                escapeHtml(kind === "rate" ? formatRate(max) : "100%") + "</span>" : "") +
            '<span class="tweakui-performance-graph-zero text-muted" aria-hidden="true">0</span>' +
            '<svg viewBox="0 0 ' + GRAPH_W + " " + GRAPH_H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
            '<line class="tweakui-performance-graph-grid" x1="0" x2="' + GRAPH_W + '" y1="' + GRAPH_H / 2 + '" y2="' + GRAPH_H / 2 + '"></line>' +
            paths + "</svg></div>" +
            (view ? '<div class="tweakui-performance-graph-axis text-muted small" aria-hidden="true"><span>' + escapeHtml(spanText(span)) +
                "</span><span>Now</span></div>" : "") +
            (series.length > 1 ? '<div class="tweakui-performance-graph-legend small" aria-hidden="true">' + series.map(function (s, i) {
                return '<span><i class="tweakui-performance-graph-swatch ' + (i === 0 ? "tweakui-performance-accent" : "theme-color-primary") +
                    '" aria-hidden="true"></i> ' + escapeHtml((s.label || "") + (kind === "rate" ? " (/s)" : "")) + "</span>";
            }).join("") + "</div>" : "");
    }

    // What a graph's hover says at time t: each series' reading nearest it (within view.gap), then the time; "" without
    function graphTip(view, keys, labels, kind, t) {
        var parts = [], at = null;
        keys.forEach(function (key, i) {
            var best = null;
            (view.history[key] || []).forEach(function (p) { if (!best || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p; });
            if (!best || Math.abs(best[0] - t) > view.gap) return;
            parts.push((labels[i] ? labels[i] + " " : "") + graphValue(kind, best[1]));
            at = best[0];
        });
        return parts.length ? parts.join(" \u00b7 ") + " \u00b7 " + new Date(at).toLocaleTimeString() : "";
    }

    // Free of total, the share used (in the warning colours past 80% and 95%) and its graph
    function memoryGraphHtml(free, total, view, key) {
        var share = total > 0 ? (total - free) / total : 0;
        return freeOf(free, total) + ' <span class="text-muted">\u00b7</span> <span class="' + levelClass(share) + '" data-used>' +
            percent(share) + " used</span>" + graphHtml(view, key, [{key: key}], "percent");
    }

    // The CPU's busy share between two readings of its counters ({total: [busy, total]}, the API's): {total}, from 0
    // to 1, or null where the counters didn't move; null without two readings
    function cpuShares(prev, next) {
        if (!prev || !next) return null;
        var a = prev.total, b = next.total, all = a && b ? b[1] - a[1] : 0;
        return {total: all > 0 ? Math.min(Math.max((b[0] - a[0]) / all, 0), 1) : null};
    }

    // Each drive's activity between two readings of its counters ({time, drives}, the API's): {name: {reads, writes
    // (per second), read_rate, write_rate (bytes per second), read_size, write_size (bytes per operation, null without
    // any), busy (0 to 1), wait (ms per operation, null without any)}}; a drive whose counters went back (restarted,
    // wrapped) is left out; null without two readings
    function diskShares(prev, next) {
        if (!prev || !next || !(next.time > prev.time)) return null;
        var seconds = next.time - prev.time, before = {}, out = {};
        prev.drives.forEach(function (d) { before[d.name] = d; });
        next.drives.forEach(function (d) {
            var a = before[d.name];
            if (!a) return;
            var delta = {};
            var keys = ["reads", "writes", "read_bytes", "write_bytes", "read_ms", "write_ms", "busy_ms", "idle_ms"];
            for (var i = 0; i < keys.length; i++) {
                if (!(keys[i] in d)) continue;
                delta[keys[i]] = d[keys[i]] - a[keys[i]];
                if (!(delta[keys[i]] >= 0)) return;
            }
            var ops = delta.reads + delta.writes, ms = seconds * 1000;
            var busy = "busy_ms" in delta ? delta.busy_ms / ms : "idle_ms" in delta ? 1 - delta.idle_ms / ms : null;
            out[d.name] = {reads: delta.reads / seconds, writes: delta.writes / seconds,
                read_rate: delta.read_bytes / seconds, write_rate: delta.write_bytes / seconds,
                read_size: delta.reads ? delta.read_bytes / delta.reads : null,
                write_size: delta.writes ? delta.write_bytes / delta.writes : null,
                busy: busy === null ? null : Math.min(Math.max(busy, 0), 1),
                wait: ops ? (delta.read_ms + delta.write_ms) / ops : null};
        });
        return out;
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

    function lineHtml(level, html, attrs) {
        return '<li data-level="' + escapeHtml(level) + '"' + (attrs || "") + '><i class="fa ' + (ICONS[level] || ICONS.warning) +
            " fa-fw text-" + escapeHtml(level) + '"></i> ' + html + "</li>";
    }

    // Recent Task History's problems in a sentence ({level, text}), from the tasks the report lists: those that failed
    // (and how many ran out of memory) and those that left photos out; null when none did
    function tasksSummary(report) {
        var tasks = report.tasks || [], failed = 0, memory = 0, leftOut = 0;
        tasks.forEach(function (t) {
            var keys = (t.notes || []).map(function (n) { return n.key; });
            if (t.status === "failed") {
                failed++;
                if (keys.indexOf("out_of_memory") >= 0) memory++;
            }
            if (keys.indexOf("left_out") >= 0) leftOut++;
        });
        if (!failed && !leftOut) return null;
        var parts = [], level = failed ? "warning" : "info";
        if (tasks.length === 1) {
            if (failed) parts.push("failed" + (memory ? " (it ran out of memory)" : ""));
            if (leftOut) parts.push("left photos out");
            return {level: level, text: (report.admin ? "The last task on this server " : "Your last task ") + parts.join(" and ") + "."};
        }
        if (failed) parts.push(formatNumber(failed) + " failed" + (memory ? " (" + formatNumber(memory) + " ran out of memory)" : ""));
        if (leftOut) parts.push(formatNumber(leftOut) + " left photos out");
        var whose = report.admin ? "Of the last " + plural(tasks.length, "task", "tasks") + " on this server, " :
            "Of your last " + plural(tasks.length, "task", "tasks") + ", ";
        return {level: level, text: whose + parts.join(" and ") + "."};
    }

    // General Assessment: a card of the verdicts, Recent Task History's problems (linking down to it) and the time-per-photo
    // trend, its left edge in its worst line's colour; nothing without any of them
    function assessmentHtml(report) {
        var verdicts = report.verdicts || [], summary = tasksSummary(report), trend = trendText(report.trend);
        var lines = verdicts.map(function (v) { return lineHtml(v.level, escapeHtml(v.text)); });
        if (summary) {
            lines.push(lineHtml(summary.level, escapeHtml(summary.text) + ' <a href="#tweakui-performance-recent">See their Notes in Recent Task History</a>.',
                " data-summary"));
        }
        if (trend) lines.push(lineHtml("info", escapeHtml(trend), ' class="tweakui-performance-trend"'));
        if (!lines.length) return "";
        var levels = verdicts.map(function (v) { return v.level; }).concat(summary ? [summary.level] : [], trend ? ["info"] : []);
        var worst = LEVELS.filter(function (l) { return levels.indexOf(l) >= 0; })[0] || "info";
        return '<section class="tweakui-performance-assessment theme-background-highlight theme-border" data-level="' + worst + '">' +
            '<span class="tweakui-performance-assessment-edge text-' + worst + '" aria-hidden="true"></span>' +
            '<h4>General Assessment</h4><ul class="tweakui-performance-verdicts list-unstyled">' + lines.join("") + "</ul></section>";
    }

    function nodeHtml(n, view) {
        var rows = "";
        var engine = [n.engine ? String(n.engine).toUpperCase() : "", n.engine_version && n.engine_version !== "?" ? n.engine_version : ""]
            .join(" ").trim();
        if (engine) rows += rowHtml("Engine", escapeHtml(engine) + (n.version && n.version !== "?" ? ' <span class="text-muted">(API ' + escapeHtml(n.version) + ")</span>" : ""));
        if (n.online) {
            if (n.cpu_cores) rows += rowHtml("CPU Cores", escapeHtml(n.cpu_cores));
            if (n.total_memory) rows += '<tr><th>Memory</th><td data-memory>' + memoryGraphHtml(n.available_memory, n.total_memory, view, "node:" + n.id) + "</td></tr>";
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

    function nodesHtml(nodes, view) {
        var html = "<h4>Processing Nodes</h4>";
        if (!nodes.length) return html + '<p class="text-muted">No processing node is available to you.</p>';
        return html + '<div class="tweakui-performance-cards">' + nodes.map(function (n) { return nodeHtml(n, view); }).join("") + "</div>";
    }

    // CPU Load (the total of all cores) once two readings give it, and the load averages where the system keeps them
    function cpuRows(cpu, load, view) {
        if (!cpu) return "";
        var cores = cpu.cores || 0, rows;
        if (load && load.total !== null) {
            rows = rowHtml("CPU Load", '<span data-cpu-total>' + percent(load.total) + "</span>" +
                (cores ? ' <span class="text-muted">of ' + cores + (cores === 1 ? " core" : " cores") + "</span>" : ""), graphHtml(view, "cpu", [{key: "cpu"}], "percent"));
        } else {
            rows = rowHtml("CPU Load", '<span class="text-muted">Measuring...</span>', graphHtml(view, "cpu", [{key: "cpu"}], "percent"));
        }
        if (cpu.load) {
            rows += rowHtml("Load Average", escapeHtml(cpu.load.map(function (n) { return Number(n).toFixed(2); }).join(", ")) +
                ' <span class="text-muted">(1, 5 and 15 minutes)</span>');
        }
        return rows;
    }

    // Operations per second: one decimal under 10
    function formatRate(n) {
        return (n < 10 ? n.toFixed(1).replace(/\.0$/, "") : formatNumber(Math.round(n))) + "/s";
    }

    // Reads or writes: per second, bytes per second and the average size of one (small means scattered work)
    function ioText(ops, rate, size) {
        if (!ops) return "None";
        return escapeHtml(formatRate(ops) + " \u00b7 " + formatBytes(rate) + "/s") +
            (size ? ' <span class="text-muted">\u00b7 ' + escapeHtml(formatBytes(size)) + " each</span>" : "");
    }

    // A drive's card: where it is mounted, then its activity once two readings give it
    function driveCardHtml(d, rates, view) {
        var rows = rowHtml("Mounted At", escapeHtml(d.mounts.join(", ")));
        if (!rates) {
            rows += rowHtml("Activity", '<span class="text-muted">Measuring...</span>');
        } else {
            var key = "drive:" + d.name + ":";
            rows += rowHtml("Reads", '<i class="tweakui-performance-swatch tweakui-performance-accent"></i>' + ioText(rates.reads, rates.read_rate, rates.read_size));
            rows += rowHtml("Writes", '<i class="tweakui-performance-swatch theme-color-primary"></i>' + ioText(rates.writes, rates.write_rate, rates.write_size));
            rows += "<tr><th></th><td>" + graphHtml(view, key + "ops", [{key: key + "reads", label: "Reads"}, {key: key + "writes", label: "Writes"}], "rate") + "</td></tr>";
            if (rates.busy !== null) {
                rows += rowHtml("Busy", '<span class="' + levelClass(rates.busy) + '" data-busy>' + percent(rates.busy) + "</span>",
                    graphHtml(view, key + "busy", [{key: key + "busy"}], "percent"));
            }
            rows += rowHtml("Wait", rates.wait === null ? '<span class="text-muted">No operations</span>'
                : escapeHtml(rates.wait.toFixed(1)) + ' ms <span class="text-muted">per operation</span>');
        }
        return '<div class="tweakui-performance-card tweakui-performance-drive theme-border" data-drive="' + escapeHtml(d.name) + '">' +
            '<h5><i class="far fa-hdd fa-fw"></i> ' + escapeHtml(d.name) + (d.tasks ? ' <span class="text-muted">\u00b7 Tasks</span>' : "") +
            '</h5><table class="tweakui-performance-facts">' + rows + "</table></div>";
    }

    // The server's card: CPU Load (of the machine WebODM runs on), disk and memory; "" when it says nothing
    function serverCardHtml(server, load, view) {
        var rows = cpuRows(server.cpu, load, view);
        if (server.disk) rows += rowHtml("Disk", memoryHtml(server.disk.free, server.disk.total));
        if (server.memory) rows += rowHtml("Memory", memoryGraphHtml(server.memory.free, server.memory.total, view, "memory"));
        if (!rows) return "";
        return '<div class="tweakui-performance-card tweakui-performance-server theme-border" data-server>' +
            '<h5><i class="fa fa-hdd fa-fw"></i> WebODM</h5><table class="tweakui-performance-facts">' + rows + "</table>" +
            (server.cpu ? '<p class="text-muted small tweakui-performance-cpu-note">The CPU load of the machine WebODM runs on: ' +
                "processing nodes don't report theirs. A node on the same machine shares it.</p>" : "") + "</div>";
    }

    // The server's card, then a card per drive it uses (diskRates: diskShares's, or null while measuring)
    function serverCardsHtml(server, load, diskRates, view) {
        var io = server.disk_io;
        return serverCardHtml(server, load, view) + (io ? io.drives.map(function (d) {
            return driveCardHtml(d, diskRates && diskRates[d.name], view);
        }).join("") : "");
    }

    function serverHtml(server, load, diskRates, view) {
        var cards = serverCardsHtml(server, load, diskRates, view);
        if (!cards) return "";
        return '<h4>Server</h4><div class="tweakui-performance-cards" data-server-cards>' + cards + "</div>" +
            (server.disk_io ? '<p class="text-muted small tweakui-performance-disk-note">Disk activity is what the system counts for each ' +
                "whole disk: in Docker, the disks of the machine Docker runs on, so a processing node's work on them counts too. " +
                "Small operations mean scattered (random) work, large ones sequential.</p>" : "");
    }

    // A process's row: its command line on one line (whole in its title) with a copy button, its CPU as a share of one
    // core (as top shows it; of all cores in its title) and its resident memory with its share of the machine's
    function processRowHtml(p, cores, total) {
        var cpu = p.cpu === null || p.cpu === undefined ? '<span class="text-muted">Measuring...</span>' :
            "<span" + (cores ? ' title="' + escapeHtml((p.cpu / cores).toFixed(1) + "% of all " + plural(cores, "core", "cores")) + '"' : "") +
            ">" + escapeHtml(p.cpu.toFixed(1)) + "%</span>";
        var command = p.command ? '<code class="tweakui-performance-command" title="' + escapeHtml(p.command) + '">' + escapeHtml(p.command) +
            '</code> <button type="button" class="btn btn-default btn-xs" data-act="copy-command" data-copy="' + escapeHtml(p.command) +
            '" title="Copy Command Line" aria-label="Copy Command Line"><i class="far fa-clipboard"></i></button>' :
            '<span class="text-muted">Not readable</span>';
        var memory = escapeHtml(formatBytes(p.rss)) + (total ? ' <span class="text-muted">\u00b7 ' + escapeHtml((p.rss / total * 100).toFixed(1)) + "%</span>" : "");
        return '<tr data-pid="' + escapeHtml(p.pid) + '"><td class="tweakui-performance-number">' + escapeHtml(p.pid) + "</td><td>" + escapeHtml(p.name) +
            '</td><td class="tweakui-performance-command-cell">' + command + "</td><td>" + escapeHtml(p.user || "") +
            '</td><td class="tweakui-performance-number">' + cpu + '</td><td class="tweakui-performance-number">' + memory + "</td></tr>";
    }

    // One of Process View's tables (list: null while there is nothing to show, which `empty` says)
    function processTableHtml(kind, title, list, cores, total, empty) {
        var html = "<h5>" + title + "</h5>";
        if (!list) return html + '<p class="text-muted small">' + empty + "</p>";
        return html + '<div class="tweakui-performance-scroll"><table class="table table-condensed tweakui-performance-process-table" data-processes-by="' +
            kind + '"><thead><tr><th class="tweakui-performance-number">PID</th><th>Command</th><th>Command Line</th><th>User</th>' +
            '<th class="tweakui-performance-number">CPU</th><th class="tweakui-performance-number">Memory</th></tr></thead><tbody>' +
            list.map(function (p) { return processRowHtml(p, cores, total); }).join("") + "</tbody></table></div>";
    }

    // Process View's tables: Top 10 by CPU above Top 10 by Memory (processes: the live figures' processes, undefined
    // until they come, null where the server can't read them)
    function processesHtml(processes, cores, total) {
        if (processes === undefined) return '<p class="text-muted">Loading...</p>';
        if (!processes) return '<p class="text-muted">The server\'s processes can\'t be read.</p>';
        return (processes.container ? '<p class="text-muted small">' + CONTAINER_NOTE + "</p>" : "") +
            processTableHtml("cpu", "Top 10 by CPU", processes.cpu, cores, total, "Measuring: CPU use shows from the next refresh.") +
            processTableHtml("memory", "Top 10 by Memory", processes.memory, cores, total, "None.");
    }

    // The Process View button (on: pressed) and the place for its tables
    function processViewHtml(on) {
        return '<div class="tweakui-performance-process-view"><button type="button" class="btn btn-default btn-sm' + (on ? " active" : "") +
            '" data-act="processes" aria-pressed="' + on + '"><i class="fa fa-list fa-fw"></i> Process View</button>' +
            '<div class="tweakui-performance-processes" data-processes' + (on ? "" : " hidden") + "></div></div>";
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
    // A task's photo through WebODM's thumbnail, this many pixels on its longest side
    function photoUrl(t, name, size) {
        return "/api/projects/" + encodeURIComponent(t.project.id) + "/tasks/" + encodeURIComponent(t.id) + "/images/thumbnail/" +
            encodeURIComponent(name) + "?size=" + size;
    }

    // The photos a note names (Photos Left Out), collapsed (open when asked): each a link opening it, its thumbnail on
    // hover, the log's reason and a Remove Photo button; Copy Names puts their names on the clipboard, a line each, and
    // Remove Photos From Task deletes them all from the task. After a removal (n.removed, n.failed) it says what to do next.
    function photosListHtml(t, n, open) {
        var photos = n.photos || [], count = photos.length + (n.more || 0);
        var names = photos.map(function (p) { return p.name; });
        var html = '<details class="tweakui-performance-other tweakui-performance-photos" data-task="' + escapeHtml(t.id) + '"' +
            (open ? " open" : "") + "><summary>Photos Left Out (" + escapeHtml(formatNumber(count)) + ")</summary>";
        if (n.removed) {
            html += '<p class="text-success small tweakui-performance-removed"><i class="fa fa-check"></i> ' +
                escapeHtml(plural(n.removed, "photo", "photos")) + " removed from the task. Restart the task to process it without " +
                (n.removed === 1 ? "it" : "them") + "." + (n.more ? " Refresh to list the rest." : "") + "</p>";
        }
        if (n.failed && n.failed.length) {
            html += '<p class="text-danger small">Could not delete ' + escapeHtml(n.failed.join(", ")) + ".</p>";
        }
        if (photos.length) {
            html += '<button type="button" class="btn btn-default btn-xs" data-act="copy-names" data-names="' +
                escapeHtml(names.join("\n")) + '"><i class="far fa-clipboard"></i> Copy Names</button>' +
                '<button type="button" class="btn btn-danger btn-xs" data-act="remove-photos"><i class="fa fa-trash"></i> Remove Photos From Task</button>';
        }
        html += '<span class="tweakui-performance-remove-status text-danger small" role="status" aria-live="polite"></span>';
        if (photos.length || n.more) {
            html += '<ul class="list-unstyled small">' + photos.map(function (p) {
                return '<li><a href="' + escapeHtml(photoUrl(t, p.name, PHOTO_OPEN)) + '" target="_blank" rel="noopener" data-photo="' +
                    escapeHtml(photoUrl(t, p.name, PHOTO_HOVER)) + '">' + escapeHtml(p.name) + "</a>" +
                    (REASONS[p.reason] ? ' <span class="text-muted">' + REASONS[p.reason] + "</span>" : "") +
                    ' <button type="button" class="btn btn-default btn-xs tweakui-performance-remove-photo" data-act="remove-photo" data-name="' +
                    escapeHtml(p.name) + '"><i class="fa fa-trash"></i> Remove Photo</button></li>';
            }).join("") + (n.more ? '<li class="text-muted">' + escapeHtml(plural(n.more, "more photo", "more photos")) + " not shown.</li>" : "") +
                "</ul>";
        }
        return html + "</details>";
    }

    // What Remove Photos From Task asks before it deletes
    function removeQuestion(t, names) {
        var task = t.name ? '"' + t.name + '"' : "this task";
        return (names.length === 1 ? "Remove " + names[0] + " from " + task + "?" : "Remove these " + formatNumber(names.length) +
            " photos from " + task + "?") + "\n\n" + (names.length === 1 ? "It is" : "They are") + " deleted from the task for good " +
            "(your own copies are not touched). The task stops using the processing node's copy of it, so its next Restart " +
            "uploads the photos left and processes it from the start.";
    }

    function notesHtml(t) {
        var notes = t.notes || [], other = t.other || [];
        var html = notes.length ? '<ul class="list-unstyled tweakui-performance-notes">' + notes.map(function (n) {
            var icon = n.level === "info" ? "fa-info-circle" : ICONS[n.level] || ICONS.warning;
            return '<li data-note="' + escapeHtml(n.key) + '"><i class="fa ' + icon + " fa-fw text-" + escapeHtml(n.level) + '"></i> ' +
                escapeHtml(n.text) + (n.line ? '<div class="text-muted small tweakui-performance-line"><code>' + escapeHtml(n.line) + "</code></div>" : "") +
                ((n.photos && n.photos.length) || n.removed ? photosListHtml(t, n) : "") + "</li>";
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

    // A task's address in WebODM's API, with a path after it
    function taskUrl(t, path) {
        return "/api/projects/" + encodeURIComponent(t.project.id) + "/tasks/" + encodeURIComponent(t.id) + "/" + (path || "");
    }

    // A file name from a task's name, without the characters file systems refuse
    function fileName(name) {
        // eslint-disable-next-line no-control-regex
        return String(name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || "task";
    }

    var RESTARTING = "Restarting: it leaves this list while it runs.";

    // A task's Actions menu (a Bootstrap dropdown, opened by the page's own script): its log as WebODM's console
    // download, Restart From Load Dataset where WebODM's Dashboard offers Restart, and its report when it has one
    function actionsHtml(t, name) {
        // In alphabetical order
        var items = [];
        if (t.report) items.push('<li><a href="' + escapeHtml(taskUrl(t, "download/report.pdf")) + '" download><i class="fa fa-download fa-fw"></i> Download Report</a></li>');
        items.push('<li><a href="' + escapeHtml(taskUrl(t, "output/?f=raw")) + '" download="' + escapeHtml(fileName(name) + ".txt") +
            '"><i class="fa fa-file-alt fa-fw"></i> Download Task Logs</a></li>');
        if (t.can_restart) items.push('<li><a href="#" role="button" data-act="restart"><i class="fa fa-redo-alt fa-fw"></i> Restart From Load Dataset</a></li>');
        if (t.report) {
            items.push('<li><a href="' + escapeHtml(taskUrl(t, "download/report.pdf?inline=1")) + '" target="_blank" rel="noopener noreferrer">' +
                '<i class="fa fa-file-pdf fa-fw"></i> View Report</a></li>');
        }
        return ' <div class="btn-group tweakui-performance-actions"><button type="button" class="btn btn-default btn-xs dropdown-toggle" ' +
            'data-act="actions" aria-haspopup="true" aria-expanded="false"' + (t.restarting ? " disabled" : "") +
            '>Actions <span class="caret"></span></button><ul class="dropdown-menu">' + items.join("") + "</ul></div>";
    }

    function taskHtml(t, system) {
        var name = t.name || "Task of " + (t.created_at ? t.created_at.slice(0, 10) : "?");
        var where = escapeHtml(t.project.name) + (t.owner ? " of " + escapeHtml(t.owner) : "");
        var open = t.status === "failed";
        var notes = notesButtonHtml(t, open);
        var wide = "tweakui-performance-wide ";
        return '<tr data-task="' + escapeHtml(t.id) + '"' + (t.status ? ' data-status="' + escapeHtml(t.status) + '"' : "") + '><td><a href="/map/project/' +
            escapeHtml(t.project.id) + "/task/" + escapeHtml(t.id) + '/">' + escapeHtml(name) + "</a>" +
            ' <span class="tweakui-performance-task-buttons">' + notes + actionsHtml(t, name) + "</span>" +
            '<div class="text-muted small">' + where + "</div>" + statusHtml(t) +
            '<div class="small text-muted tweakui-performance-action-status" aria-live="polite">' + (t.restarting ? RESTARTING : "") + "</div>" +
            detailHtml(t, system) + "</td>" +
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
        var html = '<h4 id="tweakui-performance-recent">Recent Task History</h4>';
        if (!report.tasks.length) return html + '<p class="text-muted">No finished tasks yet.</p>';
        var wide = ' class="tweakui-performance-wide ';
        return html + '<p class="text-muted">The last ' + report.tasks.length + " finished " + (report.tasks.length === 1 ? "task" : "tasks") +
            (report.admin ? " on this server" : " of yours") + " (completed, failed or canceled), newest first.</p>" +
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

    function render(page, report, load, system, diskRates, view, processesOn) {
        page.querySelector(".tweakui-performance-body").innerHTML = assessmentHtml(report) + nodesHtml(report.nodes, view) +
            serverHtml(report.server, load, diskRates, view) + (report.admin ? processViewHtml(!!processesOn) : "");
        // Recent Task History goes below the page's controls, which stay put while the parts around them redraw
        page.querySelector(".tweakui-performance-recent").innerHTML = tasksHtml(report, system) +
            '<p class="text-muted small tweakui-performance-note">Memory sizing follows <a href="' + REQUIREMENTS +
            '" target="_blank" rel="noopener noreferrer">WebODM\'s hardware requirements</a>, which are conservative. ' +
            "In Docker, a node has the memory Docker gives it.</p>";
    }

    // A number setting on the page (Refresh Every, History Length: data-control="refresh" or "history"): a slider and a
    // box, each change applied at once (apply(value)) and saved to the user's settings (setting) when the slider is let
    // go or the box left; a box not a whole number in range, or a save refused, puts back the saved value and says why
    function numberControl(doc, win, page, id, setting, fallback, apply, fetchFn) {
        var box = page.querySelector('[data-control="' + id + '"]');
        var slider = box && box.querySelector(".tweakui-performance-every-slider");
        var input = box && box.querySelector("#tweakui-performance-" + id);
        var status = box && box.querySelector(".tweakui-performance-every-status");
        if (!slider || !input) return null;
        var min = Number(input.min) || 1, max = Number(input.max) || fallback;
        var value = ui.wholeNumber(input.value, min, max), saved = typeof value === "number" ? value : fallback;
        function say(text) { if (status) status.textContent = text || ""; }
        function show(v) { slider.value = v; input.value = v; }
        function putBack(reason) {
            show(saved);
            apply(saved);
            say("Not saved: " + reason);
        }
        function commit(v) {
            if (v === saved) return Promise.resolve();
            var change = {};
            change[setting] = v;
            return ui.saveSettings(doc, win, change, fetchFn).then(function () {
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
        return {value: saved, slider: slider, input: input, commit: commit};
    }

    function start(doc, win, fetchFn) {
        var page = doc.getElementById("tweakui-performance");
        if (!page || !page.querySelector(".tweakui-performance-body")) return null;
        fetchFn = fetchFn || (win.fetch && win.fetch.bind(win));
        var api = page.getAttribute("data-api"), button = page.querySelector("[data-act=refresh]");
        var status = page.querySelector(".tweakui-performance-status");
        var state = {report: null, cpu: null, load: null, io: null, diskRates: null, history: {}, hover: null,
            seconds: EVERY_DEFAULT, minutes: HISTORY_DEFAULT, diskAt: 0, timer: null, busy: false,
            looping: false, stopped: false, processesOn: false, processes: undefined};
        try {
            state.processesOn = win.sessionStorage.getItem(PROCESSES_KEY) === "1";
        } catch (e) {
            // Storage that can't be used: Process View starts off
        }

        // The readings this tab kept before a reload (sessionStorage: a new tab starts fresh, closing it forgets them);
        // storage that can't be used (a private window, blocked) starts empty
        var savedAt = 0;
        function saveReadings(force) {
            var now = Date.now();
            if (!force && now - savedAt < SAVE_EVERY) return;
            savedAt = now;
            try {
                win.sessionStorage.setItem(SAVED_KEY, JSON.stringify(packReadings(state, now)));
            } catch (e) {
                // Full or blocked: this save is skipped
            }
        }

        function restoreReadings() {
            var saved;
            try {
                saved = JSON.parse(win.sessionStorage.getItem(SAVED_KEY) || "null");
            } catch (e) {
                return;
            }
            var back = unpackReadings(saved, Date.now(), view().gap);
            if (!back) return;
            state.history = back.history;
            state.cpu = back.cpu;
            state.io = back.io;
        }

        function ask(path) {
            return fetchFn(api + path, {credentials: "same-origin"}).then(function (res) {
                if (!res.ok) throw new Error(res.status);
                return res.json();
            });
        }

        // The graphs' window now
        function view() {
            return {history: state.history, now: Date.now(), span: state.minutes * 60000,
                gap: Math.max(GAP_REFRESHES * state.seconds * 1000, GAP_MIN)};
        }

        // A new reading of the CPU and disk counters: the load and the disks' activity since the last one, kept for the
        // graphs with the memory's share used (the server's and each node's)
        function reading(cpu, io, memory, nodes) {
            var now = Date.now(), h = state.history;
            state.load = cpuShares(state.cpu, cpu);
            state.cpu = cpu || null;
            state.diskRates = diskShares(state.io, io);
            state.io = io || null;
            if (state.load) record(h, "cpu", now, state.load.total);
            Object.keys(state.diskRates || {}).forEach(function (name) {
                var r = state.diskRates[name], key = "drive:" + name + ":";
                record(h, key + "reads", now, r.reads);
                record(h, key + "writes", now, r.writes);
                record(h, key + "busy", now, r.busy);
            });
            if (memory && memory.total) record(h, "memory", now, (memory.total - memory.free) / memory.total);
            (nodes || []).forEach(function (n) {
                if (n.online && n.total_memory) record(h, "node:" + n.id, now, (n.total_memory - n.available_memory) / n.total_memory);
            });
            saveReadings(false);
        }

        // The hovered graph's readings under the pointer (state.hover: {id, at: 0 to 1 across}), again after a redraw
        function showTip() {
            var old = page.querySelector(".tweakui-performance-graph-tip");
            if (old) old.parentNode.removeChild(old);
            var cursor = page.querySelector(".tweakui-performance-graph-cursor");
            if (cursor) cursor.parentNode.removeChild(cursor);
            if (!state.hover) return;
            var graph = page.querySelector('[data-graph="' + state.hover.id.replace(/["\\]/g, "") + '"]');
            if (!graph) return;
            var v = view(), at = state.hover.at;
            var text = graphTip(v, graph.getAttribute("data-series").split(" "), graph.getAttribute("data-labels").split("|"),
                graph.getAttribute("data-kind"), v.now - v.span + at * v.span);
            if (!text) return;
            cursor = ui.el(doc, "div", "tweakui-performance-graph-cursor theme-color-primary");
            cursor.style.left = (at * 100).toFixed(1) + "%";
            var tip = ui.el(doc, "div", "tweakui-performance-graph-tip theme-secondary theme-border");
            tip.textContent = text;
            tip.style[at < 0.5 ? "left" : "right"] = ((at < 0.5 ? at : 1 - at) * 100).toFixed(1) + "%";
            graph.appendChild(cursor);
            graph.appendChild(tip);
        }

        // The next live refresh in `delay` ms, none while the tab is hidden or once stopped
        function schedule(delay) {
            if (state.timer) win.clearTimeout(state.timer);
            state.timer = null;
            if (state.stopped || doc.hidden) return;
            state.timer = win.setTimeout(ui.guard(NAME, tick), delay);
        }

        // The live figures drawn again: the server's cards and each node's memory
        function redrawLive() {
            var v = view(), cards = page.querySelector("[data-server-cards]");
            var html = serverCardsHtml(state.report.server, state.load, state.diskRates, v);
            if (cards && html) cards.innerHTML = html;
            state.report.nodes.forEach(function (n) {
                var cell = page.querySelector('[data-node="' + String(n.id).replace(/["\\]/g, "") + '"] [data-memory]');
                if (cell && n.online && n.total_memory) cell.innerHTML = memoryGraphHtml(n.available_memory, n.total_memory, v, "node:" + n.id);
            });
            showTip();
        }

        // Process View's tables drawn again (a superuser's page, while it is on)
        function redrawProcesses() {
            var holder = page.querySelector("[data-processes]");
            if (!holder || !state.processesOn) return;
            var server = state.report.server;
            holder.innerHTML = processesHtml(state.processes, server.cpu && server.cpu.cores,
                server.memory && server.memory.total);
        }

        // The Process View button: its tables open (asked at once, then on every refresh) or close
        function toggleProcesses(btn) {
            var on = !state.processesOn, holder = page.querySelector("[data-processes]");
            state.processesOn = on;
            state.processes = undefined;
            btn.setAttribute("aria-pressed", String(on));
            btn.classList.toggle("active", on);
            if (holder) {
                holder.hidden = !on;
                holder.innerHTML = "";
            }
            try {
                win.sessionStorage.setItem(PROCESSES_KEY, on ? "1" : "0");
            } catch (e) {
                // Not kept: the page still shows it
            }
            redrawProcesses();
            if (on && state.looping && !state.busy) schedule(0);
        }

        function applyLive(data) {
            var server = state.report.server;
            reading(data.cpu, data.disk_io, data.memory, data.nodes);
            server.cpu = data.cpu || null;
            if ("disk_io" in data) server.disk_io = data.disk_io || null;
            if (data.memory) server.memory = data.memory;
            if ("disk" in data) {
                if (data.disk) server.disk = data.disk;
                state.diskAt = Date.now();
            }
            (data.nodes || []).forEach(function (n) {
                state.report.nodes.forEach(function (r) {
                    if (r.id === n.id && n.online && n.total_memory) {
                        r.total_memory = n.total_memory;
                        r.available_memory = n.available_memory;
                    }
                });
            });
            redrawLive();
            if ("processes" in data && state.processesOn) {
                state.processes = data.processes;
                redrawProcesses();
            }
        }

        // The live figures; the next is asked once this one is answered, so a slow server is never asked twice at once
        function tick() {
            state.timer = null;
            var query = [];
            if (Date.now() - state.diskAt >= DISK_EVERY) query.push("disk=1");
            if (state.processesOn && state.report && state.report.admin) query.push("processes=1");
            state.busy = true;
            return ask("performance/live" + (query.length ? "?" + query.join("&") : "")).then(function (data) {
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
                var server = report.server || {};
                reading(server.cpu, server.disk_io, server.memory, report.nodes);
                state.diskAt = Date.now();
                closeMenu();
                render(page, report, state.load, unitSystem(win), state.diskRates, view(), state.processesOn);
                redrawProcesses();
                showTip();
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

        var every = numberControl(doc, win, page, "refresh", "performance_refresh", EVERY_DEFAULT, function (seconds) {
            state.seconds = seconds;
            if (state.timer) schedule(seconds * 1000);
        }, fetchFn);
        if (every) state.seconds = every.value;
        // History Length: the graphs drawn again over the new window at once
        var length = numberControl(doc, win, page, "history", "performance_history", HISTORY_DEFAULT, function (minutes) {
            state.minutes = minutes;
            if (state.report) redrawLive();
        }, fetchFn);
        if (length) state.minutes = length.value;
        // After Refresh Every is known: the counters are taken back only within the gap it gives
        restoreReadings();

        var onVisibility = ui.guard(NAME, function () {
            if (doc.hidden) {
                schedule(0);
                saveReadings(true);
            } else if (state.looping && !state.busy) schedule(0);
        });
        doc.addEventListener("visibilitychange", onVisibility);
        // Leaving the page or reloading it: the latest readings kept
        var onLeave = ui.guard(NAME, function () { saveReadings(true); });
        win.addEventListener("pagehide", onLeave);

        // The maps' unit system changed (in another tab, or Units in Header): the figures again in it
        var onUnits = ui.guard(NAME, function () {
            if (state.report) {
                closeMenu();
                render(page, state.report, state.load, unitSystem(win), state.diskRates, view(), state.processesOn);
                redrawProcesses();
                showTip();
            }
        });
        doc.addEventListener(UNIT_EVENT, onUnits);

        function stop() {
            state.stopped = true;
            schedule(0);
            doc.removeEventListener("visibilitychange", onVisibility);
            win.removeEventListener("pagehide", onLeave);
            doc.removeEventListener(UNIT_EVENT, onUnits);
            win.removeEventListener("scroll", hideThumb, true);
            doc.removeEventListener("click", onAway);
            win.removeEventListener("scroll", onMove, true);
            win.removeEventListener("resize", onMove);
        }

        // Photos Left Out: hovering or focusing a photo's name shows its thumbnail to its right, from its top down (so the
        // note above stays readable), in one box over the page
        var thumb = null;
        function hideThumb() { if (thumb) thumb.hidden = true; }
        function showThumb(link) {
            if (!thumb) {
                thumb = ui.el(doc, "div", "tweakui-performance-thumb theme-border theme-secondary");
                thumb.setAttribute("aria-hidden", "true");
                thumb.appendChild(ui.el(doc, "img"));
                page.appendChild(thumb);
            }
            var img = thumb.firstChild, src = link.getAttribute("data-photo");
            if (img.getAttribute("src") !== src) {
                img.alt = "";
                img.setAttribute("src", src);
            }
            var box = link.getBoundingClientRect(), view = win.innerHeight || 0, wide = win.innerWidth || 0;
            thumb.style.left = Math.round(Math.max(8, Math.min(box.right + 12, wide - PHOTO_HOVER - 24))) + "px";
            thumb.style.top = Math.round(Math.max(8, Math.min(box.top - 4, view - PHOTO_HOVER - 16))) + "px";
            thumb.hidden = false;
        }
        function photoLink(e) { return e.target && e.target.closest ? e.target.closest("[data-photo]") : null; }
        ["mouseover", "focusin"].forEach(function (type) {
            page.addEventListener(type, ui.guard(NAME, function (e) { var link = photoLink(e); if (link) showThumb(link); }));
        });
        ["mouseout", "focusout"].forEach(function (type) {
            page.addEventListener(type, ui.guard(NAME, function (e) { if (photoLink(e)) hideThumb(); }));
        });
        win.addEventListener("scroll", hideThumb, true);

        // A task's Actions menu: over the page (fixed, so the table's scrolling box doesn't cut it off), below its
        // button, or above it where there is no room below, and kept there as the page scrolls or resizes; a click
        // anywhere, Escape or its button leaving the window closes it
        var openMenu = null;
        function closeMenu(focus) {
            if (!openMenu) return;
            var group = openMenu, toggle = group.querySelector("[data-act=actions]");
            openMenu = null;
            group.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
            if (focus) toggle.focus();
        }
        function openActions(toggle) {
            var group = toggle.parentNode;
            if (openMenu === group) return closeMenu();
            closeMenu();
            group.classList.add("open");
            toggle.setAttribute("aria-expanded", "true");
            openMenu = group;
            placeMenu();
            // Focused without scrolling the table's box to the menu
            var first = group.querySelector(".dropdown-menu a");
            if (first) first.focus({preventScroll: true});
        }
        var onAway = ui.guard(NAME, function (e) {
            var toggle = e.target && e.target.closest ? e.target.closest("[data-act=actions]") : null;
            if (openMenu && !(toggle && toggle.parentNode === openMenu)) closeMenu();
        });
        function placeMenu() {
            var toggle = openMenu.querySelector("[data-act=actions]"), list = openMenu.querySelector(".dropdown-menu");
            var box = toggle.getBoundingClientRect(), high = win.innerHeight || 0, wide = win.innerWidth || 0;
            if (high && (box.bottom < 0 || box.top > high)) return closeMenu();
            var top = box.bottom + 2;
            if (high && top + list.offsetHeight > high - 8 && box.top - list.offsetHeight - 2 >= 8) top = box.top - list.offsetHeight - 2;
            list.style.top = Math.round(top) + "px";
            list.style.left = Math.round(Math.max(8, Math.min(box.left, wide - list.offsetWidth - 8))) + "px";
        }
        var onMove = ui.guard(NAME, function () { if (openMenu) placeMenu(); });
        doc.addEventListener("click", onAway);
        win.addEventListener("scroll", onMove, true);
        win.addEventListener("resize", onMove);
        page.addEventListener("keydown", ui.guard(NAME, function (e) {
            if (!openMenu) return;
            if (e.key === "Escape") {
                closeMenu(true);
                return;
            }
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            var items = Array.prototype.slice.call(openMenu.querySelectorAll(".dropdown-menu a"));
            var at = items.indexOf(doc.activeElement);
            e.preventDefault();
            items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus({preventScroll: true});
        }));

        // Restart From Load Dataset: asks first, then does what WebODM's Restart button does by default
        // (TaskListItem.jsx): the task's options get rerun-from set to the node's second step (dataset), or lose it
        // and the node's copy where the node has none, then the task is restarted; the row says so, and the next
        // Refresh lists it no more while it runs
        function restartTask(link) {
            var row = link.closest("tr[data-task]");
            var id = row && row.getAttribute("data-task");
            var t = state.report && state.report.tasks.filter(function (x) { return String(x.id) === id; })[0];
            if (!t || !win.confirm(RESTART_QUESTION)) return;
            var toggle = row.querySelector("[data-act=actions]"), said = row.querySelector(".tweakui-performance-action-status");
            toggle.disabled = true;
            said.className = "small text-muted tweakui-performance-action-status";
            said.textContent = "Restarting...";
            function send(path, method, body) {
                return fetchFn(taskUrl(t, path), {method: method, credentials: "same-origin",
                    headers: {"Content-Type": "application/json", "X-CSRFToken": ui.csrfToken(doc)},
                    body: body === undefined ? undefined : JSON.stringify(body)}).then(function (res) {
                    if (!res.ok) throw new Error(res.status);
                    return res.json();
                });
            }
            send("", "GET").then(function (task) {
                var from = (task.can_rerun_from || []).length > 1 ? task.can_rerun_from[1] : null;
                var options = (task.options || []).filter(function (o) { return o.name !== "rerun-from"; });
                if (from !== null) options.push({name: "rerun-from", value: from});
                var data = {options: options};
                if (from === null) data.uuid = "";
                return send("", "PATCH", data);
            }).then(function () {
                return send("restart/", "POST");
            }).then(function () {
                t.restarting = true;
                said.textContent = RESTARTING;
            }).catch(function () {
                toggle.disabled = false;
                said.className = "small text-danger tweakui-performance-action-status";
                said.textContent = "Could not restart the task.";
            });
        }

        // A graph: moving over it (or touching it) shows the readings under the pointer; leaving it, or touching
        // elsewhere, hides them
        function onPointer(e) {
            var graph = e.target && e.target.closest ? e.target.closest(".tweakui-performance-graph") : null;
            if (!graph) {
                if (state.hover) {
                    state.hover = null;
                    showTip();
                }
                return;
            }
            var box = graph.getBoundingClientRect();
            if (!box.width) return;
            state.hover = {id: graph.getAttribute("data-graph"), at: Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1)};
            showTip();
        }
        page.addEventListener("pointermove", ui.guard(NAME, onPointer));
        page.addEventListener("pointerdown", ui.guard(NAME, onPointer));
        page.addEventListener("pointerleave", ui.guard(NAME, function () {
            state.hover = null;
            showTip();
        }));

        // Remove Photos From Task (or Remove Photo, one): asks first, then deletes them through the plugin's API and
        // draws the list again without them, open, with what to do next (the report is changed to match)
        function removePhotos(btn) {
            var details = btn.closest(".tweakui-performance-photos");
            var id = details && details.getAttribute("data-task");
            var t = state.report && state.report.tasks.filter(function (x) { return String(x.id) === id; })[0];
            var n = t && (t.notes || []).filter(function (x) { return x.key === "left_out"; })[0];
            if (!n) return;
            var names = btn.getAttribute("data-act") === "remove-photo" ? [btn.getAttribute("data-name")] :
                n.photos.map(function (p) { return p.name; });
            if (!names.length || !win.confirm(removeQuestion(t, names))) return;
            var buttons = details.querySelectorAll("button");
            Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
            var said = details.querySelector(".tweakui-performance-remove-status");
            said.textContent = "";
            fetchFn(api + "performance/" + encodeURIComponent(t.project.id) + "/" + encodeURIComponent(t.id) + "/remove-photos", {
                method: "POST", credentials: "same-origin",
                headers: {"Content-Type": "application/json", "X-CSRFToken": ui.csrfToken(doc)},
                body: JSON.stringify({names: names})
            }).then(function (res) {
                return res.json().then(function (data) { return {ok: res.ok, data: data}; }, function () { return {ok: false, data: {}}; });
            }).then(function (answer) {
                if (!answer.ok) throw new Error(answer.data.detail || "");
                var gone = {};
                answer.data.removed.forEach(function (name) { gone[name] = true; });
                n.photos = n.photos.filter(function (p) { return !gone[p.name]; });
                n.removed = (n.removed || 0) + answer.data.removed.length;
                n.failed = answer.data.failed;
                var holder = ui.el(doc, "div");
                holder.innerHTML = photosListHtml(t, n, true);
                details.parentNode.replaceChild(holder.firstChild, details);
            }).catch(function (err) {
                Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
                said.textContent = (err && err.message) || "Could not remove the photos.";
            });
        }

        // A task's Notes button opens and closes the row of its notes below it; Copy Names copies a list's names
        page.addEventListener("click", ui.guard(NAME, function (e) {
            var actions = e.target && e.target.closest ? e.target.closest("[data-act=actions]") : null;
            if (actions) {
                openActions(actions);
                return;
            }
            var restart = e.target && e.target.closest ? e.target.closest("[data-act=restart]") : null;
            if (restart) {
                e.preventDefault();
                restartTask(restart);
                return;
            }
            var processes = e.target && e.target.closest ? e.target.closest("[data-act=processes]") : null;
            if (processes) {
                toggleProcesses(processes);
                return;
            }
            // Copy Names (a list's names) or a process's Copy Command Line
            var copy = e.target && e.target.closest ? e.target.closest("[data-act=copy-names], [data-act=copy-command]") : null;
            if (copy) {
                var icon = copy.querySelector("i");
                ui.copyText(copy.getAttribute("data-names") || copy.getAttribute("data-copy"), doc, win).then(function () { icon.className = "fa fa-check"; },
                    function () { icon.className = "fa fa-times"; }).then(function () {
                    win.setTimeout(function () { icon.className = "far fa-clipboard"; }, 2000);
                });
                return;
            }
            var remove = e.target && e.target.closest ? e.target.closest("[data-act=remove-photos], [data-act=remove-photo]") : null;
            if (remove) {
                removePhotos(remove);
                return;
            }
            var toggle = e.target && e.target.closest ? e.target.closest("[data-act=notes]") : null;
            if (!toggle) return;
            var row = doc.getElementById(toggle.getAttribute("aria-controls"));
            if (!row) return;
            var open = toggle.getAttribute("aria-expanded") !== "true";
            toggle.setAttribute("aria-expanded", String(open));
            row.hidden = !open;
        }));

        // The graphs' accent: the theme's link colour (theme.css gives it to links and to the bars, but to no class an
        // SVG can take), read from a link that isn't shown
        var probe = ui.el(doc, "a");
        probe.hidden = true;
        page.appendChild(probe);
        var accent = win.getComputedStyle ? win.getComputedStyle(probe).color : "";
        page.removeChild(probe);
        if (accent) page.style.setProperty("--tweakui-performance-accent", accent);

        if (button) button.addEventListener("click", ui.guard(NAME, load));
        var loaded = load();
        return {state: state, load: load, loaded: loaded, tick: tick, stop: stop, every: every, length: length};
    }

    return {start: start, formatBytes: formatBytes, formatDuration: formatDuration, formatNumber: formatNumber,
        trendText: trendText, assessmentHtml: assessmentHtml, tasksSummary: tasksSummary, formatArea: formatArea, formatLength: formatLength,
        tasksHtml: tasksHtml, notesHtml: notesHtml, removeQuestion: removeQuestion, nodeHtml: nodeHtml, barHtml: barHtml, cpuShares: cpuShares, cpuRows: cpuRows,
        diskShares: diskShares, driveCardHtml: driveCardHtml, serverHtml: serverHtml, graphHtml: graphHtml, graphTip: graphTip, spanText: spanText, packReadings: packReadings, unpackReadings: unpackReadings,
        record: record, niceCeil: niceCeil, processesHtml: processesHtml};
});
