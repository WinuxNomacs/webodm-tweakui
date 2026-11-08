// The selector check's lists (dev/selector-check.js): the browser run itself is run against a WebODM
const {readSelectors, plan, WHERE, PUBLIC} = require("../selector-check");

const selectors = readSelectors(PUBLIC);

test("every script's SELECTORS list is read from its source, scripts with an empty one left out", () => {
    expect(selectors.units_menu).toEqual({unitSelector: "select.unit-selector"});
    expect(selectors.task_controls.open).toBe("fa-minus-square");
    expect(selectors.zoom_override).toBeUndefined();
    Object.values(selectors).forEach(list => Object.values(list).forEach(s => expect(typeof s).toBe("string")));
});

test("every script with selectors has a page in the check, so a new one is not left out", () => {
    const {byPage, unplaced} = plan(selectors);
    expect(unplaced).toEqual([]);
    const checked = Object.values(byPage).flat().length;
    expect(checked).toBe(Object.values(selectors).reduce((n, list) => n + Object.keys(list).length, 0));
});

test("the check's notes name selectors the scripts have", () => {
    Object.entries(WHERE).forEach(([script, where]) => {
        const names = Object.keys(selectors[script] || {});
        expect(names.length).toBeGreaterThan(0);
        Object.entries(where.within || {}).forEach(([name, parent]) => expect(names).toEqual(expect.arrayContaining([name, parent])));
        [...(where.className || []), ...(where.admin || []), ...Object.keys(where.pages || {})].forEach(n => expect(names).toContain(n));
    });
});

test("a script with selectors and no page is reported, and a relative selector is checked inside its parent's", () => {
    const {byPage, unplaced} = plan({...selectors, new_tweak: {thing: ".thing"}});
    expect(unplaced).toEqual(["new_tweak"]);
    expect(byPage.task.find(c => c.script === "task_details" && c.name === "rows").within).toBe(selectors.task_details.table);
    expect(byPage.model.find(c => c.script === "source_frames").name).toBe("modelView");
});
