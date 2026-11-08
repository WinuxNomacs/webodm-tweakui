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

test("with Zoom Override on, the 2D map hook lifts the limit and the 3D view gets the wheel and the Zoom Sensitivity button, before Share", () => {
    const mapHook = jest.fn();
    const v = view3d([0, 0, 0]);
    const row = document.createElement("div");
    row.className = "model-action-buttons";
    row.innerHTML = '<div><button class="snapshot"></button></div><div><button class="shareButton"></button></div>';
    const page = document.createElement("div");
    page.setAttribute("data-modelview", "");
    page.appendChild(row);
    document.body.appendChild(page);
    const win = Object.assign({TweakUI: {settings: {zoom_override_2d: true, zoom_override_3d: true, zoom_sensitivity_3d: 200}},
        PluginsAPI: {Map: {didAddControls: mapHook}}, viewer: v.viewer, setTimeout: f => f()}, v.win);
    zo.start(document, win);
    const map = fakeMap();
    mapHook.mock.calls[0][0]({map});
    expect(map.setMaxZoom).toHaveBeenCalledWith(27);
    expect(row.children.length).toBe(3);
    expect(row.children[1].classList.contains("tweakui-zoom-sensitivity-3d")).toBe(true);
    expect(row.children[1].querySelector("input[type=number]").value).toBe("200");
    // At 200% a notch goes as far as two
    wheel(v.canvas, 120);
    expect(v.view.position.z).toBeCloseTo(81);
    // Twice is still one button
    zo.start(document, win);
    expect(row.querySelectorAll(".tweakui-zoom-sensitivity").length).toBe(1);
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

// A Leaflet map as far as Zoom Sensitivity uses it
function fakeMap(zoom = 12) {
    const box = document.createElement("div");
    document.body.appendChild(box);
    return {
        options: {maxZoom: 24, zoomSnap: 1}, box, getContainer: () => box, getZoom: () => zoom, setMaxZoom: jest.fn(),
        setZoomAround: jest.fn(), mouseEventToContainerPoint: e => ({x: e.clientX, y: e.clientY}),
        scrollWheelZoom: {enable: jest.fn(), disable: jest.fn()}, addControl: jest.fn()
    };
}
function wheel2d(target, deltaY, deltaMode = 0) {
    const e = new WheelEvent("wheel", {deltaY, deltaMode, clientX: 300, clientY: 200, bubbles: true, cancelable: true});
    target.dispatchEvent(e);
    return e;
}

describe("Zoom Sensitivity", () => {
    afterEach(() => { jest.useRealTimers(); });

    test("a sensitivity is a whole number from 10 to 200, else 100", () => {
        expect([10, 55, 200].map(zo.sensitivity)).toEqual([10, 55, 200]);
        expect([9, 201, 50.5, "50", undefined, null].map(zo.sensitivity)).toEqual([100, 100, 100, 100, 100, 100]);
    });

    test("a 2D wheel event is a notch of 100 pixels or 3 lines, at most one, a trackpad's a share of one", () => {
        expect(zo.wheelNotch({deltaY: -100, deltaMode: 0})).toBe(1);
        expect(zo.wheelNotch({deltaY: 120, deltaMode: 0})).toBe(-1);
        expect(zo.wheelNotch({deltaY: 3, deltaMode: 1})).toBeCloseTo(-1);
        expect(zo.wheelNotch({deltaY: -1, deltaMode: 1})).toBeCloseTo(1 / 3);
        expect(zo.wheelNotch({deltaY: 1, deltaMode: 2})).toBe(-1);
        expect(zo.wheelNotch({deltaY: -10, deltaMode: 0})).toBeCloseTo(0.1);
        expect(zo.wheelNotch({deltaY: 0}) === 0).toBe(true);
    });

    test("a whole notch takes as many steps as Leaflet's own wheel would on this browser", () => {
        const map = fakeMap();
        const L = px => ({L: {DomEvent: {getWheelDelta: () => px}}});
        // Chrome on Windows (100 pixels halved): one step; on Linux (100): two; Firefox's 3 lines (60): one
        expect(zo.leafletSteps(L(-50), map, {})).toBe(1);
        expect(zo.leafletSteps(L(100), map, {})).toBe(2);
        expect(zo.leafletSteps(L(60), map, {})).toBe(1);
        expect(zo.leafletSteps({}, map, {})).toBe(1);
        // At 50% on Linux's Chrome a notch is one step, half of WebODM's two
        jest.useFakeTimers();
        const wheel = zo.wheel2d(Object.assign({setTimeout: (f, ms) => setTimeout(f, ms)}, L(-100)), map);
        wheel.set(50);
        wheel2d(map.box, -100);
        jest.advanceTimersByTime(40);
        expect(map.setZoomAround).toHaveBeenLastCalledWith({x: 300, y: 200}, 13);
    });

    test("at 100% the 2D map keeps Leaflet's wheel; otherwise a notch zooms that share of a step toward the pointer", () => {
        jest.useFakeTimers();
        const map = fakeMap(12);
        const wheel = zo.wheel2d(window, map);
        wheel.set(100);
        expect(map.scrollWheelZoom.disable).not.toHaveBeenCalled();
        expect(wheel2d(map.box, -100).defaultPrevented).toBe(false);
        wheel.set(50);
        expect(map.scrollWheelZoom.disable).toHaveBeenCalled();
        expect(map.options.zoomSnap).toBe(0);
        expect(wheel2d(map.box, -100).defaultPrevented).toBe(true);
        expect(map.setZoomAround).not.toHaveBeenCalled();
        jest.advanceTimersByTime(40);
        expect(map.setZoomAround).toHaveBeenLastCalledWith({x: 300, y: 200}, 12.5);
        // Events close together add up: two notches out at 200%
        wheel.set(200);
        wheel2d(map.box, 100);
        wheel2d(map.box, 100);
        jest.advanceTimersByTime(40);
        expect(map.setZoomAround).toHaveBeenLastCalledWith({x: 300, y: 200}, 8);
        // A trackpad's ten small events at 30%: three tenths of a step
        wheel.set(30);
        for (let i = 0; i < 10; i++) wheel2d(map.box, -10);
        jest.advanceTimersByTime(40);
        expect(map.setZoomAround.mock.calls.at(-1)[1]).toBeCloseTo(12.3);
        // Back to 100%: Leaflet's wheel and its snap again, and TweakUI's gone
        wheel.set(100);
        expect(map.scrollWheelZoom.enable).toHaveBeenCalled();
        expect(map.options.zoomSnap).toBe(1);
        const calls = map.setZoomAround.mock.calls.length;
        wheel2d(map.box, -100);
        jest.advanceTimersByTime(40);
        expect(map.setZoomAround.mock.calls.length).toBe(calls);
    });

    test("in the 3D view a notch goes the sensitivity's share of a tenth of the way", () => {
        let s = 50;
        const v = view3d([0, 0, 0]);
        zo.attach3d(v.win, v.viewer, () => s);
        wheel(v.canvas, 120);
        expect(v.view.position.z).toBeCloseTo(100 * Math.pow(0.9, 0.5));
        s = 100;
        v.view.position.set(0, 0, 100);
        wheel(v.canvas, 120);
        expect(v.view.position.z).toBeCloseTo(90);
    });

    function settingsApi(ok = true, detail = "") {
        return jest.fn((url, options) => Promise.resolve({
            ok, status: ok ? 200 : 400,
            json: () => Promise.resolve(ok ? Object.assign({zoom_override_2d: true}, JSON.parse(options.body)) : {detail})
        }));
    }
    function makePanel(fetchFn, saved = 100) {
        const applied = [];
        const win = {TweakUI: {settings: {}}};
        const p = zo.panel(document, win, "2d", saved, v => applied.push(v), fetchFn);
        document.body.appendChild(p.container);
        return Object.assign(p, {applied, win, fetchFn});
    }
    const flush = () => new Promise(r => setTimeout(r, 0));
    const fire = (input, type) => input.dispatchEvent(new Event(type, {bubbles: true}));

    test("the button opens the panel with the saved value; Escape, a click outside and the button close it", () => {
        const p = makePanel(settingsApi(), 70);
        expect(p.button.title).toBe("Zoom Sensitivity");
        expect(p.container.querySelector("label").textContent).toBe("Zoom Sensitivity (Default: 100%)");
        expect(p.container.querySelector("label .tweakui-default").className).toContain("text-muted");
        expect(p.input.value).toBe("70");
        expect(p.slider.value).toBe("70");
        expect([p.slider.min, p.slider.max, p.slider.step]).toEqual(["10", "200", "10"]);
        p.button.click();
        expect(p.container.classList.contains("open")).toBe(true);
        expect(p.button.getAttribute("aria-expanded")).toBe("true");
        expect(document.activeElement).toBe(p.slider);
        document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
        expect(p.container.classList.contains("open")).toBe(false);
        p.open();
        p.slider.dispatchEvent(new Event("pointerdown", {bubbles: true}));
        expect(p.container.classList.contains("open")).toBe(true);
        document.body.dispatchEvent(new Event("pointerdown", {bubbles: true}));
        expect(p.container.classList.contains("open")).toBe(false);
        p.button.click();
        p.button.click();
        expect(p.container.classList.contains("open")).toBe(false);
    });

    test("the slider applies as it moves and saves when let go", async () => {
        const p = makePanel(settingsApi());
        p.slider.value = "60";
        fire(p.slider, "input");
        expect(p.input.value).toBe("60");
        expect(p.applied).toEqual([60]);
        expect(p.fetchFn).not.toHaveBeenCalled();
        fire(p.slider, "change");
        await flush();
        expect(p.fetchFn).toHaveBeenCalledWith("/api/plugins/tweakui/settings", expect.objectContaining({
            method: "PATCH", body: JSON.stringify({zoom_sensitivity_2d: 60})}));
        expect(p.win.TweakUI.settings.zoom_sensitivity_2d).toBe(60);
        expect(p.saved()).toBe(60);
        // The same value again isn't saved again
        fire(p.slider, "change");
        await flush();
        expect(p.fetchFn).toHaveBeenCalledTimes(1);
    });

    test("the box takes any whole number from 10 to 200, applied as typed and saved when left; anything else is put back", async () => {
        const p = makePanel(settingsApi(), 100);
        p.input.value = "37";
        fire(p.input, "input");
        expect(p.applied).toEqual([37]);
        fire(p.input, "change");
        await flush();
        expect(p.fetchFn.mock.calls[0][1].body).toBe(JSON.stringify({zoom_sensitivity_2d: 37}));
        p.input.value = "250";
        fire(p.input, "input");
        expect(p.applied).toEqual([37]);
        fire(p.input, "change");
        expect(p.input.value).toBe("37");
        expect(p.status.textContent).toBe("Not saved: a whole number from 10 to 200");
        expect(p.applied).toEqual([37, 37]);
        expect(p.fetchFn).toHaveBeenCalledTimes(1);
    });

    test("a save refused puts back the saved value and says why", async () => {
        const p = makePanel(settingsApi(false, "Zoom Sensitivity takes 10 to 200"), 80);
        p.slider.value = "120";
        fire(p.slider, "input");
        fire(p.slider, "change");
        await flush();
        expect(p.input.value).toBe("80");
        expect(p.slider.value).toBe("80");
        expect(p.applied).toEqual([120, 80]);
        expect(p.status.textContent).toBe("Not saved: Zoom Sensitivity takes 10 to 200");
    });

    test("on the 2D map the button is a Leaflet control at the bottom left, and the saved sensitivity is applied", () => {
        jest.useFakeTimers();
        const mapHook = jest.fn();
        const L = {Control: {extend: proto => function () { this.options = proto.options; this.onAdd = proto.onAdd; }},
            DomEvent: {disableClickPropagation: jest.fn(), disableScrollPropagation: jest.fn()}};
        const win = {TweakUI: {settings: {zoom_override_2d: true, zoom_sensitivity_2d: 50}}, PluginsAPI: {Map: {didAddControls: mapHook}},
            L, setTimeout: (f, ms) => setTimeout(f, ms)};
        zo.start(document, win);
        const map = fakeMap(10);
        mapHook.mock.calls[0][0]({map});
        const control = map.addControl.mock.calls[0][0];
        expect(control.options.position).toBe("bottomleft");
        const box = control.onAdd();
        expect(box.classList.contains("tweakui-zoom-sensitivity-2d")).toBe(true);
        expect(L.DomEvent.disableScrollPropagation).toHaveBeenCalledWith(box);
        expect(box.querySelector("input[type=number]").value).toBe("50");
        wheel2d(map.box, -100);
        jest.advanceTimersByTime(40);
        expect(map.setZoomAround).toHaveBeenLastCalledWith({x: 300, y: 200}, 10.5);
        // The slider changes the wheel at once
        const slider = box.querySelector("input[type=range]");
        slider.value = "200";
        fire(slider, "input");
        wheel2d(map.box, -100);
        jest.advanceTimersByTime(40);
        expect(map.setZoomAround).toHaveBeenLastCalledWith({x: 300, y: 200}, 12);
    });
});
