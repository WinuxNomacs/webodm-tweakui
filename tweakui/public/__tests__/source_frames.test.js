const sf = require("../source_frames");

const flush = () => new Promise(r => setTimeout(r, 0));
const taskA = {id: "a", project: 3, name: "TestRGB", camera_shots: "/api/projects/3/tasks/a/download/shots.geojson"};
const taskB = {id: "b", project: 3, name: "TestThermal", camera_shots: "/api/projects/3/tasks/b/download/shots.geojson"};
const frame = (name, more) => Object.assign({filename: name, camera: "v2 dji m4t 4032 3024 brown 0.6666", width: 4000,
    height: 3000, capture_time: 1789721193, altitude: 226.77, centre: 0.1, task: taskA}, more);

function respond(byTask) {
    return jest.fn(url => {
        const id = url.split("/").pop();
        const body = byTask[id];
        if (body instanceof Error) return Promise.resolve({ok: false, status: 400, json: () => Promise.resolve({detail: body.message})});
        return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({frames: body})});
    });
}

afterEach(() => { document.body.innerHTML = ""; });

test("a map's tasks with cameras are found once each, from its tiles", () => {
    const tiles = [{meta: {task: taskA}}, {meta: {task: taskA}}, {meta: {task: {id: "c", project: 3, camera_shots: ""}}},
        {meta: {task: taskB}}, {meta: {}}];
    expect(sf.tasksWithCameras(tiles).map(t => t.id)).toEqual(["a", "b"]);
    expect(sf.tasksWithCameras(undefined)).toEqual([]);
});

test("the photos are asked of each task with the spot and the CSRF token, and merged by how near the spot is to their centre", async () => {
    document.cookie = "csrftoken=tok123";
    const fetch = respond({
        a: [{filename: "a1.jpg", centre: 0.2}, {filename: "a2.jpg", centre: 0.4}],
        b: [{filename: "b1.jpg", centre: 0.1}]
    });
    const place = {type: "Point", coordinates: [1, 2]};
    const signal = {};
    const result = await sf.findFrames(fetch, document, [taskA, taskB], place, signal);
    expect(fetch.mock.calls[0][0]).toBe("/api/plugins/tweakui/frames/3/a");
    expect(fetch.mock.calls[0][1]).toMatchObject({method: "POST", credentials: "same-origin", headers: {"X-CSRFToken": "tok123"}, signal});
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(place);
    expect(result.frames.map(f => f.filename)).toEqual(["b1.jpg", "a1.jpg", "a2.jpg"]);
    expect(result.frames[0].task).toBe(taskB);
    expect(result.errors).toEqual([]);
});

test("a task whose photos can't be found says why, named when the map has several", async () => {
    const fetch = respond({a: new Error("This task has no cameras"), b: [{filename: "b1.jpg", centre: 0}]});
    const result = await sf.findFrames(fetch, document, [taskA, taskB], {type: "Point", coordinates: [1, 2]});
    expect(result.errors).toEqual(["TestRGB: This task has no cameras"]);
    expect(result.frames.map(f => f.filename)).toEqual(["b1.jpg"]);
    const one = await sf.findFrames(respond({a: new Error("No")}), document, [taskA], {type: "Point", coordinates: [1, 2]});
    expect(one.errors).toEqual(["No"]);
});

test("the spot is drawn on a photo as a ring, round whatever the photo's shape", () => {
    const spot = sf.overlay(document, frame("a.jpg", {spot: [0.25, 0.75]}));
    const rings = spot.querySelectorAll("ellipse");
    expect(rings.length).toBe(2);
    expect(rings[1].getAttribute("cx")).toBe("0.25");
    expect(rings[1].getAttribute("cy")).toBe("0.75");
    // Round on a 4:3 photo
    expect(Number(rings[1].getAttribute("rx")) * 4000).toBeCloseTo(Number(rings[1].getAttribute("ry")) * 3000);
    expect(sf.overlay(document, frame("a.jpg")).children.length).toBe(0);
});

