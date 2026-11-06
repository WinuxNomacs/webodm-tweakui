const sf = require("../source_frames");

const flush = () => new Promise(r => setTimeout(r, 0));
const taskA = {id: "a", project: 3, name: "TestRGB", camera_shots: "/api/projects/3/tasks/a/download/shots.geojson"};
const taskB = {id: "b", project: 3, name: "TestThermal", camera_shots: "/api/projects/3/tasks/b/download/shots.geojson"};
const frame = (name, more) => Object.assign({filename: name, camera: "v2 dji m4t 4032 3024 brown 0.6666", width: 4000,
    height: 3000, capture_time: 1789721193, altitude: 226.77, share: 1, centre: 0.1, task: taskA}, more);

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

test("the photos are asked of each task with the place and the CSRF token, and merged best first", async () => {
    document.cookie = "csrftoken=tok123";
    const fetch = respond({
        a: [{filename: "a1.jpg", share: 0.5, centre: 0.2}, {filename: "a2.jpg", share: 1, centre: 0.4}],
        b: [{filename: "b1.jpg", share: 1, centre: 0.1}]
    });
    const place = {type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]]};
    const result = await sf.findFrames(fetch, document, [taskA, taskB], place);
    expect(fetch.mock.calls[0][0]).toBe("/api/plugins/tweakui/frames/3/a");
    expect(fetch.mock.calls[0][1]).toMatchObject({method: "POST", credentials: "same-origin", headers: {"X-CSRFToken": "tok123"}});
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(place);
    // An area: by share, then by how near the centre
    expect(result.frames.map(f => f.filename)).toEqual(["b1.jpg", "a2.jpg", "a1.jpg"]);
    expect(result.frames[0].task).toBe(taskB);
    expect(result.errors).toEqual([]);
    // A spot: by how near the centre only
    expect(sf.merge([{task: taskA, frames: [{filename: "x", share: 1, centre: 0.3}, {filename: "y", share: 1, centre: 0.1}]}], false)
        .map(f => f.filename)).toEqual(["y", "x"]);
});

test("a task whose photos can't be found says why, named when the map has several", async () => {
    const fetch = respond({a: new Error("This task has no cameras"), b: [{filename: "b1.jpg", share: 1, centre: 0}]});
    const result = await sf.findFrames(fetch, document, [taskA, taskB], {type: "Point", coordinates: [1, 2]});
    expect(result.errors).toEqual(["TestRGB: This task has no cameras"]);
    expect(result.frames.map(f => f.filename)).toEqual(["b1.jpg"]);
    const one = await sf.findFrames(respond({a: new Error("No")}), document, [taskA], {type: "Point", coordinates: [1, 2]});
    expect(one.errors).toEqual(["No"]);
});

test("the place is drawn on a photo: a ring round a spot, an area's outline", () => {
    const spot = sf.overlay(document, frame("a.jpg", {spot: [0.25, 0.75]}));
    const rings = spot.querySelectorAll("ellipse");
    expect(rings.length).toBe(2);
    expect(rings[1].getAttribute("cx")).toBe("0.25");
    expect(rings[1].getAttribute("cy")).toBe("0.75");
    // Round on a 4:3 photo
    expect(Number(rings[1].getAttribute("rx")) * 4000).toBeCloseTo(Number(rings[1].getAttribute("ry")) * 3000);
    const area = sf.overlay(document, frame("a.jpg", {outline: [[0.1, 0.2], [0.9, 0.2], [0.5, 1.4]]}));
    expect(area.querySelector("polygon.tweakui-sf-outline").getAttribute("points")).toBe("0.1,0.2 0.9,0.2 0.5,1.4");
    expect(sf.overlay(document, frame("a.jpg", {outline: null})).children.length).toBe(0);
});

