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
          <button data-act="backup-selected" disabled></button><button data-act="compact-selected" disabled></button><button data-act="delete-selected" disabled></button></div>
        <div class="tweakui-storage-confirm" hidden></div>
        <input type="file" class="tweakui-storage-file" multiple hidden>
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
    expect(going.textContent).toMatch(/Deleting/);
    expect(going.querySelector("input").disabled).toBe(true);
    expect(going.querySelector("[data-act=delete-task]")).toBeNull();
    expect(row(root, '[data-task="t3"]').textContent).toMatch(/Completed \(compacted\)/);
    expect(row(root, '[data-task="t3"] [data-act=compact-task]')).toBeNull();
});

test("each row's actions are in a \"•••\" menu at its end: Import and Delete for a project, Backup, Compact and Delete for a task", async () => {
    const {root} = await started(report());
    click(row(root, '[data-project="10"] [data-act=open-project]'));
    const items = sel => Array.from(row(root, sel).lastElementChild.querySelectorAll(".tweakui-row-menu .dropdown-menu a")).map(a => a.textContent.trim());
    expect(items('[data-project="10"] .tweakui-storage-project-row')).toEqual(["Import", "Delete"]);
    expect(items('[data-task="t1"]')).toEqual(["Backup", "Compact", "Delete"]);
    expect(items('[data-task="t2"]')).toEqual(["Delete"]);
    expect(row(root, '[data-task="t1"] [data-act=backup-task]').getAttribute("href")).toBe("/api/projects/10/tasks/t1/backup");
    // The button opens its menu; an item's action runs and the menu closes
    const menu = row(root, '[data-task="t2"] .tweakui-row-menu'), toggle = menu.querySelector("[data-act=menu]");
    expect([toggle.getAttribute("aria-label"), toggle.querySelector(".fa-ellipsis-h") !== null]).toEqual(["Actions", true]);
    click(toggle);
    expect(menu.classList.contains("open")).toBe(true);
    const item = menu.querySelector("[data-act=delete-task]"), ev = new MouseEvent("click", {bubbles: true, cancelable: true});
    item.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    await flush();
    expect(root.querySelector(".tweakui-storage-confirm").hidden).toBe(false);
    expect(root.querySelector(".tweakui-row-menu.open")).toBeNull();
});

test("a task opens to its files by kind, measured once", async () => {
    const kinds = {photos: 600, orthophoto: 200, elevation: 100, point_cloud: 50, textured_model: 50, other: 0};
    const {root, fetchFn} = await started(report(), {t1: {id: "t1", size: 300 * MB, kinds}});
    click(row(root, '[data-project="10"] [data-act=open-project]'));
    click(row(root, '[data-task="t1"] [data-act=open-task]'));
    await flush();
    const photos = row(root, '.tweakui-storage-breakdown [data-kind="photos"]');
    expect(photos.textContent).toMatch(/Photos600 B/);
    expect(photos.querySelector(".tweakui-storage-bar > span").style.width).toBe("60%");
    click(row(root, '[data-task="t1"] [data-act=open-task]'));
    click(row(root, '[data-task="t1"] [data-act=open-task]'));
    await flush();
    expect(fetchFn.calls.filter(c => /storage\/10\/t1/.test(c[1])).length).toBe(1);
});