test("the window lists the photos best first and shows the chosen one with its properties, full frame and download", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onClose = jest.fn();
    const w = sf.buildWindow(document, window, container, {multiple: false}, onClose);
    expect(container.querySelector(".tweakui-sf-message").textContent).toBe("Finding the photos…");
    w.show({frames: [frame("a b.jpg", {spot: [0.5, 0.5]}), frame("c.jpg", {spot: [0.1, 0.2]})], errors: []});
    expect(container.querySelector(".tweakui-sf-title").textContent).toBe("Source Frames (2)");
    const items = container.querySelectorAll(".tweakui-sf-item");
    expect(Array.from(items).map(i => i.textContent)).toEqual(["#1", "#2"]);
    expect(items[0].querySelector("img").getAttribute("src")).toBe("/api/projects/3/tasks/a/images/thumbnail/a%20b.jpg?size=160");
    expect(items[0].classList.contains("active")).toBe(true);
    const props = () => Array.from(container.querySelectorAll(".tweakui-sf-props tr")).map(r => [r.children[0].textContent, r.children[1].textContent]);
    expect(props()).toEqual([["File", "a b.jpg"], ["Captured", new Date(1789721193000).toLocaleString()],
        ["Camera", "dji m4t 4032 3024 brown 0.6666"], ["Size", "4000 × 3000 px"], ["Camera altitude", "226.8 m"]]);
    expect(container.querySelector(".tweakui-sf-main-photo img").getAttribute("src")).toContain("a%20b.jpg?size=1024");
    expect(container.querySelector(".tweakui-sf-main-photo ellipse")).not.toBeNull();
    expect(container.querySelector(".tweakui-sf-download").getAttribute("data-href")).toBe("/api/projects/3/tasks/a/images/download/a%20b.jpg");
    items[1].click();
    expect(items[1].classList.contains("active")).toBe(true);
    expect(props()[0]).toEqual(["File", "c.jpg"]);
    // The full frame, then the window's close
    container.querySelector(".tweakui-sf-open").click();
    expect(document.querySelector(".tweakui-sf-viewer img").getAttribute("src")).toContain("c.jpg?size=99999999");
    container.querySelector(".tweakui-sf-close").click();
    expect(document.querySelector(".tweakui-sf-viewer")).toBeNull();
    expect(container.querySelector(".tweakui-sf-window")).toBeNull();
    expect(onClose).toHaveBeenCalled();
});

test("a new spot's photos replace the window's in place, as if opened fresh: the best one chosen, the full frame closed", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const w = sf.buildWindow(document, window, container, {multiple: false});
    w.show({frames: [frame("a.jpg"), frame("b.jpg")], errors: []});
    w.element.style.left = "40px";
    container.querySelectorAll(".tweakui-sf-item")[1].click();
    container.querySelector(".tweakui-sf-open").click();
    w.busy(true);
    const spinner = container.querySelector(".tweakui-sf-busy");
    expect(spinner.style.display).toBe("");
    // The list stays while the new photos are found
    expect(container.querySelectorAll(".tweakui-sf-item").length).toBe(2);
    w.show({frames: [frame("c.jpg"), frame("d.jpg"), frame("e.jpg")], errors: []});
    expect(spinner.style.display).toBe("none");
    expect(document.querySelector(".tweakui-sf-viewer")).toBeNull();
    expect(container.querySelectorAll(".tweakui-sf-window").length).toBe(1);
    expect(w.element.style.left).toBe("40px");
    expect(container.querySelector(".tweakui-sf-item.active").textContent).toBe("#1");
    expect(container.querySelector(".tweakui-sf-props td").textContent).toBe("c.jpg");
});

test("a spot no photo shows says so; a map of several tasks names each photo's", () => {
    const container = document.createElement("div");
    const w = sf.buildWindow(document, window, container, {multiple: true});
    w.show({frames: [], errors: []});
    expect(container.querySelector(".tweakui-sf-body").textContent).toBe("No photo shows this spot.");
    const w2 = sf.buildWindow(document, window, container, {multiple: true});
    w2.show({frames: [frame("b.jpg", {task: taskB, spot: [0.5, 0.5]})], errors: ["TestRGB: Error 500"]});
    expect(w2.element.querySelector(".text-danger").textContent).toBe("TestRGB: Error 500");
    expect(w2.element.querySelector(".tweakui-sf-caption").textContent).toBe("#1");
    expect(w2.element.querySelector(".tweakui-sf-props").textContent).toContain("TaskTestThermal");
});

