const editor = require("../theme_editor");

const FIELDS = ["primary", "secondary", "header_background"];
const THEMES = {
    "webodm": {name: "WebODM's theme", colors: {primary: "#2c3e50", secondary: "#ffffff", header_background: "#3498db"}},
    "nord": {name: "Nord", colors: {primary: "#eceff4", secondary: "#2e3440", header_background: "#242933"}},
    "own:abc": {name: "Mine", colors: {primary: "#111111", secondary: "#222222", header_background: "#333333"}}
};

function page(checked) {
    document.head.innerHTML = '<link rel="stylesheet" href="/plugins/tweakui/theme.css">';
    const theme = id => `<div class="tweakui-theme" data-theme-id="${id}"><label><input type="radio" name="theme" value="${id}"${id === checked ? " checked" : ""}></label>
        ${id.indexOf("own:") === 0 ? '<button type="button" data-theme-action="edit">Edit</button>' : ""}
        <button type="button" data-theme-action="copy">Copy</button>
        <button type="button" data-theme-action="json"><i class="fa fa-code"></i></button></div>`;
    document.body.innerHTML = `
      <div id="tweakui-settings" data-api="/api/plugins/tweakui/">
        <input type="hidden" name="csrfmiddlewaretoken" value="tok">
        <button type="button" data-theme-action="new">New Theme</button>
        <button type="button" data-theme-action="import">Import</button>
        ${Object.keys(THEMES).map(theme).join("")}
        <div class="tweakui-editor" hidden><h5 id="tweakui-editor-title"></h5>
          <form><input type="text" id="tweakui-editor-name">
            ${FIELDS.map(f => `<div class="tweakui-editor-color" data-field="${f}"><input type="color"><input type="text" class="tweakui-editor-hex"></div>`).join("")}
            <p class="tweakui-editor-status"></p>
            <button type="submit">Save</button><button type="button" data-editor="cancel">Cancel</button>
            <button type="button" data-editor="delete" hidden>Delete</button></form></div>
        <div class="tweakui-import" hidden><form><input type="file" id="tweakui-import-file">
          <textarea id="tweakui-import-text"></textarea><div class="tweakui-import-report"></div>
          <button type="submit">Import</button><button type="button" data-import="close">Close</button></form></div>
      </div>
      <script id="tweakui-theme-colors" type="application/json">${JSON.stringify(THEMES)}</script>`;
}

function answer(body, ok, status) {
    return Promise.resolve({ok: ok !== false, status: status || 200, json: () => Promise.resolve(body)});
}

// A window whose fetch answers each request with replies(url, init), and whose timers run when asked
function start(checked, replies) {
    page(checked);
    const timers = [];
    const win = {
        fetch: jest.fn((url, init) => replies(url, init)),
        setTimeout: jest.fn(fn => timers.push(fn)), clearTimeout: jest.fn(),
        location: {reload: jest.fn()}, confirm: jest.fn(() => true),
        TweakUI: {settings: {}, copyText: jest.fn(() => Promise.resolve())}, FileReader
    };
    const state = editor.start(document, win);
    return {state, win, runTimers: () => timers.splice(0).forEach(fn => fn())};
}

const previewing = () => answer({css: "html body{color: red;}"});
const el = selector => document.querySelector(selector);
const hex = field => el(`[data-field=${field}] .tweakui-editor-hex`);
const picker = field => el(`[data-field=${field}] input[type=color]`);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test("Copy opens the editor on a copy of any theme, without Delete, and shows its colours on the page", async () => {
    const {win} = start("webodm", previewing);
    el('[data-theme-id=nord] [data-theme-action=copy]').click();
    expect(el(".tweakui-editor").hidden).toBe(false);
    expect(el("#tweakui-editor-title").textContent).toBe("New Theme");
    expect(el("#tweakui-editor-name").value).toBe("Nord (copy)");
    expect(hex("secondary").value).toBe("#2e3440");
    expect(picker("secondary").value).toBe("#2e3440");
    expect(el("[data-editor=delete]").hidden).toBe(true);
    const [url, init] = win.fetch.mock.calls[0];
    expect(url).toBe("/api/plugins/tweakui/themes/preview");
    expect(init.method).toBe("POST");
    expect(init.headers["X-CSRFToken"]).toBe("tok");
    expect(JSON.parse(init.body).colors).toEqual(THEMES.nord.colors);
    await flush();
    expect(el("#tweakui-theme-preview").textContent).toBe("html body{color: red;}");
    expect(el("link").disabled).toBe(true);
});

