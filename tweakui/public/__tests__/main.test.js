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
