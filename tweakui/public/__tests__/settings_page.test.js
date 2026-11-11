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

test("turning the Storage or the Performance view on or off reloads the page to show its side-menu item", async () => {
    for (const name of ["storage_view", "performance_view"]) {
        document.body.innerHTML = `<div id="tweakui-settings" data-api="/api/plugins/tweakui/"><p class="tweakui-status"></p>
          <input type="checkbox" data-setting="${name}"></div>`;
        const root = document.getElementById("tweakui-settings"), box = root.querySelector("input");
        box.checked = true;
        const win = {location: {reload: jest.fn()}};
        await settingsPage.save(root, box, () => Promise.resolve({ok: true, json: () => Promise.resolve({})}), document, win);
        expect(win.location.reload).toHaveBeenCalled();
    }
});

describe("a number setting with a list of values", () => {
    function valuesPage() {
        document.body.innerHTML = `<div id="tweakui-settings" data-api="/api/plugins/tweakui/"><section data-section="map2d">
            <input type="range" data-slider-of="fade_in_speed" data-values="0,50,100,200" min="0" max="3" step="1" value="3">
            <input type="number" data-setting="fade_in_speed" min="0" max="200" step="1" value="200" data-saved="200" data-values="0,50,100,200">
            </section><p class="tweakui-status"></p></div>`;
        const fetch = jest.fn((url, init) => Promise.resolve({ok: true, json: () => Promise.resolve(JSON.parse(init.body))}));
        settingsPage.start(document, {location: {hash: ""}, addEventListener() {}, fetch});
        return {fetch, slider: document.querySelector("[data-slider-of]"), box: document.querySelector("[data-setting=fade_in_speed]"),
            status: () => document.querySelector(".tweakui-status").textContent};
    }

    test("the slider steps through the values, the box showing each, and saves the value when let go", async () => {
        const {fetch, slider, box} = valuesPage();
        slider.value = "1";
        slider.dispatchEvent(new Event("input"));
        expect(box.value).toBe("50");
        slider.value = "0";
        slider.dispatchEvent(new Event("change"));
        await new Promise(r => setTimeout(r, 0));
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({fade_in_speed: 0});
        expect(box.getAttribute("data-saved")).toBe("0");
        expect(slider.value).toBe("0");
    });

    test("the box takes only the values, and puts back anything else with the slider, saying why", async () => {
        const {fetch, slider, box, status} = valuesPage();
        box.value = "100";
        box.dispatchEvent(new Event("change"));
        await new Promise(r => setTimeout(r, 0));
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({fade_in_speed: 100});
        expect(slider.value).toBe("2");
        for (const bad of ["150", "25", "300", ""]) {
            box.value = bad;
            box.dispatchEvent(new Event("change"));
            expect(box.value).toBe("100");
            expect(slider.value).toBe("2");
            expect(status()).toBe("Not saved: one of 0, 50, 100 or 200");
        }
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});

describe("a number setting", () => {
    function numberPage() {
        document.body.innerHTML = `<div id="tweakui-settings" data-api="/api/plugins/tweakui/">
            <section data-section="general"><input type="checkbox" data-setting="hide_nav_pane" checked>
            <div class="tweakui-subsettings" data-depends="hide_nav_pane">
              <input type="checkbox" data-setting="auto_hide_nav_pane">
              <div class="tweakui-subsettings" data-depends="auto_hide_nav_pane">
                <input type="range" data-slider-of="auto_hide_delay" min="200" max="3000" step="100" value="500">
                <input type="number" data-setting="auto_hide_delay" min="200" max="3000" step="1" value="500" data-saved="500">
              </div></div></section>
            <p class="tweakui-status"></p></div>`;
        const fetch = jest.fn((url, init) => Promise.resolve({ok: true, json: () => Promise.resolve(JSON.parse(init.body))}));
        settingsPage.start(document, {location: {hash: ""}, addEventListener() {}, fetch});
        return {fetch, slider: document.querySelector("[data-slider-of]"), box: document.querySelector("[data-setting=auto_hide_delay]"),
            status: () => document.querySelector(".tweakui-status").textContent};
    }

    test("the slider sets the box as it moves and saves the whole number when let go", async () => {
        const {fetch, slider, box, status} = numberPage();
        slider.disabled = false;
        slider.value = "1200";
        slider.dispatchEvent(new Event("input"));
        expect(box.value).toBe("1200");
        expect(fetch).not.toHaveBeenCalled();
        slider.dispatchEvent(new Event("change"));
        await new Promise(r => setTimeout(r, 0));
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({auto_hide_delay: 1200});
        expect(box.getAttribute("data-saved")).toBe("1200");
        expect(status()).toBe("Saved");
    });

    test("the box takes any whole number in the range, and puts back anything else, saying why", async () => {
        const {fetch, slider, box, status} = numberPage();
        box.disabled = false;
        box.value = "750";
        box.dispatchEvent(new Event("change"));
        await new Promise(r => setTimeout(r, 0));
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({auto_hide_delay: 750});
        for (const bad of ["5000", "150", "7.5", ""]) {
            box.value = bad;
            box.dispatchEvent(new Event("change"));
            expect(box.value).toBe("750");
            expect(status()).toBe("Not saved: a whole number from 200 to 3000");
        }
        expect(fetch).toHaveBeenCalledTimes(1);
        // The slider is given the saved number (a browser shows it on the nearest step; jsdom keeps it as given)
        expect(["750", "800"]).toContain(slider.value);
    });

    test("a refused number is put back", async () => {
        document.body.innerHTML = "";
        const root = numberPage();
        const box = root.box;
        box.value = "900";
        await settingsPage.save(document.getElementById("tweakui-settings"), box,
            () => Promise.resolve({ok: false, status: 400, json: () => Promise.resolve({detail: "No"})}), document, {});
        expect(box.value).toBe("500");
        expect(root.slider.value).toBe("500");
    });

    test("a part within a part is greyed while either setting above it is off", () => {
        const {slider, box} = numberPage();
        expect(box.disabled).toBe(true);
        const auto = document.querySelector("[data-setting=auto_hide_nav_pane]");
        auto.checked = true;
        settingsPage.applyDepends(document.getElementById("tweakui-settings"));
        expect(box.disabled).toBe(false);
        const hide = document.querySelector("[data-setting=hide_nav_pane]");
        hide.checked = false;
        settingsPage.applyDepends(document.getElementById("tweakui-settings"));
        expect(auto.disabled).toBe(true);
        expect(box.disabled).toBe(true);
        expect(slider.disabled).toBe(true);
    });
});

test("a thumbnail is a link acting as a button that reads Preview on a phone, and Space opens it without changing the address", () => {
    const root = previewPage();
    settingsPage.addPreviews(root, document);
    const link = root.querySelector(".tweakui-preview");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("role")).toBe("button");
    expect(link.querySelector(".tweakui-preview-text").textContent).toBe("Preview");
    const before = window.location.hash;
    const click = new MouseEvent("click", {bubbles: true, cancelable: true});
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(window.location.hash).toBe(before);
    document.querySelector(".tweakui-preview-overlay .close").click();
    const space = new KeyboardEvent("keydown", {key: " ", bubbles: true, cancelable: true});
    link.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(document.querySelector(".tweakui-preview-overlay")).not.toBeNull();
    document.querySelector(".tweakui-preview-overlay .close").click();
});

test("More shows the rest of a setting's description and reads Less, which hides it again", () => {
    document.body.innerHTML = `
      <div id="tweakui-settings">
        <div class="tweakui-setting"><label><input type="checkbox" data-setting="hide_nav_pane"> Hide</label>
          <p class="text-muted tweakui-summary">A tab. <a href="#tweakui-hide_nav_pane-more" role="button" class="tweakui-more-toggle"
            aria-expanded="false" aria-controls="tweakui-hide_nav_pane-more">More</a></p>
          <p class="text-muted tweakui-more" id="tweakui-hide_nav_pane-more" hidden>The rest.</p></div>
      </div>`;
    const root = document.getElementById("tweakui-settings");
    settingsPage.addMore(root);
    const toggle = root.querySelector(".tweakui-more-toggle"), more = root.querySelector(".tweakui-more");
    const click = new MouseEvent("click", {bubbles: true, cancelable: true});
    toggle.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(more.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe("Less");
    toggle.dispatchEvent(new KeyboardEvent("keydown", {key: " ", cancelable: true}));
    expect(more.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe("More");
});

test("Preload Tile Panning's estimate counts the tiles beyond the view as Leaflet does, 512-pixel tiles at half size on a high-resolution screen", () => {
    // 1400 x 900 at DPR 2 (256-pixel tiles): 7 x 5 tiles in view; at 100%, 18 x 12 with those beyond
    expect(settingsPage.loadAheadTiles(1400, 900, 2, 1)).toBe(18 * 12 - 7 * 5);
    // the same window at DPR 1 (512-pixel tiles): 4 x 3 in view, 10 x 7 at 100%
    expect(settingsPage.loadAheadTiles(1400, 900, 1, 1)).toBe(10 * 7 - 4 * 3);
    expect(settingsPage.loadAheadTiles(1400, 900, 2, 2)).toBeGreaterThan(settingsPage.loadAheadTiles(1400, 900, 2, 1));
});

test("Keep More's estimate counts its columns and rows beyond WebODM's 2, around what Preload Tile Panning loads", () => {
    // 7 x 5 loaded; at 100%, 2 + 6 columns and 2 + 4 rows each side, where WebODM keeps 2
    expect(settingsPage.keepMoreTiles(1400, 900, 2, 1, 0)).toBe(23 * 17 - 11 * 9);
    expect(settingsPage.keepMoreTiles(1400, 900, 2, 1, 1)).toBeGreaterThan(settingsPage.keepMoreTiles(1400, 900, 2, 1, 0));
});

test("the estimates say approximately how many MB per layer, Keep More's at most, and Preload Tile Panning's share counts for Keep More only while ticked", () => {
    const values = {load_ahead_on: false, load_ahead: 100, keep_more_tiles: 100};
    expect(settingsPage.estimateText("load_ahead", values, 1400, 900, 2))
        .toBe("Approximately 65 MB more memory per layer, in a window of this size.");
    expect(settingsPage.estimateText("keep_more", values, 1400, 900, 2))
        .toBe("Approximately 100 MB more memory per layer at most, in a window of this size.");
    expect(settingsPage.estimateText("keep_more", Object.assign({}, values, {load_ahead_on: true}), 1400, 900, 2))
        .toBe("Approximately 160 MB more memory per layer at most, in a window of this size.");
    // never less than the first step
    expect(settingsPage.estimateText("load_ahead", {load_ahead: 25}, 400, 300, 1)).toMatch(/^Approximately 5 MB/);
});

test("the device's memory is said only where the browser gives it, 8 GB as 8 or more", () => {
    expect(settingsPage.deviceMemoryText({deviceMemory: 4})).toBe("This device has approximately 4 GB of memory.");
    expect(settingsPage.deviceMemoryText({deviceMemory: 8})).toBe("This device has approximately 8 GB of memory or more.");
    expect(settingsPage.deviceMemoryText({deviceMemory: 32})).toBe("This device has approximately 32 GB of memory.");
    expect(settingsPage.deviceMemoryText({})).toBeNull();
});

function speedGroup() {
    document.body.innerHTML = `
      <div id="tweakui-settings"><div class="tweakui-group">
        <div class="tweakui-setting"><input type="checkbox" data-setting="load_ahead_on"></div>
        <div class="tweakui-setting tweakui-number-setting">
          <input type="range" data-slider-of="load_ahead" min="25" max="200" step="25" value="100">
          <input type="number" data-setting="load_ahead" min="25" max="200" value="100" data-saved="100">
          <p class="text-muted tweakui-estimate" data-estimate="load_ahead" hidden></p></div>
        <div class="tweakui-setting tweakui-number-setting">
          <input type="number" data-setting="keep_more_tiles" min="25" max="100" value="100" data-saved="100">
          <p class="text-muted tweakui-estimate" data-estimate="keep_more" hidden></p></div>
      </div></div>`;
    return document.getElementById("tweakui-settings");
}

test("the estimates follow the sliders, Preload Tile Panning's checkbox and the window's size, and the device's memory ends their group", () => {
    const root = speedGroup(), win = new EventTarget();
    Object.assign(win, {innerWidth: 1400, innerHeight: 900, devicePixelRatio: 2, navigator: {deviceMemory: 8}});
    settingsPage.addEstimates(root, win);
    const [ahead, keep] = root.querySelectorAll("[data-estimate]");
    expect(ahead.hidden).toBe(false);
    expect(ahead.textContent).toMatch(/^Approximately 65 MB/);
    expect(keep.textContent).toMatch(/^Approximately 100 MB/);
    root.querySelector("input[data-setting='load_ahead']").value = "50";
    root.querySelector("input[data-setting='load_ahead']").dispatchEvent(new Event("input", {bubbles: true}));
    expect(ahead.textContent).toMatch(/^Approximately 25 MB/);
    const tick = root.querySelector("input[data-setting='load_ahead_on']");
    tick.checked = true;
    tick.dispatchEvent(new Event("change", {bubbles: true}));
    expect(keep.textContent).toMatch(/^Approximately 130 MB/);
    // a box out of range counts as its saved value
    root.querySelector("input[data-setting='load_ahead']").value = "999";
    root.querySelector("input[data-setting='load_ahead']").dispatchEvent(new Event("input", {bubbles: true}));
    expect(ahead.textContent).toMatch(/^Approximately 65 MB/);
    win.innerWidth = 700;
    win.dispatchEvent(new Event("resize"));
    expect(ahead.textContent).not.toMatch(/^Approximately 65 MB/);
    expect(root.querySelector(".tweakui-group > p.tweakui-device-memory").textContent)
        .toBe("This device has approximately 8 GB of memory or more.");
});

test("a browser that doesn't give the device's memory shows only the estimates", () => {
    const root = speedGroup(), win = new EventTarget();
    Object.assign(win, {innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1, navigator: {}});
    settingsPage.addEstimates(root, win);
    expect(root.querySelector(".tweakui-device-memory")).toBeNull();
    expect(root.querySelector("[data-estimate]").hidden).toBe(false);
});
