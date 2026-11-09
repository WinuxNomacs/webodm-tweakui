const movable = require("../movable_controls");

// A map with Layers (open), Base Maps (expanded) and Measure (expanded) in its top right corner. jsdom lays nothing
// out, so a box is given to each control and the map, and an element counts as shown inside an open panel only.
function mapPage() {
    document.documentElement.className = "";
    document.body.innerHTML = `
      <div class="leaflet-container"><div class="leaflet-control-container"><div class="leaflet-top leaflet-right">
        <div class="leaflet-control-layers-control leaflet-bar leaflet-control" id="layers">
          <div class="open"><a class="leaflet-control-layers-control-button"></a>
            <div class="layers-control-panel"><span class="close-button"></span><div class="title">Layers</div>
            <label><input type="checkbox" id="layer"> Orthophoto</label></div></div></div>
        <div class="leaflet-control-layers leaflet-control leaflet-control-layers-expanded open" id="basemaps">
          <form><div class="leaflet-control-layers-tab"><div class="leaflet-control-autolayers-title">Base Maps</div></div></form></div>
        <div class="leaflet-control-measure leaflet-control" id="measure">
          <div class="open"><h3>Measure distances and areas</h3></div></div>
      </div></div></div>`;
    const box = (left, top, width, height) => () => ({left, top, right: left + width, bottom: top + height, width, height});
    document.querySelector(".leaflet-container").getBoundingClientRect = box(0, 0, 1000, 600);
    document.getElementById("layers").getBoundingClientRect = box(690, 10, 300, 200);
    return {layers: document.getElementById("layers"), title: document.querySelector("#layers .title")};
}

const shown = el => !!el.closest(".open");
let started = null;
const start = settings => (started = movable.start(document, {TweakUI: {settings}, MutationObserver}, shown));
afterEach(() => { if (started) started.stop(); started = null; });

function press(target, type, x, y) {
    const e = new MouseEvent(type, {bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0});
    target.dispatchEvent(e);
    return e;
}

function drag(target, from, to) {
    press(target, "pointerdown", from[0], from[1]);
    press(target, "pointermove", to[0], to[1]);
    press(target, "pointerup", to[0], to[1]);
}

test("with Movable Panels off nothing listens and a title stays put", () => {
    const {layers, title} = mapPage();
    expect(start({movable_controls: false})).toBeNull();
    drag(title, [700, 20], [500, 120]);
    expect(layers.style.transform).toBe("");
    expect(document.documentElement.classList.contains("tweakui-movable")).toBe(false);
});

test("a panel dragged by its title moves with the pointer and stays above the others", () => {
    const {layers, title} = mapPage();
    start({movable_controls: true});
    expect(document.documentElement.classList.contains("tweakui-movable")).toBe(true);
    drag(title, [700, 20], [500, 120]);
    expect(layers.style.transform).toBe("translate(-200px, 100px)");
    expect(layers.classList.contains("tweakui-moved")).toBe(true);
    expect(document.documentElement.classList.contains("tweakui-dragging")).toBe(false);
});

test("a panel cannot be dragged out of the map", () => {
    const {layers, title} = mapPage();
    start({movable_controls: true});
    drag(title, [700, 20], [-500, 2000]);
    // The map is 1000 x 600 and the panel 300 x 200 at (690, 10): it stops at the bottom left corner
    expect(layers.style.transform).toBe("translate(-690px, 390px)");
    expect(movable.clamp(50, -50, {left: 690, right: 990, top: 10, bottom: 210}, {left: 0, right: 1000, top: 0, bottom: 600}))
        .toEqual({x: 10, y: -10});
});

test("a second drag carries on from where the panel was left", () => {
    const {layers, title} = mapPage();
    start({movable_controls: true});
    drag(title, [700, 20], [600, 20]);
    // The panel's box now includes its offset, as a browser measures it
    layers.getBoundingClientRect = () => ({left: 590, top: 10, right: 890, bottom: 210});
    drag(title, [600, 20], [600, 70]);
    expect(layers.style.transform).toBe("translate(-100px, 50px)");
});

test("a click on a title is still a click, and the release of a drag is not one", () => {
    const {layers, title} = mapPage();
    start({movable_controls: true});
    const clicks = jest.fn();
    title.addEventListener("click", clicks);
    press(title, "pointerdown", 700, 20);
    press(title, "pointermove", 701, 21);
    press(title, "pointerup", 701, 21);
    press(title, "click", 701, 21);
    expect(layers.style.transform).toBe("");
    expect(clicks).toHaveBeenCalledTimes(1);
    drag(title, [700, 20], [650, 20]);
    expect(press(title, "click", 650, 20).defaultPrevented).toBe(true);
    expect(clicks).toHaveBeenCalledTimes(1);
});

test("a panel that closes goes back to its place", async () => {
    const {layers, title} = mapPage();
    start({movable_controls: true});
    drag(title, [700, 20], [500, 120]);
    layers.querySelector(".open").className = "";
    await Promise.resolve();
    expect(layers.style.transform).toBe("");
    expect(layers.classList.contains("tweakui-moved")).toBe(false);
    expect(layers.hasAttribute("data-tweakui-x")).toBe(false);
});

test("Base Maps and Measure are dragged by their title, a panel's content and controls outside a map are not", () => {
    mapPage();
    const titleOf = id => document.querySelector("#" + id + " .leaflet-control-autolayers-title, #" + id + " h3");
    expect(movable.controlFor(titleOf("basemaps")).id).toBe("basemaps");
    expect(movable.controlFor(titleOf("measure")).id).toBe("measure");
    expect(movable.controlFor(document.getElementById("layer"))).toBeNull();
    document.body.insertAdjacentHTML("beforeend", '<div class="leaflet-control"><div class="title" id="outside">x</div></div>');
    expect(movable.controlFor(document.getElementById("outside"))).toBeNull();
    expect(movable.isOpen(document.getElementById("measure"), shown)).toBe(true);
    document.querySelector("#measure .open").className = "";
    expect(movable.isOpen(document.getElementById("measure"), shown)).toBe(false);
});

test("a press on a title bar does not reach the map, which would be dragged too", () => {
    const {title} = mapPage();
    start({movable_controls: true});
    const map = jest.fn();
    document.querySelector(".leaflet-container").addEventListener("mousedown", map);
    document.querySelector(".leaflet-container").addEventListener("pointerdown", map);
    press(title, "pointerdown", 700, 20);
    press(title, "mousedown", 700, 20);
    press(title, "pointerup", 700, 20);
    expect(map).not.toHaveBeenCalled();
    press(document.getElementById("layer"), "mousedown", 700, 60);
    expect(map).toHaveBeenCalledTimes(1);
});
