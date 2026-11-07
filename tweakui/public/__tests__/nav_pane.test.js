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
    html.removeAttribute("style");
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
    // In the header, which holds the pane, so it isn't under the pane
    expect(t.parentNode.id).toBe("navbar-top");
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

describe("Resize Navigation Pane", () => {
    const handle = () => document.querySelector(".tweakui-nav-handle");
    const width = () => html.style.getPropertyValue("--tweakui-nav-width");
    const icons = () => html.classList.contains("tweakui-nav-icons");
    // jsdom has no PointerEvent: a MouseEvent of that type carries button and clientX
    const pointer = (type, x) => handle().dispatchEvent(new MouseEvent(type, {bubbles: true, cancelable: true, button: 0, clientX: x}));

    beforeEach(() => { window.innerWidth = 1280; });

    test("a width is WebODM's 250 px until set, snaps to the icons under 120 px and goes no wider than half the window", () => {
        expect(navPane.clampWidth(NaN, 1280)).toBe(250);
        expect(navPane.clampWidth(30, 1280)).toBe(navPane.MIN_WIDTH);
        expect(navPane.clampWidth(119, 1280)).toBe(navPane.MIN_WIDTH);
        expect(navPane.clampWidth(120, 1280)).toBe(120);
        expect(navPane.clampWidth(900, 1280)).toBe(640);
        // A small window still allows WebODM's width
        expect(navPane.clampWidth(300, 400)).toBe(250);
    });

    test("turned off, the divider has no handle and the pane keeps WebODM's width", () => {
        localStorage.setItem(navPane.WIDTH_KEY, "180");
        start({resize_nav_pane: false});
        expect(handle()).toBeNull();
        expect(html.classList.contains("tweakui-nav-sized")).toBe(false);
    });

    test("dragging the divider sets the pane's width, remembered for the next page", () => {
        start({resize_nav_pane: true});
        expect(handle().getAttribute("role")).toBe("separator");
        pointer("pointerdown", 250);
        expect(html.classList.contains("tweakui-nav-dragging")).toBe(true);
        pointer("pointermove", 320);
        expect(width()).toBe("320px");
        pointer("pointerup", 320);
        expect(html.classList.contains("tweakui-nav-dragging")).toBe(false);
        expect(localStorage.getItem(navPane.WIDTH_KEY)).toBe("320");
        html.className = "";
        html.removeAttribute("style");
        page();
        start({resize_nav_pane: true});
        expect(width()).toBe("320px");
        expect(html.classList.contains("tweakui-nav-sized")).toBe(true);
    });

    test("dragged narrow, only the icons show, each link's name as its tooltip until it is wider again", () => {
        start({resize_nav_pane: true});
        pointer("pointerdown", 250);
        pointer("pointermove", 80);
        pointer("pointerup", 80);
        expect(width()).toBe("50px");
        expect(icons()).toBe(true);
        const link = document.querySelector("#side-menu a");
        link.dispatchEvent(new MouseEvent("mouseover", {bubbles: true}));
        expect(link.title).toBe("Dashboard");
        pointer("pointerdown", 50);
        pointer("pointermove", 200);
        pointer("pointerup", 200);
        expect(icons()).toBe(false);
        expect(link.hasAttribute("title")).toBe(false);
    });

    test("a double click on the divider puts back WebODM's width and forgets the other", () => {
        localStorage.setItem(navPane.WIDTH_KEY, "180");
        start({resize_nav_pane: true});
        expect(width()).toBe("180px");
        handle().dispatchEvent(new MouseEvent("dblclick", {bubbles: true}));
        expect(width()).toBe("");
        expect(html.classList.contains("tweakui-nav-sized")).toBe(false);
        expect(localStorage.getItem(navPane.WIDTH_KEY)).toBeNull();
    });

    test("from the keyboard, the arrows narrow and widen the pane, through the icons", () => {
        start({resize_nav_pane: true});
        const key = k => handle().dispatchEvent(new KeyboardEvent("keydown", {key: k, bubbles: true, cancelable: true}));
        key("ArrowLeft");
        expect(width()).toBe("230px");
        key("Home");
        expect(width()).toBe("50px");
        key("ArrowRight");
        expect(width()).toBe("120px");
        key("End");
        expect(width()).toBe("");
    });

    test("only a drag that changes the width tells the maps, at most once a frame", () => {
        start({resize_nav_pane: true});
        const resize = jest.fn();
        window.addEventListener("resize", resize);
        jest.useFakeTimers();
        const raf = window.requestAnimationFrame;
        window.requestAnimationFrame = fn => setTimeout(fn, 16);
        pointer("pointerdown", 250);
        pointer("pointermove", 260);
        pointer("pointermove", 270);
        jest.advanceTimersByTime(20);
        expect(resize).toHaveBeenCalledTimes(1);
        pointer("pointerup", 270);
        expect(resize).toHaveBeenCalledTimes(2);
        window.requestAnimationFrame = raf;
        jest.useRealTimers();
        window.removeEventListener("resize", resize);
    });

    test("turned off on the settings page, the pane goes back to WebODM's width; on again, to the one remembered", () => {
        localStorage.setItem(navPane.WIDTH_KEY, "180");
        start({resize_nav_pane: true});
        document.dispatchEvent(new CustomEvent("tweakuiSettingsChanged", {detail: {resize_nav_pane: false}}));
        expect(handle()).toBeNull();
        expect(width()).toBe("");
        document.dispatchEvent(new CustomEvent("tweakuiSettingsChanged", {detail: {resize_nav_pane: true}}));
        expect(width()).toBe("180px");
        expect(handle()).not.toBeNull();
    });

    test("both on: the tab follows the pane's width (main.css places it from the same width)", () => {
        localStorage.setItem(navPane.WIDTH_KEY, "300");
        start({hide_nav_pane: true, resize_nav_pane: true});
        expect(tab()).not.toBeNull();
        expect(handle()).not.toBeNull();
        expect(width()).toBe("300px");
    });
});
