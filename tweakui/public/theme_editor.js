// Settings > Themes: the theme editor (templates/settings.html). New theme (from the current theme), Copy (any
// theme) or Edit (your own themes only) opens it under the themes, with a name and WebODM's 13 theme colours, each a
// colour picker and its #rrggbb value. While it is open the page shows the unsaved colours: the server renders their
// stylesheet (themes/preview), which takes the place of theme.css until Cancel. Save keeps the theme and makes it
// your theme; Delete (your own) deletes it. The themes' colours come from the page (#tweakui-theme-colors).
// UMD, so Jest can load it.
(function (root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else if (root.document) api.start(root.document, root);
})(typeof window !== "undefined" ? window : this, function () {
    "use strict";

    var OWN = "own:", HEX = /^#[0-9a-f]{6}$/, PREVIEW_DELAY = 250;

    function csrfToken(doc) {
        var input = doc.querySelector("input[name=csrfmiddlewaretoken]");
        if (input && input.value) return input.value;
        var m = (doc.cookie || "").match(/(?:^|;\s*)csrftoken=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : "";
    }

    function each(list, fn) { Array.prototype.forEach.call(list, fn); }

    // A JSON request to the plugin's API; an answer that isn't 2xx throws its detail
    function request(state, method, path, body) {
        return state.fetch(state.page.getAttribute("data-api") + path, {
            method: method,
            credentials: "same-origin",
            headers: {"Content-Type": "application/json", "X-CSRFToken": csrfToken(state.doc)},
            body: body === undefined ? undefined : JSON.stringify(body)
        }).then(function (res) {
            return res.json().then(null, function () { return {}; }).then(function (data) {
                if (!res.ok) throw new Error(data.detail || ("Error " + res.status));
                return data;
            });
        });
    }

    function setStatus(state, text) {
        state.editor.querySelector(".tweakui-editor-status").textContent = text;
        state.editor.querySelector(".tweakui-editor-status").className = "tweakui-editor-status" +
            (text ? " text-danger" : "");
    }

    function rows(state) { return state.editor.querySelectorAll(".tweakui-editor-color"); }

    function setColor(row, value) {
        row.querySelector("input[type=color]").value = value;
        row.querySelector(".tweakui-editor-hex").value = value;
        row.className = row.className.replace(/\s*\bhas-error\b/, "");
    }

    // A typed colour as #rrggbb, the # optional
    function normal(value) {
        value = value.trim().toLowerCase();
        return value && value.charAt(0) !== "#" ? "#" + value : value;
    }

    // The editor's colours by field, or null while a value isn't #rrggbb
    function colors(state) {
        var out = {}, ok = true;
        each(rows(state), function (row) {
            var value = normal(row.querySelector(".tweakui-editor-hex").value);
            if (!HEX.test(value)) ok = false;
            out[row.getAttribute("data-field")] = value;
        });
        return ok ? out : null;
    }

    function themeLinks(doc) { return doc.querySelectorAll("link[href*='tweakui/theme.css']"); }

    // The preview's stylesheet in place of theme.css
    function applyCss(state, css) {
        var style = state.doc.getElementById("tweakui-theme-preview");
        if (!style) {
            style = state.doc.createElement("style");
            style.id = "tweakui-theme-preview";
            state.doc.head.appendChild(style);
        }
        style.textContent = css;
        each(themeLinks(state.doc), function (link) { link.disabled = true; });
    }

    function clearPreview(state) {
        if (state.timer) state.win.clearTimeout(state.timer);
        state.timer = null;
        state.seq++; // an answer still on its way is dropped
        var style = state.doc.getElementById("tweakui-theme-preview");
        if (style) style.parentNode.removeChild(style);
        each(themeLinks(state.doc), function (link) { link.disabled = false; });
    }

    // Shows the editor's colours on the page; only the latest answer is applied
    function preview(state) {
        var values = colors(state), seq = ++state.seq;
        if (!values) return Promise.resolve();
        return request(state, "POST", "themes/preview", {name: "Preview", colors: values}).then(function (data) {
            if (seq === state.seq && !state.editor.hidden) applyCss(state, data.css);
        }, function (e) {
            if (seq === state.seq) setStatus(state, "No preview: " + e.message);
        });
    }

    function schedulePreview(state) {
        if (state.timer) state.win.clearTimeout(state.timer);
        state.timer = state.win.setTimeout(function () { state.timer = null; preview(state); }, PREVIEW_DELAY);
    }

    function currentTheme(state) {
        var checked = state.page.querySelector("input[name=theme]:checked");
        return checked && state.themes[checked.value] ? checked.value : "webodm";
    }

    // Opens the editor: "new" from the current theme's colours, "copy" from theme id's, "edit" on one of your own
    function open(state, action, id) {
        var source = action === "new" ? currentTheme(state) : id, theme = state.themes[source];
        if (!theme || (action === "edit" && source.indexOf(OWN) !== 0)) return false;
        state.editing = action === "edit" ? source.slice(OWN.length) : null;
        state.editor.querySelector("#tweakui-editor-title").textContent = action === "edit" ? "Edit theme" : "New theme";
        state.editor.querySelector("#tweakui-editor-name").value = action === "edit" ? theme.name
            : action === "copy" ? theme.name + " (copy)" : "";
        state.editor.querySelector("[data-editor=delete]").hidden = action !== "edit";
        each(rows(state), function (row) { setColor(row, theme.colors[row.getAttribute("data-field")]); });
        setStatus(state, "");
        state.editor.hidden = false;
        if (state.editor.scrollIntoView) state.editor.scrollIntoView({block: "nearest"});
        state.editor.querySelector("#tweakui-editor-name").focus();
        preview(state);
        return true;
    }

    function close(state) {
        clearPreview(state);
        state.editor.hidden = true;
        state.editing = null;
    }

    // A picker's change shows in its value and the other way round; a value that isn't #rrggbb is marked
    function onInput(state, input) {
        var row = input.closest ? input.closest(".tweakui-editor-color") : null;
        if (!row) return;
        if (input.type === "color") setColor(row, input.value);
        else {
            var value = normal(input.value);
            if (HEX.test(value)) {
                row.querySelector("input[type=color]").value = value;
                row.className = row.className.replace(/\s*\bhas-error\b/, "");
            } else if (!/\bhas-error\b/.test(row.className)) row.className += " has-error";
        }
        setStatus(state, "");
        schedulePreview(state);
    }

    // Saves the theme (new or edited), makes it the user's theme and reloads the page in it
    function save(state) {
        var name = state.editor.querySelector("#tweakui-editor-name").value.trim(), values = colors(state);
        if (!name) { setStatus(state, "Not saved: a theme needs a name"); return Promise.resolve(); }
        if (!values) { setStatus(state, "Not saved: every colour is #rrggbb"); return Promise.resolve(); }
        var body = {name: name, colors: values};
        var saving = state.editing ? request(state, "PUT", "themes/" + state.editing, body)
            : request(state, "POST", "themes", body);
        return saving.then(function (theme) {
            return request(state, "PATCH", "settings", {theme: OWN + theme.id});
        }).then(function (settings) {
            if (state.win.TweakUI) state.win.TweakUI.settings = settings;
            state.win.location.reload();
        }, function (e) {
            setStatus(state, "Not saved: " + e.message);
        });
    }

    // Deletes the theme being edited, after asking, and reloads
    function remove(state) {
        var id = state.editing, theme = id && state.themes[OWN + id];
        if (!theme || !state.win.confirm("Delete the theme “" + theme.name + "”?")) return Promise.resolve();
        return request(state, "DELETE", "themes/" + id).then(function () {
            state.win.location.reload();
        }, function (e) {
            setStatus(state, "Not deleted: " + e.message);
        });
    }

    function start(doc, win) {
        var page = doc.getElementById("tweakui-settings"), data = doc.getElementById("tweakui-theme-colors");
        var editor = page && page.querySelector(".tweakui-editor");
        if (!editor || !data) return null;
        var state = {page: page, editor: editor, doc: doc, win: win, fetch: win.fetch.bind(win),
            themes: JSON.parse(data.textContent), editing: null, seq: 0, timer: null};
        page.addEventListener("click", function (e) {
            var button = e.target.closest ? e.target.closest("[data-theme-action]") : null;
            if (!button) return;
            var theme = button.closest("[data-theme-id]");
            open(state, button.getAttribute("data-theme-action"), theme ? theme.getAttribute("data-theme-id") : null);
        });
        editor.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); save(state); });
        editor.querySelector("[data-editor=cancel]").addEventListener("click", function () { close(state); });
        editor.querySelector("[data-editor=delete]").addEventListener("click", function () { remove(state); });
        editor.addEventListener("input", function (e) { if (e.target.closest(".tweakui-editor-color")) onInput(state, e.target); });
        return state;
    }

    return {start: start, open: open, close: close, save: save, remove: remove, preview: preview, colors: colors,
        onInput: onInput};
});
