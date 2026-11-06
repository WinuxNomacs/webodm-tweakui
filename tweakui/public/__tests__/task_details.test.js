const details = require("../task_details");

const DOCKER = "docker run -ti --rm -v /my/project:/datasets/code webodm/odx --project-path /datasets";

// A details panel as TaskListItem renders it: Task ID, Created on, Options, Disk Usage
function panel(task) {
    document.body.innerHTML = '<div class="expanded-panel"><table class="table info-table"><tbody>' +
        '<tr><td><strong>Task ID:</strong></td><td><a class="task-id-link">' + task.id + ' <i></i></a></td></tr>' +
        '<tr><td><strong>Created on:</strong></td><td>' + new Date(task.created_at).toLocaleString() + '</td></tr>' +
        '<tr><td><strong>Options:</strong></td><td>' + details.optionsText(task.options) + '</td></tr>' +
        '<tr><td><strong>Disk Usage:</strong></td><td>1 MB</td></tr>' +
        "</tbody></table></div>";
    return document.querySelector(".expanded-panel");
}

const labels = root => Array.from(root.querySelectorAll("tbody > tr:not(.tweakui-hidden) strong")).map(s => s.textContent);
const CREATED = "2026-11-06T13:38:04.225Z";
const task = {id: "t1", project: 1, created_at: CREATED, status: 40, processing_time: 2795777, options: [{name: "auto-boundary", value: true}, {name: "dsm", value: true},
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
    expect(labels(root)).toEqual(["Task ID:", "Created on:", "Started:", "Finished:", "Preset:", "Options:", "ODX command:", "Disk Usage:"]);
    expect(root.querySelector(".tweakui-hidden").textContent).toContain("auto-boundary:true");
    expect(root.querySelector(".tweakui-task-preset").textContent).toBe("Mine");
    expect(Array.from(root.querySelectorAll(".tweakui-option-bubble")).map(b => b.textContent)).toEqual(["auto-boundary", "dsm", "feature-qualityultra"]);
    expect(root.querySelector(".tweakui-odx-command code").textContent).toBe(details.command(task.options));
});

test("a task matching no preset shows Custom, one without options None, and before the presets load an ellipsis", () => {
    let root = panel(task);
    details.enhance(document, window, root, task, null);
    expect(root.querySelector(".tweakui-task-preset").textContent).toBe("Custom");
    const plain = {id: "t2", project: 1, created_at: CREATED, status: 40, processing_time: 1000, options: []};
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
    expect(root.querySelectorAll("[data-tweakui-row]").length).toBe(5);
    const edited = Object.assign({}, task, {options: [{name: "dsm", value: true}]});
    root.querySelector(".tweakui-hidden td:last-child").textContent = details.optionsText(edited.options);
    details.enhance(document, window, root, edited, presets[0]);
    expect(root.querySelectorAll("[data-tweakui-row]").length).toBe(5);
    expect(root.querySelector(".tweakui-task-preset").textContent).toBe("High Resolution");
});

test("a panel whose Options row shows other options is left as WebODM made it", () => {
    const root = panel(task);
    details.enhance(document, window, root, task, null);
    const other = Object.assign({}, task, {options: [{name: "dsm", value: true}]});
    expect(details.enhance(document, window, root, other, null)).toBe(false);
    expect(root.querySelectorAll("[data-tweakui-row]").length).toBe(0);
});

test("started is the task's creation and finished that plus its processing time, in the browser's local time", () => {
    const root = panel(task);
    details.enhance(document, window, root, task, null);
    const created = new Date(CREATED).getTime();
    expect(root.querySelector(".tweakui-task-started").textContent).toBe(new Date(created).toLocaleString());
    expect(root.querySelector(".tweakui-task-finished").textContent).toBe(new Date(created + 2795777).toLocaleString());
});

test("a running task shows Running, one that never ran a dash, and the rows follow its status", () => {
    const running = Object.assign({}, task, {status: 20, processing_time: 5000});
    expect(details.times(running)).toEqual({started: new Date(CREATED).getTime(), finished: null, running: true});
    expect(details.times(Object.assign({}, task, {status: 10, processing_time: -1}))).toEqual({started: null, finished: null, running: false});
    expect(details.times(Object.assign({}, task, {status: 50, processing_time: -1}))).toEqual({started: null, finished: null, running: false});
    const root = panel(running);
    details.enhance(document, window, root, running, null);
    expect(root.querySelector(".tweakui-task-finished").textContent).toBe("Running");
    details.enhance(document, window, root, task, null);
    expect(root.querySelector(".tweakui-task-finished").textContent).not.toBe("Running");
    expect(root.querySelectorAll("[data-tweakui-row]").length).toBe(5);
});

