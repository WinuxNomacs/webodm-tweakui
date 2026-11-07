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
        waitStop(dispose) {
            this.stopped = dispose;
            return Promise.resolve();
        }
    }
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

beforeEach(() => {
    document.body.innerHTML = "";
    delete window.TweakUI;
});

test("off, as by default, nothing is scheduled and fireworks-js isn't loaded", async () => {
    const f = fake();
    surpriseMe.start(document, window, f.env);
    expect(f.pending()).toEqual([]);
    expect(f.env.load).not.toHaveBeenCalled();
});

test("on, a silent show that clicks go through starts some seconds after the page opens, ends after a few, and the next is scheduled", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    const f = fake();
    const shows = surpriseMe.start(document, window, f.env);
    expect(f.pending()).toEqual([12500]);
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
    expect(f.pending()).toEqual([60000]);
});

test("turning it on in the settings page starts a show at once, and turning it off ends it at once", async () => {
    const f = fake();
    const shows = surpriseMe.start(document, window, f.env);
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
    surpriseMe.start(document, window, f.env);
    document.dispatchEvent(new CustomEvent("tweakuiSettingsChanged", {detail: {surprise_me: true, units_in_header: true}}));
    expect(f.pending()).toEqual([12500]);
});

test("no show starts while the tab is hidden; it waits for the next turn", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    const f = fake();
    Object.defineProperty(document, "hidden", {configurable: true, get: () => true});
    try {
        const shows = surpriseMe.start(document, window, f.env);
        await f.tick();
        expect(shows.showing()).toBe(false);
        expect(f.env.load).not.toHaveBeenCalled();
        expect(f.pending()).toEqual([60000]);
    } finally {
        delete document.hidden;
    }
});

test("if fireworks-js doesn't load, it tries again at the next turn", async () => {
    window.TweakUI = {settings: {surprise_me: true}};
    const f = fake();
    f.env.load = jest.fn(() => Promise.reject(new Error("offline")));
    const shows = surpriseMe.start(document, window, f.env);
    await f.tick();
    expect(shows.showing()).toBe(false);
    expect(f.pending()).toEqual([60000]);
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
