const zo = require("../zoom_override");

afterEach(() => { document.body.innerHTML = ""; });

test("the 2D map zooms 3 steps past WebODM's limit", () => {
    const map = {options: {maxZoom: 24}, setMaxZoom: jest.fn()};
    expect(zo.extraZoom(map)).toBe(27);
    expect(map.setMaxZoom).toHaveBeenCalledWith(27);
});

test("a wheel notch goes a tenth of the way along the pointer's ray to the surface, out as far back, never nearer than 5 cm", () => {
    const down = {x: 0, y: 0, z: -1};
    expect(zo.zoomAlong({x: 0, y: 0, z: 100}, down, 100, 1).z).toBeCloseTo(90);
    // Along the ray, whatever the point picked beside it
    const ray = {x: 0.6, y: 0, z: -0.8};
    const to = zo.zoomAlong({x: 0, y: 0, z: 100}, ray, 50, 1);
    expect([to.x, to.z].map(v => +v.toFixed(6))).toEqual([3, 96]);
    expect(zo.zoomAlong({x: 0, y: 0, z: 90}, down, 90, -1).z).toBeCloseTo(100);
    expect(zo.zoomAlong({x: 0, y: 0, z: 0.051}, down, 0.051, 1).z).toBeCloseTo(0.05);
    expect(zo.zoomAlong({x: 0, y: 0, z: 0.05}, down, 0.05, 1)).toBeNull();
    expect(zo.zoomAlong({x: 0, y: 0, z: 1}, down, -1, 1)).toBeNull();
    expect(zo.notch({wheelDelta: 120})).toBe(1);
    expect(zo.notch({wheelDelta: -120})).toBe(-1);
    expect(zo.notch({detail: 3})).toBe(-1);
});

test("a trackpad's small wheel events are each a share of a notch, so a scroll zooms as far as it goes; never more than a notch an event", () => {
    expect(zo.notch({wheelDelta: 12})).toBeCloseTo(0.1);
    expect(zo.notch({wheelDelta: -3})).toBeCloseTo(-0.025);
    expect(zo.notch({wheelDelta: 360})).toBe(1);
    expect(zo.notch({detail: -1})).toBeCloseTo(1 / 3);
    // Ten tenth-notches go as far as one notch
    let pos = {x: 0, y: 0, z: 100};
    for (let i = 0; i < 10; i++) pos = zo.zoomAlong(pos, {x: 0, y: 0, z: -1}, pos.z, 0.1);
    expect(pos.z).toBeCloseTo(90);
});

// A 3D view: the camera 100 m above the ground looking straight down, the point cloud under the pointer at `hit`
function view3d(hit) {
    const area = document.createElement("div");
    const canvas = document.createElement("canvas");
    area.appendChild(canvas);
    document.body.appendChild(area);
    canvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 800, height: 600});
    const vec = (x, y, z) => ({x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; },
        distanceTo(v) { return Math.hypot(v.x - this.x, v.y - this.y, v.z - this.z); }});
    const orbit = {radiusDelta: 5, stopTweens: jest.fn()};
    const view = {position: vec(0, 0, 100), direction: {x: 0, y: 0, z: -1}, radius: 100};
    const viewer = {
        renderer: {domElement: canvas}, orbitControls: orbit, controls: orbit, getControls() { return this.controls; },
        scene: {view, pointclouds: [{visible: true}], getActiveCamera: () => ({position: view.position}),
            scene: {traverseVisible() {}}}
    };
    const win = {
        THREE: {Raycaster: class { setFromCamera() {} intersectObjects() { return []; } }, Vector2: class {},
            // The pointer's ray: from the camera toward the point picked (it lies on the ray here)
            Vector3: class {
                unproject() { return this; }
                sub() { return this; }
                normalize() {
                    const p = hit || [0, 0, 0], c = view.position;
                    const d = [p[0] - c.x, p[1] - c.y, p[2] - c.z], l = Math.hypot(...d) || 1;
                    return {x: d[0] / l, y: d[1] / l, z: d[2] / l};
                }
            }},
        Potree: {Utils: {getMousePointCloudIntersection: () => hit && {location: vec(hit[0], hit[1], hit[2])}}}
    };
    return {area, canvas, viewer, view, orbit, win};
}

function wheel(target, wheelDelta) {
    const e = new Event("mousewheel", {bubbles: true, cancelable: true});
    e.wheelDelta = wheelDelta;
    e.clientX = 600;
    e.clientY = 300;
    target.dispatchEvent(e);
    return e;
}

