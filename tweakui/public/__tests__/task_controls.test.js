const controls = require("../task_controls");

// Tasks as TaskListItem renders them: a row with the +/- and the name; while expanded, the panel with the details
// (Task ID first) and the buttons. WebODM's toggle is handled at the document, as React 16 does
function tasks(list) {
    document.body.innerHTML = list.map(t => '<div class="task-list-item" data-id="' + t.id + '"><div class="row"><div class="name">' +
        '<i class="clickable far fa-plus-square"></i> <a href="javascript:void(0);" class="name-link">' + t.id + "</a></div></div></div>").join("");
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
// WebODM's toggle also adds the task to the address or takes it out (HistoryNav.toggleQSListItem), from its router's
// copy of the location, which a popstate brings up to date
let routerSearch;
const expanded = () => (new URLSearchParams(location.search).get("project_task_expanded") || "").split(",").filter(Boolean);
function onPop() { routerSearch = location.search; }
function onDocument(e) {
    const hit = e.target.closest(".name > i.clickable, .name > .name-link");
    const el = hit && hit.closest(".task-list-item");
    if (!el) return;
    const open = !el.querySelector(".expanded-panel"), id = el.getAttribute("data-id");
    const q = new URLSearchParams(routerSearch);
    const ids = (q.get("project_task_expanded") || "").split(",").filter(x => x && x !== id);
    if (open) ids.push(id);
    q.set("project_task_expanded", ids.join(","));
    routerSearch = "?" + decodeURIComponent(q.toString());
    history.replaceState(history.state, "", location.pathname + routerSearch);
    render(el, open);
}
const mode = id => item(id).getAttribute("data-tweakui-controls");
const press = el => el.dispatchEvent(new MouseEvent("click", {bubbles: true}));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
let watch;

beforeEach(() => {
    webodmToggles = 0;
    sessionStorage.clear();
    history.replaceState(null, "", "/dashboard/?page=2");
    routerSearch = location.search;
    document.addEventListener("click", onDocument);
    window.addEventListener("popstate", onPop);
});
afterEach(() => {
    if (watch) watch.stop();
    watch = null;
    document.removeEventListener("click", onDocument);
    window.removeEventListener("popstate", onPop);
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

test("the address lists only the fully expanded tasks, not those TweakUI opens as buttons only", async () => {
    tasks([{id: "a"}, {id: "b"}]);
    watch = controls.start(document, window);
    // WebODM added both as TweakUI opened them; TweakUI took them back out, and the router read the address again
    expect(expanded()).toEqual([]);
    expect(routerSearch).toBe(location.search);
    expect(new URLSearchParams(location.search).get("page")).toBe("2");

    press(icon("a")); // expanded: a click WebODM never sees, so TweakUI adds it
    await tick();
    expect(expanded()).toEqual(["a"]);

    press(icon("b")); // b expanded too, then a fully minimized (WebODM takes it out, from the router's up-to-date copy)
    await tick();
    press(icon("a"));
    await tick();
    expect(expanded()).toEqual(["b"]);

    press(icon("a")); // back to buttons only: WebODM adds it, TweakUI takes it out
    await tick();
    expect(mode("a")).toBe("buttons");
    expect(expanded()).toEqual(["b"]);
});

test("the expanded tasks in the address change as WebODM writes them, other tasks and parameters kept", () => {
    const p = "project_task_expanded";
    expect(controls.expandedSearch("?page=2&" + p + "=x,a,b", {a: false, b: true, c: true})).toBe("?page=2&" + p + "=x,b,c");
    expect(controls.expandedSearch("?" + p + "=a", {a: false})).toBe("?" + p + "=");
    expect(controls.expandedSearch("?page=2", {a: true})).toBe("?page=2&" + p + "=a");
    expect(controls.expandedSearch("?" + p + "=a&page=2", {a: true, b: false})).toBeNull();
    expect(controls.expandedSearch("", {a: false})).toBeNull();
});
