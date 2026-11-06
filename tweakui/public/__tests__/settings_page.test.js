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
