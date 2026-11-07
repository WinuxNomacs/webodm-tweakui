const taskOptions = require("../task_options");

// A dialog as EditPresetDialog renders it: groups with a header and options, each option a label starting with its name
function dialog(groups) {
    document.body.innerHTML = '<div class="edit-preset-dialog">' + groups.map(g =>
        '<div class="option-group"><div class="option-group-header"><span class="group-name">' + g.name +
        '</span><span class="option-count">(' + g.options.length + ')</span></div><div class="option-group-content">' +
        g.options.map(o => '<div class="processing-node-option"><label>' + o + ' <i class="fa fa-info-circle"></i></label></div>').join("") +
        "</div></div>").join("") + "</div>";
    return document.querySelector(".edit-preset-dialog");
}

// Option components: getValue() is undefined at the default, as in ProcessingNodeOption
function components(values) {
    const result = {};
    Object.keys(values).forEach(name => { result[name] = {getValue: () => values[name]}; });
    return result;
}

const counts = root => Array.from(root.querySelectorAll(".option-group-header")).map(h => h.getAttribute("data-tweakui-count"));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("each heading shows how many of its options are not at their default out of how many it has", () => {
    const root = dialog([{name: "Input", options: ["ignore-gsd", "cameras", "sky-removal"]}, {name: "Point Cloud", options: ["pc-quality"]}]);
    taskOptions.update(root, components({"ignore-gsd": true, cameras: undefined, "sky-removal": undefined, "pc-quality": undefined}));
    expect(counts(root)).toEqual(["(1/3)", "(0/1)"]);
});

test("the option name is the first word of the label, without the domain WebODM adds", () => {
    document.body.innerHTML = '<div class="processing-node-option"><label>pc-quality (ultra, high) <i></i></label></div>';
    expect(taskOptions.optionName(document.querySelector(".processing-node-option"))).toBe("pc-quality");
});

test("a group with no options on the page keeps WebODM's own number", () => {
    const root = dialog([{name: "Other Options", options: []}]);
    root.querySelector(".option-group-header").setAttribute("data-tweakui-count", "(1/2)");
    taskOptions.update(root, {});
    expect(counts(root)).toEqual([null]);
});

test("an option whose component is missing or fails counts as not modified", () => {
    const root = dialog([{name: "Input", options: ["a", "b"]}]);
    taskOptions.update(root, {b: {getValue: () => { throw new Error("unmounted"); }}});
    expect(counts(root)).toEqual(["(0/2)"]);
});

test("the counts follow changes in the dialog and stop once the watch is stopped", async () => {
    const root = dialog([{name: "Input", options: ["ignore-gsd", "cameras"]}]);
    const values = {"ignore-gsd": undefined, cameras: undefined};
    const options = {"ignore-gsd": {getValue: () => values["ignore-gsd"]}, cameras: {getValue: () => values.cameras}};
    const watch = taskOptions.watch(document, options, window);
    expect(counts(root)).toEqual(["(0/2)"]);

    values["ignore-gsd"] = true;
    root.querySelector("label").dispatchEvent(new Event("change", {bubbles: true}));
    await tick();
    expect(counts(root)).toEqual(["(1/2)"]);

    values["ignore-gsd"] = undefined; // Reset to default is a click
    root.querySelector("label").dispatchEvent(new Event("click", {bubbles: true}));
    await tick();
    expect(counts(root)).toEqual(["(0/2)"]);

    watch.stop();
    values.cameras = "x";
    root.querySelector("label").dispatchEvent(new Event("change", {bubbles: true}));
    await tick();
    expect(counts(root)).toEqual(["(0/2)"]);
});

test("options added to the page, as when a group is searched or opened, are counted", async () => {
    const root = dialog([{name: "Input", options: ["a"]}]);
    taskOptions.watch(document, components({a: undefined, b: 5}), window);
    const option = document.createElement("div");
    option.className = "processing-node-option";
    option.innerHTML = "<label>b <i></i></label>";
    root.querySelector(".option-group-content").appendChild(option);
    await tick();
    await tick();
    expect(counts(root)).toEqual(["(1/2)"]);
});