test("New Theme starts from the current theme's colours with no name", () => {
    start("own:abc", previewing);
    el("[data-theme-action=new]").click();
    expect(el("#tweakui-editor-name").value).toBe("");
    expect(hex("primary").value).toBe("#111111");
    expect(document.activeElement).toBe(el("#tweakui-editor-name"));
});

test("only your own themes open for editing, with their name and Delete", () => {
    const {state} = start("webodm", previewing);
    expect(editor.open(state, "edit", "nord")).toBe(false);
    expect(el(".tweakui-editor").hidden).toBe(true);
    el('[data-theme-id="own:abc"] [data-theme-action=edit]').click();
    expect(el("#tweakui-editor-title").textContent).toBe("Edit Theme");
    expect(el("#tweakui-editor-name").value).toBe("Mine");
    expect(el("[data-editor=delete]").hidden).toBe(false);
    expect(state.editing).toBe("abc");
});

test("a picked colour shows as its value, a typed value moves the picker, and each change is previewed", () => {
    const {state, win, runTimers} = start("webodm", previewing);
    editor.open(state, "copy", "nord");
    win.fetch.mockClear();
    picker("primary").value = "#abcdef";
    picker("primary").dispatchEvent(new Event("input", {bubbles: true}));
    expect(hex("primary").value).toBe("#abcdef");
    hex("secondary").value = "FF0000";
    hex("secondary").dispatchEvent(new Event("input", {bubbles: true}));
    expect(picker("secondary").value).toBe("#ff0000");
    expect(win.fetch).not.toHaveBeenCalled();
    runTimers();
    expect(JSON.parse(win.fetch.mock.calls[0][1].body).colors).toEqual(
        {primary: "#abcdef", secondary: "#ff0000", header_background: "#242933"});
});

test("a value that isn't #rrggbb is marked and neither previewed nor saved", async () => {
    const {state, win, runTimers} = start("webodm", previewing);
    editor.open(state, "copy", "nord");
    win.fetch.mockClear();
    hex("primary").value = "#12";
    hex("primary").dispatchEvent(new Event("input", {bubbles: true}));
    expect(el("[data-field=primary]").classList.contains("has-error")).toBe(true);
    expect(editor.colors(state)).toBeNull();
    runTimers();
    await editor.save(state);
    expect(win.fetch).not.toHaveBeenCalled();
    expect(el(".tweakui-editor-status").textContent).toBe("Not saved: every colour is #rrggbb");
});

test("Cancel closes the editor and gives the page back its theme, even with a preview still on its way", async () => {
    let reply;
    const {state} = start("webodm", () => new Promise(resolve => { reply = resolve; }));
    editor.open(state, "copy", "nord");
    el("[data-editor=cancel]").click();
    reply({ok: true, json: () => Promise.resolve({css: "late"})});
    await flush();
    expect(el(".tweakui-editor").hidden).toBe(true);
    expect(el("#tweakui-theme-preview")).toBeNull();
    expect(el("link").disabled).toBe(false);
});

