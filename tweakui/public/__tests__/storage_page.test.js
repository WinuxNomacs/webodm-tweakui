const storagePage = require("../storage_page");

const MB = 1024 * 1024;

function task(id, name, size, mark, extra) {
    return Object.assign({id, name, size: size * MB, mark, status: 40, compacted: false, partial: false,
        created_at: "2026-11-01T10:00:00Z"}, extra);
}

function report(admin) {
    return {
        admin: !!admin,
        me: {user: {id: 1, username: "me"}, used: 335 * MB, quota: 1000 * MB, projects: [
            {id: 10, name: "Big", size: 320 * MB, tasks: [task("t1", "Done", 300, "compactable"), task("t2", "Failed", 20, "failed", {status: 30})]},
            {id: 11, name: "Small", size: 15 * MB, tasks: [task("t3", "Compacted", 10, null, {compacted: true}), task("t4", "Going", 5, "removing")]}
        ]},
        others: admin ? [{user: {id: 2, username: "pat"}, used: 50 * MB, quota: null, projects: [
            {id: 20, name: "Theirs", size: 50 * MB, tasks: [task("t5", "Theirs", 50, "compactable")]}]}] : []
    };
}

function page() {
    document.body.innerHTML = `
      <div id="tweakui-storage" data-api="/api/plugins/tweakui/">
        <input type="hidden" name="csrfmiddlewaretoken" value="tok">
        <div class="tweakui-storage-actions"><span class="tweakui-storage-selected"></span>
          <button data-act="compact-selected" disabled></button><button data-act="delete-selected" disabled></button></div>
        <div class="tweakui-storage-confirm" hidden></div>
        <p class="tweakui-storage-status"></p>
        <div class="tweakui-storage-body"></div>
      </div>`;
    return document.getElementById("tweakui-storage");
}

const json = (data, ok = true, status = 200) => Promise.resolve({ok, status, json: () => Promise.resolve(data)});
const flush = () => new Promise(r => setTimeout(r, 0));

// A fetch answering the report (r), a task's breakdown and WebODM's actions, keeping each call
function server(r, breakdowns = {}) {
    const calls = [];
    const fn = jest.fn((url, opts = {}) => {
        calls.push([opts.method || "GET", url]);
        if (url === "/api/plugins/tweakui/storage") return json(r);
        const m = url.match(/storage\/\d+\/(t\d)$/);
        if (m) return breakdowns[m[1]] ? json(breakdowns[m[1]]) : json({}, false, 404);
        return json({success: true});
    });
    fn.calls = calls;
    return fn;
}

async function started(r, breakdowns) {
    const root = page(), fetchFn = server(r, breakdowns);
    const view = storagePage.start(document, window, fetchFn);
    await view.loaded;
    return {root, fetchFn, view};
}

const click = el => el.dispatchEvent(new MouseEvent("click", {bubbles: true}));
const tick = el => { el.checked = !el.checked; el.dispatchEvent(new Event("change", {bubbles: true})); };
const row = (root, sel) => root.querySelector(sel);

test("sizes read as WebODM shows them", () => {
    expect(storagePage.formatBytes(0)).toBe("0 B");
    expect(storagePage.formatBytes(1536)).toBe("1.5 KB");
    expect(storagePage.formatBytes(320 * MB)).toBe("320 MB");
    expect(storagePage.formatBytes(2.25 * 1024 * MB)).toBe("2.3 GB");
});

test("a task's status reads as a word, an unfinished upload as Uploading", () => {
    expect(storagePage.statusLabel({status: 40})).toBe("Completed");
    expect(storagePage.statusLabel({status: null})).toBe("Waiting");
    expect(storagePage.statusLabel({status: null, partial: true})).toBe("Uploading");
});

test("the page shows the quota and the projects largest first, closed until opened", async () => {
    const {root} = await started(report());
    expect(root.querySelector(".tweakui-storage-quota").textContent).toMatch(/335 MB of 1000 MB used/);
    expect(root.querySelector(".progress-bar").style.width).toBe("34%");
    const names = Array.from(root.querySelectorAll(".tweakui-storage-project-row strong")).map(e => e.textContent);
    expect(names).toEqual(["Big", "320 MB", "Small", "15 MB"]);
    expect(root.querySelectorAll(".tweakui-storage-task").length).toBe(0);
    expect(root.querySelector("h4")).toBeNull();
});