test("the full-screen viewer goes through the photos with the arrow keys, zooms, and Escape closes it", () => {
    const onClose = jest.fn();
    const frames = [frame("a.jpg"), frame("b.jpg"), frame("c.jpg")];
    const win = {location: {assign: jest.fn()}};
    const v = sf.viewer(document, win, frames, 0, onClose);
    const name = () => document.querySelector(".tweakui-sf-viewer-name").textContent;
    expect(name()).toBe("1 / 3 · a.jpg");
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowLeft"}));
    expect(name()).toBe("3 / 3 · c.jpg");
    expect(document.querySelector(".tweakui-sf-viewer [aria-label=Download]").getAttribute("data-href")).toContain("/images/download/c.jpg");
    document.querySelector(".tweakui-sf-viewer [aria-label=Download]").click();
    expect(win.location.assign).toHaveBeenCalledWith("/api/projects/3/tasks/a/images/download/c.jpg");
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight"}));
    expect(name()).toBe("1 / 3 · a.jpg");
    document.querySelector(".tweakui-sf-viewer [aria-label='Zoom in']").click();
    expect(document.querySelector(".tweakui-sf-viewer-photo").style.transform).toBe("translate(0px, 0px) scale(1.5)");
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
    expect(document.querySelector(".tweakui-sf-viewer")).toBeNull();
    expect(onClose).toHaveBeenCalledWith(0);
    expect(v.element.isConnected).toBe(false);
});

// Leaflet's map as far as the 2D tool uses it: a container, and positions as the pixels themselves
function fakeMap() {
    const container = document.createElement("div");
    container.className = "leaflet-container";
    document.body.appendChild(container);
    const point = (x, y) => ({x, y, distanceTo: p => Math.hypot(p.x - x, p.y - y)});
    const added = [];
    const map = {
        getContainer: () => container,
        mouseEventToLatLng: e => ({lat: e.clientY, lng: e.clientX}),
        latLngToContainerPoint: ll => point(ll.lng, ll.lat),
        removeLayer: jest.fn(l => added.splice(added.indexOf(l), 1)),
        added
    };
    const layer = kind => (latlngs, options) => ({kind, latlngs, options, addTo(m) { m.added.push(this); return this; }});
    const L = {circleMarker: (latlng, options) => Object.assign(layer("circle")(latlng, options), {setLatLng(ll) { this.latlngs = ll; }})};
    return {map, L, container};
}

function click(target, x, y, moved) {
    target.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true, clientX: x, clientY: y}));
    const e = new MouseEvent("click", {bubbles: true, cancelable: true, clientX: x + (moved || 0), clientY: y});
    target.dispatchEvent(e);
    return e;
}

test("on the 2D map each click moves the one spot there, and is TweakUI's alone until it stops", () => {
    const {map, L, container} = fakeMap();
    const control = document.createElement("div");
    control.className = "leaflet-control";
    container.appendChild(control);
    const tool = sf.mapTool(L, map);
    const onSpot = jest.fn();
    const mapClick = jest.fn();
    container.addEventListener("click", mapClick);
    tool.start(onSpot);
    // A drag that pans the map is not a click, nor one on a control
    click(container, 10, 20, 30);
    click(control, 300, 300);
    expect(onSpot).not.toHaveBeenCalled();
    click(container, 10, 20);
    expect(onSpot).toHaveBeenLastCalledWith({type: "Point", coordinates: [10, 20]});
    // Not a layer's popup of WebODM's
    expect(mapClick).toHaveBeenCalledTimes(1);
    click(container, 50, 60);
    expect(onSpot).toHaveBeenLastCalledWith({type: "Point", coordinates: [50, 60]});
    expect(map.added.map(l => [l.kind, l.latlngs])).toEqual([["circle", {lat: 60, lng: 50}]]);
    tool.stop();
    expect(map.added).toEqual([]);
    click(container, 70, 70);
    expect(onSpot).toHaveBeenCalledTimes(2);
    expect(mapClick).toHaveBeenCalledTimes(2);
});

