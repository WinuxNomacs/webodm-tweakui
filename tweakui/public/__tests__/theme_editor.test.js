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
        <button type="button" data-theme-action="copy">Copy</button></div>`;
    document.body.innerHTML = `
      <div id="tweakui-settings" data-api="/api/plugins/tweakui/">
        <input type="hidden" name="csrfmiddlewaretoken" value="tok">
        <button type="button" data-theme-action="new">New theme</button>
        ${Object.keys(THEMES).map(theme).join("")}
        <div class="tweakui-editor" hidden><h5 id="tweakui-editor-title"></h5>
          <form><input type="text" id="tweakui-editor-name">
            ${FIELDS.map(f => `<div class="tweakui-editor-color" data-field="${f}"><input type="color"><input type="text" class="tweakui-editor-hex"></div>`).join("")}
            <p class="tweakui-editor-status"></p>
            <button type="submit">Save</button><button type="button" data-editor="cancel">Cancel</button>
            <button type="button" data-editor="delete" hidden>Delete</button></form></div>
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
        location: {reload: jest.fn()}, confirm: jest.fn(() => true), TweakUI: {settings: {}}
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
    expect(el("#tweakui-editor-title").textContent).toBe("New theme");
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

test("New theme starts from the current theme's colours with no name", () => {
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
    expect(el("#tweakui-editor-title").textContent).toBe("Edit theme");
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
