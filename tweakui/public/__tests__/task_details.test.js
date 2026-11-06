const details = require("../task_details");

const DOCKER = "docker run -ti --rm -v /my/project:/datasets/code webodm/odx --project-path /datasets";

// A details panel as TaskListItem renders it: Task ID, Created on, Options, Disk Usage
function panel(task) {
    document.body.innerHTML = '<div class="expanded-panel"><table class="table info-table"><tbody>' +
        '<tr><td><strong>Task ID:</strong></td><td><a class="task-id-link">' + task.id + ' <i></i></a></td></tr>' +
        '<tr><td><strong>Created on:</strong></td><td>today</td></tr>' +
        '<tr><td><strong>Options:</strong></td><td>' + details.optionsText(task.options) + '</td></tr>' +
        '<tr><td><strong>Disk Usage:</strong></td><td>1 MB</td></tr>' +
        "</tbody></table></div>";
    return document.querySelector(".expanded-panel");
}

const labels = root => Array.from(root.querySelectorAll("tbody > tr:not(.tweakui-hidden) strong")).map(s => s.textContent);
const task = {id: "t1", project: 1, options: [{name: "auto-boundary", value: true}, {name: "dsm", value: true},
    {name: "feature-quality", value: "ultra"}]};
const presets = [
    {id: 1, name: "High Resolution", options: [{name: "dsm", value: true}]},
    {id: 2, name: "Default", options: [{name: "auto-boundary", value: true}, {name: "dsm", value: true}]},
    {id: 3, name: "Mine", options: [{name: "feature-quality", value: "ultra"}, {name: "dsm", value: true}, {name: "auto-boundary", value: true}]}
];

test("the preset is the first whose options and values are exactly the task's, as WebODM's Edit dialog finds it", () => {
    expect(details.matchPreset(presets, task.options).name).toBe("Mine");
    expect(details.matchPreset(presets, [{name: "dsm", value: true}, {name: "auto-boundary", value: true}]).name).toBe("Default");
    expect(details.matchPreset(presets, [{name: "dsm", value: false}])).toBeNull();
    expect(details.matchPreset(presets, [{name: "dsm", value: true}, {name: "pc-quality", value: "high"}])).toBeNull();
});

test("the command is WebODM's docker form with the task's options, then the ones the node adds", () => {
    expect(details.command(task.options)).toBe(DOCKER + " --auto-boundary --dsm --feature-quality ultra --pc-ept --cog --gltf");
    expect(details.command([])).toBe(DOCKER + " --pc-ept --cog --gltf");
});

test("the command leaves out false booleans, quotes values for the shell and takes the boundary as a file", () => {
    expect(details.command([{name: "fast-orthophoto", value: false}, {name: "cog", value: true},
        {name: "name", value: "my task's"}, {name: "boundary", value: {type: "FeatureCollection"}}, {name: "mesh-size", value: 200000}]))
        .toBe(DOCKER + " --cog --name 'my task'\\''s' --boundary /datasets/code/boundary.geojson --mesh-size 200000 --pc-ept --gltf");
});

test("the panel gets Preset, Options as bubbles and ODX command rows after WebODM's Options row, which is hidden", () => {
    const root = panel(task);
    expect(details.enhance(document, window, root, task, presets[2])).toBe(true);
    expect(labels(root)).toEqual(["Task ID:", "Created on:", "Preset:", "Options:", "ODX command:", "Disk Usage:"]);
    expect(root.querySelector(".tweakui-hidden").textContent).toContain("auto-boundary:true");
    expect(root.querySelector(".tweakui-task-preset").textContent).toBe("Mine");
    expect(Array.from(root.querySelectorAll(".tweakui-option-bubble")).map(b => b.textContent)).toEqual(["auto-boundary", "dsm", "feature-qualityultra"]);
    expect(root.querySelector(".tweakui-odx-command code").textContent).toBe(details.command(task.options));
});

test("a task matching no preset shows Custom, one without options None, and before the presets load an ellipsis", () => {
    let root = panel(task);
    details.enhance(document, window, root, task, null);
    expect(root.querySelector(".tweakui-task-preset").textContent).toBe("Custom");
    const plain = {id: "t2", project: 1, options: []};
    root = panel(plain);
    details.enhance(document, window, root, plain, null);
    expect(root.querySelector(".tweakui-task-preset").textContent).toBe("None");
    expect(root.querySelector(".tweakui-option-bubbles").textContent).toBe("Default");
    details.enhance(document, window, root, plain, undefined);
    expect(root.querySelector(".tweakui-task-preset").textContent).toBe("…");
});

test("enhancing again changes nothing, and rows follow changed options", () => {
    const root = panel(task);
    details.enhance(document, window, root, task, null);
    const first = root.querySelector("[data-tweakui-row]");
    details.enhance(document, window, root, task, null);
    expect(root.querySelector("[data-tweakui-row]")).toBe(first);
    expect(root.querySelectorAll("[data-tweakui-row]").length).toBe(3);
    const edited = {id: "t1", options: [{name: "dsm", value: true}]};
    root.querySelector(".tweakui-hidden td:last-child").textContent = details.optionsText(edited.options);
    details.enhance(document, window, root, edited, presets[0]);
    expect(root.querySelectorAll("[data-tweakui-row]").length).toBe(3);
    expect(root.querySelector(".tweakui-task-preset").textContent).toBe("High Resolution");
});

test("a panel whose Options row shows other options is left as WebODM made it", () => {
    const root = panel(task);
    details.enhance(document, window, root, task, null);
    const other = {id: "t1", options: [{name: "dsm", value: true}]};
    expect(details.enhance(document, window, root, other, null)).toBe(false);
    expect(root.querySelectorAll("[data-tweakui-row]").length).toBe(0);
});

test("the copy button copies the command and shows a check", async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(window.navigator, "clipboard", {value: {writeText}, configurable: true});
    const root = panel(task);
    details.enhance(document, window, root, task, null);
    root.querySelector(".tweakui-odx-copy").click();
    await Promise.resolve(); await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(details.command(task.options));
    expect(root.querySelector(".tweakui-odx-copy i").className).toBe("fa fa-check");
});

test("start adds the rows to a panel once WebODM gives its task, and adds no button", async () => {
    let hook;
    const win = Object.assign(Object.create(window), {
        PluginsAPI: {Dashboard: {addTaskActionButton: cb => { hook = cb; }}},
        fetch: jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve(presets)})),
        setTimeout: (f) => setTimeout(f, 0), MutationObserver: window.MutationObserver
    });
    const root = panel(task);
    details.start(document, win);
    expect(hook({task})).toBeNull();
    await new Promise(r => setTimeout(r, 10));
    expect(win.fetch).toHaveBeenCalledWith("/api/presets/?ordering=-system,-created_at", {credentials: "same-origin"});
    expect(root.querySelector(".tweakui-task-preset").textContent).toBe("Mine");
});