test("the window lists the photos best first and shows the chosen one with its properties, full frame and download", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onClose = jest.fn();
    const w = sf.buildWindow(document, window, container, {area: true, multiple: false}, onClose);
    expect(container.querySelector(".tweakui-sf-message").textContent).toBe("Finding the photos…");
    w.show({frames: [frame("a b.jpg", {share: 0.9, outline: [[0, 0], [1, 0], [1, 1]]}), frame("c.jpg", {share: 0.4})], errors: []});
    expect(container.querySelector(".tweakui-sf-title").textContent).toBe("Source Frames (2)");
    const items = container.querySelectorAll(".tweakui-sf-item");
    expect(Array.from(items).map(i => i.textContent)).toEqual(["90%", "40%"]);
    expect(items[0].querySelector("img").getAttribute("src")).toBe("/api/projects/3/tasks/a/images/thumbnail/a%20b.jpg?size=160");
    expect(items[0].classList.contains("active")).toBe(true);
    const props = () => Array.from(container.querySelectorAll(".tweakui-sf-props tr")).map(r => [r.children[0].textContent, r.children[1].textContent]);
    expect(props()).toEqual([["File", "a b.jpg"], ["Area shown", "90%"], ["Captured", new Date(1789721193000).toLocaleString()],
        ["Camera", "dji m4t 4032 3024 brown 0.6666"], ["Size", "4000 × 3000 px"], ["Camera altitude", "226.8 m"]]);
    expect(container.querySelector(".tweakui-sf-main-photo img").getAttribute("src")).toContain("a%20b.jpg?size=1024");
    expect(container.querySelector(".tweakui-sf-main-photo polygon")).not.toBeNull();
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
    expect(onClose).toHaveBeenCalledWith(false);
});

test("a place no photo shows says so; a map of several tasks names each photo's", () => {
    const container = document.createElement("div");
    const w = sf.buildWindow(document, window, container, {area: false, multiple: true});
    w.show({frames: [], errors: []});
    expect(container.querySelector(".tweakui-sf-body").textContent).toBe("No photo shows this spot.");
    const w2 = sf.buildWindow(document, window, container, {area: false, multiple: true});
    w2.show({frames: [frame("b.jpg", {task: taskB, spot: [0.5, 0.5]})], errors: ["TestRGB: Error 500"]});
    expect(w2.element.querySelector(".text-danger").textContent).toBe("TestRGB: Error 500");
    expect(w2.element.querySelector(".tweakui-sf-caption").textContent).toBe("#1");
    expect(w2.element.querySelector(".tweakui-sf-props").textContent).toContain("TaskTestThermal");
    expect(w2.element.querySelector(".tweakui-sf-props").textContent).not.toContain("Area shown");
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
    const L = {polygon: layer("polygon"), polyline: layer("polyline"), circleMarker: layer("circle")};
    return {map, L, container};
}

function click(target, x, y, moved) {
    target.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true, clientX: x, clientY: y}));
    const e = new MouseEvent("click", {bubbles: true, cancelable: true, clientX: x + (moved || 0), clientY: y});
    target.dispatchEvent(e);
    return e;
}

test("on the 2D map a click is a spot, and is TweakUI's alone (not a layer's popup of WebODM's)", () => {
    const {map, L, container} = fakeMap();
    const tool = sf.mapTool(L, map);
    const done = jest.fn();
    const mapClick = jest.fn();
    container.addEventListener("click", mapClick);
    tool.start("spot", done);
    // A drag that pans the map is not a click
    click(container, 10, 20, 30);
    expect(done).not.toHaveBeenCalled();
    click(container, 10, 20);
    expect(done).toHaveBeenCalledWith({type: "Point", coordinates: [10, 20]});
    expect(mapClick).not.toHaveBeenCalled();
    expect(map.added.map(l => l.kind)).toEqual(["circle"]);
    // Picking is over: the map has its clicks back
    click(container, 50, 50);
    expect(mapClick).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
    tool.clear();
    expect(map.added).toEqual([]);
});

