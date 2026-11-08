const core = require("../core");
const themeMenu = require("../theme_menu");
const unitsMenu = require("../units_menu");

afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = "";
});

describe("errors stay in their feature", () => {
    test("a guarded function that throws logs the feature's name and returns, and the caller goes on", () => {
        const log = jest.spyOn(console, "error").mockImplementation(() => {});
        const boom = new Error("boom");
        const wrapped = core.guard("zoom_override", () => { throw boom; });
        expect(() => wrapped()).not.toThrow();
        expect(log).toHaveBeenCalledWith("TweakUI zoom_override:", boom);
    });

    test("a guarded function passes on its arguments, this and what it returns", () => {
        const wrapped = core.guard("x", function (a, b) { return [this.n, a + b]; });
        expect(wrapped.call({n: 1}, 2, 3)).toEqual([1, 5]);
    });

    test("a hook callback that throws doesn't reach WebODM's code that calls it", () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        // As WebODM's event emitter: listeners are called one after another, synchronously
        const listeners = [];
        const hook = cb => listeners.push(cb);
        hook(core.guard("broken", () => { throw new Error("broken"); }));
        const after = jest.fn();
        hook(after);
        expect(() => listeners.forEach(cb => cb({map: {}}))).not.toThrow();
        expect(after).toHaveBeenCalled();
    });

    test("a feature whose start throws is logged and the next feature still starts", () => {
        const log = jest.spyOn(console, "error").mockImplementation(() => {});
        const win = {document, TweakUI: {settings: {}}};
        const second = jest.fn();
        core.feature(win, "first", () => { throw new Error("first"); });
        core.feature(win, "second", second);
        expect(log.mock.calls[0][0]).toBe("TweakUI first:");
        expect(second).toHaveBeenCalledWith(document, win);
    });

    test("a feature starts only when its condition, given the settings, says so", () => {
        const win = {document, TweakUI: {settings: {on: true, off: false}}};
        const on = jest.fn(), off = jest.fn();
        core.feature(win, "on", on, {when: s => s.on});
        core.feature(win, "off", off, {when: s => s.off});
        expect(on).toHaveBeenCalled();
        expect(off).not.toHaveBeenCalled();
    });

    test("a feature that waits for the page starts once it is parsed", () => {
        const doc = {readyState: "loading", listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }};
        const start = jest.fn();
        core.feature({document: doc, TweakUI: {settings: {}}}, "later", start, {ready: true});
        expect(start).not.toHaveBeenCalled();
        doc.listeners.DOMContentLoaded();
        expect(start).toHaveBeenCalled();
    });
});

describe("the helpers on window.TweakUI", () => {
    test("installing them keeps the settings, themes and flags settings.js put there", () => {
        const settings = {theme: "nord"}, themes = [{id: "nord"}];
        const win = {TweakUI: {settings, themes, superuser: true}};
        core.install(win);
        expect(win.TweakUI.settings).toBe(settings);
        expect(win.TweakUI.themes).toBe(themes);
        expect(win.TweakUI.superuser).toBe(true);
        expect(win.TweakUI.guard).toBe(core.guard);
        expect(core.settingsOf(win)).toBe(settings);
        expect(core.settingsOf({})).toEqual({});
    });

    test("an element's text is set as text, never as HTML", () => {
        const e = core.el(document, "span", "a b", "<b>x</b>");
        expect(e.className).toBe("a b");
        expect(e.textContent).toBe("<b>x</b>");
        expect(e.children.length).toBe(0);
        expect(core.el(document, "i").textContent).toBe("");
    });

    test("the CSRF token comes from the page's form field, else from the cookie", () => {
        document.cookie = "csrftoken=fromcookie";
        expect(core.csrfToken(document)).toBe("fromcookie");
        document.body.innerHTML = '<input name="csrfmiddlewaretoken" value="fromform">';
        expect(core.csrfToken(document)).toBe("fromform");
    });

    test("waiting for an element calls back at once when it's there, else when it appears", async () => {
        document.body.innerHTML = '<p id="here"></p>';
        const now = jest.fn();
        expect(core.whenElement(document, window, "#here", now)).toBeNull();
        expect(now).toHaveBeenCalledWith(document.getElementById("here"));
        const later = jest.fn();
        core.whenElement(document, window, "#later", later);
        expect(later).not.toHaveBeenCalled();
        document.body.appendChild(Object.assign(document.createElement("div"), {id: "later"}));
        await Promise.resolve();
        expect(later).toHaveBeenCalledTimes(1);
    });

    test("a side-menu item is WebODM's shape: an icon and a label in a link", () => {
        document.body.innerHTML = '<ul id="side-menu"><li><a href="/x/">X</a></li></ul>';
        const li = core.sideLink(document, "Storage", "/s/", "fa fa-database fa-fw");
        expect(li.outerHTML).toBe('<li><a href="/s/"><i class="fa fa-database fa-fw"></i> Storage</a></li>');
        expect(core.sideItem(document, "/x/").textContent).toBe("X");
        expect(core.sideItem(document, "/none/")).toBeNull();
    });
});

