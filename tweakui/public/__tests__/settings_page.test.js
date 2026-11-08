const settingsPage = require("../settings_page");

function page(checked) {
    document.body.innerHTML = `
      <div id="tweakui-settings" data-api="/api/plugins/tweakui/">
        <input type="hidden" name="csrfmiddlewaretoken" value="tok">
        <ul class="tweakui-nav"><li><a href="#general" data-section="general" class="theme-background-highlight-hover">General</a></li>
          <li><a href="#themes" data-section="themes">Themes</a></li></ul>
        <section data-section="general"><input type="checkbox" data-setting="show_configured_option_count"${checked ? " checked" : ""}></section>
        <section data-section="themes"></section>
        <p class="tweakui-status"></p>
      </div>`;
    return document.getElementById("tweakui-settings");
}

const visible = root => Array.from(root.querySelectorAll("section")).filter(s => !s.hidden).map(s => s.getAttribute("data-section"));

test("the page opens on the first category, General, when the address names none or an unknown one", () => {
    const root = page();
    expect(settingsPage.showSection(root, "")).toBe("general");
    expect(visible(root)).toEqual(["general"]);
    expect(settingsPage.showSection(root, "#nothing")).toBe("general");
});

test("the hash picks the category, marks its link and keeps the links' hover class", () => {
    const root = page();
    settingsPage.showSection(root, "#themes");
    expect(visible(root)).toEqual(["themes"]);
    const [general, themes] = root.querySelectorAll(".tweakui-nav a");
    expect(themes.classList.contains("active")).toBe(true);
    expect(themes.getAttribute("aria-selected")).toBe("true");
    expect(general.classList.contains("active")).toBe(false);
    expect(general.classList.contains("theme-background-highlight-hover")).toBe(true);
});

test("changing a setting sends a PATCH of it with the page's CSRF token and says it is saved", async () => {
    const root = page(false);
    const input = root.querySelector("input[data-setting]");
    input.checked = true;
    const fetchFn = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({show_configured_option_count: true})}));
    const win = {TweakUI: {settings: {}}};
    await settingsPage.save(root, input, fetchFn, document, win);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/plugins/tweakui/settings");
    expect(init.method).toBe("PATCH");
    expect(init.headers["X-CSRFToken"]).toBe("tok");
    expect(JSON.parse(init.body)).toEqual({show_configured_option_count: true});
    expect(win.TweakUI.settings).toEqual({show_configured_option_count: true});
    expect(root.querySelector(".tweakui-status").textContent).toBe("Saved");
});

test("a refused change puts the checkbox back and says why", async () => {
    const root = page(false);
    const input = root.querySelector("input[data-setting]");
    input.checked = true;
    const fetchFn = () => Promise.resolve({ok: false, status: 400, json: () => Promise.resolve({detail: "Unknown setting"})});
    await settingsPage.save(root, input, fetchFn, document, {});
    expect(input.checked).toBe(false);
    expect(root.querySelector(".tweakui-status").textContent).toBe("Not saved: Unknown setting");
    expect(root.querySelector(".tweakui-status").classList.contains("theme-background-failed")).toBe(true);
});

test("a network failure also puts the checkbox back", async () => {
    const root = page(true);
    const input = root.querySelector("input[data-setting]");
    input.checked = false;
    await settingsPage.save(root, input, () => Promise.reject(new Error("offline")), document, {});
    expect(input.checked).toBe(true);
    expect(root.querySelector(".tweakui-status").textContent).toBe("Not saved: offline");
});

const banner = root => root.querySelector(".tweakui-status");
const shown = root => banner(root).classList.contains("tweakui-shown");