test("on the 2D map an area is drawn corner by corner and finished on its first corner, controls left alone", () => {
    const {map, L, container} = fakeMap();
    const control = document.createElement("div");
    control.className = "leaflet-control";
    container.appendChild(control);
    const tool = sf.mapTool(L, map);
    const done = jest.fn();
    tool.start("area", done);
    click(container, 0, 0);
    click(container, 100, 0);
    click(control, 300, 300);
    click(container, 100, 100);
    expect(map.added.map(l => l.kind)).toEqual(["polygon"]);
    click(container, 5, 5);
    expect(done).toHaveBeenCalledWith({type: "Polygon", coordinates: [[[0, 0], [100, 0], [100, 100], [0, 0]]]});
    // A double click finishes one too
    tool.start("area", done);
    click(container, 0, 0); click(container, 10, 0); click(container, 10, 10);
    container.dispatchEvent(new MouseEvent("dblclick", {bubbles: true, cancelable: true}));
    expect(done).toHaveBeenCalledTimes(2);
    // Two corners are no area
    tool.start("area", done);
    click(container, 0, 0); click(container, 10, 0);
    tool.finish();
    expect(done).toHaveBeenCalledTimes(2);
    tool.cancel();
});

test("the bar starts with Spot, shows Finish while an area is drawn, and Escape stops picking", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const tool = {start: jest.fn(), cancel: jest.fn(), finish: jest.fn(), clear: jest.fn()};
    const onPlace = jest.fn(), onClose = jest.fn();
    sf.buildBar(document, window, container, tool, onPlace, onClose);
    const bar = container.querySelector(".tweakui-sf-bar");
    expect(tool.start.mock.calls[0][0]).toBe("spot");
    expect(bar.querySelector(".tweakui-sf-spot").classList.contains("active")).toBe(true);
    expect(bar.querySelector(".tweakui-sf-finish").style.display).toBe("none");
    expect(container.classList.contains("tweakui-sf-picking")).toBe(true);
    bar.querySelector(".tweakui-sf-area").click();
    expect(tool.start.mock.calls[1][0]).toBe("area");
    expect(bar.querySelector(".tweakui-sf-finish").style.display).toBe("");
    bar.querySelector(".tweakui-sf-finish").click();
    expect(tool.finish).toHaveBeenCalled();
    // The tool gives the place: picking ends and the place goes on
    tool.start.mock.calls[1][1]({type: "Polygon", coordinates: []});
    expect(onPlace).toHaveBeenCalled();
    expect(container.classList.contains("tweakui-sf-picking")).toBe(false);
    bar.querySelector(".tweakui-sf-spot").click();
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
    expect(container.classList.contains("tweakui-sf-picking")).toBe(false);
    bar.querySelector(".tweakui-sf-bar-close").click();
    expect(container.querySelector(".tweakui-sf-bar")).toBeNull();
    expect(onClose).toHaveBeenCalled();
});

test("the button opens the bar, a place opens the window of its photos, and a new place keeps its own drawing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let give;
    const tool = {start: jest.fn((kind, done) => { give = done; }), cancel: jest.fn(), finish: jest.fn(), clear: jest.fn()};
    const win = {fetch: respond({a: [{filename: "a.jpg", share: 1, centre: 0, spot: [0.5, 0.5]}]})};
    win.fetch.bind = () => win.fetch;
    const c = sf.controller(document, win, container, tool, [taskA]);
    c.toggle();
    expect(c.isOpen()).toBe(true);
    give({type: "Point", coordinates: [1, 2]});
    await flush(); await flush();
    expect(container.querySelector(".tweakui-sf-title").textContent).toBe("Source Frames (1)");
    tool.start.mock.calls.length = 0;
    container.querySelector(".tweakui-sf-area").click();
    give({type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]]});
    expect(tool.clear).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".tweakui-sf-window").length).toBe(1);
    // Closing the window clears the place; closing the bar too
    container.querySelector(".tweakui-sf-close").click();
    expect(tool.clear).toHaveBeenCalledTimes(1);
    c.toggle();
    expect(c.isOpen()).toBe(false);
    expect(container.querySelector(".tweakui-sf-bar")).toBeNull();
});

