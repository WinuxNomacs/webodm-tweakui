const otherTasks = require("../other_tasks");

const flush = () => new Promise(r => setTimeout(r, 0));
const own = {id: "own", project: 3, name: "TestRGB"};
const tiles = [{meta: {task: own}}, {meta: {task: own}}];
const RGB = [{description: "red"}, {description: "green"}, {description: "blue"}, {description: "alpha"}];

// Leaflet as far as the panel uses it
function fakeLeaflet() {
    return {
        tileLayer: jest.fn((url, options) => ({url, options, opacity: 1, setOpacity(o) { this.opacity = o; }})),
        latLngBounds: corners => ({corners}),
        Control: {extend: proto => function () { this.options = proto.options; this.onAdd = proto.onAdd; }},
        DomEvent: {disableClickPropagation: jest.fn(), disableScrollPropagation: jest.fn()}
    };
}
const fakeMap = () => ({addLayer: jest.fn(), removeLayer: jest.fn(), addControl: jest.fn()});

const metadata = {
    tiles: ["/api/projects/3/tasks/b/orthophoto/tiles/{z}/{x}/{y}.png"], scheme: "xyz", maxzoom: 22,
    bounds: {value: [-91.99, 46.84, -91.98, 46.85]},
    statistics: {"1": {min: 10, max: 200}, "2": {min: 5, max: 250}, "3": {min: 20, max: 210}, "4": {min: 0, max: 255}}
};

function respond(routes) {
    return jest.fn(url => {
        const key = Object.keys(routes).find(k => url.indexOf(k) === 0);
        const body = key && routes[key];
        if (body instanceof Error) return Promise.resolve({ok: false, status: 403, json: () => Promise.resolve({})});
        return Promise.resolve({ok: !!key, status: key ? 200 : 404, json: () => Promise.resolve(body)});
    });
}

test("only a task's map gets the panel, not a project's map or a map with several tasks", () => {
    expect(otherTasks.mapTask(tiles, "/map/project/3/task/own/")).toBe(own);
    expect(otherTasks.mapTask(tiles, "/map/project/3/")).toBeNull();
    expect(otherTasks.mapTask(tiles.concat([{meta: {task: {id: "b", project: 3}}}]), "/map/project/3/task/own/")).toBeNull();
    expect(otherTasks.mapTask([], "/map/project/3/task/own/")).toBeNull();
});

test("an orthophoto's tiles are asked as WebODM's map asks them: 512 px, rescaled to its RGB bands, cropped", () => {
    const url = otherTasks.tileUrl({orthophoto_bands: RGB, crop: {type: "Polygon"}}, metadata);
    expect(url).toBe("/api/projects/3/tasks/b/orthophoto/tiles/{z}/{x}/{y}.png?size=512&rescale=5%2C250&crop=1");
    // Without named bands, all of them; without statistics, no rescale; a query in the tile URL is kept
    expect(otherTasks.tileUrl({}, metadata)).toContain("rescale=0%2C255");
    expect(otherTasks.tileUrl({}, {tiles: ["/t/{z}/{x}/{y}.png?a=1&size=256"]})).toBe("/t/{z}/{x}/{y}.png?a=1&size=512");
    expect(otherTasks.tileUrl({}, {tiles: ["/t.png"], statistics: {}})).toBe("/t.png?size=512&rescale=-1%2C1");
});

test("opening the panel lists the project's other tasks with an orthophoto, each with a checkbox and an opacity", async () => {
    const fetch = respond({"/api/projects/3/tasks/?available_assets=orthophoto.tif": [
        own, {id: "b", project: 3, name: "TestThermal"}, {id: "c", project: 3, name: ""}]});
    const panel = otherTasks.build(document, fakeLeaflet(), fakeMap(), own, fetch);
    document.body.innerHTML = "";
    document.body.appendChild(panel.container);
    const wrapper = panel.container.firstChild;
    expect(wrapper.className).toBe("");
    panel.container.querySelector(".tweakui-other-tasks-button").click();
    expect(wrapper.className).toBe("open");
    expect(panel.container.querySelector(".title").textContent).toBe("Other Tasks");
    await flush();
    const rows = panel.container.querySelectorAll(".tweakui-other-task");
    expect(Array.from(rows).map(r => r.textContent)).toEqual(["TestThermal", "Task #c"]);
    expect(Array.from(rows).map(r => r.querySelector("input[type=checkbox]").checked)).toEqual([false, false]);
    expect(rows[0].querySelector("input[type=range]").value).toBe("100");
    panel.container.querySelector(".close-button").click();
    expect(wrapper.className).toBe("");
    await panel.open();
    expect(fetch).toHaveBeenCalledTimes(1);
});