describe("the banner", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("a save shows a green check and Saved for 3 seconds, and a second save starts the 3 seconds again", async () => {
        const root = page(false);
        const input = root.querySelector("input[data-setting]");
        const ok = () => Promise.resolve({ok: true, json: () => Promise.resolve({})});
        input.checked = true;
        await settingsPage.save(root, input, ok, document, {});
        expect(shown(root)).toBe(true);
        expect(banner(root).classList.contains("theme-background-success")).toBe(true);
        expect(banner(root).querySelector(".fa-check-circle")).not.toBeNull();
        expect(banner(root).textContent).toBe("Saved");
        jest.advanceTimersByTime(2000);
        input.checked = false;
        await settingsPage.save(root, input, ok, document, {});
        jest.advanceTimersByTime(2000);
        expect(shown(root)).toBe(true);
        jest.advanceTimersByTime(1000);
        expect(shown(root)).toBe(false);
    });

    test("a refused change shows a red banner saying why, until the next change", async () => {
        const root = page(false);
        const input = root.querySelector("input[data-setting]");
        input.checked = true;
        const refused = () => Promise.resolve({ok: false, status: 400, json: () => Promise.resolve({detail: "Unknown setting"})});
        await settingsPage.save(root, input, refused, document, {});
        jest.advanceTimersByTime(10000);
        expect(shown(root)).toBe(true);
        expect(banner(root).querySelector(".fa-exclamation-circle")).not.toBeNull();
        input.checked = true;
        settingsPage.save(root, input, () => new Promise(() => {}), document, {});
        expect(shown(root)).toBe(false);
    });

    test("a save that reloads the page shows Saved once the page has reloaded, and only then", async () => {
        const {root, webodm, nord} = themesPage();
        const store = {};
        const sessionStorage = {getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; }};
        nord.checked = true;
        const win = {location: {reload: jest.fn(), hash: ""}, sessionStorage, addEventListener() {}, fetch() {}};
        await settingsPage.save(root, nord, () => Promise.resolve({ok: true, json: () => Promise.resolve({theme: "nord"})}), document, win, webodm);
        themesPage();
        settingsPage.start(document, win);
        const reloaded = document.getElementById("tweakui-settings");
        expect(shown(reloaded)).toBe(true);
        expect(banner(reloaded).textContent).toBe("Saved");
        themesPage();
        settingsPage.start(document, win);
        expect(shown(document.getElementById("tweakui-settings"))).toBe(false);
    });

    test("a browser without session storage still saves and reloads", async () => {
        const {root, webodm, nord} = themesPage();
        nord.checked = true;
        const win = {location: {reload: jest.fn()}};
        Object.defineProperty(win, "sessionStorage", {get() { throw new Error("blocked"); }});
        await settingsPage.save(root, nord, () => Promise.resolve({ok: true, json: () => Promise.resolve({})}), document, win, webodm);
        expect(win.location.reload).toHaveBeenCalled();
    });
});

function themesPage() {
    document.body.innerHTML = `
      <div id="tweakui-settings" data-api="/api/plugins/tweakui/">
        <input type="hidden" name="csrfmiddlewaretoken" value="tok">
        <section data-section="themes">
          <input type="radio" name="theme" value="webodm" data-setting="theme" checked>
          <input type="radio" name="theme" value="nord" data-setting="theme">
        </section>
        <p class="tweakui-status"></p>
      </div>`;
    const root = document.getElementById("tweakui-settings");
    const [webodm, nord] = root.querySelectorAll("input[type=radio]");
    return {root, webodm, nord};
}

test("choosing a theme sends its value and reloads the page to show it", async () => {
    const {root, webodm, nord} = themesPage();
    nord.checked = true;
    const fetchFn = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({theme: "nord"})}));
    const win = {location: {reload: jest.fn()}};
    await settingsPage.save(root, nord, fetchFn, document, win, webodm);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({theme: "nord"});
    expect(win.location.reload).toHaveBeenCalled();
});

test("a refused theme puts the previous one back and does not reload", async () => {
    const {root, webodm, nord} = themesPage();
    nord.checked = true;
    const win = {location: {reload: jest.fn()}};
    const fetchFn = () => Promise.resolve({ok: false, status: 400, json: () => Promise.resolve({detail: "Unknown theme: nord"})});
    await settingsPage.save(root, nord, fetchFn, document, win, webodm);
    expect(webodm.checked).toBe(true);
    expect(nord.checked).toBe(false);
    expect(win.location.reload).not.toHaveBeenCalled();
    expect(root.querySelector(".tweakui-status").textContent).toBe("Not saved: Unknown theme: nord");
});

