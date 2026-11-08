// General > Task Options > Sort Preset Options: the Options preset dropdown of a task's form (the New Task panel's and
// a task's Edit form, EditTaskForm in WebODM) becomes a dropdown of TweakUI's own, in theme colours: (Custom) when the
// options were edited, then Default, at the top; then "User Presets", which opens in the list to the user's own
// presets, A-Z; then the other system presets, A-Z. WebODM's select stays on the page, hidden: choosing an item sets
// its value and sends it a change event, so WebODM's own code selects the preset, and the button follows the select
// (its options, value and title change as WebODM re-renders it). UMD, so Jest can load it.
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

    function gettext(win, text) {
        return typeof win.gettext === "function" ? win.gettext(text) : text;
    }

    function byName(a, b) {
        return a.name.localeCompare(b.name, undefined, {sensitivity: "base"});
    }

    // The select's presets, in the menu's order: {top: [(Custom), Default], user: [...], system: [...]}, each
    // {value, name}; Default is the system preset WebODM shows as gettext("Default")
    function order(select, win) {
        var defaultName = gettext(win, "Default"), out = {top: [], user: [], system: []}, custom = null, def = null;
        Array.prototype.forEach.call(select.options, function (o) {
            var p = {value: o.value, name: o.textContent};
            if (o.value === CUSTOM) custom = p;
            else if (!o.classList.contains("system-preset")) out.user.push(p);
            else if (!def && (p.name === defaultName || p.name === "Default")) def = p;
            else out.system.push(p);
        });
        if (custom) out.top.push(custom);
        if (def) out.top.push(def);
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
        wrap.appendChild(button);
        wrap.appendChild(menu);
        // null: the submenu opens when the chosen preset is the user's; then as the user left it
        var userOpen = null;

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

        function build() {
            var list = order(select, win), now = selected();
            while (menu.firstChild) menu.removeChild(menu.firstChild);
            list.top.forEach(function (p) { menu.appendChild(item(p)); });
            if (list.user.length) {
                var mine = list.user.some(function (p) { return p.value === now; });
                var open = userOpen === null ? mine : userOpen;
                var li = ui.el(doc, "li", "tweakui-presets-group");
                li.setAttribute("role", "presentation");
                var head = ui.el(doc, "a", "tweakui-presets-group-head");
                head.href = "#";
                head.setAttribute("role", "menuitem");
                head.setAttribute("aria-expanded", open ? "true" : "false");
                head.appendChild(ui.el(doc, "i", "fa fa-fw " + (open ? "fa-caret-down" : "fa-caret-right")));
                head.appendChild(doc.createTextNode(" User Presets"));
                li.appendChild(head);
                menu.appendChild(li);
                if (open) list.user.forEach(function (p) { menu.appendChild(item(p, true)); });
            }
            if (list.system.length && menu.firstChild) {
                var line = ui.el(doc, "li", "divider");
                line.setAttribute("role", "separator");
                menu.appendChild(line);
            }
            list.system.forEach(function (p) { menu.appendChild(item(p)); });
        }

        function isOpen() { return wrap.classList.contains("open"); }

        function links() { return Array.prototype.slice.call(menu.querySelectorAll("a")); }

        // The arrows: from the button to the chosen preset (else the first or last item), then item by item
        function focusItem(step) {
            var all = links(), i = all.indexOf(doc.activeElement);
            if (!all.length) return;
            if (i === -1) (menu.querySelector("li.tweakui-presets-current > a") || all[step > 0 ? 0 : all.length - 1]).focus();
            else all[(i + step + all.length) % all.length].focus();
        }

        function open() {
            build();
            wrap.classList.add("open");
            button.setAttribute("aria-expanded", "true");
        }

        function close(refocus) {
            if (!isOpen()) return;
            wrap.classList.remove("open");
            button.setAttribute("aria-expanded", "false");
            if (refocus) button.focus();
        }

        button.addEventListener("click", ui.guard(NAME, function () {
            if (isOpen()) close(false);
            else open();
        }));
        menu.addEventListener("click", ui.guard(NAME, function (e) {
            var a = e.target.closest ? e.target.closest("a") : null;
            if (!a) return;
            e.preventDefault();
            if (a.classList.contains("tweakui-presets-group-head")) {
                userOpen = a.getAttribute("aria-expanded") !== "true";
                build();
                var head = menu.querySelector(".tweakui-presets-group-head");
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
                close(true);
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
        return {wrap: wrap, button: button, menu: menu, open: open, close: close, sync: sync};
    }

    // Every preset select on the page that has no dropdown yet
    function scan(doc, win) {
        Array.prototype.forEach.call(doc.querySelectorAll(SELECTORS.form + " select:not([" + DONE + "])"), function (select) {
            if (select.querySelector(SELECTORS.systemPreset)) enhance(select, doc, win);
        });
    }

    function start(doc, win) {
        if (!ui.settingsOf(win).sort_preset_options) return null;
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
