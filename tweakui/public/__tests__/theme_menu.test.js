const themeMenu = require("../theme_menu");

const THEMES = [
    {id: "webodm", name: "WebODM's theme", swatch: ["#ffffff"]},
    {id: "catppuccin-latte", name: "Catppuccin Latte", swatch: ["#eff1f5"]},
    {id: "dracula", name: "Dracula", swatch: ["#282a36"]},
    {id: "nord", name: "Nord", swatch: ["#2e3440"]}
];

// WebODM's header and side menu: the user icon's menu in its header links, which single-user mode leaves out
function header(singleUser) {
    document.body.innerHTML = `
      <nav id="navbar-top"><div class="navbar-header">` + (singleUser ? "" : `<ul class="nav navbar-top-links navbar-right">
        <li class="dropdown"><a class="dropdown-toggle"><i class="fa fa-user"></i></a><ul class="dropdown-menu dropdown-user"></ul></li>
      </ul>`) + `<a class="navbar-brand" href="/"></a></div>
      <div class="sidebar"><ul class="nav" id="side-menu">
        <li><a href="/dashboard/">Dashboard</a></li><li><a href="/plugins/tweakui/">TweakUI</a></li><li id="about-menu"><a href="/about/">About</a></li>
      </ul></div></nav>`;
}

function win(theme, extra) {
    return Object.assign({TweakUI: {settings: {theme: theme}, themes: THEMES}, location: {reload: jest.fn()}}, extra);
}

const names = menu => Array.from(menu.querySelectorAll("a[data-theme]")).map(a => a.getAttribute("data-theme"));

test("the paintbrush menu goes just before the user icon", () => {
    header();
    const menu = themeMenu.build(document, win("webodm"));
    const items = document.querySelectorAll(".navbar-top-links > li");
    expect(items[0]).toBe(menu);
    expect(items[1].querySelector(".dropdown-user")).not.toBeNull();
    expect(menu.querySelector(".dropdown-toggle .fa-paint-brush")).not.toBeNull();
    expect(menu.querySelector(".dropdown-toggle").getAttribute("data-toggle")).toBe("dropdown");
});

test("the current theme and WebODM's theme come first, then the others in their order", () => {
    header();
    const menu = themeMenu.build(document, win("dracula"));
    expect(names(menu)).toEqual(["dracula", "webodm", "catppuccin-latte", "nord"]);
    const children = Array.from(menu.querySelector("ul").children);
    expect(children[3].className).toBe("divider");
    expect(menu.querySelector('a[data-theme="dracula"]').getAttribute("aria-checked")).toBe("true");
    expect(menu.querySelector('a[data-theme="webodm"] .fa-check').classList.contains("tweakui-unchecked")).toBe(true);
    expect(menu.querySelector('a[data-theme="nord"] .tweakui-swatch i').style.background).toBe("rgb(46, 52, 64)");
});

test("with WebODM's theme current it is listed once, on top", () => {
    header();
    expect(names(themeMenu.build(document, win("webodm")))).toEqual(["webodm", "catppuccin-latte", "dracula", "nord"]);
});

test("there is no menu when Settings > Themes turns it off", () => {
    header();
    const w = win("webodm");
    w.TweakUI.settings.show_theme_menu = false;
    expect(themeMenu.build(document, w)).toBeNull();
    expect(document.querySelector(".tweakui-theme-menu")).toBeNull();
    w.TweakUI.settings.show_theme_menu = true;
    expect(themeMenu.build(document, w)).not.toBeNull();
});

test("there is no menu on a page without the side menu (signed out), without the themes, or a second time", () => {
    document.body.innerHTML = "<nav id='navbar-top'><div class='navbar-header'></div></nav>";
    expect(themeMenu.build(document, win("webodm"))).toBeNull();
    header();
    expect(themeMenu.build(document, {TweakUI: {settings: {theme: "webodm"}}})).toBeNull();
    expect(themeMenu.build(document, win("webodm"))).not.toBeNull();
    expect(themeMenu.build(document, win("webodm"))).toBeNull();
    expect(document.querySelectorAll(".tweakui-theme-menu").length).toBe(1);
});

