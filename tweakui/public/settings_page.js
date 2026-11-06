// The TweakUI settings page (templates/settings.html): the navigation pane shows one category at a time (from the
// address's #hash, General by default), and each setting is saved as soon as it is changed: a checkbox as true or
// false, a radio button (Themes) as its value. A new theme reloads the page to show it. UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.document) api.start(root.document, root);
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    function csrfToken(doc) {
        var input = doc.querySelector("input[name=csrfmiddlewaretoken]");
        if (input && input.value) return input.value;
        var m = (doc.cookie || "").match(/(?:^|;\s*)csrftoken=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : "";
    }

    function each(list, fn) { Array.prototype.forEach.call(list, fn); }

    // Shows the category named by the hash, or the first one when it names none
    function showSection(page, hash) {
        var name = (hash || "").replace(/^#/, "");
        if (!page.querySelector("section[data-section='" + name + "']")) {
            name = page.querySelector("section[data-section]").getAttribute("data-section");
        }
        each(page.querySelectorAll("section[data-section]"), function (s) {
            s.hidden = s.getAttribute("data-section") !== name;
        });
        each(page.querySelectorAll(".tweakui-nav a[data-section]"), function (a) {
            var active = a.getAttribute("data-section") === name;
            a.className = a.className.replace(/\s*\b(active|theme-background-highlight)\b(?!-)/g, "");
            if (active) a.className += " active theme-background-highlight";
            if (active) a.setAttribute("aria-selected", "true");
            else a.removeAttribute("aria-selected");
        });
        return name;
    }

    function setStatus(page, text, failed) {
        var status = page.querySelector(".tweakui-status");
        status.textContent = text;
        status.className = "tweakui-status" + (failed ? " text-danger" : " text-muted");
    }

    // PATCHes one setting; a failure puts the control back as it was and says why
    function save(page, input, fetchFn, doc, win, previous) {
        var name = input.getAttribute("data-setting"), radio = input.type === "radio", changes = {};
        var value = radio ? input.value : input.checked;
        changes[name] = value;
        setStatus(page, "", false);
        return fetchFn(page.getAttribute("data-api") + "settings", {
            method: "PATCH",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json", "X-CSRFToken": csrfToken(doc)},
            body: JSON.stringify(changes)
        }).then(function (res) {
            return res.json().then(null, function () { return {}; }).then(function (body) {
                if (!res.ok) throw new Error(body.detail || ("Error " + res.status));
                if (win.TweakUI) win.TweakUI.settings = body;
                setStatus(page, "Saved", false);
                if (name === "theme") win.location.reload();
            });
        }).then(null, function (e) {
            if (!radio) input.checked = !value;
            else if (previous) previous.checked = true;
            setStatus(page, "Not saved: " + e.message, true);
        });
    }

    function start(doc, win) {
        var page = doc.getElementById("tweakui-settings");
        if (!page) return;
        showSection(page, win.location.hash);
        win.addEventListener("hashchange", function () { showSection(page, win.location.hash); });
        // A radio button's group remembers its checked one, to put it back if the change is refused
        var checked = {};
        each(page.querySelectorAll("input[type=radio][data-setting]:checked"), function (input) {
            checked[input.name] = input;
        });
        each(page.querySelectorAll("input[data-setting]"), function (input) {
            input.addEventListener("change", function () {
                var previous = checked[input.name];
                if (input.type === "radio") checked[input.name] = input;
                save(page, input, win.fetch.bind(win), doc, win, previous).then(function () {
                    if (input.type === "radio" && !input.checked && previous) checked[input.name] = previous;
                });
            });
        });
    }

    return {start: start, showSection: showSection, save: save, csrfToken: csrfToken};
});