test("without WebODM's Created on row there are no Started and Finished rows", () => {
    const root = panel(task);
    root.querySelectorAll("tbody > tr")[1].remove();
    expect(details.enhance(document, window, root, task, null)).toBe(true);
    expect(labels(root)).toEqual(["Task ID:", "Preset:", "Options:", "ODX command:", "Disk Usage:"]);
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

test("a task that hasn't ended is fetched again while its panel is open, and its rows follow it", async () => {
    jest.useFakeTimers();
    let hook;
    // Its own id: the earlier start test's observer still watches the page with task t1
    const running = Object.assign({}, task, {id: "t9", status: 20, processing_time: 5000});
    const done = Object.assign({}, task, {id: "t9"});
    const fetch = jest.fn(url => Promise.resolve({ok: true, json: () => Promise.resolve(url.startsWith("/api/presets") ? presets : done)}));
    const win = Object.assign(Object.create(window), {
        PluginsAPI: {Dashboard: {addTaskActionButton: cb => { hook = cb; }}},
        fetch, setTimeout: (f, ms) => setTimeout(f, ms), MutationObserver: undefined
    });
    const root = panel(running);
    details.start(document, win);
    hook({task: running});
    await jest.advanceTimersByTimeAsync(10);
    expect(root.querySelector(".tweakui-task-finished").textContent).toBe("Running");
    await jest.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledWith("/api/projects/1/tasks/t9/", {credentials: "same-origin"});
    expect(root.querySelector(".tweakui-task-finished").textContent).not.toBe("Running");
    const calls = fetch.mock.calls.length;
    await jest.advanceTimersByTimeAsync(20000);
    expect(fetch.mock.calls.length).toBe(calls);
    jest.useRealTimers();
});

const ALL = details.parts();
const without = (...off) => Object.assign({}, ALL, ...off.map(p => ({[p]: false})));

test("every part is on unless its setting is false", () => {
    expect(details.parts({})).toEqual({times: true, preset: true, options: true, command: true, step: true});
    expect(details.parts({task_details_command: false, task_details_step: true}).command).toBe(false);
});

test("parts turned off are left out, and without bubbles WebODM's Options row stays", () => {
    const root = panel(task);
    details.enhance(document, window, root, task, null, without("times", "options"));
    expect(labels(root)).toEqual(["Task ID:", "Created on:", "Options:", "Preset:", "ODX command:", "Disk Usage:"]);
    expect(root.querySelector(".tweakui-hidden")).toBeNull();
    details.enhance(document, window, root, task, null, without("preset", "command"));
    expect(labels(root)).toEqual(["Task ID:", "Created on:", "Started:", "Finished:", "Options:", "Disk Usage:"]);
    expect(root.querySelector(".tweakui-hidden")).not.toBeNull();
    details.enhance(document, window, root, task, null, without("times", "options"));
    expect(root.querySelector(".tweakui-hidden")).toBeNull();
    expect(root.querySelectorAll("[data-tweakui-row]").length).toBe(2);
});

test("ODM's stages are 13, 12 with fast-orthophoto, and stop at end-with's", () => {
    expect(details.stages([]).length).toBe(13);
    expect(details.stages([]).map(s => s[0]).indexOf("mvs_texturing")).toBe(7);
    expect(details.stages([{name: "fast-orthophoto", value: true}]).length).toBe(12);
    expect(details.stages([{name: "end-with", value: "odm_dem"}]).map(s => s[1]).pop()).toBe("Elevation Models");
    expect(details.stages([{name: "end-with", value: "odm_dem"}]).length).toBe(10);
});

test("the step is the last stage the console says is running, then done after the last", () => {
    let step = details.readStep(undefined, ["[INFO] Initializing ODX 3.8.5"]);
    expect(step).toEqual({stage: null, done: false});
    expect(details.stepText([], step)).toEqual(["Current Step:", "Starting"]);
    step = details.readStep(step, ["[INFO] Running dataset stage", "[INFO] Finished dataset stage",
        "[INFO] Running mvs_texturing stage"]);
    expect(details.stepText([], step)).toEqual(["Current Step (8/13):", "Texturing"]);
    expect(details.stepText([{name: "fast-orthophoto", value: true}], step)).toEqual(["Current Step (7/12):", "Texturing"]);
    step = details.readStep(step, ["[INFO] Finished odm_postprocess stage", "[INFO] No more stages to run"]);
    expect(details.stepText([], step)).toEqual(["Current Step:", "Downloading results"]);
    expect(details.stepText([], undefined)).toEqual(["Current Step:", "…"]);
});

test("a running task's step follows Finished, or the Options row without Created on, and not once it has ended", () => {
    const running = Object.assign({}, task, {status: 20, processing_time: 5000});
    let root = panel(running);
    details.enhance(document, window, root, running, null, ALL, {stage: "opensfm", done: false});
    expect(labels(root)).toEqual(["Task ID:", "Created on:", "Started:", "Finished:", "Current Step (4/13):", "Preset:",
        "Options:", "ODX command:", "Disk Usage:"]);
    expect(root.querySelector(".tweakui-task-step").textContent).toBe("Structure from Motion");
    details.enhance(document, window, root, running, null, without("step"), {stage: "opensfm", done: false});
    expect(root.querySelector(".tweakui-task-step")).toBeNull();
    details.enhance(document, window, root, task, null, ALL, {stage: "opensfm", done: false});
    expect(root.querySelector(".tweakui-task-step")).toBeNull();
    root = panel(running);
    root.querySelectorAll("tbody > tr")[1].remove();
    details.enhance(document, window, root, running, null, ALL, undefined);
    expect(labels(root)).toEqual(["Task ID:", "Current Step:", "Preset:", "Options:", "ODX command:", "Disk Usage:"]);
});

test("a running task's console is read on opening, then only its new lines, and again from the start after a restart", async () => {
    jest.useFakeTimers();
    let hook, consoleLines = ["[INFO] Running dataset stage", "[INFO] Running opensfm stage"];
    const running = Object.assign({}, task, {id: "t8", status: 20, processing_time: 5000});
    const fetch = jest.fn(url => {
        let body = running;
        if (url.startsWith("/api/presets")) body = presets;
        else if (url.includes("/output/")) {
            const line = Number(/line=(\d+)/.exec(url)[1]);
            body = {lines: consoleLines.slice(line), count: consoleLines.length};
        }
        return Promise.resolve({ok: true, json: () => Promise.resolve(body)});
    });
    const win = Object.assign(Object.create(window), {
        PluginsAPI: {Dashboard: {addTaskActionButton: cb => { hook = cb; }}},
        fetch, setTimeout: (f, ms) => setTimeout(f, ms), MutationObserver: undefined
    });
    const root = panel(running);
    details.start(document, win, ALL);
    hook({task: running});
    await jest.advanceTimersByTimeAsync(10);
    expect(fetch).toHaveBeenCalledWith("/api/projects/1/tasks/t8/output/?f=json&line=0", {credentials: "same-origin"});
    expect(root.querySelector(".tweakui-task-step").textContent).toBe("Structure from Motion");
    consoleLines = consoleLines.concat(["[INFO] Running openmvs stage"]);
    await jest.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledWith("/api/projects/1/tasks/t8/output/?f=json&line=2", {credentials: "same-origin"});
    expect(root.querySelector(".tweakui-task-step").textContent).toBe("Multi-View Stereo");
    consoleLines = ["[INFO] Initializing ODX 3.8.5"];
    await jest.advanceTimersByTimeAsync(5000);
    expect(root.querySelector(".tweakui-task-step").textContent).toBe("Starting");
    jest.useRealTimers();
});

test("with Current step off the console is not read", async () => {
    let hook;
    const running = Object.assign({}, task, {id: "t7", status: 20, processing_time: 5000});
    const fetch = jest.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve(presets)}));
    const win = Object.assign(Object.create(window), {
        PluginsAPI: {Dashboard: {addTaskActionButton: cb => { hook = cb; }}},
        fetch, setTimeout: (f) => setTimeout(f, 0), MutationObserver: undefined
    });
    panel(running);
    details.start(document, win, without("step"));
    hook({task: running});
    await new Promise(r => setTimeout(r, 10));
    expect(fetch.mock.calls.some(c => c[0].includes("/output/"))).toBe(false);
});
