// General > Task Options > Show Modified Options: in the Task Options dialog (EditPresetDialog in WebODM), each
// group heading's "(13)" becomes "(modified/total)", kept up to date as options change. An option is modified when it
// is not at ODM's default, which is when its component's getValue() is undefined, as "Reset to default" leaves it.
// The count goes in the heading's data-tweakui-count attribute, which main.css shows in place of WebODM's number:
// React re-renders its own text but leaves the attribute alone.
// General > Task Options > Expand Configured: a collapsed group still shows its modified options ("configured"),
// WebODM's own controls, under its heading. WebODM keeps a collapsed group's options on the page, hidden by an inline
// display: none; data-tweakui-expand on the group, data-tweakui-configured on its configured options and subgroups,
// and main.css show only those. "Other Options" is not on the page while closed, so it shows nothing. The dialog's
// Expand/Collapse button then cycles Expand All, Collapse All, Collapse All but Configured: WebODM's own two, and
// data-tweakui-plain on the dialog for a Collapse All that hides the configured options too (skipped when there are
// none). UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.PluginsAPI && root.PluginsAPI.Dashboard && root.PluginsAPI.Dashboard.presetDialogOptionsReady) {
        root.PluginsAPI.Dashboard.presetDialogOptionsReady(function (args) {
            var settings = (root.TweakUI && root.TweakUI.settings) || {};
            var features = {count: !!settings.show_modified_options, expand: !!settings.expand_configured};
            if (features.count || features.expand) api.watch(root.document, args.options, root, features);
        });
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    var ATTR = "data-tweakui-count", EXPAND = "data-tweakui-expand", CONFIGURED = "data-tweakui-configured";
    var PLAIN = "data-tweakui-plain";
    var ALL = {count: true, expand: true};

    // The option name a .processing-node-option shows: the first word of its label
    function optionName(el) {
        var label = el.querySelector("label");
        var text = label && label.firstChild && label.firstChild.nodeValue;
        return text ? text.trim().split(/\s+/)[0] : null;
    }

    function isModified(component) {
        try {
            return !!component && typeof component.getValue === "function" && component.getValue() !== undefined;
        } catch (e) {
            return false;
        }
    }

    // Sets or removes a boolean attribute, only when it changes
    function flag(el, name, on) {
        if (on && !el.hasAttribute(name)) el.setAttribute(name, "");
        else if (!on && el.hasAttribute(name)) el.removeAttribute(name);
    }

    // Writes "(modified/total)" on every group heading of the dialog whose options are on the page (features.count);
    // a group whose options are not ("Other Options" while closed) keeps WebODM's own number. With features.expand,
    // marks the configured options, and the collapsed groups that have any, for main.css to show
    function update(dialog, options, features) {
        features = features || ALL;
        Array.prototype.forEach.call(dialog.querySelectorAll(".option-group"), function (group) {
            var header = group.querySelector(".option-group-header");
            if (!header) return;
            var shown = group.querySelectorAll(".processing-node-option"), modified = 0;
            Array.prototype.forEach.call(shown, function (el) {
                var on = isModified(options[optionName(el)]);
                if (on) modified++;
                if (features.expand) flag(el, CONFIGURED, on);
            });
            if (features.expand) {
                Array.prototype.forEach.call(group.querySelectorAll(".option-subgroup"), function (sub) {
                    flag(sub, CONFIGURED, !!sub.querySelector(".processing-node-option[" + CONFIGURED + "]"));
                });
                var content = group.querySelector(".option-group-content");
                flag(group, EXPAND, modified > 0 && !!content && content.style.display === "none" && !dialog.hasAttribute(PLAIN));
            }
            if (!features.count) return;
            var text = shown.length ? "(" + modified + "/" + shown.length + ")" : null;
            if (text === null) {
                if (header.hasAttribute(ATTR)) header.removeAttribute(ATTR);
            } else if (header.getAttribute(ATTR) !== text) {
                header.setAttribute(ATTR, text);
            }
        });
    }

    // The dialog's Expand/Collapse button (its icon is the one way to tell it) and whether WebODM has all groups open
    function toggleButton(dialog) {
        var icon = dialog.querySelector("button > .fa-angle-double-down, button > .fa-angle-double-up");
        return icon ? icon.parentNode : null;
    }

    function allOpen(button) {
        return !!button.querySelector(".fa-angle-double-up");
    }

    // Its title names what a click does next
    function titleButton(dialog) {
        var button = toggleButton(dialog);
        if (!button) return;
        var title = allOpen(button) ? "Collapse All" : dialog.hasAttribute(PLAIN) ? "Collapse All but Configured" : "Expand All";
        if (button.getAttribute("title") !== title) button.setAttribute("title", title);
    }

    // A click on it: from all open, WebODM collapses all and, if any option is configured, they're hidden too; from
    // that, TweakUI alone shows the configured ones again (WebODM never sees the click); from there, WebODM expands all
    function cycle(dialog, e) {
        var button = toggleButton(dialog);
        if (!button || button.disabled || !button.contains(e.target)) return;
        if (allOpen(button)) {
            if (dialog.querySelector(".processing-node-option[" + CONFIGURED + "]")) dialog.setAttribute(PLAIN, "");
        } else if (dialog.hasAttribute(PLAIN)) {
            e.stopPropagation();
            e.preventDefault();
            dialog.removeAttribute(PLAIN);
        }
    }

    // Counts now and after every change in the dialog: typing, checkboxes, lists, "Reset to default" (a click),
    // groups opened or searched (new options on the page), values set by code (React writes the value attribute).
    // Opening and closing a group, or Expand/Collapse, is a click
    function watch(doc, options, win, features) {
        var dialogs = doc.querySelectorAll(".edit-preset-dialog");
        if (!dialogs.length || !options) return null;
        var dialog = dialogs[dialogs.length - 1];
        if (dialog.tweakuiWatch) dialog.tweakuiWatch.stop();
        var pending = false;
        function later() {
            if (pending) return;
            pending = true;
            win.setTimeout(function () {
                pending = false;
                update(dialog, options, features);
                if (features && features.expand) titleButton(dialog);
            }, 0);
        }
        function onCycle(e) { cycle(dialog, e); }
        dialog.removeAttribute(PLAIN);
        if (features && features.expand) dialog.addEventListener("click", onCycle, true);
        var events = ["input", "change", "click"];
        events.forEach(function (e) { dialog.addEventListener(e, later, true); });
        var observer = win.MutationObserver ? new win.MutationObserver(later) : null;
        if (observer) observer.observe(dialog, {childList: true, subtree: true, attributes: true, attributeFilter: ["value"]});
        dialog.tweakuiWatch = {
            stop: function () {
                events.forEach(function (e) { dialog.removeEventListener(e, later, true); });
                dialog.removeEventListener("click", onCycle, true);
                if (observer) observer.disconnect();
            }
        };
        update(dialog, options, features);
        if (features && features.expand) titleButton(dialog);
        return dialog.tweakuiWatch;
    }

    return {watch: watch, update: update, optionName: optionName, isModified: isModified};
});