test("a changed checkbox does not reload the page", async () => {
    const root = page(false);
    const input = root.querySelector("input[data-setting]");
    input.checked = true;
    const win = {location: {reload: jest.fn()}};
    const fetchFn = () => Promise.resolve({ok: true, json: () => Promise.resolve({})});
    await settingsPage.save(root, input, fetchFn, document, win);
    expect(win.location.reload).not.toHaveBeenCalled();
});

test("a saved change is announced to the page's scripts with all the settings, and a refused one is not", async () => {
    const root = page(false);
    const input = root.querySelector("input[data-setting]");
    const heard = jest.fn();
    document.addEventListener("tweakuiSettingsChanged", heard);
    input.checked = true;
    await settingsPage.save(root, input, () => Promise.resolve({ok: true, json: () => Promise.resolve({surprise_me: true})}), document, window);
    input.checked = false;
    await settingsPage.save(root, input, () => Promise.resolve({ok: false, status: 400, json: () => Promise.resolve({})}), document, window);
    document.removeEventListener("tweakuiSettingsChanged", heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0][0].detail).toEqual({surprise_me: true});
});

test("the settings under Enhanced Task Details are greyed out and disabled while it is off", async () => {
    document.body.innerHTML = `<div id="tweakui-settings" data-api="/api/plugins/tweakui/">
        <section data-section="general"><input type="checkbox" data-setting="enhanced_task_details">
        <div class="tweakui-subsettings" data-depends="enhanced_task_details">
        <input type="checkbox" data-setting="task_details_step" checked></div></section>
        <p class="tweakui-status"></p></div>`;
    const fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({})}));
    settingsPage.start(document, {location: {hash: ""}, addEventListener() {}, fetch});
    const main = document.querySelector("[data-setting=enhanced_task_details]");
    const part = document.querySelector("[data-setting=task_details_step]");
    const box = document.querySelector(".tweakui-subsettings");
    expect(part.disabled).toBe(true);
    expect(box.classList.contains("tweakui-off")).toBe(true);
    main.checked = true;
    main.dispatchEvent(new Event("change"));
    expect(part.disabled).toBe(false);
    expect(box.classList.contains("tweakui-off")).toBe(false);
    expect(part.checked).toBe(true);
});

test("turning the theme menu on or off reloads the page to show it", async () => {
    document.body.innerHTML = `<div id="tweakui-settings" data-api="/api/plugins/tweakui/">
        <section data-section="themes"><input type="checkbox" data-setting="show_theme_menu"></section>
        <p class="tweakui-status"></p></div>`;
    const root = document.getElementById("tweakui-settings"), input = root.querySelector("input");
    const win = {location: {reload: jest.fn()}};
    const fetchFn = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({show_theme_menu: true})}));
    input.checked = true;
    await settingsPage.save(root, input, fetchFn, document, win);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({show_theme_menu: true});
    expect(win.location.reload).toHaveBeenCalled();
});

function previewPage() {
    document.body.innerHTML = `
      <div id="tweakui-settings" data-api="/api/plugins/tweakui/" data-previews="/plugins/tweakui/previews/">
        <section data-section="general"><h4>General</h4>
          <div class="tweakui-setting" data-preview="other-tasks"><label><input type="checkbox" data-setting="other_tasks">
            Other   Tasks</label><p>desc</p></div>
          <div class="tweakui-setting"><label><input type="checkbox" data-setting="task_details_times"> Started</label></div>
        </section>
        <section data-section="themes"><h4>Themes</h4><div class="tweakui-intro" data-preview="themes"><p>intro</p></div></section>
      </div>
      <button id="elsewhere">x</button>`;
    return document.getElementById("tweakui-settings");
}

test("a setting with a data-preview gets a lazy thumbnail of its screenshot, named after the setting", () => {
    const root = previewPage();
    settingsPage.addPreviews(root, document);
    settingsPage.addPreviews(root, document);
    const buttons = root.querySelectorAll(".tweakui-preview");
    expect(buttons.length).toBe(2);
    const img = buttons[0].querySelector("img");
    expect(img.getAttribute("src")).toBe("/plugins/tweakui/previews/other-tasks.webp");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.alt).toBe("Other Tasks");
    expect(buttons[0].closest(".tweakui-setting").classList.contains("tweakui-has-preview")).toBe(true);
    expect(buttons[1].querySelector("img").alt).toBe("Themes");
});