test("Save keeps a new theme, makes it the user's theme and reloads the page in it", async () => {
    const {state, win} = start("webodm", (url) => url.endsWith("preview") ? previewing()
        : url.endsWith("themes") ? answer({id: "new1"}, true, 201) : answer({theme: "own:new1"}));
    editor.open(state, "copy", "nord");
    el("#tweakui-editor-name").value = "  Night  ";
    await editor.save(state);
    const calls = win.fetch.mock.calls.filter(c => !c[0].endsWith("preview"));
    expect(calls[0][0]).toBe("/api/plugins/tweakui/themes");
    expect(calls[0][1].method).toBe("POST");
    expect(JSON.parse(calls[0][1].body)).toEqual({name: "Night", colors: THEMES.nord.colors});
    expect(calls[1][0]).toBe("/api/plugins/tweakui/settings");
    expect(JSON.parse(calls[1][1].body)).toEqual({theme: "own:new1"});
    expect(win.TweakUI.settings).toEqual({theme: "own:new1"});
    expect(win.location.reload).toHaveBeenCalled();
});

test("Save of an edited theme puts it by its id", async () => {
    const {state, win} = start("webodm", (url) => url.endsWith("preview") ? previewing()
        : url.endsWith("abc") ? answer({id: "abc"}) : answer({theme: "own:abc"}));
    editor.open(state, "edit", "own:abc");
    await editor.save(state);
    const put = win.fetch.mock.calls.find(c => c[0].endsWith("/themes/abc"));
    expect(put[1].method).toBe("PUT");
    expect(win.location.reload).toHaveBeenCalled();
});

test("a theme without a name or one the server refuses is not saved, and the editor says why", async () => {
    const {state, win} = start("webodm", (url) => url.endsWith("preview") ? previewing()
        : answer({detail: "At most 50 themes"}, false, 400));
    editor.open(state, "new");
    await editor.save(state);
    expect(el(".tweakui-editor-status").textContent).toBe("Not saved: a theme needs a name");
    el("#tweakui-editor-name").value = "One more";
    await editor.save(state);
    expect(el(".tweakui-editor-status").textContent).toBe("Not saved: At most 50 themes");
    expect(el(".tweakui-editor-status").classList.contains("text-danger")).toBe(true);
    expect(win.location.reload).not.toHaveBeenCalled();
});

test("Delete asks first, then deletes the theme and reloads; declining deletes nothing", async () => {
    const {state, win} = start("own:abc", (url) => url.endsWith("preview") ? previewing() : answer({}, true, 204));
    editor.open(state, "edit", "own:abc");
    win.confirm.mockReturnValueOnce(false);
    await editor.remove(state);
    expect(win.fetch.mock.calls.some(c => c[1].method === "DELETE")).toBe(false);
    await editor.remove(state);
    expect(win.confirm).toHaveBeenLastCalledWith("Delete the theme “Mine”?");
    const del = win.fetch.mock.calls.find(c => c[1].method === "DELETE");
    expect(del[0]).toBe("/api/plugins/tweakui/themes/abc");
    expect(win.location.reload).toHaveBeenCalled();
});

test("Copy JSON puts any theme on the clipboard as {name, colors} and the button shows it worked", async () => {
    const {win, runTimers} = start("webodm", previewing);
    el("[data-theme-id=nord] [data-theme-action=json]").click();
    expect(JSON.parse(win.TweakUI.copyText.mock.calls[0][0])).toEqual(THEMES.nord);
    await flush();
    expect(el("[data-theme-id=nord] [data-theme-action=json] i").className).toBe("fa fa-check");
    runTimers();
    expect(el("[data-theme-id=nord] [data-theme-action=json] i").className).toBe("fa fa-code");
    win.TweakUI.copyText.mockReturnValueOnce(Promise.reject(new Error("denied")));
    el('[data-theme-id="own:abc"] [data-theme-action=json]').click();
    await flush();
    expect(el('[data-theme-id="own:abc"] [data-theme-action=json] i').className).toBe("fa fa-times");
    expect(el(".tweakui-editor").hidden).toBe(true);
});

const report = () => el(".tweakui-import-report").textContent;
const imported = result => (url) => url.endsWith("import") ? answer(result) : previewing();

test("Import opens its panel; a chosen file's text goes into the JSON box", async () => {
    const {state} = start("webodm", previewing);
    el("[data-theme-action=import]").click();
    expect(el(".tweakui-import").hidden).toBe(false);
    expect(el(".tweakui-editor").hidden).toBe(true);
    await editor.readFile(state, new File(['{"name": "From a file"}'], "t.json", {type: "application/json"}));
    expect(el("#tweakui-import-text").value).toBe('{"name": "From a file"}');
    await editor.readFile(state, {size: 2 * 1024 * 1024, name: "big.json"});
    expect(report()).toBe("Not read: the file is larger than 1 MB");
});

