// General > Task Details > Expand Task Controls: on the Dashboard, a minimized task still shows its action buttons
// (Download, Map, 3D Model, Report, Edit, Restart, Delete and the plugins' own). WebODM leaves a minimized task's panel
// out of the page altogether, so "buttons only" is WebODM's expanded task with all but its buttons hidden
// (data-tweakui-controls="buttons" on the task, main.css). The +/- control and the task's name cycle buttons only,
// expanded (WebODM's), fully minimized (WebODM's, data-tweakui-controls="min"): from buttons only TweakUI alone shows
// the rest (WebODM never sees the click). A task the list shows minimized starts as buttons only (TweakUI clicks its
// +); the tasks fully expanded are kept for the tab (sessionStorage), so a reload, which reopens every task WebODM
// lists in the address as expanded, shows them as they were. UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.document) {
        var settings = (root.TweakUI && root.TweakUI.settings) || {};
        if (settings.expand_task_controls && /^\/dashboard\//.test(root.location.pathname)) api.start(root.document, root);
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    var MODE = "data-tweakui-controls", SEEN = "data-tweakui-controls-seen", BUTTONS = "buttons", MIN = "min";
    var KEY = "tweakui-task-controls-full";
    var TITLES = {buttons: "Expand", full: "Minimize", min: "Show Task Controls"};

    // A task's +/- (WebODM's toggle), on its own row; an edit panel's inner .task-list-item has none
    function toggle(item) {
        var name = item.firstElementChild;
        while (name && !(name.classList.contains("row") && name.querySelector(".name"))) name = name.nextElementSibling;
        var icon = name && name.querySelector(".name > i.clickable");
        return icon || null;
    }

    function isOpen(item) {
        var icon = toggle(item);
        return !!icon && icon.classList.contains("fa-minus-square");
    }

    // The task's id, from its panel's Task ID (only while it's open)
    function taskId(item) {
        var link = item.querySelector(".expanded-panel .task-id-link");
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
        Array.prototype.forEach.call(doc.querySelectorAll(".task-list-item"), function (item) {
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
        });
    }

    // A click on a task's +/- or name, before WebODM's: from buttons only, TweakUI shows the rest; from expanded,
    // WebODM minimizes it fully; from fully minimized, WebODM opens it, as buttons only
    function onToggle(win, e) {
        var target = e.target;
        var hit = target && target.closest && target.closest(".name > i.clickable, .name > .name-link");
        var item = hit && hit.closest(".task-list-item");
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
        function onClick(e) {
            if (!auto && onToggle(win, e)) later();
        }
        doc.addEventListener("click", onClick, true);
        var observer = win.MutationObserver ? new win.MutationObserver(later) : null;
        if (observer) observer.observe(doc.body || doc.documentElement, {childList: true, subtree: true});
        apply(doc, win, click);
        return {
            stop: function () {
                doc.removeEventListener("click", onClick, true);
                if (observer) observer.disconnect();
            }
        };
    }

    return {start: start, apply: apply, onToggle: onToggle, taskId: taskId, isOpen: isOpen, KEY: KEY};
});
