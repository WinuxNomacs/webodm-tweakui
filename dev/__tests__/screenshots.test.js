// The shot list of dev/screenshots.js: the browser run itself is checked by looking at the images it makes
const fs = require("fs");
const path = require("path");
const {SHOTS, OUT} = require("../screenshots");

// Every setting is declared once, as Setting("name", ...) in features.py
const featuresPy = fs.readFileSync(path.join(__dirname, "..", "..", "tweakui", "features.py"), "utf8");
const settingNames = [...featuresPy.matchAll(/\bSetting\("(\w+)"/g)].map(m => m[1]);

test("every shot has a name of its own, fit for a file name", () => {
    const names = SHOTS.map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
    names.forEach(n => expect(n).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
});

test("every setting a shot turns on is one of TweakUI's settings", () => {
    expect(settingNames).toContain("storage_view");
    SHOTS.forEach(s => Object.keys(s.settings).forEach(k => expect(settingNames).toContain(k)));
});

test("every shot has its image in previews/, and every image there a shot", () => {
    const images = fs.readdirSync(OUT).filter(f => f.endsWith(".webp")).map(f => f.replace(/\.webp$/, "")).sort();
    expect(images).toEqual(SHOTS.map(s => s.name).sort());
});

test("every image in previews/ is shown somewhere: as a setting's preview or on a docs page", () => {
    const root = path.join(__dirname, "..", "..");
    const used = fs.readFileSync(path.join(root, "tweakui", "templates", "settings.html"), "utf8") +
        fs.readdirSync(path.join(root, "docs")).filter(f => f.endsWith(".md"))
            .map(f => fs.readFileSync(path.join(root, "docs", f), "utf8")).join("\n");
    SHOTS.forEach(s => expect(used).toMatch(new RegExp(`data-preview="${s.name}"|previews/${s.name}\\.webp`)));
});