test("Import sends the parsed JSON and reports what was added, replaced and refused; Close then reloads", async () => {
    const {state, win} = start("webodm", imported({added: ["Night"], replaced: ["Mine"],
        refused: [{index: 3, name: "Bad", reason: "Colours that are not #rrggbb: primary"}, {index: 4, name: "", reason: "Expected a theme object"}]}));
    editor.openImport(state);
    el("#tweakui-import-text").value = '[{"name": "Night"}]';
    await editor.importThemes(state);
    const [url, init] = win.fetch.mock.calls.find(c => c[0].endsWith("import"));
    expect(url).toBe("/api/plugins/tweakui/themes/import");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual([{name: "Night"}]);
    const lines = Array.from(document.querySelectorAll(".tweakui-import-report p, .tweakui-import-report li")).map(e => e.textContent);
    expect(lines).toEqual(["Added 1: Night", "Replaced 1: Mine", "Refused 2:", "#3 “Bad”: Colours that are not #rrggbb: primary",
        "#4: Expected a theme object", "Close reloads the page to show them."]);
    el("[data-import=close]").click();
    expect(win.location.reload).toHaveBeenCalled();
});

test("text that isn't JSON or an import the server refuses is reported, and Close only closes", async () => {
    const {state, win} = start("webodm", (url) => url.endsWith("import")
        ? answer({detail: "Expected a theme object or a list of them"}, false, 400) : previewing());
    editor.openImport(state);
    await editor.importThemes(state);
    expect(report()).toBe("Not imported: choose a file or paste JSON");
    el("#tweakui-import-text").value = "{name: oops";
    await editor.importThemes(state);
    expect(report()).toMatch(/^Not imported: this isn't JSON \(/);
    expect(win.fetch.mock.calls.some(c => c[0].endsWith("import"))).toBe(false);
    el("#tweakui-import-text").value = "[]";
    await editor.importThemes(state);
    expect(report()).toBe("Not imported: Expected a theme object or a list of them");
    expect(el(".tweakui-import-report p").className).toBe("text-danger");
    el("[data-import=close]").click();
    expect(win.location.reload).not.toHaveBeenCalled();
    expect(el(".tweakui-import").hidden).toBe(true);
    expect(report()).toBe("");
});

test("an import with everything refused changes nothing, so Close doesn't reload", async () => {
    const {state, win} = start("webodm", imported({added: [], replaced: [], refused: [{index: 1, name: "X", reason: "At most 50 themes"}]}));
    editor.openImport(state);
    el("#tweakui-import-text").value = '{"name": "X"}';
    await editor.importThemes(state);
    expect(report()).toBe("Refused 1:#1 “X”: At most 50 themes");
    editor.closeImport(state);
    expect(win.location.reload).not.toHaveBeenCalled();
});

describe("Administration > TweakUI Themes", () => {
    const PUBLISHED = {"published:p1": {name: "Shared", colors: THEMES.nord.colors}};

    function adminPage(own) {
        document.head.innerHTML = "";
        document.body.innerHTML = `
          <div id="tweakui-published" data-api="/api/plugins/tweakui/">
            <input type="hidden" name="csrfmiddlewaretoken" value="tok">
            <button type="button" data-theme-action="import">Import</button>
            <div class="tweakui-theme" data-theme-id="published:p1">
              <button type="button" data-theme-action="json"><i class="fa fa-code"></i></button>
              <button type="button" data-theme-action="delete">Delete</button></div>
            <p class="tweakui-published-status"></p>
            <form class="tweakui-publish">${own ? '<select id="tweakui-publish-theme"><option value="abc">Mine</option></select>' : ""}
              <button type="submit">Publish</button></form>
            <div class="tweakui-import" data-import-path="published/import" hidden><form><input type="file" id="tweakui-import-file">
              <textarea id="tweakui-import-text"></textarea><div class="tweakui-import-report"></div>
              <button type="submit">Import</button><button type="button" data-import="close">Close</button></form></div>
          </div>
          <script id="tweakui-theme-colors" type="application/json">${JSON.stringify(PUBLISHED)}</script>`;
    }

    function startAdmin(replies, own = true) {
        adminPage(own);
        const win = {
            fetch: jest.fn((url, init) => replies(url, init)), setTimeout: jest.fn(), clearTimeout: jest.fn(),
            location: {reload: jest.fn()}, confirm: jest.fn(() => true),
            TweakUI: {settings: {}, copyText: jest.fn(() => Promise.resolve())}, FileReader
        };
        return {state: editor.start(document, win), win};
    }

    test("the page starts without the editor, and Copy JSON copies a published theme", async () => {
        const {state, win} = startAdmin(() => answer({}));
        expect(state.editor).toBeNull();
        el("[data-theme-action=json]").click();
        await flush();
        expect(JSON.parse(win.TweakUI.copyText.mock.calls[0][0])).toEqual({name: "Shared", colors: THEMES.nord.colors});
    });

    test("Import goes into the published themes", async () => {
        const {state, win} = startAdmin(() => answer({added: ["Night"], replaced: [], refused: []}));
        el("[data-theme-action=import]").click();
        expect(el(".tweakui-import").hidden).toBe(false);
        el("#tweakui-import-text").value = '{"name": "Night"}';
        await editor.importThemes(state);
        expect(win.fetch.mock.calls[0][0]).toBe("/api/plugins/tweakui/published/import");
        expect(report()).toBe("Added 1: NightClose reloads the page to show them.");
    });

    test("Delete asks first, then deletes the published theme by its id and reloads; a failure is shown", async () => {
        let ok = true;
        const {win} = startAdmin(() => ok ? answer({}, true, 204) : answer({detail: "Not found."}, false, 404));
        win.confirm.mockReturnValueOnce(false);
        el("[data-theme-action=delete]").click();
        expect(win.fetch).not.toHaveBeenCalled();
        el("[data-theme-action=delete]").click();
        expect(win.confirm.mock.calls[1][0]).toBe("Delete the published theme “Shared”? Users who chose it get WebODM's theme.");
        const [url, init] = win.fetch.mock.calls[0];
        expect([url, init.method, init.headers["X-CSRFToken"]]).toEqual(["/api/plugins/tweakui/published/p1", "DELETE", "tok"]);
        await flush();
        expect(win.location.reload).toHaveBeenCalledTimes(1);
        ok = false;
        el("[data-theme-action=delete]").click();
        await flush();
        await flush();
        expect(el(".tweakui-published-status").textContent).toBe("Not deleted: Not found.");
        expect(el(".tweakui-published-status").className).toBe("tweakui-published-status text-danger");
    });

    test("Publish sends the chosen own theme's id and reloads; a refusal is shown", async () => {
        let ok = true;
        const {win} = startAdmin(() => ok ? answer({theme: {}, replaced: false}, true, 201)
            : answer({detail: "At most 50 themes"}, false, 400));
        el(".tweakui-publish button").click();
        const [url, init] = win.fetch.mock.calls[0];
        expect([url, init.method, JSON.parse(init.body)]).toEqual(["/api/plugins/tweakui/published", "POST", {id: "abc"}]);
        await flush();
        expect(win.location.reload).toHaveBeenCalledTimes(1);
        ok = false;
        el(".tweakui-publish button").click();
        await flush();
        await flush();
        expect(el(".tweakui-published-status").textContent).toBe("Not published: At most 50 themes");
        expect(win.location.reload).toHaveBeenCalledTimes(1);
    });

    test("without themes of your own, Publish has nothing to send", () => {
        const {win} = startAdmin(() => answer({}), false);
        el(".tweakui-publish button").click();
        expect(win.fetch).not.toHaveBeenCalled();
    });
});
