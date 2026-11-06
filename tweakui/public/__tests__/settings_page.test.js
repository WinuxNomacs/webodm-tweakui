const settingsPage = require("../settings_page");

function page(checked) {
    document.body.innerHTML = `
      <div id="tweakui-settings" data-api="/api/plugins/tweakui/">
        <input type="hidden" name="csrfmiddlewaretoken" value="tok">
        <ul class="tweakui-nav"><li><a href="#general" data-section="general" class="theme-background-highlight-hover">General</a></li>
          <li><a href="#themes" data-section="themes">Themes</a></li></ul>
        <section data-section="general"><input type="checkbox" data-setting="show_modified_options"${checked ? " checked" : ""}></section>
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
    const fetchFn = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({show_modified_options: true})}));
    const win = {TweakUI: {settings: {}}};
    await settingsPage.save(root, input, fetchFn, document, win);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/plugins/tweakui/settings");
    expect(init.method).toBe("PATCH");
    expect(init.headers["X-CSRFToken"]).toBe("tok");
    expect(JSON.parse(init.body)).toEqual({show_modified_options: true});
    expect(win.TweakUI.settings).toEqual({show_modified_options: true});
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
    expect(root.querySelector(".tweakui-status").classList.contains("text-danger")).toBe(true);
});

test("a network failure also puts the checkbox back", async () => {
    const root = page(true);
    const input = root.querySelector("input[data-setting]");
    input.checked = false;
    await settingsPage.save(root, input, () => Promise.reject(new Error("offline")), document, {});
    expect(input.checked).toBe(true);
    expect(root.querySelector(".tweakui-status").textContent).toBe("Not saved: offline");
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