describe("the header menus' order doesn't depend on which script starts first", () => {
    const THEMES = {settings: {theme: "webodm"}, themes: [{id: "webodm", name: "WebODM's theme"}]};

    function page() {
        document.body.innerHTML =
            '<nav id="navbar-top"><div class="navbar-header"><a class="navbar-brand"></a></div>' +
            '<ul class="nav navbar-top-links navbar-right"><li class="dropdown"><a class="dropdown-user"></a></li></ul></nav>' +
            '<ul id="side-menu"><li><a href="/dashboard/">Dashboard</a></li><li><a href="/plugins/tweakui/">TweakUI</a></li>' +
            '<li id="about-menu"><a href="/about/">About</a></li></ul>';
    }

    function order(selector) {
        return Array.from(document.querySelectorAll(selector)).map(li =>
            li.classList.contains("tweakui-units-menu") ? "units" : li.classList.contains("tweakui-theme-menu") ? "theme" :
                li.querySelector(".dropdown-user") ? "user" : li.textContent.trim());
    }

    for (const desktop of [false, true]) {
        for (const first of ["theme", "units"]) {
            test(`${desktop ? "in the side menu" : "in the header"}, with the ${first} menu first`, () => {
                page();
                const win = {TweakUI: Object.assign({desktop}, THEMES), localStorage: window.localStorage};
                const steps = {theme: () => themeMenu.build(document, win), units: () => unitsMenu.build(document, win)};
                steps[first]();
                steps[first === "theme" ? "units" : "theme"]();
                if (desktop) expect(order("#side-menu > li")).toEqual(["Dashboard", "theme", "units", "TweakUI", "About"]);
                else expect(order(".navbar-top-links > li")).toEqual(["units", "theme", "user"]);
            });
        }
    }

    // DJI Thermal's Temperature Unit menu goes first in the list, after its own request, so before or after TweakUI's
    function addOther(name) {
        const links = document.querySelector(".navbar-top-links");
        const li = document.createElement("li");
        li.className = "dropdown";
        li.textContent = name;
        links.insertBefore(li, links.firstChild);
    }
    const settle = () => new Promise(r => setTimeout(r, 0));

    for (const otherFirst of [true, false]) {
        test(`TweakUI's menus stay ahead of another plugin's, which ${otherFirst ? "starts before" : "starts after"} them`, async () => {
            page();
            const win = {TweakUI: Object.assign({desktop: false}, THEMES), localStorage: window.localStorage,
                MutationObserver: window.MutationObserver};
            if (otherFirst) addOther("Temperature");
            themeMenu.build(document, win);
            unitsMenu.build(document, win);
            if (!otherFirst) addOther("Temperature");
            await settle();
            expect(order(".navbar-top-links > li")).toEqual(["units", "theme", "Temperature", "user"]);
        });
    }

    test("TweakUI stops moving its menus when another plugin keeps putting its own first", async () => {
        page();
        const win = {TweakUI: Object.assign({desktop: false}, THEMES), localStorage: window.localStorage,
            MutationObserver: window.MutationObserver};
        themeMenu.build(document, win);
        unitsMenu.build(document, win);
        const links = document.querySelector(".navbar-top-links");
        addOther("Stubborn");
        const stubborn = links.firstChild;
        new MutationObserver(() => {
            if (links.firstChild !== stubborn) links.insertBefore(stubborn, links.firstChild);
        }).observe(links, {childList: true});
        for (let i = 0; i < 30; i++) await settle();
        expect(order(".navbar-top-links > li")[0]).toBe("Stubborn");
    });
});
