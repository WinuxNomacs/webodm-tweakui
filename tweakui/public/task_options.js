// General > Task Options > Show Modified Options: in the Task Options dialog (EditPresetDialog in WebODM), each
// group heading's "(13)" becomes "(modified/total)", kept up to date as options change. An option is modified when it
// is not at ODM's default, which is when its component's getValue() is undefined, as "Reset to default" leaves it.
// The count goes in the heading's data-tweakui-count attribute, which main.css shows in place of WebODM's number:
// React re-renders its own text but leaves the attribute alone. UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.PluginsAPI && root.PluginsAPI.Dashboard && root.PluginsAPI.Dashboard.presetDialogOptionsReady) {
        root.PluginsAPI.Dashboard.presetDialogOptionsReady(function (args) {
            var settings = (root.TweakUI && root.TweakUI.settings) || {};
            if (settings.show_modified_options) api.watch(root.document, args.options, root);
        });
    }
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    var ATTR = "data-tweakui-count";

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

    // Writes "(modified/total)" on every group heading of the dialog whose options are on the page; a group whose
    // options are not ("Other Options" while closed) keeps WebODM's own number
    function update(dialog, options) {
        Array.prototype.forEach.call(dialog.querySelectorAll(".option-group"), function (group) {
            var header = group.querySelector(".option-group-header");
            if (!header) return;
            var shown = group.querySelectorAll(".processing-node-option"), modified = 0;
            Array.prototype.forEach.call(shown, function (el) {
                if (isModified(options[optionName(el)])) modified++;
            });
            var text = shown.length ? "(" + modified + "/" + shown.length + ")" : null;
            if (text === null) {
                if (header.hasAttribute(ATTR)) header.removeAttribute(ATTR);
            } else if (header.getAttribute(ATTR) !== text) {
                header.setAttribute(ATTR, text);
            }
        });
    }

    // Counts now and after every change in the dialog: typing, checkboxes, lists, "Reset to default" (a click),
    // groups opened or searched (new options on the page), values set by code (React writes the value attribute)
    function watch(doc, options, win) {
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
                update(dialog, options);
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
        update(dialog, options);
        return dialog.tweakuiWatch;
    }

    return {watch: watch, update: update, optionName: optionName, isModified: isModified};
});
