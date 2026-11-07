// General > Task Options > Show Modified Options: in the Task Options dialog (EditPresetDialog in WebODM), each
// group heading's "(13)" becomes "(modified/total)", kept up to date as options change. An option is modified when it
// is not at ODM's default, which is when its component's getValue() is undefined, as "Reset to default" leaves it.
// The count goes in the heading's data-tweakui-count attribute, which main.css shows in place of WebODM's number:
// React re-renders its own text but leaves the attribute alone.
// General > Task Options > Expand Configured: a collapsed group still shows its modified options ("configured"),
// WebODM's own controls, under its heading. WebODM keeps a collapsed group's options on the page, hidden by an inline
// display: none; data-tweakui-expand on the group, data-tweakui-configured on its configured options and subgroups,
// and main.css show only those. "Other Options" is not on the page while closed, so it shows nothing. UMD, so Jest
// can load it.
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
                flag(group, EXPAND, modified > 0 && !!content && content.style.display === "none");
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
            }, 0);
        }
        var events = ["input", "change", "click"];
        events.forEach(function (e) { dialog.addEventListener(e, later, true); });
        var observer = win.MutationObserver ? new win.MutationObserver(later) : null;
        if (observer) observer.observe(dialog, {childList: true, subtree: true, attributes: true, attributeFilter: ["value"]});
        dialog.tweakuiWatch = {
            stop: function () {
                events.forEach(function (e) { dialog.removeEventListener(e, later, true); });
                if (observer) observer.disconnect();
            }
        };
        update(dialog, options, features);
        return dialog.tweakuiWatch;
    }

    return {watch: watch, update: update, optionName: optionName, isModified: isModified};
});