test("without a dialog on the page nothing is watched", () => {
    document.body.innerHTML = "";
    expect(taskOptions.watch(document, {}, window)).toBeNull();
});

describe("Expand Configured", () => {
    // A dialog with subgroups, as EditPresetDialog renders a group with more than one; collapsed groups' content
    // has WebODM's inline display: none
    function grouped(groups) {
        document.body.innerHTML = '<div class="edit-preset-dialog">' + groups.map(g =>
            '<div class="option-group"><div class="option-group-header"><span class="option-count">(0)</span></div>' +
            '<div class="option-group-content" style="display: ' + (g.collapsed ? "none" : "block") + '">' +
            g.subgroups.map(sub => '<div class="option-subgroup"><div class="option-subgroup-content">' +
                sub.map(o => '<div class="processing-node-option"><label>' + o + ' <i></i></label></div>').join("") +
                "</div></div>").join("") + "</div></div>").join("") + "</div>";
        return document.querySelector(".edit-preset-dialog");
    }
    const expanded = root => Array.from(root.querySelectorAll(".option-group")).map(g => g.hasAttribute("data-tweakui-expand"));
    const configured = root => Array.from(root.querySelectorAll(".processing-node-option[data-tweakui-configured] label"))
        .map(l => l.firstChild.nodeValue.trim());

    test("a collapsed group with configured options is marked, with those options and their subgroups", () => {
        const root = grouped([
            {collapsed: true, subgroups: [["min-num-features", "feature-quality"], ["matcher-type"]]},
            {collapsed: true, subgroups: [["pc-quality"]]},
        ]);
        taskOptions.update(root, components({"feature-quality": "ultra", "min-num-features": undefined}), {expand: true});
        expect(expanded(root)).toEqual([true, false]);
        expect(configured(root)).toEqual(["feature-quality"]);
        const subs = root.querySelectorAll(".option-subgroup");
        expect([subs[0], subs[1]].map(s => s.hasAttribute("data-tweakui-configured"))).toEqual([true, false]);
    });

    test("an open group is not marked, so it shows all its options as WebODM does", () => {
        const root = grouped([{collapsed: false, subgroups: [["feature-quality"]]}]);
        taskOptions.update(root, components({"feature-quality": "ultra"}), {expand: true});
        expect(expanded(root)).toEqual([false]);
    });

    test("without Show Modified Options the headings keep WebODM's own number", () => {
        const root = grouped([{collapsed: true, subgroups: [["feature-quality"]]}]);
        taskOptions.update(root, components({"feature-quality": "ultra"}), {expand: true});
        expect(counts(root)).toEqual([null]);
    });

    test("without Expand Configured nothing is marked", () => {
        const root = grouped([{collapsed: true, subgroups: [["feature-quality"]]}]);
        taskOptions.update(root, components({"feature-quality": "ultra"}), {count: true});
        expect(expanded(root)).toEqual([false]);
        expect(configured(root)).toEqual([]);
        expect(counts(root)).toEqual(["(1/1)"]);
    });

    test("an option reset to its default leaves the collapsed group at once, and opening the group unmarks it", async () => {
        const root = grouped([{collapsed: true, subgroups: [["feature-quality", "pc-quality"]]}]);
        const values = {"feature-quality": "ultra", "pc-quality": "high"};
        const options = {};
        Object.keys(values).forEach(n => { options[n] = {getValue: () => values[n]}; });
        taskOptions.watch(document, options, window, {expand: true});
        expect(configured(root)).toEqual(["feature-quality", "pc-quality"]);

        values["pc-quality"] = undefined;
        root.querySelector("label").dispatchEvent(new Event("click", {bubbles: true}));
        await tick();
        expect(configured(root)).toEqual(["feature-quality"]);
        expect(expanded(root)).toEqual([true]);

        root.querySelector(".option-group-content").style.display = "block"; // the group opened (a click)
        root.querySelector(".option-group-header").dispatchEvent(new Event("click", {bubbles: true}));
        await tick();
        expect(expanded(root)).toEqual([false]);
    });
});
