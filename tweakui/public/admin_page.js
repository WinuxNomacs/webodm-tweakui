// Administration > TweakUI (templates/admin.html), for superusers: a checkbox per feature users may have
// (access.py). Each change is PATCHed to the plugin's API as it is made; a green "Saved" banner shows for 3 seconds,
// a refused change goes back and a red banner says why. UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "admin_page", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    var SHOWN = 3000;

    function setStatus(page, text, failed) {
        var status = page.querySelector(".tweakui-status");
        if (!status) return;
        clearTimeout(status.tweakuiTimer);
        status.textContent = "";
        status.className = "tweakui-status theme-border";
        if (!text) return;
        var doc = status.ownerDocument, icon = doc.createElement("i"), label = doc.createElement("span");
        icon.className = "fa " + (failed ? "fa-exclamation-circle" : "fa-check-circle");
        icon.setAttribute("aria-hidden", "true");
        label.textContent = text;
        status.appendChild(icon);
        status.appendChild(label);
        status.className += " tweakui-shown " + (failed ? "theme-background-failed" : "theme-background-success");
        if (!failed) status.tweakuiTimer = setTimeout(function () { setStatus(page, "", false); }, SHOWN);
    }

    function save(page, input, fetchFn, doc) {
        var changes = {}, value = input.checked;
        changes[input.getAttribute("data-access")] = value;
        setStatus(page, "", false);
        return fetchFn(page.getAttribute("data-api") + "access", {
            method: "PATCH",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json", "X-CSRFToken": ui.csrfToken(doc)},
            body: JSON.stringify(changes)
        }).then(function (res) {
            return res.json().then(null, function () { return {}; }).then(function (body) {
                if (!res.ok) throw new Error(body.detail || ("Error " + res.status));
                setStatus(page, "Saved", false);
            });
        }).then(null, function (e) {
            input.checked = !value;
            setStatus(page, "Not saved: " + e.message, true);
        });
    }

    function start(doc, win, fetchFn) {
        var page = doc.getElementById("tweakui-admin");
        if (!page) return null;
        fetchFn = fetchFn || (win.fetch && win.fetch.bind(win));
        var saves = [];
        Array.prototype.forEach.call(page.querySelectorAll("input[data-access]"), function (input) {
            input.addEventListener("change", ui.guard("admin_page", function () {
                saves.push(save(page, input, fetchFn, doc));
            }));
        });
        return {saves: saves};
    }

    return {start: start, save: save, setStatus: setStatus};
});