test("with Source Frames on, the 2D map and the 3D view get the button when their task has cameras", () => {
    const mapHook = jest.fn(), modelHook = jest.fn();
    const React = {createElement: jest.fn((tag, props) => ({tag, props}))};
    const win = settings => ({TweakUI: {settings}, React, L: {}, Potree: {}, THREE: {},
        PluginsAPI: {Map: {addActionButton: mapHook}, ModelView: {addActionButton: modelHook}}, fetch: jest.fn()});
    sf.start(document, win({source_frames_2d: false, source_frames_3d: false}));
    expect(mapHook).not.toHaveBeenCalled();
    expect(modelHook).not.toHaveBeenCalled();

    sf.start(document, win({source_frames_2d: true, source_frames_3d: true}));
    // Without dependencies: WebODM keeps only the buttons that answer first
    expect(typeof mapHook.mock.calls[0][0]).toBe("function");
    const map = {getContainer: () => document.createElement("div")};
    const button = mapHook.mock.calls[0][0]({map, tiles: [{meta: {task: taskA}}]});
    expect(button.tag).toBe("button");
    expect(button.props.className).toContain("tweakui-sf-button");
    expect(mapHook.mock.calls[0][0]({map, tiles: [{meta: {task: {id: "c", project: 3, camera_shots: ""}}}]})).toBeNull();

    document.body.innerHTML = '<div data-modelview data-task=\'{"id": "a", "project": 3, "available_assets": ["shots.geojson"]}\'></div>';
    expect(sf.modelTask(document)).toEqual({id: "a", project: 3, available_assets: ["shots.geojson"]});
    expect(modelHook.mock.calls[0][0]({viewer: {}}).tag).toBe("button");
    document.body.innerHTML = '<div data-modelview data-task=\'{"id": "a", "project": 3, "available_assets": []}\'></div>';
    expect(modelHook.mock.calls[0][0]({viewer: {}})).toBeNull();
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

test("in the 3D view a click on the points is a spot in the task's coordinates, marked without Potree's saved measurements", () => {
    const {win, viewer, canvas, scene} = fake3d([410975.5, 4661820.25, 211.5]);
    const tool = sf.modelTool(win, viewer);
    const done = jest.fn();
    tool.start("spot", done);
    // A drag orbits the view: no spot
    canvas.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true, clientX: 10, clientY: 10, button: 0}));
    canvas.dispatchEvent(new MouseEvent("pointerup", {bubbles: true, clientX: 60, clientY: 10, button: 0}));
    expect(done).not.toHaveBeenCalled();
    tap3d(canvas, 400, 300);
    expect(done).toHaveBeenCalledWith({type: "Point", coordinates: [410975.5, 4661820.25, 211.5], crs: "task"});
    // WebODM saves Potree's measurements with the task: none is added
    expect(viewer.scene.addMeasurement).not.toHaveBeenCalled();
    const marks = scene.children.find(c => c.name === "tweakui-source-frames");
    expect(marks.children.length).toBe(1);
    tool.clear();
    expect(scene.children).toEqual([]);
});

test("in the 3D view an area takes its corners and Finish; a click on nothing says so", () => {
    const empty = fake3d(null);
    const missTool = sf.modelTool(empty.win, empty.viewer);
    missTool.hint = jest.fn();
    missTool.start("spot", jest.fn());
    tap3d(empty.canvas, 400, 300);
    expect(missTool.hint).toHaveBeenCalledWith("Nothing there: click on the points or the model.");
    missTool.clear();

    const {win, viewer, canvas, scene} = fake3d([1, 2, 3]);
    const tool = sf.modelTool(win, viewer);
    const done = jest.fn();
    tool.start("area", done);
    tap3d(canvas, 100, 100); tap3d(canvas, 300, 100); tap3d(canvas, 300, 300);
    tool.finish();
    expect(done).toHaveBeenCalledWith({type: "Polygon", coordinates: [[[1, 2, 3], [1, 2, 3], [1, 2, 3], [1, 2, 3]]], crs: "task"});
    const marks = scene.children.find(c => c.name === "tweakui-source-frames");
    // Three spheres and the closed line through them
    expect(marks.children.length).toBe(4);
    expect(marks.children[3].geometry.points.length).toBe(3);
    tool.clear();
    expect(scene.children).toEqual([]);
});