test("a project opens to its tasks with their marks, and a busy task can't be ticked or deleted", async () => {
    const {root} = await started(report());
    click(row(root, '[data-project="11"] [data-act=open-project]'));
    const going = row(root, '[data-task="t4"]');
    expect(going.textContent).toMatch(/Being deleted/);
    expect(going.querySelector("input").disabled).toBe(true);
    expect(going.querySelector("[data-act=delete-task]")).toBeNull();
    expect(row(root, '[data-task="t3"]').textContent).toMatch(/Completed \(compacted\)/);
    expect(row(root, '[data-task="t3"] [data-act=compact-task]')).toBeNull();
});

test("a task opens to its files by kind, measured once", async () => {
    const kinds = {photos: 600, orthophoto: 200, elevation: 100, point_cloud: 50, textured_model: 50, other: 0};
    const {root, fetchFn} = await started(report(), {t1: {id: "t1", size: 300 * MB, kinds}});
    click(row(root, '[data-project="10"] [data-act=open-project]'));
    click(row(root, '[data-task="t1"] [data-act=open-task]'));
    await flush();
    const photos = row(root, '.tweakui-storage-breakdown [data-kind="photos"]');
    expect(photos.textContent).toMatch(/Photos600 B/);
    expect(photos.querySelector(".progress-bar").style.width).toBe("60%");
    click(row(root, '[data-task="t1"] [data-act=open-task]'));
    click(row(root, '[data-task="t1"] [data-act=open-task]'));
    await flush();
    expect(fetchFn.calls.filter(c => /storage\/10\/t1/.test(c[1])).length).toBe(1);
});

test("ticking a project takes in its tasks; the bar counts what is ticked and what it frees", async () => {
    const {root, view} = await started(report());
    click(row(root, '[data-project="10"] [data-act=open-project]'));
    click(row(root, '[data-project="11"] [data-act=open-project]'));
    tick(row(root, '[data-task="t3"] input'));
    expect(root.querySelector(".tweakui-storage-selected").textContent).toBe("Selected: 1 task (10 MB)");
    expect(root.querySelector("[data-act=compact-selected]").disabled).toBe(true);
    expect(root.querySelector("[data-act=delete-selected]").disabled).toBe(false);
    tick(row(root, '[data-task="t2"] input'));
    tick(row(root, '[data-project="10"] [data-act=tick-project]'));
    const t2 = row(root, '[data-task="t2"] input');
    expect(t2.checked && t2.disabled).toBe(true);
    const p = storagePage.plan(view.state);
    expect(p.projects.map(e => e.project.name)).toEqual(["Big"]);
    expect(p.tasks.map(e => e.task.name)).toEqual(["Compacted"]);
    expect(p.compact.map(e => e.task.name)).toEqual(["Done"]);
    expect(p.freed).toBe(330 * MB);
    expect(root.querySelector(".tweakui-storage-selected").textContent).toBe("Selected: 1 project and 1 task (330 MB)");
    expect(root.querySelector("[data-act=compact-selected]").disabled).toBe(false);
});

test("Delete asks first, naming each project and task and what it frees, and only then calls WebODM's API", async () => {
    const {root, fetchFn} = await started(report());
    click(row(root, '[data-project="11"] [data-act=open-project]'));
    tick(row(root, '[data-project="10"] [data-act=tick-project]'));
    tick(row(root, '[data-task="t3"] input'));
    click(root.querySelector("[data-act=delete-selected]"));
    await flush();
    const box = root.querySelector(".tweakui-storage-confirm");
    expect(box.hidden).toBe(false);
    expect(box.textContent).toMatch(/Delete 1 project and 1 task\? This frees 330 MB\./);
    expect(Array.from(box.querySelectorAll("li")).map(li => li.textContent)).toEqual(
        ["Project Big (2 tasks): 320 MB", "Compacted in Small: 10 MB"]);
    expect(fetchFn.calls.some(c => c[0] !== "GET")).toBe(false);
    click(box.querySelector("[data-act=confirm-yes]"));
    await flush(); await flush();
    expect(fetchFn.calls.filter(c => c[0] !== "GET")).toEqual([
        ["DELETE", "/api/projects/10/"], ["POST", "/api/projects/11/tasks/t3/remove/"]]);
    expect(fetchFn.mock.calls.find(c => c[0] === "/api/projects/10/")[1].headers["X-CSRFToken"]).toBe("tok");
    expect(fetchFn.calls.filter(c => c[1] === "/api/plugins/tweakui/storage").length).toBe(2);
    expect(root.querySelector(".tweakui-storage-status").textContent).toBe("Deleted.");
    expect(root.querySelector(".tweakui-storage-selected").textContent).toMatch(/^Tick/);
});