function controlled(byTask) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let spot;
    const tool = {start: jest.fn(f => { spot = f; }), stop: jest.fn()};
    const win = {fetch: respond(byTask), AbortController: class { constructor() { this.signal = {}; } abort() { this.signal.aborted = true; } }};
    win.fetch.bind = () => win.fetch;
    const onChange = jest.fn();
    const c = sf.controller(document, win, container, tool, [taskA], onChange);
    return {container, tool, win, onChange, c, spot: p => spot(p)};
}

test("on, Source Frames shows its label the whole time, the first spot opens the window and later ones update it", async () => {
    const {container, tool, win, onChange, c, spot} = controlled({a: [{filename: "a.jpg", centre: 0, spot: [0.5, 0.5]}]});
    c.toggle();
    expect(c.isOn()).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(true);
    const label = () => container.querySelector(".tweakui-sf-label");
    expect(label().textContent).toBe(" Click Map to View Source Frame");
    expect(container.querySelector(".tweakui-sf-window")).toBeNull();
    spot({type: "Point", coordinates: [1, 2]});
    await flush(); await flush();
    expect(container.querySelector(".tweakui-sf-title").textContent).toBe("Source Frames (1)");
    expect(label()).not.toBeNull();
    // The next spot: the same window, busy until its photos come
    win.fetch.mockImplementation(() => Promise.resolve({ok: true, status: 200,
        json: () => Promise.resolve({frames: [{filename: "b.jpg", centre: 0, spot: [0.2, 0.2]}, {filename: "c.jpg", centre: 0.5, spot: [0.9, 0.9]}]})}));
    const first = container.querySelector(".tweakui-sf-window");
    spot({type: "Point", coordinates: [3, 4]});
    expect(container.querySelector(".tweakui-sf-busy").style.display).toBe("");
    await flush(); await flush();
    expect(container.querySelector(".tweakui-sf-window")).toBe(first);
    expect(container.querySelector(".tweakui-sf-title").textContent).toBe("Source Frames (2)");
    expect(label()).not.toBeNull();
    expect(tool.start).toHaveBeenCalledTimes(1);
});

test("only the latest spot's photos are shown, the older request cancelled", async () => {
    const {container, win, c, spot} = controlled({});
    const answers = [];
    win.fetch.mockImplementation((url, options) => new Promise(resolve => answers.push({resolve, options})));
    c.toggle();
    spot({type: "Point", coordinates: [1, 2]});
    spot({type: "Point", coordinates: [3, 4]});
    expect(answers[0].options.signal.aborted).toBe(true);
    expect(answers[1].options.signal.aborted).toBeUndefined();
    const reply = names => ({ok: true, status: 200, json: () => Promise.resolve({frames: names.map(n => ({filename: n, centre: 0}))})});
    answers[1].resolve(reply(["new.jpg"]));
    await flush(); await flush();
    answers[0].resolve(reply(["old1.jpg", "old2.jpg"]));
    await flush(); await flush();
    expect(container.querySelector(".tweakui-sf-props td").textContent).toBe("new.jpg");
});

test("the button again, Escape, or the window's close turns Source Frames off: the label, the spot and the window go", async () => {
    const {container, tool, onChange, c, spot} = controlled({a: [{filename: "a.jpg", centre: 0}]});
    const ends = [
        () => c.toggle(),
        () => document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"})),
        () => container.querySelector(".tweakui-sf-close").click()
    ];
    for (const end of ends) {
        c.toggle();
        spot({type: "Point", coordinates: [1, 2]});
        await flush(); await flush();
        expect(container.classList.contains("tweakui-sf-picking")).toBe(true);
        end();
        expect(c.isOn()).toBe(false);
        expect(onChange).toHaveBeenLastCalledWith(false);
        expect(container.querySelector(".tweakui-sf-label")).toBeNull();
        expect(container.querySelector(".tweakui-sf-window")).toBeNull();
        expect(container.classList.contains("tweakui-sf-picking")).toBe(false);
    }
    expect(tool.stop).toHaveBeenCalledTimes(3);
    // Escape in the full-screen viewer closes only the viewer
    c.toggle();
    spot({type: "Point", coordinates: [1, 2]});
    await flush(); await flush();
    container.querySelector(".tweakui-sf-open").click();
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
    expect(document.querySelector(".tweakui-sf-viewer")).toBeNull();
    expect(c.isOn()).toBe(true);
    c.toggle();
});