test("checking a task shows its orthophoto over the task's own layers, the slider sets its opacity, unchecking hides it", async () => {
    const L = fakeLeaflet(), map = fakeMap();
    const fetch = respond({
        "/api/projects/3/tasks/?": [{id: "b", project: 3, name: "TestThermal", crop: {type: "Polygon"}, orthophoto_bands: RGB}],
        "/api/projects/3/tasks/b/orthophoto/metadata?crop=1": metadata
    });
    const panel = otherTasks.build(document, L, map, own, fetch);
    await panel.open();
    const checkbox = panel.container.querySelector("input[type=checkbox]");
    const slider = panel.container.querySelector("input[type=range]");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await flush();
    expect(map.addLayer).toHaveBeenCalledTimes(1);
    const layer = map.addLayer.mock.calls[0][0];
    expect(layer.url).toContain("crop=1");
    expect(layer.options).toMatchObject({tileSize: 512, maxZoom: 121, maxNativeZoom: 21, tms: false, zIndex: 100,
        bounds: {corners: [[46.84, -91.99], [46.85, -91.98]]}});
    slider.value = "40";
    slider.dispatchEvent(new Event("input"));
    expect(layer.opacity).toBe(0.4);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    expect(map.removeLayer).toHaveBeenCalledWith(layer);
    // Shown again without asking for its metadata again, at the slider's opacity
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    expect(map.addLayer).toHaveBeenLastCalledWith(layer);
    expect(L.tileLayer).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
});

test("a project without other orthophotos, or tasks that cannot be listed, say so", async () => {
    let panel = otherTasks.build(document, fakeLeaflet(), fakeMap(), own, respond({"/api/projects/3/tasks/?": [own]}));
    await panel.open();
    expect(panel.container.querySelector(".tweakui-other-tasks-list").textContent)
        .toBe("No other task of this project has an orthophoto.");
    panel = otherTasks.build(document, fakeLeaflet(), fakeMap(), own, respond({"/api/projects/3/tasks/?": new Error()}));
    await panel.open();
    expect(panel.container.querySelector(".tweakui-other-tasks-list").textContent).toBe("Could not load the tasks: Error 403");
});

test("an orthophoto that cannot be loaded unchecks its task", async () => {
    const map = fakeMap();
    const panel = otherTasks.build(document, fakeLeaflet(), map, own, respond({"/api/projects/3/tasks/?": [{id: "b", project: 3, name: "B"}]}));
    await panel.open();
    const checkbox = panel.container.querySelector("input[type=checkbox]");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await flush();
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);
    expect(map.addLayer).not.toHaveBeenCalled();
});

test("with Other Tasks on, the map hook adds the control in the top right corner of a task's map only", () => {
    const hook = jest.fn();
    const win = loc => ({TweakUI: {settings: {other_tasks: true}}, PluginsAPI: {Map: {didAddControls: hook}},
        location: {pathname: loc}, fetch: jest.fn()});
    otherTasks.start(document, win("/map/project/3/task/own/"));
    expect(hook.mock.calls[0][0]).toEqual(["leaflet"]);
    const map = fakeMap();
    hook.mock.calls[0][1]({map, tiles}, fakeLeaflet());
    const control = map.addControl.mock.calls[0][0];
    expect(control.options.position).toBe("topright");
    expect(control.onAdd().classList.contains("tweakui-other-tasks")).toBe(true);

    const projectMap = fakeMap();
    expect(otherTasks.add({map: projectMap, tiles}, fakeLeaflet(), document, win("/map/project/3/"))).toBeNull();
    expect(projectMap.addControl).not.toHaveBeenCalled();

    const off = jest.fn();
    otherTasks.start(document, {TweakUI: {settings: {other_tasks: false}}, PluginsAPI: {Map: {didAddControls: off}}});
    expect(off).not.toHaveBeenCalled();
});