test("Cancel leaves everything as it is", async () => {
    const {root, fetchFn} = await started(report());
    click(row(root, '[data-project="11"] [data-act=delete-project]'));
    await flush();
    click(root.querySelector("[data-act=confirm-no]"));
    expect(root.querySelector(".tweakui-storage-confirm").hidden).toBe(true);
    expect(fetchFn.calls.some(c => c[0] !== "GET")).toBe(false);
});

test("Compact measures its tasks first to say what their photos free, in WebODM's words", async () => {
    const kinds = {photos: 200 * MB, orthophoto: 0, elevation: 0, point_cloud: 0, textured_model: 0, other: 100 * MB};
    const {root, fetchFn} = await started(report(), {t1: {id: "t1", kinds}});
    click(row(root, '[data-project="10"] [data-act=open-project]'));
    click(row(root, '[data-task="t1"] [data-act=compact-task]'));
    await flush(); await flush();
    const box = root.querySelector(".tweakui-storage-confirm");
    expect(box.textContent).toMatch(/Compact 1 task\? This frees 200 MB\./);
    expect(box.querySelector("li").textContent).toBe("Done in Big: 200 MB of photos");
    expect(box.textContent).toMatch(/It will no longer be possible to restart the task/);
    click(box.querySelector("[data-act=confirm-yes]"));
    await flush(); await flush();
    expect(fetchFn.calls.filter(c => c[0] !== "GET")).toEqual([["POST", "/api/projects/10/tasks/t1/compact/"]]);
    expect(root.querySelector(".tweakui-storage-status").textContent).toMatch(/Compacting started/);
});

test("a task that can't be measured still compacts, its photos unknown", () => {
    const state = {breakdowns: {}, index: storagePage.indexReport(report())};
    const text = storagePage.confirmation(state, {compact: [state.index.tasks.t1]});
    expect(text.title).toBe("Compact 1 task? This frees 0 B and the photos of 1 more.");
    expect(text.lines).toEqual(["Done in Big: its photos"]);
});

test("a refused action says which and why", async () => {
    const root = page();
    const fetchFn = jest.fn(url => url === "/api/plugins/tweakui/storage" ? json(report())
        : json({detail: "You do not have permission"}, false, 403));
    const view = storagePage.start(document, window, fetchFn);
    await view.loaded;
    click(row(root, '[data-project="10"] [data-act=delete-project]'));
    await flush();
    click(root.querySelector("[data-act=confirm-yes]"));
    await flush(); await flush(); await flush();
    const status = root.querySelector(".tweakui-storage-status");
    expect(status.textContent).toBe("Not done: Big: You do not have permission");
    expect(status.classList.contains("text-danger")).toBe(true);
});

test("an admin sees their own storage, then each other user's, named, without a quota when they have none", async () => {
    const {root} = await started(report(true));
    expect(Array.from(root.querySelectorAll("h4")).map(h => h.textContent)).toEqual(["Your storage", "pat"]);
    const pat = root.querySelector('[data-user="2"]');
    expect(pat.querySelector(".tweakui-storage-quota").textContent.trim()).toBe("50 MB used");
    tick(pat.querySelector("[data-act=tick-project]"));
    click(root.querySelector("[data-act=delete-selected]"));
    await flush();
    expect(root.querySelector(".tweakui-storage-confirm li").textContent).toBe("Project Theirs (1 task) of pat: 50 MB");
});

test("names are shown as text, never as markup", async () => {
    const r = report();
    r.me.projects[0].name = "<img src=x onerror=alert(1)>";
    const {root} = await started(r);
    expect(root.querySelector(".tweakui-storage-body img")).toBeNull();
    expect(root.querySelector(".tweakui-storage-project-row strong").textContent).toBe("<img src=x onerror=alert(1)>");
});

test("a report that fails to load says so", async () => {
    const root = page();
    const view = storagePage.start(document, window, () => json({}, false, 500));
    await view.loaded;
    expect(root.querySelector(".tweakui-storage-body").textContent).toBe("Could not load the storage report.");
});
