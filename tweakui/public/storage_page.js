// Diagnostic > Storage (templates/storage.html): the user's quota and the projects they own, largest first, each
// opening to its tasks and a task to its files by kind (storage.py through the plugin's API); for an admin, a section
// per other user too. Rows are ticked to clean up several at once, or cleaned up one by one with their own buttons;
// either way one confirmation names what goes and what it frees, and the work is WebODM's own API's (a task's compact
// and remove, a project's delete), so its permissions, the processing node's cleanup and the quota apply. A completed
// task is backed up as WebODM's Download > Backup does (its backup URL, the browser's own download), several one after
// another; a project's Import uploads zips to WebODM's import URL in chunks, as WebODM's Import does, one task each.
// UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "storage_page", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // WebODM's task status codes (nodeodm/status_codes.py)
    var STATUS = {10: "Queued", 20: "Running", 30: "Failed", 40: "Completed", 50: "Canceled"};
    var KINDS = [["photos", "Photos"], ["orthophoto", "Orthophoto"], ["elevation", "Elevation"],
        ["point_cloud", "Point cloud"], ["textured_model", "Textured model"], ["other", "Other"]];
    var MARKS = {
        removing: ["Deleting", "label-default"], compacting: ["Compacting", "label-default"],
        importing: ["Importing", "label-default"],
        failed: ["Failed: can be deleted", "label-danger"], canceled: ["Canceled: can be deleted", "label-warning"],
        compactable: ["Can be compacted", "label-info"]
    };
    // WebODM's own words for compacting (TaskListItem.jsx)
    var COMPACT_NOTE = "Compacting will free disk space by permanently deleting the original images used for " +
        "processing. It will no longer be possible to restart the task. Maps and models will remain in place.";
    // Backup All: the pause between two downloads, so the browser takes each one
    var BACKUP_PAUSE = 1000;
    // Import: WebODM's Import sends 8 MB chunks; a chunk that gets no answer is sent again, up to this many times
    var CHUNK_SIZE = 8000000, CHUNK_TRIES = 3;

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

    function statusLabel(task) {
        if (task.partial) return "Uploading";
        return STATUS[task.status] || "Waiting";
    }

    // The report's projects and tasks by id: {projects: {id: {project, owner}}, tasks: {id: {task, project, owner}}}
    function indexReport(report) {
        var index = {projects: {}, tasks: {}};
        var sections = report ? [report.me].concat(report.others || []) : [];
        sections.forEach(function (section) {
            if (!section) return;
            section.projects.forEach(function (p) {
                index.projects[p.id] = {project: p, owner: section.user};
                p.tasks.forEach(function (t) { index.tasks[t.id] = {task: t, project: p, owner: section.user}; });
            });
        });
        return index;
    }

    function busy(task) { return task.mark === "removing" || task.mark === "compacting"; }

    // WebODM offers a backup of a completed task (its Download menu's Backup)
    function backupable(task) { return task.status === 40 && !busy(task); }

    function backupUrl(e) { return "/api/projects/" + e.project.id + "/tasks/" + e.task.id + "/backup"; }

    // What the ticked rows come to: the projects and the tasks (outside them) a Delete removes, with the bytes it frees;
    // the tasks a Compact compacts and a Backup All downloads (ticked ones and those of ticked projects that can be), and
    // how many a Backup All skips
    function plan(state) {
        var index = state.index, out = {projects: [], tasks: [], compact: [], backup: [], skipped: 0, freed: 0};
        function backup(e) {
            if (backupable(e.task)) out.backup.push(e); else out.skipped++;
        }
        Object.keys(state.selected.projects).forEach(function (id) {
            var e = index.projects[id];
            if (!e) return;
            out.projects.push(e);
            out.freed += e.project.size;
            e.project.tasks.forEach(function (t) {
                if (t.mark === "compactable") out.compact.push(index.tasks[t.id]);
                backup(index.tasks[t.id]);
            });
        });
        Object.keys(state.selected.tasks).forEach(function (id) {
            var e = index.tasks[id];
            if (!e || state.selected.projects[e.project.id]) return;
            out.tasks.push(e);
            out.freed += e.task.size;
            if (e.task.mark === "compactable") out.compact.push(e);
            backup(e);
        });
        return out;
    }

    // The photos' bytes Compact frees for these tasks (each one's breakdown), and how many are still unknown
    function compactFrees(state, entries) {
        var bytes = 0, unknown = 0;
        entries.forEach(function (e) {
            var b = state.breakdowns[e.task.id];
            if (b && b.kinds) bytes += b.kinds.photos; else unknown++;
        });
        return {bytes: bytes, unknown: unknown};
    }

    function quotaHtml(section) {
        if (section.quota === null || section.quota === undefined) {
            return '<p class="tweakui-storage-quota"><i class="fa fa-database fa-fw"></i> ' + escapeHtml(formatBytes(section.used)) + " used</p>";
        }
        var perc = section.quota > 0 ? section.used / section.quota * 100 : 100;
        return '<div class="tweakui-storage-quota"><i class="fa fa-database fa-fw"></i> ' + escapeHtml(formatBytes(section.used)) + " of " +
            escapeHtml(formatBytes(section.quota)) + " used" +
            '<div class="progress"><div class="progress-bar progress-bar-' + (perc <= 100 ? "success" : "warning") + '" style="width: ' +
            Math.min(perc, 100).toFixed(0) + '%">' + perc.toFixed(0) + "%</div></div></div>";
    }

    function breakdownHtml(state, task) {
        var b = state.breakdowns[task.id];
        if (!b || b === "loading") return '<p class="text-muted"><i class="fa fa-circle-notch fa-spin"></i> Measuring...</p>';
        if (b === "error") return '<p class="text-danger">Could not measure this task.</p>';
        var total = 0;
        KINDS.forEach(function (k) { total += b.kinds[k[0]] || 0; });
        return '<table class="tweakui-storage-kinds">' + KINDS.map(function (k) {
            var n = b.kinds[k[0]] || 0, perc = total ? n / total * 100 : 0;
            return '<tr data-kind="' + k[0] + '"><td>' + k[1] + '</td><td class="tweakui-storage-size">' + escapeHtml(formatBytes(n)) +
                '</td><td class="tweakui-storage-share"><span class="tweakui-storage-bar theme-border"><span style="width: ' + perc.toFixed(1) + '%"></span></span></td></tr>';
        }).join("") + "</table>";
    }

    function taskHtml(state, project, task) {
        var open = !!state.open.tasks[task.id], underProject = !!state.selected.projects[project.id];
        var ticked = underProject || !!state.selected.tasks[task.id], mark = MARKS[task.mark];
        var name = task.name || "Task of " + (task.created_at ? task.created_at.slice(0, 10) : "?");
        var created = task.created_at ? new Date(task.created_at) : null;
        var html = '<tr class="tweakui-storage-task" data-task="' + escapeHtml(task.id) + '" data-project="' + escapeHtml(project.id) + '">' +
            '<td><input type="checkbox" data-act="tick-task" aria-label="Select ' + escapeHtml(name) + '"' + (ticked ? " checked" : "") +
            (underProject || busy(task) ? " disabled" : "") + "></td>" +
            '<td class="tweakui-storage-name tweakui-storage-indent"><button type="button" class="btn btn-link btn-xs" data-act="open-task" aria-expanded="' + open + '">' +
            '<i class="fa fa-caret-' + (open ? "down" : "right") + ' fa-fw"></i> ' + escapeHtml(name) + "</button>" +
            (mark ? ' <span class="label ' + mark[1] + '">' + mark[0] + "</span>" : "") + "</td>" +
            "<td>" + escapeHtml(statusLabel(task)) + (task.compacted ? " (compacted)" : "") + "</td>" +
            '<td class="tweakui-storage-date">' + (created && !isNaN(created) ? escapeHtml(created.toLocaleDateString()) : "") + "</td>" +
            '<td class="tweakui-storage-size">' + escapeHtml(formatBytes(task.size)) + "</td>" +
            '<td class="tweakui-storage-buttons">' +
            (backupable(task) ? '<a class="btn btn-default btn-xs" href="' + escapeHtml(backupUrl({project: project, task: task})) +
                '" download title="Backup: download the whole task as a zip"><i class="fa fa-file-download"></i><span class="hidden-xs"> Backup</span></a> ' : "") +
            (task.mark === "compactable" ? '<button type="button" class="btn btn-default btn-xs" data-act="compact-task" title="Compact: delete its photos, keep its maps and models"><i class="fa fa-compress"></i> Compact</button> ' : "") +
            (busy(task) ? "" : '<button type="button" class="btn btn-danger btn-xs" data-act="delete-task" title="Delete this task"><i class="fa fa-trash"></i></button>') +
            "</td></tr>";
        if (open) html += '<tr class="tweakui-storage-breakdown" data-task="' + escapeHtml(task.id) + '"><td></td><td colspan="5">' + breakdownHtml(state, task) + "</td></tr>";
        return html;
    }

    function projectHtml(state, project) {
        var open = !!state.open.projects[project.id], ticked = !!state.selected.projects[project.id];
        var html = '<tbody class="tweakui-storage-project" data-project="' + escapeHtml(project.id) + '"><tr class="tweakui-storage-project-row theme-background-highlight">' +
            '<td><input type="checkbox" data-act="tick-project" aria-label="Select project ' + escapeHtml(project.name) + '"' + (ticked ? " checked" : "") + "></td>" +
            '<td class="tweakui-storage-name"><button type="button" class="btn btn-link btn-xs" data-act="open-project" aria-expanded="' + open + '">' +
            '<i class="fa fa-caret-' + (open ? "down" : "right") + ' fa-fw"></i> <strong>' + escapeHtml(project.name) + "</strong></button></td>" +
            "<td>" + project.tasks.length + (project.tasks.length === 1 ? " task" : " tasks") + "</td><td></td>" +
            '<td class="tweakui-storage-size"><strong>' + escapeHtml(formatBytes(project.size)) + "</strong></td>" +
            '<td class="tweakui-storage-buttons"><button type="button" class="btn btn-default btn-xs" data-act="import-project" ' +
            'title="Import: add tasks to this project from zips (backups or assets)"' + (state.working ? " disabled" : "") +
            '><i class="glyphicon glyphicon-import"></i><span class="hidden-xs"> Import</span></button> <button type="button" class="btn btn-danger btn-xs" data-act="delete-project" title="Delete this project and its tasks"><i class="fa fa-trash"></i></button></td></tr>';
        if (open) {
            if (!project.tasks.length) html += '<tr><td></td><td colspan="5" class="text-muted tweakui-storage-indent">No tasks.</td></tr>';
            project.tasks.forEach(function (t) { html += taskHtml(state, project, t); });
        }
        return html + "</tbody>";
    }

    function sectionHtml(state, section, title) {
        var html = '<section class="tweakui-storage-user" data-user="' + escapeHtml(section.user.id) + '">' +
            (title ? "<h4>" + escapeHtml(title) + "</h4>" : "") + quotaHtml(section);
        if (!section.projects.length) return html + '<p class="text-muted">No projects.</p></section>';
        return html + '<div class="tweakui-storage-scroll"><table class="table tweakui-storage-table"><thead><tr><th></th><th>Name</th><th>Status</th><th>Created</th>' +
            '<th class="tweakui-storage-size">Size</th><th></th></tr></thead>' +
            section.projects.map(function (p) { return projectHtml(state, p); }).join("") + "</table></div></section>";
    }

    function render(page, state) {
        var body = page.querySelector(".tweakui-storage-body"), r = state.report;
        if (!r) return;
        var html = sectionHtml(state, r.me, r.admin ? "Your storage" : null);
        if (r.admin) {
            html += r.others.length ? r.others.map(function (s) { return sectionHtml(state, s, s.user.username); }).join("")
                : '<p class="text-muted">No other user owns a project.</p>';
        }
        body.innerHTML = html;
        renderSelection(page, state);
    }

    // The action bar: what is ticked and the actions it allows
    function renderSelection(page, state) {
        var p = plan(state), n = p.projects.length + p.tasks.length;
        var text = page.querySelector(".tweakui-storage-selected");
        if (!n) text.textContent = "Tick tasks or projects to back up or clean up several at once.";
        else {
            var parts = [];
            if (p.projects.length) parts.push(p.projects.length + (p.projects.length === 1 ? " project" : " projects"));
            if (p.tasks.length) parts.push(p.tasks.length + (p.tasks.length === 1 ? " task" : " tasks"));
            text.textContent = "Selected: " + parts.join(" and ") + " (" + formatBytes(p.freed) + ")";
        }
        page.querySelector("[data-act=backup-selected]").disabled = !p.backup.length || state.working;
        page.querySelector("[data-act=compact-selected]").disabled = !p.compact.length || state.working;
        page.querySelector("[data-act=delete-selected]").disabled = !n || state.working;
    }

    function setStatus(page, text, failed) {
        var status = page.querySelector(".tweakui-storage-status");
        status.textContent = text || "";
        status.className = "tweakui-storage-status" + (failed ? " text-danger" : " text-muted");
    }

    function entryLine(state, e, what) {
        if (what === "project") {
            var n = e.project.tasks.length;
            return "Project " + e.project.name + " (" + n + (n === 1 ? " task" : " tasks") + ")" + owned(e) + ": " + formatBytes(e.project.size);
        }
        return (e.task.name || "Task") + " in " + e.project.name + owned(e) + ": " + (what === "compact" ? photosText(state, e) : formatBytes(e.task.size));
    }
    function owned(e) { return e.owner && e.owner.self === false ? " of " + e.owner.username : ""; }
    function photosText(state, e) {
        var b = state.breakdowns[e.task.id];
        return b && b.kinds ? formatBytes(b.kinds.photos) + " of photos" : "its photos";
    }

    // The confirmation's text: {title, lines, note, button} for a Delete (action.projects, action.tasks) or a Compact
    // (action.compact)
    function confirmation(state, action) {
        if (action.compact) {
            var f = compactFrees(state, action.compact), n = action.compact.length;
            return {
                title: "Compact " + n + (n === 1 ? " task" : " tasks") + "? This frees " + formatBytes(f.bytes) +
                    (f.unknown ? " and the photos of " + f.unknown + " more" : "") + ".",
                lines: action.compact.map(function (e) { return entryLine(state, e, "compact"); }),
                note: COMPACT_NOTE, button: "Compact", danger: false
            };
        }
        var parts = [], freed = 0, lines = [];
        if (action.projects.length) parts.push(action.projects.length + (action.projects.length === 1 ? " project" : " projects"));
        if (action.tasks.length) parts.push(action.tasks.length + (action.tasks.length === 1 ? " task" : " tasks"));
        action.projects.forEach(function (e) { freed += e.project.size; lines.push(entryLine(state, e, "project")); });
        action.tasks.forEach(function (e) { freed += e.task.size; lines.push(entryLine(state, e, "task")); });
        return {
            title: "Delete " + parts.join(" and ") + "? This frees " + formatBytes(freed) + ".",
            lines: lines,
            note: (action.projects.length ? "A deleted project goes with all its tasks. " : "") + "What is deleted cannot be recovered.",
            button: "Delete", danger: true
        };
    }

    function showConfirm(page, text, onYes) {
        var box = page.querySelector(".tweakui-storage-confirm");
        box.innerHTML = "<p><strong>" + escapeHtml(text.title) + "</strong></p><ul>" +
            text.lines.map(function (l) { return "<li>" + escapeHtml(l) + "</li>"; }).join("") + "</ul>" +
            '<p class="text-muted">' + escapeHtml(text.note) + "</p>" +
            '<button type="button" class="btn btn-' + (text.danger ? "danger" : "primary") + ' btn-sm" data-act="confirm-yes">' + escapeHtml(text.button) + "</button> " +
            '<button type="button" class="btn btn-default btn-sm" data-act="confirm-no">Cancel</button>';
        box.hidden = false;
        box.querySelector("[data-act=confirm-yes]").onclick = function () { box.hidden = true; box.innerHTML = ""; onYes(); };
        box.querySelector("[data-act=confirm-no]").onclick = function () { box.hidden = true; box.innerHTML = ""; };
        box.querySelector("[data-act=confirm-yes]").focus();
        if (box.scrollIntoView) box.scrollIntoView({block: "nearest"});
    }

    // WebODM's API calls for an action, in order: [{method, url, label}]
    function requests(action) {
        var out = [];
        if (action.compact) {
            action.compact.forEach(function (e) {
                out.push({method: "POST", url: "/api/projects/" + e.project.id + "/tasks/" + e.task.id + "/compact/", label: e.task.name || "Task"});
            });
            return out;
        }
        action.projects.forEach(function (e) {
            out.push({method: "DELETE", url: "/api/projects/" + e.project.id + "/", label: e.project.name});
        });
        action.tasks.forEach(function (e) {
            out.push({method: "POST", url: "/api/projects/" + e.project.id + "/tasks/" + e.task.id + "/remove/", label: e.task.name || "Task"});
        });
        return out;
    }

    function run(fetchFn, doc, list) {
        var failed = [];
        return list.reduce(function (chain, r) {
            return chain.then(function () {
                return fetchFn(r.url, {method: r.method, credentials: "same-origin", headers: {"X-CSRFToken": ui.csrfToken(doc)}})
                    .then(function (res) {
                        if (res.ok) return;
                        return res.json().then(function (d) { failed.push(r.label + ": " + ((d && (d.detail || d.error)) || res.status)); },
                            function () { failed.push(r.label + ": " + res.status); });
                    }, function () { failed.push(r.label + ": no answer"); });
            });
        }, Promise.resolve()).then(function () { return failed; });
    }

    // A browser download of a URL, as a link's click: the page holds none of it, whatever its size
    function download(doc, url) {
        var a = doc.createElement("a");
        a.href = url;
        a.setAttribute("download", "");
        a.hidden = true;
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
    }

    function randomId(win) {
        if (win.crypto && typeof win.crypto.randomUUID === "function") return win.crypto.randomUUID();
        return "tweakui-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    }

    // The error a WebODM answer gives: its detail or error, else its status
    function failure(res) {
        return res.json().then(function (d) {
            var detail = d && (d.detail || d.error);
            return Array.isArray(detail) ? detail.join(" ") : detail || String(res.status);
        }, function () { return String(res.status); });
    }

    // One zip to WebODM's import URL, in chunks as WebODM's Import (Dropzone) sends them, named after the file (a
    // backup takes back its own name). progress(fraction) after each chunk; resolves to WebODM's new task, or rejects
    // with the reason
    function importZip(fetchFn, doc, win, projectId, file, progress) {
        var total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE)), id = randomId(win);
        var url = "/api/projects/" + projectId + "/tasks/import", name = file.name.replace(/\.zip$/i, "");
        function send(index, tries) {
            var offset = index * CHUNK_SIZE, body = new win.FormData();
            body.append("name", name);
            body.append("dzuuid", id);
            body.append("dzchunkindex", String(index));
            body.append("dztotalfilesize", String(file.size));
            body.append("dzchunksize", String(CHUNK_SIZE));
            body.append("dztotalchunkcount", String(total));
            body.append("dzchunkbyteoffset", String(offset));
            body.append("file", file.slice(offset, Math.min(file.size, offset + CHUNK_SIZE)), file.name);
            return fetchFn(url, {method: "POST", credentials: "same-origin", headers: {"X-CSRFToken": ui.csrfToken(doc)}, body: body})
                .then(function (res) {
                    if (!res.ok) return failure(res).then(function (why) { throw new Error(why); });
                    progress((index + 1) / total);
                    if (index + 1 < total) return send(index + 1, 1);
                    return res.json();
                }, function () {
                    if (tries < CHUNK_TRIES) return send(index, tries + 1);
                    throw new Error("no answer");
                });
        }
        return send(0, 1);
    }

    function start(doc, win, fetchFn) {
        var page = doc.getElementById("tweakui-storage");
        if (!page || !page.querySelector(".tweakui-storage-body")) return null;
        fetchFn = fetchFn || (win.fetch && win.fetch.bind(win));
        var api = page.getAttribute("data-api");
        var state = {report: null, index: {projects: {}, tasks: {}}, open: {projects: {}, tasks: {}},
            selected: {projects: {}, tasks: {}}, breakdowns: {}, working: false};
        var fileInput = page.querySelector(".tweakui-storage-file"), importTo = null;

        function load() {
            return fetchFn(api + "storage", {credentials: "same-origin"}).then(function (res) {
                if (!res.ok) throw new Error(res.status);
                return res.json();
            }).then(function (report) {
                report.me.user.self = true;
                (report.others || []).forEach(function (s) { s.user.self = false; });
                state.report = report;
                state.index = indexReport(report);
                // What is gone (or now busy) is no longer ticked
                Object.keys(state.selected.projects).forEach(function (id) { if (!state.index.projects[id]) delete state.selected.projects[id]; });
                Object.keys(state.selected.tasks).forEach(function (id) {
                    var e = state.index.tasks[id];
                    if (!e || busy(e.task)) delete state.selected.tasks[id];
                });
                render(page, state);
            }, function () {
                page.querySelector(".tweakui-storage-body").innerHTML = '<p class="text-danger">Could not load the storage report.</p>';
            });
        }

        function measure(id) {
            var e = state.index.tasks[id];
            if (!e) return Promise.resolve();
            var b = state.breakdowns[id];
            if (b && b.kinds) return Promise.resolve();
            state.breakdowns[id] = "loading";
            return fetchFn(api + "storage/" + e.project.id + "/" + id, {credentials: "same-origin"}).then(function (res) {
                if (!res.ok) throw new Error(res.status);
                return res.json();
            }).then(function (d) { state.breakdowns[id] = d; }, function () { state.breakdowns[id] = "error"; });
        }

        function act(action) {
            var list = requests(action);
            if (!list.length) return Promise.resolve();
            state.working = true;
            renderSelection(page, state);
            setStatus(page, (action.compact ? "Compacting " : "Deleting ") + list.length + (list.length === 1 ? " item" : " items") + "...");
            return run(fetchFn, doc, list).then(function (failed) {
                state.working = false;
                if (failed.length) setStatus(page, "Not done: " + failed.join("; "), true);
                else setStatus(page, action.compact ? "Compacting started; sizes update once WebODM is done." : "Deleted.");
                if (!action.compact) { state.selected = {projects: {}, tasks: {}}; }
                action.compact && action.compact.forEach(function (e) { delete state.breakdowns[e.task.id]; });
                return load();
            });
        }

        // Asks first; a Compact measures its tasks first, to say what it frees
        function ask(action) {
            var ready = action.compact ? Promise.all(action.compact.map(function (e) { return measure(e.task.id); })) : Promise.resolve();
            return ready.then(function () {
                render(page, state);
                showConfirm(page, confirmation(state, action), function () { act(action); });
            });
        }

        // Backup All: each task's download in turn, a pause between them; nothing changes, so no confirmation
        function backupAll() {
            var p = plan(state), list = p.backup;
            if (!list.length) return Promise.resolve();
            var skipped = p.skipped ? " (" + p.skipped + " skipped: not completed)" : "";
            state.working = true;
            render(page, state);
            return list.reduce(function (chain, e, i) {
                return chain.then(function () {
                    setStatus(page, "Downloading backup " + (i + 1) + " of " + list.length + ": " + (e.task.name || "Task") + skipped);
                    download(doc, backupUrl(e));
                    if (i + 1 < list.length) return new Promise(function (resolve) { win.setTimeout(resolve, BACKUP_PAUSE); });
                });
            }, Promise.resolve()).then(function () {
                state.working = false;
                render(page, state);
                setStatus(page, list.length + (list.length === 1 ? " backup" : " backups") + " started; the browser saves " +
                    (list.length === 1 ? "it" : "them") + " as WebODM sends " + (list.length === 1 ? "it" : "them") + skipped + ".");
            });
        }

        // Import: the zips chosen, one after another into the project, then the list again (WebODM marks each task
        // Importing until it has restored it)
        function importFiles(projectId, files) {
            files = Array.prototype.slice.call(files || []);
            if (!files.length) return Promise.resolve();
            var failed = [], done = 0;
            state.working = true;
            render(page, state);
            return files.reduce(function (chain, file, i) {
                return chain.then(function () {
                    var line = "Importing " + (files.length > 1 ? (i + 1) + " of " + files.length + ": " : "") + file.name;
                    setStatus(page, line + ", 0%");
                    return importZip(fetchFn, doc, win, projectId, file, function (f) {
                        setStatus(page, line + ", " + Math.floor(f * 100) + "%");
                    }).then(function () { done++; }, function (err) { failed.push(file.name + ": " + err.message); });
                });
            }, Promise.resolve()).then(function () {
                state.working = false;
                if (failed.length) setStatus(page, "Not imported: " + failed.join("; "), true);
                else setStatus(page, "Uploaded " + done + (done === 1 ? " zip" : " zips") + "; WebODM is importing " +
                    (done === 1 ? "it" : "them") + ".");
                return load();
            });
        }

        if (fileInput) {
            fileInput.addEventListener("change", function () {
                var to = importTo, files = fileInput.files;
                importTo = null;
                if (to) importFiles(to, files).then(function () { fileInput.value = ""; });
            });
        }

        page.addEventListener("click", function (ev) {
            var el = ev.target.closest ? ev.target.closest("[data-act]") : null;
            if (!el) return;
            var what = el.getAttribute("data-act");
            var taskRow = el.closest("[data-task]"), projectBody = el.closest("[data-project]");
            var taskId = taskRow && taskRow.getAttribute("data-task"), projectId = projectBody && projectBody.getAttribute("data-project");
            if (what === "open-project") {
                if (state.open.projects[projectId]) delete state.open.projects[projectId]; else state.open.projects[projectId] = true;
                render(page, state);
            } else if (what === "open-task") {
                if (state.open.tasks[taskId]) { delete state.open.tasks[taskId]; render(page, state); }
                else { state.open.tasks[taskId] = true; render(page, state); measure(taskId).then(function () { render(page, state); }); }
            } else if (what === "compact-task") {
                ask({compact: [state.index.tasks[taskId]]});
            } else if (what === "delete-task") {
                ask({projects: [], tasks: [state.index.tasks[taskId]]});
            } else if (what === "delete-project") {
                ask({projects: [state.index.projects[projectId]], tasks: []});
            } else if (what === "import-project") {
                if (!fileInput || state.working) return;
                importTo = projectId;
                fileInput.click();
            } else if (what === "backup-selected") {
                backupAll();
            } else if (what === "compact-selected") {
                ask({compact: plan(state).compact});
            } else if (what === "delete-selected") {
                var p = plan(state);
                ask({projects: p.projects, tasks: p.tasks});
            }
        });
        page.addEventListener("change", function (ev) {
            var el = ev.target, what = el.getAttribute && el.getAttribute("data-act");
            if (what === "tick-project") {
                var id = el.closest("[data-project]").getAttribute("data-project");
                if (el.checked) state.selected.projects[id] = true; else delete state.selected.projects[id];
                render(page, state);
            } else if (what === "tick-task") {
                var t = el.closest("[data-task]").getAttribute("data-task");
                if (el.checked) state.selected.tasks[t] = true; else delete state.selected.tasks[t];
                renderSelection(page, state);
            }
        });

        var loaded = load();
        return {state: state, loaded: loaded, load: load, backupAll: backupAll, importFiles: importFiles};
    }

    return {start: start, formatBytes: formatBytes, statusLabel: statusLabel, plan: plan, indexReport: indexReport,
        confirmation: confirmation, requests: requests, compactFrees: compactFrees, importZip: importZip,
        CHUNK_SIZE: CHUNK_SIZE, BACKUP_PAUSE: BACKUP_PAUSE};
});
