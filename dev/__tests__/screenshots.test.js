// The shot list of dev/screenshots.js: the browser run itself is checked by looking at the images it makes
const fs = require("fs");
const path = require("path");
const {SHOTS, OUT} = require("../screenshots");

const settingsPy = fs.readFileSync(path.join(__dirname, "..", "..", "tweakui", "settings.py"), "utf8");
const DEFAULTS = settingsPy.slice(settingsPy.indexOf("DEFAULTS = {"), settingsPy.indexOf("\n}\n"));
const settingNames = [...DEFAULTS.matchAll(/^\s+"(\w+)":/gm)].map(m => m[1]);

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
