const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");

function sideMenu(extra) {
    document.body.innerHTML =
        '<ul class="nav" id="side-menu">' +
        '<li><a href="/dashboard/">Dashboard</a></li>' +
        '<li><a href="/plugins/tweakui/">TweakUI</a></li>' +
        '<li><a href="/plugins/diagnostic/">Diagnostic</a></li>' +
        (extra || "") +
        '<li id="about-menu"><a href="/about/">About</a></li>' +
        "</ul>";
}

function labels() {
    return Array.prototype.map.call(document.querySelectorAll("#side-menu > li"), (li) => li.textContent);
}

test("loading the script marks the page with the tweakui class and keeps its other classes", () => {
    document.documentElement.className = "theme";
    new Function(source)();
    expect(document.documentElement.classList.contains("tweakui")).toBe(true);
    expect(document.documentElement.classList.contains("theme")).toBe(true);
});

test("the TweakUI menu item moves just above About and is marked as moved", () => {
    sideMenu("<li><a href=\"#\">Administration</a></li>");
    new Function(source)();
    expect(labels()).toEqual(["Dashboard", "Diagnostic", "Administration", "TweakUI", "About"]);
    expect(document.querySelector('a[href="/plugins/tweakui/"]').parentNode.classList.contains("tweakui-menu")).toBe(true);
});

test("without an About item the TweakUI menu item stays where it is but is still shown", () => {
    document.body.innerHTML = '<ul id="side-menu"><li><a href="/plugins/tweakui/">TweakUI</a></li><li><a href="/x/">X</a></li></ul>';
    new Function(source)();
    expect(labels()).toEqual(["TweakUI", "X"]);
    expect(document.querySelector("#side-menu > li").classList.contains("tweakui-menu")).toBe(true);
});

test("a page without the side menu is left alone", () => {
    document.body.innerHTML = "<p>Welcome</p>";
    expect(() => new Function(source)()).not.toThrow();
});

describe("the Storage view in the side menu", () => {
    afterEach(() => { delete window.TweakUI; delete window.jQuery; window.history.replaceState(null, "", "/"); });

    const subs = item => Array.from(item.querySelectorAll(":scope > ul a")).map(a => [a.textContent.trim(), a.getAttribute("href")]);

    test("turned off, the side menu is WebODM's", () => {
        window.TweakUI = {settings: {storage_view: false}};
        sideMenu();
        new Function(source)();
        expect(document.querySelectorAll("#side-menu ul").length).toBe(0);
        expect(document.querySelector('a[href="/plugins/diagnostic/"]')).not.toBeNull();
    });

    test("turned on, Diagnostic opens to System and Storage, closed until its page or a click", () => {
        window.TweakUI = {settings: {storage_view: true}};
        sideMenu();
        new Function(source)();
        const item = Array.from(document.querySelectorAll("#side-menu > li")).find(li => /Diagnostic/.test(li.textContent));
        expect(item.querySelector("a").getAttribute("href")).toBe("#");
        expect(item.querySelector("a .arrow")).not.toBeNull();
        expect(subs(item)).toEqual([["System", "/plugins/diagnostic/"], ["Storage", "/plugins/tweakui/storage/"]]);
        expect(item.classList.contains("active")).toBe(false);
        // TweakUI's own item is left as it is
        expect(document.querySelector(".tweakui-menu > a").getAttribute("href")).toBe("/plugins/tweakui/");
    });

    test("on the Storage page its entry is marked and Diagnostic is open", () => {
        window.TweakUI = {settings: {storage_view: true}};
        window.history.replaceState(null, "", "/plugins/tweakui/storage/");
        sideMenu();
        new Function(source)();
        const item = document.querySelector("#side-menu ul").parentNode;
        expect(item.classList.contains("active")).toBe(true);
        expect(item.querySelector("a.active").textContent.trim()).toBe("Storage");
    });

    test("without Diagnostic, TweakUI's item opens to Settings and Storage, open from the start", () => {
        window.TweakUI = {settings: {storage_view: true}};
        document.body.innerHTML = '<ul id="side-menu"><li><a href="/dashboard/">Dashboard</a></li>' +
            '<li><a href="/plugins/tweakui/">TweakUI</a></li><li id="about-menu"><a href="/about/">About</a></li></ul>';
        new Function(source)();
        const item = document.querySelector(".tweakui-menu");
        expect(labels()[1]).toMatch(/^TweakUI/);
        expect(subs(item)).toEqual([["Settings", "/plugins/tweakui/"], ["Storage", "/plugins/tweakui/storage/"]]);
        expect(item.classList.contains("active")).toBe(true);
    });

    test("when WebODM's menu has already started, the new parent opens and closes on its own", () => {
        window.TweakUI = {settings: {storage_view: true}};
        window.jQuery = () => ({data: name => name === "metisMenu" ? {} : undefined});
        sideMenu();
        new Function(source)();
        const list = document.querySelector("#side-menu ul");
        const link = list.parentNode.querySelector("a");
        expect(list.classList.contains("collapse")).toBe(true);
        expect(list.classList.contains("in")).toBe(false);
        link.click();
        expect(list.classList.contains("in")).toBe(true);
        expect(list.getAttribute("aria-expanded")).toBe("true");
        link.click();
        expect(list.classList.contains("in")).toBe(false);
    });

    test("running twice does not add a second submenu", () => {
        window.TweakUI = {settings: {storage_view: true}};
        sideMenu();
        new Function(source)();
        new Function(source)();
        expect(document.querySelectorAll("#side-menu ul").length).toBe(1);
    });
});

describe("Administration > TweakUI Themes in the side menu", () => {
    afterEach(() => { delete window.TweakUI; delete window.jQuery; window.history.replaceState(null, "", "/"); });

    const admin = () => sideMenu('<li><a href="#">Administration<span class="fa arrow"></span></a><ul class="nav nav-second-level">' +
        '<li><a href="/admin/app/setting/1/change/">Brand</a></li><li><a href="/admin/app/theme/1/change/">Theme</a></li>' +
        '<li><a href="/admin/app/plugin/">Plugins</a></li></ul></li>');
    const adminItems = () => Array.from(document.querySelectorAll(".nav-second-level > li")).map(li => li.textContent.trim());

    test("a superuser gets the link right after Theme", () => {
        window.TweakUI = {settings: {}, superuser: true};
        admin();
        new Function(source)();
        expect(adminItems()).toEqual(["Brand", "Theme", "TweakUI Themes", "Plugins"]);
        const link = document.querySelector('a[href="/plugins/tweakui/admin/themes/"]');
        expect(link.querySelector("i").className).toBe("fa fa-palette fa-fw");
        expect(link.classList.contains("active")).toBe(false);
        new Function(source)();
        expect(adminItems().length).toBe(4);
    });

    test("other users, staff included, get no link", () => {
        window.TweakUI = {settings: {}};
        admin();
        new Function(source)();
        expect(adminItems()).toEqual(["Brand", "Theme", "Plugins"]);
    });

    test("on the page itself, the link is active and Administration open", () => {
        window.TweakUI = {settings: {}, superuser: true};
        window.history.replaceState(null, "", "/plugins/tweakui/admin/themes/");
        window.jQuery = () => ({data: name => name === "metisMenu" ? {} : undefined});
        admin();
        new Function(source)();
        const link = document.querySelector('a[href="/plugins/tweakui/admin/themes/"]');
        expect(link.classList.contains("active")).toBe(true);
        const list = document.querySelector(".nav-second-level");
        expect(list.parentNode.classList.contains("active")).toBe(true);
        expect(list.classList.contains("in")).toBe(true);
    });
});
