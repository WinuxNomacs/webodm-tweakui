const controls = require("../task_controls");

// Tasks as TaskListItem renders them: a row with the +/- and the name; while expanded, the panel with the details
// (Task ID first) and the buttons. WebODM's toggle is handled at the document, as React 16 does
function tasks(list) {
    document.body.innerHTML = list.map(t => '<div class="task-list-item" data-id="' + t.id + '"><div class="row"><div class="name">' +
        '<i class="clickable far fa-plus-square"></i> <a href="#" class="name-link">' + t.id + "</a></div></div></div>").join("");
    list.forEach(t => { if (t.open) render(item(t.id), true); });
}
const item = id => document.querySelector('.task-list-item[data-id="' + id + '"]');
const icon = id => item(id).querySelector(".name > i.clickable");
function render(el, open) {
    el.querySelector(".name > i").className = "clickable far " + (open ? "fa-minus-square" : "fa-plus-square");
    const panel = el.querySelector(".expanded-panel");
    if (panel) panel.remove();
    if (open) {
        el.insertAdjacentHTML("beforeend", '<div class="expanded-panel"><div class="row"><table class="info-table"><tr><td>' +
            '<a class="task-id-link">' + el.getAttribute("data-id") + ' <i class="far fa-clipboard"></i></a></td></tr></table></div>' +
            '<div class="row clearfix"><div class="action-buttons"><button>Download</button></div></div></div>');
    }
    webodmToggles++;
}
let webodmToggles;
function onDocument(e) {
    const hit = e.target.closest(".name > i.clickable, .name > .name-link");
    const el = hit && hit.closest(".task-list-item");
    if (el) render(el, !el.querySelector(".expanded-panel"));
}
const mode = id => item(id).getAttribute("data-tweakui-controls");
const press = el => el.dispatchEvent(new MouseEvent("click", {bubbles: true}));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
let watch;

beforeEach(() => {
    webodmToggles = 0;
    sessionStorage.clear();
    document.addEventListener("click", onDocument);
});
afterEach(() => {
    if (watch) watch.stop();
    watch = null;
    document.removeEventListener("click", onDocument);
});

test("a minimized task is opened as buttons only, its +/- titled Expand", () => {
    tasks([{id: "a"}, {id: "b"}]);
    watch = controls.start(document, window);
    expect(["a", "b"].map(mode)).toEqual(["buttons", "buttons"]);
    expect(controls.isOpen(item("a"))).toBe(true);
    expect(icon("a").getAttribute("title")).toBe("Expand");
});

test("the +/- cycles buttons only, expanded, fully minimized, and back to buttons only", async () => {
    tasks([{id: "a"}]);
    watch = controls.start(document, window);
    const before = webodmToggles;

    press(icon("a"));
    await tick();
    expect(mode("a")).toBeNull(); // expanded: TweakUI alone, WebODM never sees the click
    expect(webodmToggles).toBe(before);
    expect(icon("a").getAttribute("title")).toBe("Minimize");

    press(icon("a"));
    await tick();
    expect(mode("a")).toBe("min");
    expect(controls.isOpen(item("a"))).toBe(false);
    expect(icon("a").getAttribute("title")).toBe("Show Task Controls");

    press(icon("a"));
    await tick();
    expect(mode("a")).toBe("buttons");
    expect(controls.isOpen(item("a"))).toBe(true);
    expect(webodmToggles).toBe(before + 2);
});

test("the task's name toggles it the same way", async () => {
    tasks([{id: "a"}]);
    watch = controls.start(document, window);
    press(item("a").querySelector(".name-link"));
    await tick();
    expect(mode("a")).toBeNull();
});

test("a fully minimized task is not opened again when the list changes", async () => {
    tasks([{id: "a"}]);
    watch = controls.start(document, window);
    press(icon("a"));
    press(icon("a"));
    await tick();
    document.body.appendChild(document.createElement("div"));
    await tick();
    await tick();
    expect(mode("a")).toBe("min");
});

test("after a reload a task fully expanded in this tab stays so, the others WebODM reopens are buttons only", async () => {
    tasks([{id: "a"}, {id: "b"}]);
    watch = controls.start(document, window);
    press(icon("a"));
    await tick();
    watch.stop();

    tasks([{id: "a", open: true}, {id: "b", open: true}]); // the reload: WebODM opens both, from the address
    watch = controls.start(document, window);
    expect([mode("a"), mode("b")]).toEqual([null, "buttons"]);
});

test("a task WebODM opens by itself while fully minimized (Edit, Restart) is taken as expanded", async () => {
    tasks([{id: "a"}]);
    watch = controls.start(document, window);
    press(icon("a"));
    press(icon("a"));
    await tick();
    render(item("a"), true); // WebODM's own setState({expanded: true})
    await tick();
    await tick();
    expect(mode("a")).toBeNull();
});

test("the task id is the Task ID link's text, without its clipboard icon", () => {
    tasks([{id: "abc-123", open: true}]);
    expect(controls.taskId(item("abc-123"))).toBe("abc-123");
});

test("an edit panel's own task-list-item, which has no +/-, is left alone", () => {
    document.body.innerHTML = '<div class="task-list-item"><div class="row no-padding"><form></form></div></div>';
    watch = controls.start(document, window);
    expect(document.querySelector(".task-list-item").hasAttribute("data-tweakui-controls")).toBe(false);
});