test("with Source Frames on, the button goes before Share on a 2D map or 3D view whose task has cameras", () => {
    const mapHook = jest.fn();
    const win = settings => ({TweakUI: {settings}, L: {}, Potree: {}, THREE: {}, setTimeout: f => f(),
        PluginsAPI: {Map: {didAddControls: mapHook}}, fetch: jest.fn()});
    sf.start(document, win({source_frames_2d: false, source_frames_3d: false}));
    expect(mapHook).not.toHaveBeenCalled();

    // WebODM's map: its container, and beside it the action buttons (a plugin's in a div, Share, 3D)
    document.body.innerHTML = '<div><div id="map"></div><div class="actionButtons"><div><button id="snap"></button></div>' +
        '<div class="shareButton"></div><button class="switchModeButton"></button></div></div>';
    const map = {getContainer: () => document.getElementById("map")};
    sf.start(document, win({source_frames_2d: true}));
    // Not WebODM's addActionButton, which keeps only the first answers (Snapshot's would be left out)
    expect(typeof mapHook.mock.calls[0][0]).toBe("function");
    mapHook.mock.calls[0][0]({map, tiles: [{meta: {task: {id: "c", project: 3, camera_shots: ""}}}]});
    expect(document.querySelector(".tweakui-sf-button")).toBeNull();
    mapHook.mock.calls[0][0]({map, tiles: [{meta: {task: taskA}}]});
    const row = document.querySelector(".actionButtons");
    expect(Array.from(row.children).map(c => c.id || c.className)).toEqual(["", "tweakui-sf-action", "shareButton", "switchModeButton"]);
    expect(row.children[0].querySelector("#snap")).not.toBeNull();
    // Once only
    mapHook.mock.calls[0][0]({map, tiles: [{meta: {task: taskA}}]});
    expect(document.querySelectorAll(".tweakui-sf-button").length).toBe(1);
    const button = document.querySelector(".tweakui-sf-button");
    button.click();
    expect(document.querySelector("#map .tweakui-sf-label")).not.toBeNull();
    expect(button.classList.contains("active")).toBe(true);
    button.click();
    expect(document.querySelector("#map .tweakui-sf-label")).toBeNull();
    expect(button.classList.contains("active")).toBe(false);

    // The 3D view: its task on [data-modelview], its viewer as window.viewer, its action buttons' row
    const page3d = assets => '<div data-modelview data-task=\'{"id": "a", "project": 3, "available_assets": ' + JSON.stringify(assets) +
        '}\'><div class="model-action-buttons"><div class="shareButton"></div></div></div>';
    const viewer = {renderer: {domElement: document.createElement("canvas")}, scene: {}, renderArea: document.createElement("div")};
    document.body.innerHTML = page3d(["shots.geojson"]);
    expect(sf.modelTask(document)).toEqual({id: "a", project: 3, available_assets: ["shots.geojson"]});
    sf.start(document, Object.assign(win({source_frames_3d: true}), {viewer}));
    expect(document.querySelector(".model-action-buttons").firstElementChild.className).toBe("tweakui-sf-action");
    document.body.innerHTML = page3d([]);
    sf.start(document, Object.assign(win({source_frames_3d: true}), {viewer}));
    expect(document.querySelector(".tweakui-sf-button")).toBeNull();
});

// three.js and Potree as far as the 3D tool uses them
function fake3d(hit) {
    class Vector3 {
        constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
        clone() { return new Vector3(this.x, this.y, this.z); }
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
        distanceTo(v) { return Math.hypot(v.x - this.x, v.y - this.y, v.z - this.z); }
        project() { return new Vector3(0, 0, 0); }
    }
    class Object3D {
        constructor() { this.children = []; this.parent = null; this.position = new Vector3(0, 0, 0); }
        add(o) { o.parent = this; this.children.push(o); }
        remove(o) { this.children.splice(this.children.indexOf(o), 1); o.parent = null; }
        traverse(f) { f(this); this.children.forEach(c => c.traverse(f)); }
        traverseVisible(f) { this.traverse(f); }
    }
    class Mesh extends Object3D { constructor(geometry, material) { super(); this.isMesh = true; this.geometry = geometry; this.material = material; } }
    class Line extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }
    const disposable = class { dispose() {} };
    const THREE = {
        Vector3, Vector2: class {}, Group: Object3D, Mesh, Line, LineLoop: class extends Line {},
        SphereGeometry: disposable, MeshBasicMaterial: disposable, LineBasicMaterial: disposable,
        BufferGeometry: class extends disposable { setFromPoints(p) { this.points = p; return this; } },
        Raycaster: class { setFromCamera() {} intersectObjects() { return []; } }
    };
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    canvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 800, height: 600});
    const scene = new Object3D();
    const viewer = {
        renderer: {domElement: canvas},
        scene: {scene, pointclouds: [{visible: true}], getActiveCamera: () => ({position: new Vector3(0, 0, 100)}),
            addMeasurement: jest.fn(), removeMeasurement: jest.fn()}
    };
    const Potree = {Utils: {getMousePointCloudIntersection: jest.fn(() => hit && {location: new Vector3(hit[0], hit[1], hit[2])})}};
    return {win: {THREE, Potree}, viewer, canvas, scene};
}

