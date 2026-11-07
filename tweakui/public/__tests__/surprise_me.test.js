const surpriseMe = require("../surprise_me");

// A stand-in for fireworks-js's Fireworks class, and timers the test runs by hand
function fake() {
    const made = [];
    class Fireworks {
        constructor(box, options) {
            this.box = box;
            this.options = options;
            this.started = false;
            this.stopped = null;
            made.push(this);
        }
        start() { this.started = true; }
        stop(dispose) { this.stopped = dispose; }
        updateSize() {}
        get isRunning() { return false; }
        waitStop(dispose) {
            this.stopped = dispose;
            return Promise.resolve();
        }
    }
    // What fireworks-js reads in launch(): where it aims, while its mouse is active
    Fireworks.prototype.launch = function (count) {
        this.launched = (this.launched || []).concat({count, x: this.mouse.x, y: this.mouse.y, active: this.mouse.active});
    };
    Object.defineProperty(Fireworks.prototype, "mouse", {get() { return this._mouse || (this._mouse = {active: false}); }});
    const timers = [];
    const env = {
        random: () => 0.5,
        load: jest.fn(() => Promise.resolve(Fireworks)),
        setTimeout: (f, ms) => timers.push({f, ms, gone: false}) - 1,
        clearTimeout: i => { if (timers[i]) timers[i].gone = true; },
    };
    // Runs the next pending timer and lets the promises settle
    const tick = async () => {
        const t = timers.find(x => !x.gone);
        if (!t) return null;
        t.gone = true;
        t.f();
        await new Promise(r => setTimeout(r, 0));
        return t.ms;
    };
    const pending = () => timers.filter(x => !x.gone).map(x => x.ms);
    return {made, env, tick, pending};
}
const boxes = () => document.querySelectorAll(".tweakui-fireworks").length;

let running = [];
const start = env => {
    const shows = surpriseMe.start(document, window, env);
    running.push(shows);
    return shows;
};
beforeEach(() => {
    document.body.innerHTML = "";
    delete window.TweakUI;
});
// Each start() listens on the document until stopped
afterEach(() => {
    running.forEach(s => s.stop());
    running = [];
});

test("on, a show starts 4 to 8 seconds after the page opens and the next 4 to 8 seconds after one ends", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    const f = fake();
    let r = 0;
    f.env.random = () => r;
    start(f.env);
    expect(f.pending()).toEqual([4000]);
    r = 1;
    await f.tick();
    await f.tick();
    expect(f.pending()).toEqual([8000]);
});

test("off, as by default, nothing is scheduled and fireworks-js isn't loaded", async () => {
    const f = fake();
    start(f.env);
    expect(f.pending()).toEqual([]);
    expect(f.env.load).not.toHaveBeenCalled();
});

test("on, a silent show that clicks go through starts some seconds after the page opens, ends after a few, and the next is scheduled", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    const f = fake();
    const shows = start(f.env);
    expect(f.pending()).toEqual([6000]);
    await f.tick();
    expect(shows.showing()).toBe(true);
    expect(boxes()).toBe(1);
    const [fireworks] = f.made;
    expect(fireworks.started).toBe(true);
    expect(fireworks.box.getAttribute("aria-hidden")).toBe("true");
    expect(fireworks.options.sound.enabled).toBe(false);
    expect(fireworks.options.mouse.click).toBe(false);
    expect(f.pending()).toEqual([7500]);
    await f.tick();
    expect(shows.showing()).toBe(false);
    expect(fireworks.stopped).toBe(true);
    expect(boxes()).toBe(0);
    expect(f.pending()).toEqual([6000]);
});

test("turning it on in the settings page starts a show at once, and turning it off ends it at once", async () => {
    const f = fake();
    const shows = start(f.env);
    document.dispatchEvent(new CustomEvent("tweakuiSettingsChanged", {detail: {surprise_me: true}}));
    expect(f.pending()).toEqual([0]);
    await f.tick();
    expect(boxes()).toBe(1);
    document.dispatchEvent(new CustomEvent("tweakuiSettingsChanged", {detail: {surprise_me: false}}));
    expect(shows.showing()).toBe(false);
    expect(boxes()).toBe(0);
    expect(f.made[0].stopped).toBe(true);
    expect(f.pending()).toEqual([]);
});

