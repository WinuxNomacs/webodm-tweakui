// Diagnostic > Performance (templates/performance.html): verdicts at the top, then a card per processing node the
// user may use (what it says of itself: cores, memory, queue), the server's disk and memory, and the recent completed
// tasks (an admin's: every user's) with their time per photo and a trend (performance.py through the plugin's API).
// Asked on opening and with Refresh. UMD, so Jest can load it.
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

    function formatDate(iso) {
        var d = iso ? new Date(iso) : null;
        return d && !isNaN(d) ? d.toLocaleString() : "";
    }

    // A used-of-total bar: the share used, coloured as it fills
    function barHtml(used, total) {
        var share = total > 0 ? Math.min(Math.max(used / total, 0), 1) : 0;
        var kind = share >= FULL_DANGER ? "danger" : share >= FULL_WARNING ? "warning" : "success";
        return '<div class="progress tweakui-performance-progress" title="' + Math.round(share * 100) + '% used">' +
            '<div class="progress-bar progress-bar-' + kind + '" style="width: ' + (share * 100).toFixed(0) + '%"></div></div>';
    }

    function rowHtml(label, value, extra) {
        return "<tr><th>" + escapeHtml(label) + "</th><td>" + value + (extra || "") + "</td></tr>";
    }

    function freeOf(free, total) {
        return escapeHtml(formatBytes(free)) + " free of " + escapeHtml(formatBytes(total));
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
            if (n.total_memory) {
                rows += rowHtml("Memory", freeOf(n.available_memory, n.total_memory), barHtml(n.total_memory - n.available_memory, n.total_memory));
            }
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

    function serverHtml(server) {
        var rows = "";
        if (server.disk) rows += rowHtml("Disk", freeOf(server.disk.free, server.disk.total), barHtml(server.disk.total - server.disk.free, server.disk.total));
        if (server.memory) rows += rowHtml("Memory", freeOf(server.memory.free, server.memory.total), barHtml(server.memory.total - server.memory.free, server.memory.total));
        if (!rows) return "";
        return '<h4>Server</h4><div class="tweakui-performance-cards"><div class="tweakui-performance-card theme-border" data-server>' +
            '<h5><i class="fa fa-hdd fa-fw"></i> WebODM</h5><table class="tweakui-performance-facts">' + rows + "</table></div></div>";
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

    function taskHtml(t) {
        var name = t.name || "Task of " + (t.created_at ? t.created_at.slice(0, 10) : "?");
        var where = escapeHtml(t.project.name) + (t.owner ? " of " + escapeHtml(t.owner) : "");
        return '<tr data-task="' + escapeHtml(t.id) + '"><td><a href="/map/project/' + escapeHtml(t.project.id) + "/task/" + escapeHtml(t.id) + '/">' +
            escapeHtml(name) + '</a><div class="text-muted small">' + where + "</div></td>" +
            '<td class="tweakui-performance-date">' + escapeHtml(t.created_at ? new Date(t.created_at).toLocaleDateString() : "") + "</td>" +
            '<td class="tweakui-performance-number">' + escapeHtml(t.images ? formatNumber(t.images) : "") + "</td>" +
            '<td class="tweakui-performance-number">' + escapeHtml(formatDuration(t.seconds)) + "</td>" +
            '<td class="tweakui-performance-number">' + escapeHtml(t.seconds_per_image ? t.seconds_per_image.toFixed(1) + "s" : "") + "</td>" +
            '<td class="tweakui-performance-step">' + (t.slowest_step ? escapeHtml(t.slowest_step.name) + ' <span class="text-muted">' +
                escapeHtml(formatDuration(t.slowest_step.seconds)) + "</span>" : "") + "</td>" +
            '<td class="tweakui-performance-node">' + escapeHtml(t.node || "") + "</td></tr>";
    }

    function tasksHtml(report) {
        var html = "<h4>Recent Processing</h4>";
        if (!report.tasks.length) return html + '<p class="text-muted">No completed tasks yet.</p>';
        var trend = trendText(report.trend);
        return html + '<p class="text-muted">The last ' + report.tasks.length + " completed " + (report.tasks.length === 1 ? "task" : "tasks") +
            (report.admin ? " on this server" : " of yours") + ", newest first.</p>" +
            (trend ? '<p class="tweakui-performance-trend">' + escapeHtml(trend) + "</p>" : "") +
            '<div class="tweakui-performance-scroll"><table class="table tweakui-performance-table"><thead><tr><th>Task</th>' +
            '<th class="tweakui-performance-date">Created</th><th class="tweakui-performance-number">Photos</th>' +
            '<th class="tweakui-performance-number">Time</th><th class="tweakui-performance-number">Per Photo</th>' +
            '<th class="tweakui-performance-step" title="Of the structure-from-motion steps ODM times in its report (stats.json); the later steps are not timed one by one">Slowest SfM Step</th>' +
            '<th class="tweakui-performance-node">Node</th></tr></thead><tbody>' + report.tasks.map(taskHtml).join("") + "</tbody></table></div>";
    }

    function render(page, report) {
        page.querySelector(".tweakui-performance-body").innerHTML = verdictsHtml(report.verdicts) + nodesHtml(report.nodes) +
            serverHtml(report.server) + tasksHtml(report) +
            '<p class="text-muted small tweakui-performance-note">Memory sizing follows <a href="' + REQUIREMENTS +
            '" target="_blank" rel="noopener noreferrer">WebODM\'s hardware requirements</a>, which are conservative. ' +
            "In Docker, a node has the memory Docker gives it.</p>";
    }

    function start(doc, win, fetchFn) {
        var page = doc.getElementById("tweakui-performance");
        if (!page || !page.querySelector(".tweakui-performance-body")) return null;
        fetchFn = fetchFn || (win.fetch && win.fetch.bind(win));
        var api = page.getAttribute("data-api"), button = page.querySelector("[data-act=refresh]");
        var status = page.querySelector(".tweakui-performance-status"), state = {report: null};

        function load() {
            if (button) button.disabled = true;
            if (status) status.textContent = state.report ? "Refreshing..." : "";
            return fetchFn(api + "performance", {credentials: "same-origin"}).then(function (res) {
                if (!res.ok) throw new Error(res.status);
                return res.json();
            }).then(function (report) {
                state.report = report;
                render(page, report);
                if (status) status.textContent = "Updated " + new Date().toLocaleTimeString();
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

        if (button) button.addEventListener("click", ui.guard("performance_page", load));
        var loaded = load();
        return {state: state, load: load, loaded: loaded};
    }

    return {start: start, formatBytes: formatBytes, formatDuration: formatDuration, formatNumber: formatNumber,
        trendText: trendText, verdictsHtml: verdictsHtml, nodeHtml: nodeHtml, barHtml: barHtml};
});
