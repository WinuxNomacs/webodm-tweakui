const core = require("../core");
const presetMenu = require("../preset_menu");

// A task's form, as WebODM renders its Options row: the presets in WebODM's order (system first, newest first),
// the system ones marked, (Custom) at the top when given
function form({custom = false, user = ["Multispectral", "m4t-Thermal", "M4T-RGB"], value = "1"} = {}) {
    const system = [["1", "Default"], ["2", "High Resolution"], ["3", "Fast Orthophoto"], ["4", "3D Model"], ["5", "Buildings"]];
    const options = (custom ? ['<option value="-1">(Custom)</option>'] : [])
        .concat(system.map(([v, n]) => `<option value="${v}" class="system-preset">${n}</option>`))
        .concat(user.map((n, i) => `<option value="${10 + i}">${n}</option>`));
    document.body.innerHTML = '<div class="edit-task-form"><div class="form-group form-inline"><div>' +
        `<select class="form-control" title="Options: auto">${options.join("")}</select>` +
        '<div class="btn-group presets-dropdown"></div></div></div></div>';
    const select = document.querySelector("select");
    select.value = value;
    return select;
}

function start(settings = {sort_preset_options: true}) {
    window.TweakUI = {settings};
    return presetMenu.start(document, window);
}

const button = () => document.querySelector(".tweakui-presets-button");
const items = () => Array.from(document.querySelectorAll(".tweakui-presets-menu > li")).map(li =>
    li.classList.contains("divider") ? "---" : (li.querySelector(".tweakui-presets-nested") ? "  " : "") + li.textContent.trim());
const link = text => Array.from(document.querySelectorAll(".tweakui-presets-menu a")).find(a => a.textContent.trim() === text);

beforeEach(() => {
    core.install(window);
    delete window.gettext;
});

afterEach(() => jest.restoreAllMocks());

test("turned off, WebODM's preset dropdown is left as it is", () => {
    form();
    start({sort_preset_options: false});
    expect(button()).toBeNull();
    expect(document.querySelector("select").hasAttribute("data-tweakui-presets")).toBe(false);
});

test("turned on, a dropdown of TweakUI's own takes the select's place, showing the chosen preset and its title", () => {
    const select = form();
    start();
    expect(select.hasAttribute("data-tweakui-presets")).toBe(true);
    expect(select.nextSibling.className).toBe("tweakui-presets");
    expect(button().textContent).toBe("Default");
    expect(button().title).toBe("Options: auto");
});

test("(Custom) and Default stay at the top, User Presets comes next, closed, and the other presets follow A-Z", () => {
    form({custom: true, value: "-1"});
    start();
    button().click();
    expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(true);
    expect(items()).toEqual(["(Custom)", "Default", "User Presets", "---", "3D Model", "Buildings", "Fast Orthophoto", "High Resolution"]);
});

test("User Presets opens in the list to the user's presets, A-Z regardless of case, and closes again", () => {
    form();
    start();
    button().click();
    link("User Presets").click();
    expect(items().slice(1, 5)).toEqual(["User Presets", "  M4T-RGB", "  m4t-Thermal", "  Multispectral"]);
    expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(true);
    link("User Presets").click();
    expect(items()).not.toContain("  M4T-RGB");
});

test("User Presets starts open when the chosen preset is one of the user's, which is marked", () => {
    form({value: "11"});
    start();
    expect(button().textContent).toBe("m4t-Thermal");
    button().click();
    expect(items()).toContain("  m4t-Thermal");
    expect(link("m4t-Thermal").parentNode.className).toBe("tweakui-presets-current");
    expect(link("m4t-Thermal").className).toContain("theme-background-highlight");
});

test("without presets of the user's, there is no User Presets", () => {
    form({user: []});
    start();
    button().click();
    expect(items()).toEqual(["Default", "---", "3D Model", "Buildings", "Fast Orthophoto", "High Resolution"]);
});

test("Default is found in WebODM's language", () => {
    window.gettext = t => (t === "Default" ? "Standard" : t);
    form();
    document.querySelector('option[value="1"]').textContent = "Standard";
    start();
    button().click();
    expect(items()[0]).toBe("Standard");
});

test("choosing a preset sets WebODM's select and tells it, as a choice there would, and closes the menu", () => {
    const select = form();
    start();
    const changed = jest.fn(e => e.target.value);
    document.addEventListener("change", changed);
    button().click();
    link("Buildings").click();
    document.removeEventListener("change", changed);
    expect(select.value).toBe("5");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.results[0].value).toBe("5");
    expect(button().textContent).toBe("Buildings");
    expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(false);
});

test("choosing the preset already chosen sends no change", () => {
    form();
    start();
    const changed = jest.fn();
    document.addEventListener("change", changed);
    button().click();
    link("Default").click();
    document.removeEventListener("change", changed);
    expect(changed).not.toHaveBeenCalled();
});

test("the button follows WebODM's select as WebODM re-renders it: a new preset, a new value", async () => {
    const select = form();
    start();
    const custom = document.createElement("option");
    custom.value = "-1";
    custom.textContent = "(Custom)";
    select.insertBefore(custom, select.firstChild);
    select.value = "-1";
    select.setAttribute("title", "Options: edited");
    await Promise.resolve();
    expect(button().textContent).toBe("(Custom)");
    expect(button().title).toBe("Options: edited");
});

test("a click outside or Escape closes the menu; the arrows open it at the chosen preset and move through it", () => {
    form();
    start();
    button().click();
    document.body.click();
    expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(false);
    button().focus();
    button().dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true}));
    expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(true);
    expect(document.activeElement.textContent).toBe("Default");
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true}));
    expect(document.activeElement.textContent.trim()).toBe("User Presets");
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
    expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(false);
    expect(document.activeElement).toBe(button());
});

test("a form opened later gets the dropdown too, once; other selects of the form are left alone", async () => {
    document.body.innerHTML = "";
    jest.useFakeTimers();
    start();
    form();
    const node = document.createElement("select");
    node.innerHTML = "<option>node-odm-1</option>";
    document.querySelector(".edit-task-form").appendChild(node);
    await Promise.resolve();
    jest.runAllTimers();
    jest.useRealTimers();
    expect(document.querySelectorAll(".tweakui-presets")).toHaveLength(1);
    expect(node.hasAttribute("data-tweakui-presets")).toBe(false);
});

test("an error while building the menu is logged, not thrown into WebODM's form", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    form();
    start();
    jest.spyOn(String.prototype, "localeCompare").mockImplementation(() => { throw new Error("boom"); });
    expect(() => button().click()).not.toThrow();
    expect(console.error.mock.calls[0][0]).toBe("TweakUI preset_menu:");
});
