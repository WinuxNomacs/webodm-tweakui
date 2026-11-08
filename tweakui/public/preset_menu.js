// General > Task Options > Replace Preset Options Menu: the Options preset dropdown of a task's form (the New Task
// panel's and a task's Edit form, EditTaskForm in WebODM) becomes a menu of TweakUI's own, in theme colours: (Custom)
// at the top when the options were edited; then two submenus that open in the list, "User Presets" (the user's own)
// and "System Presets" (WebODM's, Default among them), each A-Z and open at first. WebODM's select stays on the page,
// hidden: choosing an item sets its value and sends it a change event, so WebODM's own code selects the preset, and
// the button follows the select (its options, value and title change as WebODM re-renders it). A filter box at the
// top, focused as the menu opens, shows only the presets whose names hold what is typed (any case), every submenu with
// a match open; Enter chooses the first match. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "preset_menu", api.start, {ready: true});
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: a task's form, and its system presets' options
    // (the preset select is the form's select that has them)
    var SELECTORS = {form: ".edit-task-form", systemPreset: "option.system-preset"};
    var NAME = "preset_menu";
    // On WebODM's select, once it has TweakUI's dropdown (main.css hides it)
    var DONE = "data-tweakui-presets";
    var CUSTOM = "-1";

    function byName(a, b) {
        return a.name.localeCompare(b.name, undefined, {sensitivity: "base"});
    }

    // The select's presets, in the menu's order: {top: [(Custom)], user: [...], system: [...]}, each {value, name}
    function order(select) {
        var out = {top: [], user: [], system: []};
        Array.prototype.forEach.call(select.options, function (o) {
            var p = {value: o.value, name: o.textContent};
            if (o.value === CUSTOM) out.top.push(p);
            else if (o.classList.contains("system-preset")) out.system.push(p);
            else out.user.push(p);
        });
        out.user.sort(byName);
        out.system.sort(byName);
        return out;
    }

    // WebODM's select set to a preset, as if the user had chosen it there: React listens for the change event
    function choose(select, value, win) {
        var setter = Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, "value");
        if (setter && setter.set) setter.set.call(select, value);
        else select.value = value;
        var e;
        if (typeof win.Event === "function") e = new win.Event("change", {bubbles: true});
        else {
            e = win.document.createEvent("Event");
            e.initEvent("change", true, false);
        }
        select.dispatchEvent(e);
    }

    // TweakUI's dropdown for one of WebODM's preset selects, put just after it
    function enhance(select, doc, win) {
        var wrap = ui.el(doc, "div", "tweakui-presets");
        var button = ui.el(doc, "button", "form-control tweakui-presets-button");
        button.type = "button";
        button.setAttribute("aria-haspopup", "true");
        button.setAttribute("aria-expanded", "false");
        var label = ui.el(doc, "span", "tweakui-presets-label");
        button.appendChild(label);
        button.appendChild(ui.el(doc, "i", "fa fa-chevron-down tweakui-presets-caret"));
        var menu = ui.el(doc, "ul", "dropdown-menu tweakui-presets-menu");
        menu.setAttribute("role", "menu");
        // The filter: the menu's first item, kept as the rest is rebuilt (so typing keeps its focus and caret)
        var filterItem = ui.el(doc, "li", "tweakui-presets-filter");
        filterItem.setAttribute("role", "presentation");
        var filter = ui.el(doc, "input", "form-control input-sm");
        filter.type = "text";
        filter.setAttribute("placeholder", "Filter Presets");
        filter.setAttribute("aria-label", "Filter Presets");
        filter.setAttribute("autocomplete", "off");
        filterItem.appendChild(filter);
        menu.appendChild(filterItem);
        wrap.appendChild(button);
        wrap.appendChild(menu);
        // Each submenu, by key: open at first, then as the user left it
        var groupOpen = {user: true, system: true};

        function selected() {
            var o = select.options[select.selectedIndex];
            return o ? o.value : null;
        }

        function sync() {
            var o = select.options[select.selectedIndex];
            label.textContent = o ? o.textContent : "";
            var title = select.getAttribute("title");
            if (title) button.setAttribute("title", title);
            else button.removeAttribute("title");
            button.disabled = select.disabled;
        }

        function item(p, nested) {
            // The chosen one in the theme's highlight, as WebODM's menus show an item under the pointer (Bootstrap's
            // .active colours don't follow the theme)
            var current = p.value === selected(), li = ui.el(doc, "li", current ? "tweakui-presets-current" : "");
            li.setAttribute("role", "presentation");
            var a = ui.el(doc, "a", (nested ? "tweakui-presets-nested" : "") + (current ? " theme-background-highlight" : ""), p.name);
            a.href = "#";
            a.setAttribute("role", "menuitem");
            a.setAttribute("data-value", p.value);
            li.appendChild(a);
            return li;
        }

        // A submenu's heading, and its presets while open (always while filtering); none without presets
        function group(key, label, presets, filtering) {
            if (!presets.length) return;
            var open = filtering || groupOpen[key];
            var li = ui.el(doc, "li", "tweakui-presets-group");
            li.setAttribute("role", "presentation");
            var head = ui.el(doc, "a", "tweakui-presets-group-head");
            head.href = "#";
            head.setAttribute("role", "menuitem");
            head.setAttribute("data-group", key);
            if (filtering) head.setAttribute("data-filtering", "");
            head.setAttribute("aria-expanded", open ? "true" : "false");
            head.appendChild(ui.el(doc, "i", "fa fa-fw " + (open ? "fa-caret-down" : "fa-caret-right")));
            head.appendChild(doc.createTextNode(" " + label));
            li.appendChild(head);
            menu.appendChild(li);
            if (open) presets.forEach(function (p) { menu.appendChild(item(p, true)); });
        }

        function build() {
            var list = order(select), query = filter.value.trim().toLowerCase();
            var match = function (p) { return !query || p.name.toLowerCase().indexOf(query) !== -1; };
            while (menu.lastChild !== filterItem) menu.removeChild(menu.lastChild);
            list.top.filter(match).forEach(function (p) { menu.appendChild(item(p)); });
            group("user", "User Presets", list.user.filter(match), !!query);
            group("system", "System Presets", list.system.filter(match), !!query);
            if (menu.lastChild === filterItem) {
                var none = ui.el(doc, "li", "disabled tweakui-presets-none");
                none.setAttribute("role", "presentation");
                none.appendChild(ui.el(doc, "span", "", "No matching presets"));
                menu.appendChild(none);
            }
        }

        function isOpen() { return wrap.classList.contains("open"); }

        function links() { return Array.prototype.slice.call(menu.querySelectorAll("a")); }

        // The arrows: from the button to the chosen preset (else the first or last item), from the filter down to the
        // first match (past the submenus' names), then item by item, the filter box before the first
        function focusItem(step) {
            var all = [filter].concat(links()), i = all.indexOf(doc.activeElement);
            var first = menu.querySelector("a[data-value]");
            if (i === 0 && step > 0 && first) first.focus();
            else if (i === -1) (menu.querySelector("li.tweakui-presets-current > a") || all[step > 0 ? Math.min(1, all.length - 1) : all.length - 1]).focus();
            else all[(i + step + all.length) % all.length].focus();
        }

        // focusFilter: opened with a click, ready for typing; the filter starts empty each time
        function open(focusFilter) {
            filter.value = "";
            build();
            wrap.classList.add("open");
            button.setAttribute("aria-expanded", "true");
            if (focusFilter) filter.focus();
        }

        function close(refocus) {
            if (!isOpen()) return;
            wrap.classList.remove("open");
            button.setAttribute("aria-expanded", "false");
            if (refocus) button.focus();
        }

        button.addEventListener("click", ui.guard(NAME, function () {
            if (isOpen()) close(false);
            else open(true);
        }));
        filter.addEventListener("input", ui.guard(NAME, build));
        menu.addEventListener("click", ui.guard(NAME, function (e) {
            var a = e.target.closest ? e.target.closest("a") : null;
            if (!a) return;
            e.preventDefault();
            if (a.classList.contains("tweakui-presets-group-head")) {
                // While filtering, every submenu with a match stays open
                if (a.hasAttribute("data-filtering")) return;
                var key = a.getAttribute("data-group");
                groupOpen[key] = a.getAttribute("aria-expanded") !== "true";
                build();
                var head = menu.querySelector('.tweakui-presets-group-head[data-group="' + key + '"]');
                if (head) head.focus();
                return;
            }
            var value = a.getAttribute("data-value");
            close(true);
            if (value !== selected()) choose(select, value, win);
            sync();
        }));
        wrap.addEventListener("keydown", ui.guard(NAME, function (e) {
            if (e.key === "Escape" && isOpen()) {
                e.preventDefault();
                // First the filter is cleared, then the menu closed
                if (filter.value) {
                    filter.value = "";
                    build();
                    filter.focus();
                } else close(true);
            } else if (e.key === "Enter" && e.target === filter) {
                e.preventDefault();
                var first = menu.querySelector("a[data-value]");
                if (first) first.click();
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (!isOpen()) open();
                focusItem(e.key === "ArrowDown" ? 1 : -1);
            } else if (e.key === "Tab") close(false);
        }));
        var outside = ui.guard(NAME, function (e) {
            if (!wrap.parentNode) {
                doc.removeEventListener("click", outside, true);
                return;
            }
            if (isOpen() && !wrap.contains(e.target)) close(false);
        });
        doc.addEventListener("click", outside, true);

        // WebODM re-renders the select: its presets (a preset saved or deleted, (Custom) after an edit), its title
        // (the chosen preset's options) and its value
        if (win.MutationObserver) {
            new win.MutationObserver(ui.guard(NAME, function () {
                sync();
                if (isOpen()) build();
            })).observe(select, {childList: true, subtree: true, characterData: true, attributes: true});
        }
        select.addEventListener("change", ui.guard(NAME, sync));
        select.setAttribute(DONE, "");
        select.parentNode.insertBefore(wrap, select.nextSibling);
        sync();
        return {wrap: wrap, button: button, menu: menu, filter: filter, open: open, close: close, sync: sync};
    }

    // Every preset select on the page that has no dropdown yet
    function scan(doc, win) {
        Array.prototype.forEach.call(doc.querySelectorAll(SELECTORS.form + " select:not([" + DONE + "])"), function (select) {
            if (select.querySelector(SELECTORS.systemPreset)) enhance(select, doc, win);
        });
    }

    function start(doc, win) {
        if (!ui.settingsOf(win).replace_preset_menu) return null;
        var pending = false;
        function later() {
            if (pending) return;
            pending = true;
            win.setTimeout(function () {
                pending = false;
                scan(doc, win);
            }, 0);
        }
        scan(doc, win);
        var observer = win.MutationObserver ? new win.MutationObserver(ui.guard(NAME, later)) : null;
        if (observer) observer.observe(doc.body || doc.documentElement, {childList: true, subtree: true});
        return {stop: function () { if (observer) observer.disconnect(); }};
    }

    return {start: start, scan: scan, enhance: enhance, order: order, choose: choose, SELECTORS: SELECTORS};
});