test("another setting's change leaves the shows as they are", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    const f = fake();
    start(f.env);
    document.dispatchEvent(new CustomEvent("tweakuiSettingsChanged", {detail: {surprise_me: true, units_in_header: true}}));
    expect(f.pending()).toEqual([6000]);
});

test("no show starts while the tab is hidden; it waits for the next turn", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    const f = fake();
    Object.defineProperty(document, "hidden", {configurable: true, get: () => true});
    try {
        const shows = start(f.env);
        await f.tick();
        expect(shows.showing()).toBe(false);
        expect(f.env.load).not.toHaveBeenCalled();
        expect(f.pending()).toEqual([6000]);
    } finally {
        delete document.hidden;
    }
});

test("if fireworks-js doesn't load, it tries again at the next turn", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    const f = fake();
    f.env.load = jest.fn(() => Promise.reject(new Error("offline")));
    const shows = start(f.env);
    await f.tick();
    expect(shows.showing()).toBe(false);
    expect(f.pending()).toEqual([6000]);
});

test("the library is loaded from the plugin's own copy, once", () => {
    document.head.innerHTML = "";
    const win = {};
    surpriseMe.load(document, win);
    surpriseMe.load(document, win);
    const scripts = document.head.querySelectorAll("script");
    expect(scripts.length).toBe(1);
    expect(scripts[0].getAttribute("src")).toBe("/plugins/tweakui/vendor/fireworks-js/fireworks.umd.js");
});

// A right button's press and release at (x, y), on a target
async function rightClick(target, x, y, {to = [x, y], shift = false} = {}) {
    const down = new MouseEvent("mousedown", {bubbles: true, button: 2, clientX: x, clientY: y, shiftKey: shift});
    const menu = new MouseEvent("contextmenu", {bubbles: true, cancelable: true, button: 2, clientX: x, clientY: y, shiftKey: shift});
    const up = new MouseEvent("mouseup", {bubbles: true, button: 2, clientX: to[0], clientY: to[1], shiftKey: shift});
    target.dispatchEvent(down);
    target.dispatchEvent(menu);
    target.dispatchEvent(up);
    await new Promise(r => setTimeout(r, 0));
    return menu.defaultPrevented;
}

test("a right-click sends one rocket to the pointer, on a layer of its own, instead of the browser's menu", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    const f = fake();
    start(f.env);
    expect(await rightClick(document.body, 300, 200)).toBe(true);
    expect(await rightClick(document.body, 40, 50)).toBe(true);
    expect(f.made.length).toBe(1);
    expect(f.made[0].launched).toEqual([{count: 1, x: 300, y: 200, active: true}, {count: 1, x: 40, y: 50, active: true}]);
    expect(f.made[0].mouse.active).toBe(false);
    expect(boxes()).toBe(1);
    expect(f.pending()).toEqual([6000]);
});

test("a right-drag (the 3D view's pan), Shift + right-click and a right-click in a text field send no rocket; the last two get the browser's menu", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    document.body.innerHTML = "<input type='text'>";
    const f = fake();
    start(f.env);
    expect(await rightClick(document.body, 100, 100, {to: [160, 100]})).toBe(true);
    expect(await rightClick(document.body, 100, 100, {shift: true})).toBe(false);
    expect(await rightClick(document.querySelector("input"), 100, 100)).toBe(false);
    expect(f.made.length).toBe(0);
});

test("off, a right-click is the browser's; turning it off removes the right-clicks' layer", async () => {
    const f = fake();
    const shows = start(f.env);
    expect(await rightClick(document.body, 10, 10)).toBe(false);
    expect(f.made.length).toBe(0);
    shows.set(true, false);
    await rightClick(document.body, 10, 10);
    expect(boxes()).toBe(1);
    shows.set(false);
    expect(boxes()).toBe(0);
    expect(f.made[0].stopped).toBe(true);
    expect(await rightClick(document.body, 10, 10)).toBe(false);
});

test("a long press on a touch screen (a contextmenu with no right button pressed) keeps its menu", () => {
    window.TweakUI = {settings: {surprise_me: true}};
    start(fake().env);
    const menu = new MouseEvent("contextmenu", {bubbles: true, cancelable: true});
    document.body.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(false);
});