test("choosing a theme saves it with the CSRF cookie and reloads the page", async () => {
    header();
    document.cookie = "csrftoken=tok";
    const w = win("webodm");
    const menu = themeMenu.build(document, w);
    const fetchFn = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({theme: "nord"})}));
    await themeMenu.choose(menu, "nord", fetchFn, document, w);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/plugins/tweakui/settings");
    expect(init.method).toBe("PATCH");
    expect(init.headers["X-CSRFToken"]).toBe("tok");
    expect(JSON.parse(init.body)).toEqual({theme: "nord"});
    expect(w.location.reload).toHaveBeenCalled();
});

test("choosing the current theme does nothing", async () => {
    header();
    const w = win("nord"), fetchFn = jest.fn();
    await themeMenu.choose(themeMenu.build(document, w), "nord", fetchFn, document, w);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(w.location.reload).not.toHaveBeenCalled();
});

test("a refused theme is shown in the menu, which stays open, and nothing reloads", async () => {
    header();
    const w = win("webodm");
    const menu = themeMenu.build(document, w);
    const fetchFn = () => Promise.resolve({ok: false, status: 400, json: () => Promise.resolve({detail: "Unknown theme: x"})});
    await themeMenu.choose(menu, "x", fetchFn, document, w);
    const status = menu.querySelector(".tweakui-theme-status");
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe("Not saved: Unknown theme: x");
    expect(menu.classList.contains("open")).toBe(true);
    expect(w.location.reload).not.toHaveBeenCalled();
    expect(w.TweakUI.settings.theme).toBe("webodm");
});

test("a click on a theme in the menu chooses it", async () => {
    header();
    const fetchFn = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({theme: "dracula"})}));
    const w = win("webodm", {fetch: fetchFn});
    themeMenu.start(document, w);
    document.querySelector('a[data-theme="dracula"] .tweakui-theme-name').click();
    await new Promise(r => setTimeout(r, 0));
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({theme: "dracula"});
});

test("the user's own themes come after the presets, behind a divider of their own", () => {
    header();
    const themes = THEMES.map(t => Object.assign({group: "builtin"}, t)).concat(
        [{id: "own:abc", name: "Mine", group: "own", swatch: ["#111111"]}]);
    const menu = themeMenu.build(document, win("webodm", {TweakUI: {settings: {theme: "webodm"}, themes: themes}}));
    expect(names(menu)).toEqual(["webodm", "catppuccin-latte", "dracula", "nord", "own:abc"]);
    const children = Array.from(menu.querySelector("ul").children).map(li => li.className || li.textContent);
    expect(children.filter(c => c === "divider").length).toBe(2);
    expect(children[children.length - 3]).toBe("divider");
});

test("in single-user mode, without the user icon, the menu goes in header links of its own where WebODM puts them", () => {
    header(true);
    const menu = themeMenu.build(document, win("webodm"));
    const links = document.querySelector(".navbar-header > .navbar-top-links.navbar-right");
    expect(links.firstElementChild).toBe(menu);
    expect(links.nextElementSibling.classList.contains("navbar-brand")).toBe(true);
    expect(menu.querySelector(".dropdown-toggle").getAttribute("data-toggle")).toBe("dropdown");
});

test("in desktop mode, where WebODM hides its header, the menu is a side menu item above TweakUI's that opens below", () => {
    header(true);
    const w = win("dracula");
    w.TweakUI.desktop = true;
    const menu = themeMenu.build(document, w);
    expect(document.querySelector(".navbar-top-links")).toBeNull();
    expect(menu.parentNode.id).toBe("side-menu");
    expect(menu.nextElementSibling.querySelector('a[href="/plugins/tweakui/"]')).not.toBeNull();
    const toggle = menu.querySelector(":scope > a"), list = menu.querySelector(":scope > ul");
    expect(toggle.textContent.trim()).toBe("Theme");
    expect(toggle.hasAttribute("data-toggle")).toBe(false);
    expect(toggle.querySelector(".fa-paint-brush")).not.toBeNull();
    expect(toggle.querySelector(".arrow")).not.toBeNull();
    expect(list.className).toBe("tweakui-theme-list nav nav-second-level collapse");
    expect(list.querySelector(".dropdown-header")).toBeNull();
    expect(names(menu)).toEqual(["dracula", "webodm", "catppuccin-latte", "nord"]);
    toggle.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true}));
    expect(list.classList.contains("in")).toBe(true);
    expect(menu.classList.contains("active")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true}));
    expect(list.classList.contains("in")).toBe(false);
});
