// General > Task Details > Task Buttons When Minimized: on the Dashboard, a minimized task still shows its action buttons
// (Download, Map, 3D Model, Report, Edit, Restart, Delete and the plugins' own). WebODM leaves a minimized task's panel
// out of the page altogether, so "buttons only" is WebODM's expanded task with all but its buttons hidden
// (data-tweakui-controls="buttons" on the task, main.css). The +/- control and the task's name cycle buttons only,
// expanded (WebODM's), fully minimized (WebODM's, data-tweakui-controls="min"): from buttons only TweakUI alone shows
// the rest (WebODM never sees the click). A task the list shows minimized starts as buttons only (TweakUI clicks its
// +); the tasks fully expanded are kept for the tab (sessionStorage), so a reload, which reopens every task WebODM
// lists in the address as expanded, shows them as they were. WebODM adds each task it opens to the address
// (project_task_expanded), TweakUI's too: the address keeps only the fully expanded ones, so a project of hundreds of
// tasks doesn't make an address too long for a proxy. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) {
        root.TweakUI.feature(root, "task_controls", api.start, {when: function (s, win) {
            return s.expand_task_controls && /^\/dashboard\//.test(win.location.pathname);
        }});
    }
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: a task on the Dashboard (TaskListItem), its
    // +/- and name, its open panel and that panel's Task ID
    var SELECTORS = {
        task: ".task-list-item", toggle: ".name > i.clickable", nameLink: ".name > .name-link",
        open: "fa-minus-square", taskId: ".expanded-panel .task-id-link"
    };
    var NAME = "task_controls";

    var MODE = "data-tweakui-controls", SEEN = "data-tweakui-controls-seen", BUTTONS = "buttons", MIN = "min";
    var KEY = "tweakui-task-controls-full";
    // WebODM's list of the expanded tasks in the address (TaskListItem, HistoryNav)
    var PARAM = "project_task_expanded";
    var TITLES = {buttons: "Expand", full: "Minimize", min: "Show Task Controls"};

    // A task's +/- (WebODM's toggle), on its own row; an edit panel's inner .task-list-item has none
    function toggle(item) {
        var name = item.firstElementChild;
        while (name && !(name.classList.contains("row") && name.querySelector(".name"))) name = name.nextElementSibling;
        var icon = name && name.querySelector(SELECTORS.toggle);
        return icon || null;
    }

    function isOpen(item) {
        var icon = toggle(item);
        return !!icon && icon.classList.contains(SELECTORS.open);
    }

    // The task's id, from its panel's Task ID (only while it's open)
    function taskId(item) {
        var link = item.querySelector(SELECTORS.taskId);
        var text = link && link.textContent.trim();
        return text ? text.split(/\s+/)[0] : null;
    }

    function readFull(win) {
        try {
            var list = JSON.parse(win.sessionStorage.getItem(KEY) || "[]");
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function remember(win, id, full) {
        if (!id) return;
        var list = readFull(win).filter(function (x) { return x !== id; });
        if (full) list.push(id);
        try {
            win.sessionStorage.setItem(KEY, JSON.stringify(list));
        } catch (e) { /* the tasks then come back as buttons only */ }
    }

    // The address's query with the expanded tasks changed, written as WebODM writes it: `want` {id: true (listed) or
    // false (not)}; null when it doesn't change
    function expandedSearch(search, want) {
        var out = [], found = false, changed = false;
        function listed(ids) {
            var kept = ids.filter(function (id) {
                if (want[id] === false) changed = true;
                return want[id] !== false;
            });
            Object.keys(want).forEach(function (id) {
                if (want[id] && kept.indexOf(id) === -1) {
                    kept.push(id);
                    changed = true;
                }
            });
            return kept;
        }
        search.replace(/^\?/, "").split("&").forEach(function (part) {
            if (!part) return;
            var eq = part.indexOf("=");
            if (eq === -1 || part.slice(0, eq) !== PARAM) {
                out.push(part);
                return;
            }
            found = true;
            out.push(PARAM + "=" + listed(part.slice(eq + 1).split(",").filter(Boolean)).join(","));
        });
        if (!found) {
            var ids = listed([]);
            if (ids.length) out.push(PARAM + "=" + ids.join(","));
        }
        return changed ? (out.length ? "?" + out.join("&") : "") : null;
    }

    // Takes the tasks shown as buttons only out of the address and puts the fully expanded ones in. WebODM's router
    // keeps its own copy of the location (react-router's history), which a popstate makes it read again, so WebODM's
    // next toggle doesn't write the old list back
    function syncAddress(win, want) {
        var search = expandedSearch(win.location.search, want);
        if (search === null || !win.history || !win.history.replaceState) return;
        var state = win.history.state;
        win.history.replaceState(state, "", win.location.pathname + search + win.location.hash);
        var pop;
        if (typeof win.PopStateEvent === "function") pop = new win.PopStateEvent("popstate", {state: state});
        else {
            pop = win.document.createEvent("Event");
            pop.initEvent("popstate", false, false);
        }
        win.dispatchEvent(pop);
    }

    function setMode(item, mode) {
        if (mode) {
            if (item.getAttribute(MODE) !== mode) item.setAttribute(MODE, mode);
        } else if (item.hasAttribute(MODE)) {
            item.removeAttribute(MODE);
        }
    }

    // Brings every task on the page to its state: a task seen for the first time minimized is opened as buttons
    // only, one WebODM opened itself (from the address) is buttons only unless it was fully expanded in this tab; a
    // task WebODM opens or closes by itself (Edit, Restart) is taken as it is. The +/- title names the next step
    function apply(doc, win, click) {
        var want = {};
        Array.prototype.forEach.call(doc.querySelectorAll(SELECTORS.task), function (item) {
            var icon = toggle(item);
            if (!icon) return;
            var open = isOpen(item), mode = item.getAttribute(MODE);
            if (!item.hasAttribute(SEEN)) {
                item.setAttribute(SEEN, "");
                if (!open) {
                    setMode(item, BUTTONS);
                    click(icon);
                    open = isOpen(item);
                } else if (readFull(win).indexOf(taskId(item)) === -1) {
                    setMode(item, BUTTONS);
                }
                mode = item.getAttribute(MODE);
            } else if (open && mode === MIN) {
                setMode(item, null);
                mode = null;
            } else if (!open && mode !== MIN) {
                setMode(item, MIN);
                mode = MIN;
            }
            var title = !open ? TITLES.min : mode === BUTTONS ? TITLES.buttons : TITLES.full;
            if (icon.getAttribute("title") !== title) icon.setAttribute("title", title);
            var id = open && taskId(item);
            if (id) want[id] = mode !== BUTTONS;
        });
        syncAddress(win, want);
    }

    // A click on a task's +/- or name, before WebODM's: from buttons only, TweakUI shows the rest; from expanded,
    // WebODM minimizes it fully; from fully minimized, WebODM opens it, as buttons only
    function onToggle(win, e) {
        var target = e.target;
        var hit = target && target.closest && target.closest(SELECTORS.toggle + ", " + SELECTORS.nameLink);
        var item = hit && hit.closest(SELECTORS.task);
        if (!item || !toggle(item)) return false;
        var open = isOpen(item), mode = item.getAttribute(MODE), id = taskId(item);
        if (open && mode === BUTTONS) {
            e.stopPropagation();
            e.preventDefault();
            setMode(item, null);
            remember(win, id, true);
        } else if (open) {
            setMode(item, MIN);
            remember(win, id, false);
        } else {
            setMode(item, BUTTONS);
        }
        return true;
    }

    function start(doc, win) {
        var auto = false, pending = false;
        function click(icon) {
            auto = true;
            try {
                icon.click();
            } finally {
                auto = false;
            }
        }
        function later() {
            if (pending) return;
            pending = true;
            win.setTimeout(function () {
                pending = false;
                apply(doc, win, click);
            }, 0);
        }
        var onClick = ui.guard(NAME, function (e) {
            if (!auto && onToggle(win, e)) later();
        });
        doc.addEventListener("click", onClick, true);
        var observer = win.MutationObserver ? new win.MutationObserver(ui.guard(NAME, later)) : null;
        if (observer) observer.observe(doc.body || doc.documentElement, {childList: true, subtree: true});
        apply(doc, win, click);
        return {
            stop: function () {
                doc.removeEventListener("click", onClick, true);
                if (observer) observer.disconnect();
            }
        };
    }

    return {start: start, apply: apply, onToggle: onToggle, taskId: taskId, isOpen: isOpen, expandedSearch: expandedSearch, KEY: KEY, SELECTORS: SELECTORS};
});