test("in the 3D view the wheel zooms toward the point under the pointer and the orbit centre moves to its depth", () => {
    const {area, canvas, viewer, view, orbit, win} = view3d([20, 0, 10]);
    const potree = jest.fn();
    canvas.addEventListener("mousewheel", potree);
    zo.attach3d(win, viewer);
    const e = wheel(canvas, 120);
    // Potree's own zoom doesn't run
    expect(potree).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
    // A tenth of the way to (20, 0, 10)
    expect(view.position.x).toBeCloseTo(2);
    expect(view.position.z).toBeCloseTo(91);
    // The orbit centre, straight down, as deep as the point
    expect(view.radius).toBeCloseTo(81);
    expect(orbit.radiusDelta).toBe(0);
    expect(orbit.stopTweens).toHaveBeenCalled();
    wheel(canvas, -120);
    expect(view.position.z).toBeCloseTo(100);
    expect(area).toBeTruthy();
});

test("over nothing, in another navigation mode, or with the setting off, the wheel stays Potree's", () => {
    const nothing = view3d(null);
    const potree = jest.fn();
    nothing.canvas.addEventListener("mousewheel", potree);
    zo.attach3d(nothing.win, nothing.viewer);
    wheel(nothing.canvas, 120);
    expect(potree).toHaveBeenCalledTimes(1);
    expect(nothing.view.position.z).toBe(100);

    const earth = view3d([0, 0, 0]);
    earth.viewer.controls = {};
    const potree2 = jest.fn();
    earth.canvas.addEventListener("mousewheel", potree2);
    zo.attach3d(earth.win, earth.viewer);
    wheel(earth.canvas, 120);
    expect(potree2).toHaveBeenCalledTimes(1);

    const mapHook = jest.fn();
    document.body.innerHTML = '<div data-modelview><div class="model-action-buttons"></div></div>';
    const off = view3d([0, 0, 0]);
    zo.start(document, Object.assign({TweakUI: {settings: {zoom_override_2d: false, zoom_override_3d: false}},
        PluginsAPI: {Map: {didAddControls: mapHook}}, viewer: off.viewer}, off.win));
    expect(mapHook).not.toHaveBeenCalled();
    wheel(off.canvas, 120);
    expect(off.view.position.z).toBe(100);
});

test("with Zoom Override on, the 2D map hook lifts the limit and the 3D view gets the wheel, adding no button", () => {
    const mapHook = jest.fn();
    const v = view3d([0, 0, 0]);
    const row = document.createElement("div");
    row.className = "model-action-buttons";
    const page = document.createElement("div");
    page.setAttribute("data-modelview", "");
    page.appendChild(row);
    document.body.appendChild(page);
    const win = Object.assign({TweakUI: {settings: {zoom_override_2d: true, zoom_override_3d: true}},
        PluginsAPI: {Map: {didAddControls: mapHook}}, viewer: v.viewer, setTimeout: f => f()}, v.win);
    zo.start(document, win);
    const map = {options: {maxZoom: 24}, setMaxZoom: jest.fn()};
    mapHook.mock.calls[0][0]({map});
    expect(map.setMaxZoom).toHaveBeenCalledWith(27);
    expect(row.children.length).toBe(0);
    wheel(v.canvas, 120);
    expect(v.view.position.z).toBeCloseTo(90);
});

test("a burst of wheel events with the pointer still picks once, and zooms as far as picking each time would", () => {
    const v = view3d([0, 0, 0]);
    const pick = jest.spyOn(v.win.Potree.Utils, "getMousePointCloudIntersection");
    let now = 1000;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
    try {
        zo.attach3d(v.win, v.viewer);
        for (let i = 0; i < 10; i++) { wheel(v.canvas, 12); now += 16; }
        expect(pick).toHaveBeenCalledTimes(1);
        expect(v.view.position.z).toBeCloseTo(90);
        // A pause, or the pointer moved: picked again
        now += 300;
        wheel(v.canvas, 12);
        expect(pick).toHaveBeenCalledTimes(2);
        const e = new Event("mousewheel", {bubbles: true, cancelable: true});
        Object.assign(e, {wheelDelta: 12, clientX: 610, clientY: 300});
        v.canvas.dispatchEvent(e);
        expect(pick).toHaveBeenCalledTimes(3);
    } finally {
        clock.mockRestore();
    }
});
