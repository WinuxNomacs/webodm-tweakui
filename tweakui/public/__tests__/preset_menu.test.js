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

function start(settings = {replace_preset_menu: true}) {
    window.TweakUI = {settings};
    return presetMenu.start(document, window);
}

const button = () => document.querySelector(".tweakui-presets-button");
const items = () => Array.from(document.querySelectorAll(".tweakui-presets-menu > li:not(.tweakui-presets-filter)")).map(li =>
    li.classList.contains("divider") ? "---" : (li.querySelector(".tweakui-presets-nested") ? "  " : "") + li.textContent.trim());
const link = text => Array.from(document.querySelectorAll(".tweakui-presets-menu a")).find(a => a.textContent.trim() === text);

beforeEach(() => {
    core.install(window);
    delete window.gettext;
});

afterEach(() => jest.restoreAllMocks());

test("turned off, WebODM's preset dropdown is left as it is", () => {
    form();
    start({replace_preset_menu: false});
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

const ALL = ["User Presets", "  M4T-RGB", "  m4t-Thermal", "  Multispectral", "System Presets", "  3D Model", "  Buildings",
    "  Default", "  Fast Orthophoto", "  High Resolution"];

test("(Custom) stays at the top; User Presets and System Presets follow, both open, each A-Z regardless of case", () => {
    form({custom: true, value: "-1"});
    start();
    button().click();
    expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(true);
    expect(items()).toEqual(["(Custom)"].concat(ALL));
});

test("a click on a submenu's name closes it and opens it again, the other left as it is", () => {
    form();
    start();
    button().click();
    link("User Presets").click();
    expect(items()).toEqual(["User Presets", "System Presets", "  3D Model", "  Buildings", "  Default",
        "  Fast Orthophoto", "  High Resolution"]);
    expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(true);
    expect(document.activeElement.textContent.trim()).toBe("User Presets");
    link("System Presets").click();
    expect(items()).toEqual(["User Presets", "System Presets"]);
    expect(document.activeElement.textContent.trim()).toBe("System Presets");
    link("User Presets").click();
    link("System Presets").click();
    expect(items()).toEqual(ALL);
});

test("a submenu closed stays closed while the form is open, until opened again", () => {
    form();
    start();
    button().click();
    link("System Presets").click();
    button().click();
    button().click();
    expect(items()).not.toContain("  Default");
});

test("the chosen preset is marked", () => {
    form({value: "11"});
    start();
    expect(button().textContent).toBe("m4t-Thermal");
    button().click();
    expect(link("m4t-Thermal").parentNode.className).toBe("tweakui-presets-current");
    expect(link("m4t-Thermal").className).toContain("theme-background-highlight");
    expect(link("Default").parentNode.className).toBe("");
});

describe("the filter", () => {
    const filter = () => document.querySelector(".tweakui-presets-filter input");
    const type = text => {
        filter().value = text;
        filter().dispatchEvent(new Event("input", {bubbles: true}));
    };
    const key = (k, target = document.activeElement) => target.dispatchEvent(new KeyboardEvent("keydown", {key: k, bubbles: true, cancelable: true}));

    test("opened with a click, the menu's filter box at the top has the focus, empty", () => {
        form();
        start();
        button().click();
        const first = document.querySelector(".tweakui-presets-menu > li");
        expect(first.className).toBe("tweakui-presets-filter");
        expect(filter().placeholder).toBe("Filter Presets");
        expect(document.activeElement).toBe(filter());
        expect(filter().value).toBe("");
    });

    test("typing shows only the presets whose names hold the text, in any case, with their submenus open", () => {
        form({custom: true, value: "-1"});
        start();
        button().click();
        link("User Presets").click();
        filter().focus();
        type("m");
        expect(items()).toEqual(["(Custom)", "User Presets", "  M4T-RGB", "  m4t-Thermal", "  Multispectral", "System Presets",
            "  3D Model"]);
        type("ORTHO");
        expect(items()).toEqual(["System Presets", "  Fast Orthophoto"]);
        type("cust");
        expect(items()).toEqual(["(Custom)"]);
        // The filter keeps the focus and what was typed as the list changes
        expect(document.activeElement).toBe(filter());
        type("");
        expect(items()).toEqual(["(Custom)", "User Presets", "System Presets", "  3D Model", "  Buildings", "  Default",
            "  Fast Orthophoto", "  High Resolution"]);
    });

    test("no match says so", () => {
        form();
        start();
        button().click();
        type("zzz");
        expect(items()).toEqual(["No matching presets"]);
    });

    test("while filtering, a submenu's name doesn't close it", () => {
        form();
        start();
        button().click();
        type("t");
        link("User Presets").click();
        expect(items()).toContain("  m4t-Thermal");
    });

    test("Enter chooses the first match", () => {
        const select = form();
        start();
        button().click();
        type("build");
        key("Enter", filter());
        expect(select.value).toBe("5");
        expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(false);
    });

    test("the down arrow goes from the filter to the first match, past its submenu's name; the up arrow back, item by item", () => {
        form();
        start();
        button().click();
        type("rgb");
        key("ArrowDown", filter());
        expect(document.activeElement.textContent).toBe("M4T-RGB");
        key("ArrowUp");
        expect(document.activeElement.textContent.trim()).toBe("User Presets");
        key("ArrowUp");
        expect(document.activeElement).toBe(filter());
    });

    test("Escape clears the filter first, then closes the menu; it opens empty again", () => {
        form();
        start();
        button().click();
        type("rgb");
        key("Escape", filter());
        expect(filter().value).toBe("");
        expect(items()).toContain("  Default");
        expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(true);
        key("Escape", filter());
        expect(document.querySelector(".tweakui-presets").classList.contains("open")).toBe(false);
        button().click();
        type("rgb");
        button().click();
        button().click();
        expect(filter().value).toBe("");
    });
});

test("without presets of the user's, there is no User Presets", () => {
    form({user: []});
    start();
    button().click();
    expect(items()[0]).toBe("System Presets");
    expect(items()).not.toContain("User Presets");
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
    expect(document.activeElement.textContent.trim()).toBe("Fast Orthophoto");
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