test("ticking a project takes in its tasks; the bar counts what is ticked and what it frees", async () => {
    const {root, view} = await started(report());
    // Delete in the danger colour only once something is ticked
    const del = root.querySelector("[data-act=delete-selected]");
    expect([del.classList.contains("btn-danger"), del.classList.contains("btn-default")]).toEqual([false, true]);
    click(row(root, '[data-project="10"] [data-act=open-project]'));
    click(row(root, '[data-project="11"] [data-act=open-project]'));
    tick(row(root, '[data-task="t3"] input'));
    expect(root.querySelector(".tweakui-storage-selected").textContent).toBe("Selected: 1 task (10 MB)");
    expect(root.querySelector("[data-act=compact-selected]").disabled).toBe(true);
    expect(root.querySelector("[data-act=delete-selected]").disabled).toBe(false);
    expect([del.classList.contains("btn-danger"), del.classList.contains("btn-default")]).toEqual([true, false]);
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
    expect(box.textContent).toMatch(/A deleted project goes with all its tasks/);
    expect(fetchFn.calls.some(c => c[0] !== "GET")).toBe(false);
    click(box.querySelector("[data-act=confirm-yes]"));
    await flush(); await flush();
    expect(fetchFn.calls.filter(c => c[0] !== "GET")).toEqual([
        ["DELETE", "/api/projects/10/"], ["POST", "/api/projects/11/tasks/t3/remove/"]]);
    expect(fetchFn.mock.calls.find(c => c[0] === "/api/projects/10/")[1].headers["X-CSRFToken"]).toBe("tok");
    expect(fetchFn.calls.filter(c => c[1] === "/api/plugins/tweakui/storage").length).toBe(2);
    expect(root.querySelector(".tweakui-storage-status").textContent).toBe("Deleted.");
    expect(root.querySelector(".tweakui-storage-selected").textContent).toBe("Select one or multiple tasks or projects to back up, compact or delete them.");
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

test("deleting tasks alone does not speak of projects", () => {
    const state = {breakdowns: {}, index: storagePage.indexReport(report())};
    const text = storagePage.confirmation(state, {projects: [], tasks: [state.index.tasks.t2]});
    expect(text.title).toBe("Delete 1 task? This frees 20 MB.");
    expect(text.note).toBe("What is deleted cannot be recovered.");
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
    expect(Array.from(root.querySelectorAll("h4")).map(h => h.textContent)).toEqual(["Your Storage", "pat"]);
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

describe("Backup and Import", () => {
    afterEach(() => jest.restoreAllMocks());

    // The links clicked for downloads, by URL, instead of jsdom's navigation
    const downloads = () => {
        const urls = [];
        jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
            urls.push([this.getAttribute("href"), this.hasAttribute("download")]);
        });
        return urls;
    };

    test("a completed task has a Backup link to WebODM's backup, a browser download; other tasks have none", async () => {
        const {root} = await started(report());
        click(row(root, '[data-project="10"] [data-act=open-project]'));
        click(row(root, '[data-project="11"] [data-act=open-project]'));
        const backup = id => row(root, `[data-task="${id}"] a[download]`);
        expect(backup("t1").getAttribute("href")).toBe("/api/projects/10/tasks/t1/backup");
        expect(backup("t1").textContent.trim()).toBe("Backup");
        expect(backup("t3").getAttribute("href")).toBe("/api/projects/11/tasks/t3/backup");
        expect(backup("t2")).toBeNull();
        expect(backup("t4")).toBeNull();
    });

    test("Backup All downloads each completed task ticked, or of a ticked project, one after another, and says how many it skipped", async () => {
        const urls = downloads();
        jest.spyOn(window, "setTimeout").mockImplementation(fn => { fn(); return 0; });
        const {root, fetchFn} = await started(report());
        const all = root.querySelector("[data-act=backup-selected]");
        expect(all.disabled).toBe(true);
        click(row(root, '[data-project="11"] [data-act=open-project]'));
        tick(row(root, '[data-project="10"] [data-act=tick-project]'));
        tick(row(root, '[data-task="t3"] input'));
        expect(all.disabled).toBe(false);
        click(all);
        for (let i = 0; i < 5; i++) await flush();
        expect(urls).toEqual([["/api/projects/10/tasks/t1/backup", true], ["/api/projects/11/tasks/t3/backup", true]]);
        expect(root.querySelector(".tweakui-storage-status").textContent)
            .toBe("2 backups started; the browser saves them as WebODM sends them (1 skipped: not completed).");
        expect(fetchFn.calls.some(c => c[0] !== "GET")).toBe(false);
        expect(document.querySelectorAll("a[hidden]").length).toBe(0);
    });

    // Whether the browser would ask before leaving the page (its beforeunload event cancelled)
    const leaveAsks = () => {
        const ev = new Event("beforeunload", {cancelable: true});
        window.dispatchEvent(ev);
        return ev.defaultPrevented;
    };

    test("the browser asks before leaving the page while an import, a delete or a compact runs, and not once it is done", async () => {
        const root = page(), answers = [];
        const done = data => answers.shift()({ok: true, status: 200, json: () => Promise.resolve(data)});
        const fetchFn = jest.fn(url => url === "/api/plugins/tweakui/storage" ? json(report())
            : new Promise(resolve => { answers.push(resolve); }));
        const view = storagePage.start(document, window, fetchFn);
        await view.loaded;
        expect(leaveAsks()).toBe(false);
        const importing = view.importFiles("10", [new File([new Uint8Array(3)], "a.zip")]);
        await flush();
        expect(leaveAsks()).toBe(true);
        done({id: "new"});
        await importing;
        expect(leaveAsks()).toBe(false);
        click(row(root, '[data-project="10"] [data-act=open-project]'));
        for (const act of ["delete-project", "compact-task"]) {
            click(row(root, act === "delete-project" ? '[data-project="11"] [data-act=delete-project]' : '[data-task="t1"] [data-act=compact-task]'));
            await flush(); await flush();
            if (act === "compact-task") done({});  // the breakdown it measures first
            await flush(); await flush();
            click(root.querySelector("[data-act=confirm-yes]"));
            await flush();
            expect(leaveAsks()).toBe(true);
            done({});
            for (let i = 0; i < 4; i++) await flush();
            expect(leaveAsks()).toBe(false);
        }
    });

    test("Backup All does not ask before leaving: the browser carries its downloads on", async () => {
        downloads();
        const pauses = [], wait = window.setTimeout;
        jest.spyOn(window, "setTimeout").mockImplementation((fn, ms) => {
            if (ms === storagePage.BACKUP_PAUSE) { pauses.push(fn); return 0; }
            return wait(fn, ms);
        });
        const {root} = await started(report());
        click(row(root, '[data-project="11"] [data-act=open-project]'));
        tick(row(root, '[data-project="10"] [data-act=tick-project]'));
        tick(row(root, '[data-task="t3"] input'));
        const backingUp = root.querySelector("[data-act=backup-selected]");
        click(backingUp);
        await flush();
        expect(pauses.length).toBe(1);
        expect(leaveAsks()).toBe(false);
        pauses[0]();
        for (let i = 0; i < 3; i++) await flush();
        expect(root.querySelector(".tweakui-storage-status").textContent).toMatch(/^2 backups started/);
    });

    test("each project's menu has Import, which opens the file chooser for zips", async () => {
        const {root} = await started(report());
        const input = root.querySelector(".tweakui-storage-file");
        const opened = jest.spyOn(input, "click").mockImplementation(() => {});
        const button = row(root, '[data-project="10"] [data-act=import-project]');
        expect(button.textContent.trim()).toBe("Import");
        click(button);
        expect(opened).toHaveBeenCalledTimes(1);
    });

    // A fetch answering the report, and WebODM's import as it answers a chunk ({uploaded: true}) and the last one (the task)
    function importServer(fail) {
        const sent = [];
        const fn = jest.fn((url, opts = {}) => {
            if (url === "/api/plugins/tweakui/storage") return json(report());
            const b = opts.body;
            sent.push({url, name: b.get("name"), index: b.get("dzchunkindex"), count: b.get("dztotalchunkcount"),
                offset: b.get("dzchunkbyteoffset"), id: b.get("dzuuid"), size: b.get("file").size, file: b.get("file").name,
                csrf: opts.headers["X-CSRFToken"]});
            if (fail) return fail(sent.length);
            return json(Number(b.get("dzchunkindex")) + 1 < Number(b.get("dztotalchunkcount")) ? {uploaded: true} : {id: "new"});
        });
        fn.sent = sent;
        return fn;
    }

    const zip = (name, size) => new File([new Uint8Array(size)], name, {type: "application/zip"});

    test("Import uploads each zip into the project in WebODM's chunks, named after the file, then reloads the list", async () => {
        const root = page(), fetchFn = importServer();
        const view = storagePage.start(document, window, fetchFn);
        await view.loaded;
        const size = storagePage.CHUNK_SIZE * 2 + 10;
        await view.importFiles("10", [zip("Survey-backup.zip", size), zip("assets.zip", 5)]);
        expect(fetchFn.sent.map(s => [s.url, s.name, s.index, s.count, s.offset, s.size, s.file])).toEqual([
            ["/api/projects/10/tasks/import", "Survey-backup", "0", "3", "0", storagePage.CHUNK_SIZE, "Survey-backup.zip"],
            ["/api/projects/10/tasks/import", "Survey-backup", "1", "3", String(storagePage.CHUNK_SIZE), storagePage.CHUNK_SIZE, "Survey-backup.zip"],
            ["/api/projects/10/tasks/import", "Survey-backup", "2", "3", String(storagePage.CHUNK_SIZE * 2), 10, "Survey-backup.zip"],
            ["/api/projects/10/tasks/import", "assets", "0", "1", "0", 5, "assets.zip"]]);
        expect(new Set(fetchFn.sent.slice(0, 3).map(s => s.id)).size).toBe(1);
        expect(fetchFn.sent[3].id).not.toBe(fetchFn.sent[0].id);
        expect(fetchFn.sent.every(s => s.csrf === "tok")).toBe(true);
        expect(root.querySelector(".tweakui-storage-status").textContent).toBe("Uploaded 2 zips; WebODM is importing them.");
        expect(fetchFn.mock.calls.filter(c => c[0] === "/api/plugins/tweakui/storage").length).toBe(2);
    });

    test("Import shows its progress, file by file", async () => {
        const root = page(), seen = [];
        const fetchFn = importServer(() => {
            seen.push(root.querySelector(".tweakui-storage-status").textContent);
            return json({uploaded: true});
        });
        const view = storagePage.start(document, window, fetchFn);
        await view.loaded;
        await view.importFiles("10", [zip("a.zip", storagePage.CHUNK_SIZE + 1), zip("b.zip", 1)]);
        expect(seen).toEqual(["Importing 1 of 2: a.zip, 0%", "Importing 1 of 2: a.zip, 50%", "Importing 2 of 2: b.zip, 0%"]);
    });

    test("a chunk that gets no answer is sent again; a refused zip says why and the next one still goes", async () => {
        const root = page();
        const fetchFn = importServer(n => n === 1 ? Promise.reject(new Error("offline"))
            : n === 2 ? json({detail: ["Cannot create task, you need to upload 1 file"]}, false, 400) : json({id: "new"}));
        const view = storagePage.start(document, window, fetchFn);
        await view.loaded;
        await view.importFiles("10", [zip("bad.zip", 3), zip("good.zip", 3)]);
        expect(fetchFn.sent.map(s => s.file)).toEqual(["bad.zip", "bad.zip", "good.zip"]);
        const status = root.querySelector(".tweakui-storage-status");
        expect(status.textContent).toBe("Not imported: bad.zip: Cannot create task, you need to upload 1 file");
        expect(status.classList.contains("text-danger")).toBe(true);
    });

    test("a task WebODM is importing is marked so", async () => {
        const r = report();
        r.me.projects[1].tasks.push(task("t6", "Arriving", 0, "importing", {status: 20}));
        const {root} = await started(r);
        click(row(root, '[data-project="11"] [data-act=open-project]'));
        expect(row(root, '[data-task="t6"]').textContent).toMatch(/Importing/);
        expect(row(root, '[data-task="t6"] a[download]')).toBeNull();
    });
});
