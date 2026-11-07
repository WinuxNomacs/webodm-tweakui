const unitsMenu = require("../units_menu");
const themeMenu = require("../theme_menu");

// The header as WebODM renders it, and a map's UnitSelector (WebODM's select.unit-selector)
function header(withMap, singleUser) {
    document.body.innerHTML = `
      <nav id="navbar-top"><div class="navbar-header">` + (singleUser ? "" : `<ul class="nav navbar-top-links navbar-right">
        <li class="dropdown"><a class="dropdown-toggle"><i class="fa fa-user"></i></a><ul class="dropdown-menu dropdown-user"></ul></li>
      </ul>`) + `<a class="navbar-brand" href="/"></a></div>
      <div class="sidebar"><ul class="nav" id="side-menu">
        <li><a href="/dashboard/">Dashboard</a></li><li><a href="/plugins/tweakui/">TweakUI</a></li><li id="about-menu"><a href="/about/">About</a></li>
      </ul></div></nav>` + (withMap ? `<select class="unit-selector"><option value="metric">Metric</option>
        <option value="imperial">Imperial</option><option value="imperialUS">Imperial (US)</option></select>` : "");
}
const shown = menu => menu.querySelector(".tweakui-units-name").textContent;
const checked = menu => Array.from(menu.querySelectorAll('a[aria-checked="true"]')).map(a => a.getAttribute("data-units"));
const pick = (menu, system) => menu.querySelector('a[data-units="' + system + '"]').dispatchEvent(new MouseEvent("click", {bubbles: true}));
let watch;

beforeEach(() => localStorage.clear());
afterEach(() => {
    if (watch) watch.stop();
    watch = null;
});

test("the menu goes before the paintbrush, which is before the user icon, and lists WebODM's three systems", () => {
    header();
    themeMenu.build(document, {TweakUI: {settings: {theme: "webodm"}, themes: [{id: "webodm", name: "WebODM's theme"}]}});
    watch = unitsMenu.start(document, window);
    const items = document.querySelectorAll(".navbar-top-links > li");
    expect(items[0]).toBe(watch.menu);
    expect(items[1].classList.contains("tweakui-theme-menu")).toBe(true);
    expect(Array.from(watch.menu.querySelectorAll("a[data-units]")).map(a => a.textContent.trim()))
        .toEqual(["Metric", "Imperial", "Imperial (US)"]);
});

test("without a stored system it shows Metric, as WebODM does", () => {
    header();
    watch = unitsMenu.start(document, window);
    expect(shown(watch.menu)).toBe("Metric");
    expect(checked(watch.menu)).toEqual(["metric"]);
});

test("choosing a system stores it as WebODM does, fires WebODM's event once and sets the map's selector", () => {
    header(true);
    const heard = jest.fn();
    document.addEventListener("onUnitSystemChanged", heard);
    watch = unitsMenu.start(document, window);
    pick(watch.menu, "imperialUS");
    pick(watch.menu, "imperialUS");
    document.removeEventListener("onUnitSystemChanged", heard);
    expect(localStorage.getItem("unit_system")).toBe("imperialUS");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0][0].detail).toBe("imperialUS");
    expect(document.querySelector("select.unit-selector").value).toBe("imperialUS");
    expect(shown(watch.menu)).toBe("Imperial (US)");
});

test("a change on a map's selector (WebODM's event) updates the menu", () => {
    header();
    watch = unitsMenu.start(document, window);
    localStorage.setItem("unit_system", "imperial");
    document.dispatchEvent(new CustomEvent("onUnitSystemChanged", {detail: "imperial"}));
    expect(shown(watch.menu)).toBe("Imperial");
    expect(checked(watch.menu)).toEqual(["imperial"]);
});

test("a change in another tab updates the menu", () => {
    header();
    watch = unitsMenu.start(document, window);
    localStorage.setItem("unit_system", "imperial");
    window.dispatchEvent(new StorageEvent("storage", {key: "unit_system"}));
    expect(shown(watch.menu)).toBe("Imperial");
});

test("a page without the side menu (signed out) gets no menu, and the menu is added only once", () => {
    document.body.innerHTML = "<nav id='navbar-top'><div class='navbar-header'></div></nav>";
    expect(unitsMenu.start(document, window)).toBeNull();
    header();
    watch = unitsMenu.start(document, window);
    expect(unitsMenu.build(document, window)).toBeNull();
    expect(document.querySelectorAll(".tweakui-units-menu").length).toBe(1);
});

test("in single-user mode the menu goes before the paintbrush in header links of their own", () => {
    header(false, true);
    themeMenu.build(document, {TweakUI: {settings: {theme: "webodm"}, themes: [{id: "webodm", name: "WebODM's theme"}]}});
    watch = unitsMenu.start(document, window);
    const items = document.querySelectorAll(".navbar-header > .navbar-top-links > li");
    expect(items.length).toBe(2);
    expect(items[0]).toBe(watch.menu);
    expect(items[1].classList.contains("tweakui-theme-menu")).toBe(true);
});

test("in desktop mode the menu is a side menu item after the theme menu's, named Units: and the system", () => {
    header(false, true);
    const w = {TweakUI: {desktop: true, settings: {theme: "webodm"}, themes: [{id: "webodm", name: "WebODM's theme"}]}};
    themeMenu.build(document, w);
    window.TweakUI = w.TweakUI;
    watch = unitsMenu.start(document, window);
    delete window.TweakUI;
    const items = Array.from(document.querySelectorAll("#side-menu > li"));
    expect(items.map(li => li.className || li.id || li.textContent.trim()))
        .toEqual(["Dashboard", "tweakui-side-item tweakui-theme-menu", "tweakui-side-item tweakui-units-menu", "TweakUI", "about-menu"]);
    expect(watch.menu.querySelector(":scope > a").textContent.replace(/\s+/g, " ").trim()).toBe("Units: Metric");
    expect(watch.menu.querySelector(".dropdown-header")).toBeNull();
    pick(watch.menu, "imperial");
    expect(shown(watch.menu)).toBe("Imperial");
});