function tap3d(canvas, x, y) {
    canvas.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true, clientX: x, clientY: y, button: 0}));
    canvas.dispatchEvent(new MouseEvent("pointerup", {bubbles: true, clientX: x, clientY: y, button: 0}));
}

test("in the 3D view each click on the points moves the one spot there, in the task's coordinates, without Potree's saved measurements", () => {
    const {win, viewer, canvas, scene} = fake3d([410975.5, 4661820.25, 211.5]);
    const tool = sf.modelTool(win, viewer);
    const onSpot = jest.fn();
    tool.start(onSpot);
    // A drag orbits the view: no spot
    canvas.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true, clientX: 10, clientY: 10, button: 0}));
    canvas.dispatchEvent(new MouseEvent("pointerup", {bubbles: true, clientX: 60, clientY: 10, button: 0}));
    expect(onSpot).not.toHaveBeenCalled();
    tap3d(canvas, 400, 300);
    expect(onSpot).toHaveBeenCalledWith({type: "Point", coordinates: [410975.5, 4661820.25, 211.5], crs: "task"});
    tap3d(canvas, 200, 100);
    expect(onSpot).toHaveBeenCalledTimes(2);
    // WebODM saves Potree's measurements with the task: none is added
    expect(viewer.scene.addMeasurement).not.toHaveBeenCalled();
    const marks = scene.children.find(c => c.name === "tweakui-source-frames");
    expect(marks.children.length).toBe(1);
    tool.stop();
    expect(scene.children).toEqual([]);
    tap3d(canvas, 400, 300);
    expect(onSpot).toHaveBeenCalledTimes(2);
});

test("in the 3D view a click on nothing says so and leaves the spot", () => {
    const empty = fake3d(null);
    const tool = sf.modelTool(empty.win, empty.viewer);
    tool.hint = jest.fn();
    const onSpot = jest.fn();
    tool.start(onSpot);
    tap3d(empty.canvas, 400, 300);
    expect(tool.hint).toHaveBeenCalledWith("Nothing there: click on the points or the model.");
    expect(onSpot).not.toHaveBeenCalled();
    tool.stop();
});

test("the full-frame viewer takes the focus, and gives it back to what opened it or to the photo chosen in it", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const w = sf.buildWindow(document, window, container, {multiple: false});
    w.show({frames: [frame("a.jpg"), frame("b.jpg")], errors: []});
    const open = () => w.element.querySelector(".tweakui-sf-open");
    const first = open();
    first.focus();
    first.click();
    expect(document.activeElement.getAttribute("aria-label")).toBe("Close");
    expect(document.activeElement.closest(".tweakui-sf-viewer")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
    expect(document.activeElement).toBe(first);

    // Another photo chosen in the viewer: the window shows it, and its Open Full Frame button has the focus
    first.click();
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight"}));
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
    expect(first.isConnected).toBe(false);
    expect(document.activeElement).toBe(open());
    expect(w.element.querySelector(".tweakui-sf-props").textContent).toContain("b.jpg");

    // Opened by a click on the photo, which takes no focus: back to the Open Full Frame button
    document.body.focus();
    w.element.querySelector(".tweakui-sf-main-photo").click();
    document.querySelector(".tweakui-sf-viewer [aria-label=Close]").click();
    expect(document.activeElement).toBe(open());
});