test("a screenshot that doesn't load hides its thumbnail", () => {
    const root = previewPage();
    settingsPage.addPreviews(root, document);
    const button = root.querySelector(".tweakui-preview");
    button.querySelector("img").dispatchEvent(new Event("error"));
    expect(button.hidden).toBe(true);
    expect(button.parentNode.classList.contains("tweakui-has-preview")).toBe(false);
});

test("clicking a thumbnail shows the screenshot full size, and Esc closes it and focuses the thumbnail again", () => {
    const root = previewPage();
    settingsPage.addPreviews(root, document);
    const button = root.querySelector(".tweakui-preview");
    button.click();
    const overlay = document.querySelector(".tweakui-preview-overlay");
    expect(overlay.getAttribute("role")).toBe("dialog");
    expect(overlay.querySelector("figure img").getAttribute("src")).toBe("/plugins/tweakui/previews/other-tasks.webp");
    expect(overlay.querySelector("figcaption").textContent).toBe("Other Tasks");
    expect(document.activeElement).toBe(overlay.querySelector(".close"));
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
    expect(document.querySelector(".tweakui-preview-overlay")).toBeNull();
    expect(document.activeElement).toBe(button);
});

test("a click on the overlay or its close button closes it, and a later Esc does nothing more", () => {
    const root = previewPage();
    settingsPage.addPreviews(root, document);
    const button = root.querySelector(".tweakui-preview");
    button.click();
    document.querySelector(".tweakui-preview-overlay .close").click();
    expect(document.querySelector(".tweakui-preview-overlay")).toBeNull();
    button.click();
    document.querySelector(".tweakui-preview-overlay figure img").click();
    expect(document.querySelector(".tweakui-preview-overlay")).toBeNull();
    document.getElementById("elsewhere").focus();
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
    expect(document.activeElement.id).toBe("elsewhere");
});

test("a page without a previews folder adds no thumbnails", () => {
    const root = previewPage();
    root.removeAttribute("data-previews");
    settingsPage.addPreviews(root, document);
    expect(root.querySelector(".tweakui-preview")).toBeNull();
});

function samplePage() {
    document.body.innerHTML = `<div id="tweakui-settings" data-api="/api/plugins/tweakui/">
        <form class="tweakui-sample"><input type="text" value="x"><a href="#" id="link"><i>in a link</i></a>
            <button type="button" data-toggle="tooltip" title="A tooltip">Primary</button></form></div>`;
    return document.getElementById("tweakui-settings");
}

test("the theme sample's links and its form do nothing, so the category stays as it is", () => {
    const page = samplePage();
    settingsPage.inertSample(page, window);
    const click = new MouseEvent("click", {bubbles: true, cancelable: true});
    page.querySelector("#link i").dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    const submit = new Event("submit", {bubbles: true, cancelable: true});
    page.querySelector("form").dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
});

test("the theme sample's tooltip is Bootstrap's, set up on the first hover once the page has it", () => {
    const page = samplePage();
    const tooltip = jest.fn(function () { return this; });
    let data;
    const wrapped = {tooltip, data: () => data};
    const $ = Object.assign(jest.fn(() => wrapped), {fn: {tooltip: () => {}}});
    const win = {};
    settingsPage.inertSample(page, win);
    const button = page.querySelector("[data-toggle=tooltip]");
    button.dispatchEvent(new MouseEvent("mouseover", {bubbles: true}));
    expect(tooltip).not.toHaveBeenCalled();
    win.jQuery = $;
    button.dispatchEvent(new MouseEvent("mouseover", {bubbles: true}));
    expect($).toHaveBeenCalledWith(button);
    expect(tooltip).toHaveBeenCalledWith("show");
    data = {};
    tooltip.mockClear();
    button.dispatchEvent(new MouseEvent("mouseover", {bubbles: true}));
    expect(tooltip).not.toHaveBeenCalled();
});
