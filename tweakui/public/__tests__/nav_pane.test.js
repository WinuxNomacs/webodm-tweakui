const core = require("../core");
const navPane = require("../nav_pane");

const html = document.documentElement;

// A WebODM page: the header, and the navigation pane beside the page
function page() {
    document.body.innerHTML = '<nav id="navbar-top"><div class="navbar-default sidebar"><ul id="side-menu">' +
        '<li><a href="/dashboard/"><i class="fa fa-tachometer-alt fa-fw"></i> Dashboard</a></li></ul></div></nav>' +
        '<div id="page-wrapper"></div>';
}

function start(settings) {
    window.TweakUI = {settings};
    return navPane.start(document, window);
}

const tab = () => document.querySelector(".tweakui-nav-tab");
const hidden = () => html.classList.contains("tweakui-nav-hidden");

beforeEach(() => {
    core.install(window);
    page();
    localStorage.clear();
});

afterEach(() => {
    jest.restoreAllMocks();
    html.className = "";
});

test("turned off, there is no tab and the navigation pane stays", () => {
    start({hide_nav_pane: false});
    expect(tab()).toBeNull();
    expect(hidden()).toBe(false);
});

test("turned on, a tab on the divider below the header hides the pane, and shows it again", () => {
    start({hide_nav_pane: true});
    const t = tab();
    expect(t.tagName).toBe("BUTTON");
    expect(t.className).toContain("theme-background-highlight");
    expect(t.style.top).toBe("10px");
    expect(t.title).toBe("Hide Navigation Pane");
    t.click();
    expect(hidden()).toBe(true);
    expect(t.title).toBe("Show Navigation Pane");
    expect(t.getAttribute("aria-expanded")).toBe("false");
    expect(t.firstChild.className).toBe("fa fa-chevron-right");
    t.click();
    expect(hidden()).toBe(false);
    expect(t.title).toBe("Hide Navigation Pane");
});

test("hiding or showing the pane tells the maps the page changed width", () => {
    start({hide_nav_pane: true});
    const resize = jest.fn();
    window.addEventListener("resize", resize);
    tab().click();
    tab().click();
    window.removeEventListener("resize", resize);
    expect(resize).toHaveBeenCalledTimes(2);
});

test("a hidden pane is remembered in this browser: the next page starts hidden, before it is drawn", () => {
    start({hide_nav_pane: true});
    tab().click();
    expect(localStorage.getItem(navPane.HIDDEN_KEY)).toBe("1");
    html.className = "";
    page();
    start({hide_nav_pane: true});
    expect(hidden()).toBe(true);
    tab().click();
    expect(localStorage.getItem(navPane.HIDDEN_KEY)).toBeNull();
});

test("a pane hidden earlier is shown when the setting is off", () => {
    localStorage.setItem(navPane.HIDDEN_KEY, "1");
    start({hide_nav_pane: false});
    expect(hidden()).toBe(false);
});

test("turned on or off on the settings page, the tab comes or goes at once and the pane is shown", () => {
    start({hide_nav_pane: false});
    document.dispatchEvent(new CustomEvent("tweakuiSettingsChanged", {detail: {hide_nav_pane: true}}));
    expect(tab()).not.toBeNull();
    tab().click();
    document.dispatchEvent(new CustomEvent("tweakuiSettingsChanged", {detail: {hide_nav_pane: false}}));
    expect(tab()).toBeNull();
    expect(hidden()).toBe(false);
    expect(html.classList.contains("tweakui-nav-tabbed")).toBe(false);
});

test("a page without the navigation pane (signed out) gets no tab", () => {
    document.body.innerHTML = "<p>Sign in</p>";
    start({hide_nav_pane: true});
    expect(tab()).toBeNull();
});

test("a browser that blocks storage still hides and shows the pane, without remembering it", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    start({hide_nav_pane: true});
    tab().click();
    expect(hidden()).toBe(true);
});
