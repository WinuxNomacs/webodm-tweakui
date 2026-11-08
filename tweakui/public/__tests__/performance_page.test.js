const core = require("../core");
const performancePage = require("../performance_page");

const GB = 1024 ** 3;

function node(extra) {
    return Object.assign({id: 1, name: "node-odx-1", online: true, last_refreshed: "2026-11-08T10:00:00Z", engine: "odx",
        engine_version: "3.8.5", version: "2.4.0", queue: 0, max_images: null, cpu_cores: 20, total_memory: 64 * GB,
        available_memory: 48 * GB, max_parallel_tasks: 1, suits_images: 1500}, extra);
}

function task(id, extra) {
    return Object.assign({id, project: {id: 3, name: "Flights"}, name: "Task " + id, created_at: "2026-11-06T10:00:00Z",
        owner: null, images: 220, seconds: 824.2, seconds_per_image: 3.75, slowest_step: {name: "Reconstruction", seconds: 101.6},
        average_gsd: 1.3, node: "node-odx-1"}, extra);
}

function report(extra) {
    return Object.assign({
        admin: false,
        nodes: [node(), node({id: 2, name: "spare", online: false, cpu_cores: null, total_memory: null, available_memory: null,
            suits_images: null})],
        server: {disk: {total: 1000 * GB, used: 900 * GB, free: 100 * GB}, memory: {total: 64 * GB, free: 2 * GB, used: 62 * GB}},
        tasks: [task("t1"), task("t2", {owner: "pat", name: "", seconds: null, seconds_per_image: null, slowest_step: null})],
        trend: null, largest: 220,
        verdicts: [{level: "warning", text: "spare is not answering."}, {level: "success", text: "node-odx-1 suits about 1,500 photos per task."}]
    }, extra);
}

function page(every = 3, history = 5) {
    document.body.innerHTML = `
      <div id="tweakui-performance" data-api="/api/plugins/tweakui/">
        <div class="tweakui-performance-bar"><button data-act="refresh"></button><span class="tweakui-performance-status"></span>
          <div class="tweakui-performance-every" data-control="refresh">
            <input type="range" class="tweakui-performance-every-slider" min="1" max="10" step="1" value="${every}">
            <input type="number" id="tweakui-performance-refresh" min="1" max="10" step="1" value="${every}">
            <span class="tweakui-performance-every-status"></span>
          </div>
          <div class="tweakui-performance-every" data-control="history">
            <input type="range" class="tweakui-performance-every-slider" min="1" max="30" step="1" value="${history}">
            <input type="number" id="tweakui-performance-history" min="1" max="30" step="1" value="${history}">
            <span class="tweakui-performance-every-status"></span>
          </div>
        </div>
        <div class="tweakui-performance-body"></div>
      </div>`;
    return document.getElementById("tweakui-performance");
}

// CPU counters as the API gives them: [busy, total] for the machine, and how many cores
function cpu(total, cores, load = [1.5, 1.25, 1]) {
    return {total, cores, load};
}

// A drive's counters (the API's: since the system started) and a reading of them all at `time` seconds
function drive(name, reads, writes, readBytes, writeBytes, ms, busy) {
    return {name, mounts: ["/" + name], tasks: false, reads, writes, read_bytes: readBytes, write_bytes: writeBytes,
        read_ms: ms / 2, write_ms: ms / 2, busy_ms: busy};
}
const io = (time, drives) => ({time, drives});
const json = (data, ok = true, status = 200) => Promise.resolve({ok, status, json: () => Promise.resolve(data)});

const views = [];
afterEach(() => {
    views.splice(0).forEach(v => v && v.stop());
    jest.useRealTimers();
});

async function started(answers, every, history) {
    const root = page(every, history);
    const fetchFn = jest.fn(() => {
        const next = answers.length > 1 ? answers.shift() : answers[0];
        return next instanceof Error ? Promise.reject(next) : next;
    });
    const view = performancePage.start(document, window, fetchFn);
    views.push(view);
    await view.loaded;
    return {root, fetchFn, view};
}

const flush = () => new Promise(r => setTimeout(r, 0));
// Each element's text nodes joined with spaces, as the page reads (jsdom has no innerText)
function words(e) {
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), out = [];
    while (walker.nextNode()) out.push(walker.currentNode.nodeValue);
    return out.join(" ").replace(/\s+/g, " ").trim();
}
const texts = (root, selector) => Array.from(root.querySelectorAll(selector)).map(words);

beforeAll(() => { core.install(window); });

describe("the Performance page", () => {
    test("a page without the view's body is left alone", () => {
        document.body.innerHTML = '<div id="tweakui-performance"></div>';
        expect(performancePage.start(document, window, jest.fn())).toBeNull();
    });

    test("it asks the plugin's API once on opening and shows the verdicts with their level", async () => {
        const {root, fetchFn} = await started([json(report())]);
        expect(fetchFn).toHaveBeenCalledWith("/api/plugins/tweakui/performance", {credentials: "same-origin"});
        expect(Array.from(root.querySelectorAll(".tweakui-performance-verdicts li")).map(li => li.dataset.level)).toEqual(["warning", "success"]);
        expect(root.querySelector('.tweakui-performance-verdicts li[data-level="warning"] i').className).toContain("text-warning");
        expect(texts(root, ".tweakui-performance-verdicts li")[0]).toBe("spare is not answering.");
    });

    test("an online node's card shows its engine, cores, memory with its share used and a graph, queue, max photos and what it suits", async () => {
        const {root} = await started([json(report())]);
        const card = root.querySelector('[data-node="1"]');
        expect(card.querySelector(".label").textContent).toBe("Online");
        expect(texts(card, "tr")).toEqual(["Engine ODX 3.8.5 (API 2.4.0)", "CPU Cores 20", "Memory 48 GB free of 64 GB \u00b7 25% used",
            "Queue 0 tasks (1 at a time)", "Max Photos No limit", "Suits About 1,500 photos per task"]);
        expect(card.querySelector("[data-memory] .tweakui-performance-graph").getAttribute("data-graph")).toBe("node:1");
    });

    test("a node that does not answer is marked and shows when WebODM last saw it", async () => {
        const {root} = await started([json(report())]);
        const card = root.querySelector('[data-node="2"]');
        expect(card.querySelector(".label").textContent).toBe("Not Answering");
        expect(texts(card, "th")).toEqual(["Engine", "Last Seen"]);
    });

    test("what a node suits reads as more than the table or too little at its ends", () => {
        const div = document.createElement("div");
        div.innerHTML = performancePage.nodeHtml(node({suits_images: null, total_memory: 512 * GB}));
        expect(div.textContent).toContain("More than 5,000 photos per task");
        div.innerHTML = performancePage.nodeHtml(node({suits_images: 0, total_memory: 2 * GB, max_images: 2000, queue: 1}));
        expect(div.querySelector(".text-danger").textContent).toBe("Under 40 photos per task");
        expect(div.textContent).toContain("2,000");
        expect(div.textContent).toContain("1 task (1 at a time)");
    });

    test("the server's free disk space gets a bar and its memory a graph, each coloured as they fill", async () => {
        const {root} = await started([json(report())]);
        const server = root.querySelector("[data-server]");
        expect(texts(server, "tr")).toEqual(["Disk 100 GB free of 1000 GB", "Memory 2 GB free of 64 GB \u00b7 97% used"]);
        expect(Array.from(server.querySelectorAll(".progress-bar")).map(b => b.className.replace("progress-bar progress-bar-", "")))
            .toEqual(["warning"]);
        expect(server.querySelector("[data-used]").className).toBe("text-danger");
        expect(server.querySelector(".tweakui-performance-graph").getAttribute("data-graph")).toBe("memory");
    });

    test("recent tasks link to their map and show photos, time, time per photo, the slowest step and the node", async () => {
        const {root} = await started([json(report())]);
        const rows = root.querySelectorAll(".tweakui-performance-table tbody tr");
        expect(rows[0].querySelector("a").getAttribute("href")).toBe("/map/project/3/task/t1/");
        expect(texts(rows[0], "td").slice(2)).toEqual(["220", "13m 44s", "3.8s", "Reconstruction 1m 42s", "", "", "", "", "node-odx-1"]);
        // Another user's (an admin's view), with no name, time or stats
        expect(words(rows[1].querySelector("td a"))).toBe("Task of 2026-11-06");
        expect(words(rows[1].querySelector("td a + .text-muted"))).toBe("Flights of pat");
        expect(texts(rows[1], "td").slice(3, 6)).toEqual(["", "", ""]);
        expect(texts(root, ".tweakui-performance-body > p.text-muted")[0])
            .toBe("The last 2 finished tasks of yours (completed, failed or canceled), newest first.");
    });

    test("an admin's list says it holds the server's tasks, and no tasks says so", async () => {
        let {root} = await started([json(report({admin: true}))]);
        expect(root.textContent).toContain("The last 2 finished tasks on this server (completed, failed or canceled), newest first.");
        ({root} = await started([json(report({tasks: [], nodes: []}))]));
        expect(root.textContent).toContain("No finished tasks yet.");
        expect(root.textContent).toContain("No processing node is available to you.");
    });

    // A task with what its report and log say: 208 of 220 photos placed, two reconstructions, GPS error, no GPU
    function reported(id, extra) {
        return task(id, Object.assign({status: "completed", photos_given: 220, photos_reconstructed: 208, area: 384.7,
            reconstructions: 2, position_error: {kind: "gps", meters: 0.0236}, gpu: false, notes: [], other: [], more: 0}, extra));
    }
    const cells = row => texts(row, "td").slice(2);

    test("recent tasks show the photos placed of those given, area, reconstructions, position error and GPU", async () => {
        const {root} = await started([json(report({tasks: [reported("t1"), reported("t2", {photos_reconstructed: 220,
            reconstructions: 1, position_error: {kind: "gcp", meters: 1.234}, gpu: true, area: 25000})]}))]);
        const rows = root.querySelectorAll(".tweakui-performance-table tbody tr");
        expect(cells(rows[0])).toEqual(["208 of 220", "13m 44s", "3.8s", "Reconstruction 1m 42s", "385 m\u00b2", "2", "2.4 cm GPS", "No", "node-odx-1"]);
        expect(cells(rows[1]).slice(0, 1).concat(cells(rows[1]).slice(4, 8))).toEqual(["220 of 220", "2.50 ha", "1", "1.23 m GCP", "Yes"]);
        // Fewer photos placed than given, and more than one reconstruction, in the warning colour
        expect(rows[0].querySelectorAll("td .text-warning").length).toBe(2);
        expect(rows[1].querySelectorAll("td .text-warning").length).toBe(0);
        // At phone width the wide columns hide; their figures come under the task's name
        expect(words(rows[0].querySelector(".tweakui-performance-detail")))
            .toMatch(/Slowest Reconstruction 1m 42s · 385 m² · 2 reconstructions · 2\.4 cm GPS error · GPU: No · node-odx-1$/);
    });

    test("areas and errors follow WebODM's unit system, and are redrawn when it changes", async () => {
        expect([performancePage.formatArea(12000, "metric"), performancePage.formatArea(50000, "imperial"),
            performancePage.formatArea(100, "imperialUS")]).toEqual(["1.20 ha", "12.36 ac", "1,076 ft\u00b2"]);
        expect([performancePage.formatLength(1.5, "metric"), performancePage.formatLength(0.5, "imperial"),
            performancePage.formatLength(0.2, "imperial"), performancePage.formatLength(null, "metric")])
            .toEqual(["1.50 m", "1.64 ft", "7.9 in", ""]);
        window.localStorage.setItem("unit_system", "imperial");
        try {
            const {root} = await started([json(report({tasks: [reported("t1")]}))]);
            const row = () => root.querySelector(".tweakui-performance-table tbody tr");
            expect(cells(row()).slice(4, 7)).toEqual(["4,141 ft\u00b2", "2", "0.9 in GPS"]);
            window.localStorage.setItem("unit_system", "metric");
            document.dispatchEvent(new Event("onUnitSystemChanged"));
            expect(cells(row()).slice(4, 7)).toEqual(["385 m\u00b2", "2", "2.4 cm GPS"]);
        } finally {
            window.localStorage.removeItem("unit_system");
        }
    });

    test("failed and canceled tasks say so, a failure with its error and its notes open", async () => {
        const failed = reported("t1", {status: "failed", error: "Process exited with code 1", seconds_per_image: null,
            notes: [{key: "out_of_memory", level: "danger", text: "Processing ran out of memory and stopped.", line: "[ERROR] Whoops! You ran out of memory!"}]});
        const {root} = await started([json(report({tasks: [failed, reported("t2", {status: "canceled"})]}))]);
        const failedRow = root.querySelector('tr[data-task="t1"]');
        expect(words(failedRow.querySelector("[data-status=failed]"))).toBe("Failed: Process exited with code 1");
        expect(words(root.querySelector('tr[data-task="t2"] [data-status=canceled]'))).toBe("Canceled");
        const notes = root.querySelector("#tweakui-performance-notes-t1");
        expect(notes.hidden).toBe(false);
        expect(failedRow.querySelector("[data-act=notes]").getAttribute("aria-expanded")).toBe("true");
        expect(failedRow.querySelector("[data-act=notes] .fa").className).toContain("text-danger");
        expect(words(notes.querySelector("[data-note=out_of_memory]")))
            .toBe("Processing ran out of memory and stopped. [ERROR] Whoops! You ran out of memory!");
        // The canceled task has no notes, so no button and no row
        expect(root.querySelector('tr[data-task="t2"] [data-act=notes]')).toBeNull();
    });

    test("a task's Notes button opens its notes, with the log's other messages in a list that opens", async () => {
        const t = reported("t1", {
            notes: [{key: "reconstructions", level: "warning", text: "The photos made 2 separate reconstructions.", line: "[WARNING] Multiple reconstructions detected (2)"},
                {key: "left_out", level: "warning", text: "12 of 220 photos were left out.", line: ""}],
            other: [{text: "[WARNING] Shots are aligned on a single-line", count: 3}, {text: "[ERROR] <b>odd</b>", count: 1}], more: 4});
        const {root} = await started([json(report({tasks: [t, reported("t2", {other: [{text: "[WARNING] x", count: 1}]})]}))]);
        const button = root.querySelector('tr[data-task="t1"] [data-act=notes]'), row = root.querySelector("#tweakui-performance-notes-t1");
        expect(words(button)).toBe("2 Notes");
        expect(row.hidden).toBe(true);
        button.click();
        expect([row.hidden, button.getAttribute("aria-expanded")]).toEqual([false, "true"]);
        expect(texts(row, ".tweakui-performance-notes > li")).toEqual([
            "The photos made 2 separate reconstructions. [WARNING] Multiple reconstructions detected (2)", "12 of 220 photos were left out."]);
        const other = row.querySelector("details.tweakui-performance-other");
        expect([other.open, words(other.querySelector("summary"))]).toEqual([false, "Other Messages (6)"]);
        expect(texts(other, "li")).toEqual(["[WARNING] Shots are aligned on a single-line (3 times)", "[ERROR] <b>odd</b>", "4 more messages not shown."]);
        expect(other.querySelector("b")).toBeNull();
        button.click();
        expect(row.hidden).toBe(true);
        // Only other messages: the button counts them
        expect(words(root.querySelector('tr[data-task="t2"] [data-act=notes]'))).toBe("1 Message");
    });

    test("the photos left out are listed under their note: links that open them, a thumbnail on hover, and Copy Names", async () => {
        const photos = [{name: "DJI_0007_T.JPG", reason: "no_features"}, {name: "a b&c.tif", reason: "no_gps"}, {name: "DJI_0051_T.JPG", reason: null}];
        const t = reported("t1", {notes: [{key: "left_out", level: "warning", text: "4 of 220 photos were left out.", line: "", photos, more: 1}]});
        const {root} = await started([json(report({tasks: [t]}))]);
        root.querySelector("[data-act=notes]").click();
        const list = root.querySelector("[data-note=left_out] details.tweakui-performance-photos");
        expect([list.open, words(list.querySelector("summary"))]).toEqual([false, "Photos Left Out (4)"]);
        expect(texts(list, "li")).toEqual(["DJI_0007_T.JPG No features", "a b&c.tif No GPS", "DJI_0051_T.JPG", "1 more photo not shown."]);
        const links = list.querySelectorAll("a");
        expect([links[1].getAttribute("href"), links[1].target, links[1].rel])
            .toEqual(["/api/projects/3/tasks/t1/images/thumbnail/a%20b%26c.tif?size=2048", "_blank", "noopener"]);
        // Hovering a name shows its thumbnail in one box over the page; leaving it hides it
        links[0].dispatchEvent(new MouseEvent("mouseover", {bubbles: true}));
        const thumb = root.querySelector(".tweakui-performance-thumb");
        expect([thumb.hidden, thumb.querySelector("img").getAttribute("src")]).toEqual([false, "/api/projects/3/tasks/t1/images/thumbnail/DJI_0007_T.JPG?size=256"]);
        links[0].dispatchEvent(new MouseEvent("mouseout", {bubbles: true}));
        expect(thumb.hidden).toBe(true);
        links[1].dispatchEvent(new FocusEvent("focusin", {bubbles: true}));
        expect([thumb.hidden, thumb.querySelector("img").getAttribute("src")]).toEqual([false, "/api/projects/3/tasks/t1/images/thumbnail/a%20b%26c.tif?size=256"]);
        expect(root.querySelectorAll(".tweakui-performance-thumb")).toHaveLength(1);
        // Copy Names: a line each
        const writeText = jest.fn(() => Promise.resolve());
        Object.defineProperty(window.navigator, "clipboard", {value: {writeText}, configurable: true});
        list.querySelector("[data-act=copy-names]").click();
        await flush();
        expect(writeText).toHaveBeenCalledWith("DJI_0007_T.JPG\na b&c.tif\nDJI_0051_T.JPG");
        expect(list.querySelector("[data-act=copy-names] i").className).toBe("fa fa-check");
        delete window.navigator.clipboard;
    });

    test("the trend reads as a sentence: faster, slower or about the same", async () => {
        expect(performancePage.trendText(null)).toBe("");
        expect(performancePage.trendText({recent: 2, earlier: 4, change: -0.5, same: false}))
            .toMatch(/^Recent tasks took 50% less time per photo than earlier ones \(2\.0s against 4\.0s\)/);
        expect(performancePage.trendText({recent: 4, earlier: 2, change: 1, same: false})).toMatch(/100% more/);
        expect(performancePage.trendText({recent: 2.1, earlier: 2, change: 0.05, same: true}))
            .toBe("Recent tasks took about as long per photo as earlier ones (2.1s against 2.0s).");
        const {root} = await started([json(report({trend: {recent: 2, earlier: 4, change: -0.5, same: false}}))]);
        expect(root.querySelector(".tweakui-performance-trend").textContent).toMatch(/50% less/);
    });

    test("Refresh asks again, is disabled while it waits and keeps the page when it fails", async () => {
        const {root, fetchFn, view} = await started([json(report()), json(report({verdicts: []})), new Error("down")]);
        const button = root.querySelector("[data-act=refresh]");
        expect(root.querySelector(".tweakui-performance-status").textContent).toMatch(/^Updated /);
        button.click();
        expect(button.disabled).toBe(true);
        expect(root.querySelector(".tweakui-performance-status").textContent).toBe("Refreshing...");
        await flush();
        await flush();
        expect(button.disabled).toBe(false);
        expect(root.querySelectorAll(".tweakui-performance-verdicts li").length).toBe(0);
        await view.load();
        expect(fetchFn).toHaveBeenCalledTimes(3);
        expect(root.querySelector(".tweakui-performance-status").textContent).toBe("Could not refresh.");
        expect(root.querySelector("[data-node='1']")).not.toBeNull();
    });

    test("a report that can't be loaded says so", async () => {
        const {root} = await started([json({}, false, 500)]);
        expect(root.querySelector(".tweakui-performance-body .text-danger").textContent).toBe("Could not load the performance report.");
    });

    test("names from the report are escaped", async () => {
        const {root} = await started([json(report({nodes: [node({name: "<b>x</b>"})], verdicts: [{level: "success", text: "<i>y</i>"}]}))]);
        expect(root.querySelector("b")).toBeNull();
        expect(root.querySelector(".tweakui-performance-verdicts i:not(.fa)")).toBeNull();
        expect(root.textContent).toContain("<b>x</b>");
    });

    test("durations and numbers read as people write them", () => {
        expect(performancePage.formatDuration(42)).toBe("42s");
        expect(performancePage.formatDuration(802.5)).toBe("13m 23s");
        expect(performancePage.formatDuration(7500)).toBe("2h 5m");
        expect(performancePage.formatDuration(null)).toBe("");
        expect(performancePage.formatNumber(1500)).toBe("1,500");
        expect(performancePage.formatNumber(1234567)).toBe("1,234,567");
    });

    test("the CPU's busy share comes from the difference between two readings, none from one", () => {
        const a = cpu([100, 1000], 2), b = cpu([400, 2000], 2);
        expect(performancePage.cpuShares(a, b)).toEqual({total: 0.3});
        expect(performancePage.cpuShares(null, b)).toBeNull();
        expect(performancePage.cpuShares(a, cpu([100, 1000], 2))).toEqual({total: null});
    });

    test("CPU Load shows the total of all cores with its graph and the load averages, and says it is measuring before two readings", () => {
        const div = document.createElement("table");
        div.innerHTML = performancePage.cpuRows(cpu([0, 0], 128), null);
        expect(words(div)).toBe("CPU Load Measuring... Load Average 1.50, 1.25, 1.00 (1, 5 and 15 minutes)");
        div.innerHTML = performancePage.cpuRows(cpu([0, 0], 128), {total: 0.375});
        expect(div.querySelector("[data-cpu-total]").textContent).toBe("38%");
        expect(words(div)).toContain("38% of 128 cores");
        expect(div.querySelectorAll(".progress-bar")).toHaveLength(0);
        expect(div.querySelector(".tweakui-performance-graph").getAttribute("data-graph")).toBe("cpu");
        div.innerHTML = performancePage.cpuRows(cpu([0, 0], 1, null), {total: 0.5});
        expect(words(div)).not.toContain("Load Average");
        expect(words(div)).toContain("of 1 core");
        expect(performancePage.cpuRows(null, null)).toBe("");
    });

    test("the live figures are asked a second after the report, then every Refresh Every seconds, with the disk every 10", async () => {
        jest.useFakeTimers();
        const first = report({server: Object.assign(report().server, {cpu: cpu([0, 0], 2)})});
        const live = (busy, extra) => json(Object.assign({cpu: cpu([busy, busy * 2 + 1000], 2),
            memory: {total: 64 * GB, free: 32 * GB, used: 32 * GB}, nodes: [{id: 1, online: true, total_memory: 64 * GB, available_memory: 16 * GB}]}, extra));
        const {root, fetchFn} = await started([json(first), live(500), live(1000), live(1500), live(2000, {disk: {total: 1000 * GB, used: 500 * GB, free: 500 * GB}}), live(2500)]);
        expect(root.querySelector("[data-server]").textContent).toContain("Measuring...");
        await jest.advanceTimersByTimeAsync(1000);
        expect(fetchFn.mock.calls[1][0]).toBe("/api/plugins/tweakui/performance/live");
        expect(root.querySelector("[data-cpu-total]").textContent).toBe("25%");
        expect(root.querySelectorAll("[data-server] .progress-bar")).toHaveLength(1);
        expect(Array.from(root.querySelectorAll("[data-server] [data-graph]")).map(g => g.getAttribute("data-graph"))).toEqual(["cpu", "memory"]);
        expect(words(root.querySelector("[data-node='1'] [data-memory]"))).toBe("16 GB free of 64 GB \u00b7 75% used");
        expect(words(root.querySelector("[data-server]"))).toContain("Memory 32 GB free of 64 GB");
        await jest.advanceTimersByTimeAsync(2999);
        expect(fetchFn).toHaveBeenCalledTimes(2);
        await jest.advanceTimersByTimeAsync(1);
        expect(fetchFn).toHaveBeenCalledTimes(3);
        await jest.advanceTimersByTimeAsync(6000);
        // At 1, 4, 7 and 10 seconds: the disk with the one 10 seconds after the report's
        expect(fetchFn.mock.calls.map(c => c[0]).slice(1)).toEqual(["/api/plugins/tweakui/performance/live",
            "/api/plugins/tweakui/performance/live", "/api/plugins/tweakui/performance/live",
            "/api/plugins/tweakui/performance/live?disk=1"]);
        expect(words(root.querySelector("[data-server]"))).toContain("Disk 500 GB free of 1000 GB");
        await jest.advanceTimersByTimeAsync(3000);
        expect(fetchFn.mock.calls[5][0]).toBe("/api/plugins/tweakui/performance/live");
    });

    test("each drive's activity comes from two readings: per second, the size of one operation, busy and the wait", () => {
        const a = io(10, [drive("sde", 1000, 500, 0, 0, 2000, 100)]);
        const b = io(12, [drive("sde", 1400, 700, 4096 * 400, 65536 * 200, 2800, 1100), drive("sdf", 1, 1, 0, 0, 0, 0)]);
        expect(performancePage.diskShares(a, b)).toEqual({sde: {reads: 200, writes: 100, read_rate: 819200, write_rate: 6553600,
            read_size: 4096, write_size: 65536, busy: 0.5, wait: (800 / 600)}});
        // Windows counts idle time; a drive whose counters went back is left out; one reading gives nothing
        const win = (t, idle) => io(t, [{name: "C:", mounts: ["C:"], tasks: true, reads: 10, writes: 0, read_bytes: 0, write_bytes: 0,
            read_ms: 0, write_ms: 0, idle_ms: idle}]);
        expect(performancePage.diskShares(win(0, 0), win(4, 3000))["C:"]).toEqual({reads: 0, writes: 0, read_rate: 0,
            write_rate: 0, read_size: null, write_size: null, busy: 0.25, wait: null});
        expect(performancePage.diskShares(a, io(12, [drive("sde", 5, 700, 0, 0, 0, 0)]))).toEqual({});
        expect(performancePage.diskShares(null, b)).toBeNull();
        expect(performancePage.diskShares(b, b)).toBeNull();
    });

    test("a drive's card says where it is mounted and whether it holds the tasks, then its reads, writes, busy share and wait", () => {
        const d = Object.assign(drive("sde", 0, 0, 0, 0, 0, 0), {mounts: ["/webodm/app/media", "/webodm/venv"], tasks: true});
        const div = document.createElement("div");
        div.innerHTML = performancePage.driveCardHtml(d, null);
        expect(words(div)).toBe("sde \u00b7 Tasks Mounted At /webodm/app/media, /webodm/venv Activity Measuring...");
        div.innerHTML = performancePage.driveCardHtml(d, {reads: 2.5, writes: 1200, read_rate: 10240, write_rate: 75 * 1024 * 1024,
            read_size: 4096, write_size: 65536, busy: 0.97, wait: 3.25});
        expect(words(div)).toBe("sde \u00b7 Tasks Mounted At /webodm/app/media, /webodm/venv Reads 2.5/s \u00b7 10 KB/s \u00b7 4 KB each " +
            "Writes 1,200/s \u00b7 75 MB/s \u00b7 64 KB each Busy 97% Wait 3.3 ms per operation");
        expect(div.querySelector("[data-busy]").className).toBe("text-danger");
        expect(Array.from(div.querySelectorAll("[data-graph]")).map(g => g.getAttribute("data-graph"))).toEqual(["drive:sde:ops", "drive:sde:busy"]);
        div.innerHTML = performancePage.driveCardHtml(Object.assign({}, d, {tasks: false}), {reads: 0, writes: 0, read_rate: 0, write_rate: 0,
            read_size: null, write_size: null, busy: null, wait: null});
        expect(words(div)).toBe("sde Mounted At /webodm/app/media, /webodm/venv Reads None Writes None Wait No operations");
    });

    test("the drives' activity is refreshed with CPU Load, the tasks' drive first", async () => {
        jest.useFakeTimers();
        const disks = (t, reads) => io(t, [Object.assign(drive("sde", reads, 0, reads * 4096, 0, 0, 0), {tasks: true, mounts: ["/media"]}),
            drive("sdd", 0, 0, 0, 0, 0, 0)]);
        const first = report({server: Object.assign(report().server, {disk_io: disks(100, 0)})});
        const {root} = await started([json(first), json({cpu: null, nodes: [], disk_io: disks(101, 300)}),
            json({cpu: null, nodes: [], disk_io: disks(104, 900)})]);
        expect(Array.from(root.querySelectorAll("[data-server-cards] > [data-drive]")).map(c => c.getAttribute("data-drive"))).toEqual(["sde", "sdd"]);
        expect(words(root.querySelector("[data-drive=sde]"))).toContain("Measuring...");
        expect(root.querySelector(".tweakui-performance-disk-note")).not.toBeNull();
        await jest.advanceTimersByTimeAsync(1000);
        expect(words(root.querySelector("[data-drive=sde]"))).toContain("Reads 300/s \u00b7 1.2 MB/s \u00b7 4 KB each");
        expect(root.querySelector("[data-server]")).not.toBeNull();
        await jest.advanceTimersByTimeAsync(3000);
        expect(words(root.querySelector("[data-drive=sde]"))).toContain("Reads 200/s");
    });

    test("readings are kept for 30 minutes, and a graph draws those in its window with a gap where they stopped", () => {
        const history = {};
        for (let t = 0; t <= 31 * 60000; t += 60000) performancePage.record(history, "cpu", t, 0.5);
        performancePage.record(history, "cpu", 31 * 60000, null);
        expect(history.cpu[0][0]).toBe(60000);
        expect(history.cpu).toHaveLength(31);
        const view = {history: {cpu: [[0, 0], [1000, 0.5], [2000, 1], [60000, 0.25]]}, now: 60000, span: 60000, gap: 15000};
        const div = document.createElement("div");
        div.innerHTML = performancePage.graphHtml(view, "cpu", [{key: "cpu"}], "percent");
        const paths = Array.from(div.querySelectorAll("path:not(.tweakui-performance-graph-area)")).map(p => p.getAttribute("d"));
        // A percent graph from 0 (the bottom, 39) to 100% (the top, 1); the reading after a minute's gap is a run of its own
        expect(paths).toEqual(["M0.0 39.0 L5.0 20.0 L10.0 1.0", "M300.0 29.5 h0"]);
        expect(div.querySelectorAll(".tweakui-performance-graph-area")).toHaveLength(1);
        expect(div.querySelector(".tweakui-performance-graph-max")).toBeNull();
        expect(performancePage.niceCeil(0)).toBe(1);
        expect(performancePage.niceCeil(130)).toBe(200);
        expect(performancePage.niceCeil(4200)).toBe(5000);
    });

    test("a rate graph has two lines, the first in the theme's link colour and the second in its text colour, up to its highest reading", () => {
        const view = {history: {r: [[0, 30], [3000, 130]], w: [[0, 10], [3000, 0]]}, now: 3000, span: 6000, gap: 15000};
        const div = document.createElement("div");
        div.innerHTML = performancePage.graphHtml(view, "ops", [{key: "r", label: "Reads"}, {key: "w", label: "Writes"}], "rate");
        expect(Array.from(div.querySelectorAll("g")).map(g => g.getAttribute("class"))).toEqual(["tweakui-performance-accent", "theme-color-primary"]);
        expect(div.querySelector(".tweakui-performance-graph-max").textContent).toBe("200/s");
        expect(div.querySelector("g:last-child path").getAttribute("d")).toBe("M150.0 37.1 L300.0 39.0");
        expect(performancePage.graphTip(view, ["r", "w"], ["Reads", "Writes"], "rate", 2000))
            .toBe("Reads 130/s \u00b7 Writes 0/s \u00b7 " + new Date(3000).toLocaleTimeString());
        expect(performancePage.graphTip(view, ["r"], [""], "rate", 60000)).toBe("");
    });

    test("the graphs fill as the page refreshes, keep their readings through Refresh, and show the readings under the pointer", async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(2026, 10, 8, 12, 0, 0));
        const live = (busy) => json({cpu: cpu([busy, busy * 2 + 1000], 2), memory: {total: 64 * GB, free: 16 * GB, used: 48 * GB},
            nodes: [{id: 1, online: true, total_memory: 64 * GB, available_memory: 32 * GB}]});
        const first = report({server: Object.assign(report().server, {cpu: cpu([0, 0], 2)})});
        const {root, view} = await started([json(first), live(500), live(1000), json(first), live(1500)]);
        await jest.advanceTimersByTimeAsync(1000);
        await jest.advanceTimersByTimeAsync(3000);
        expect(view.state.history.cpu.map(p => p[1])).toEqual([0.25, 0.5]);
        expect(view.state.history.memory.map(p => p[1])).toEqual([62 / 64, 0.75, 0.75]);
        expect(view.state.history["node:1"].map(p => p[1])).toEqual([0.25, 0.5, 0.5]);
        await view.load();
        expect(view.state.history.cpu).toHaveLength(2);
        const graph = root.querySelector('[data-graph="cpu"]');
        graph.getBoundingClientRect = () => ({left: 0, width: 300, top: 0, height: 42});
        graph.dispatchEvent(new MouseEvent("pointermove", {bubbles: true, clientX: 300}));
        const tip = () => root.querySelector('[data-graph="cpu"] .tweakui-performance-graph-tip');
        expect(tip().textContent).toBe("50% \u00b7 " + new Date(2026, 10, 8, 12, 0, 4).toLocaleTimeString());
        await jest.advanceTimersByTimeAsync(3000);
        expect(tip()).not.toBeNull();
        root.dispatchEvent(new MouseEvent("pointerleave"));
        expect(tip()).toBeNull();
    });

    test("the graphs' accent is the theme's link colour, read from the page", async () => {
        const style = document.createElement("style");
        style.textContent = "a { color: rgb(1, 2, 3); }";
        document.head.appendChild(style);
        try {
            const {root} = await started([json(report())]);
            expect(root.style.getPropertyValue("--tweakui-performance-accent")).toBe("rgb(1, 2, 3)");
            expect(root.querySelector("a[hidden]")).toBeNull();
        } finally {
            style.remove();
        }
    });

    test("History Length starts from the page's value, redraws the graphs over the new window at once and saves it", async () => {
        const {root, fetchFn, view} = await started([json(report()), json({performance_history: 20})], 3, 10);
        expect(view.state.minutes).toBe(10);
        const slider = root.querySelector('[data-control="history"] .tweakui-performance-every-slider');
        slider.value = "20";
        slider.dispatchEvent(new Event("input"));
        expect(view.state.minutes).toBe(20);
        expect(root.querySelector("#tweakui-performance-history").value).toBe("20");
        slider.dispatchEvent(new Event("change"));
        await Promise.resolve();
        const [url, options] = fetchFn.mock.calls[1];
        expect(url).toBe("/api/plugins/tweakui/settings");
        expect(JSON.parse(options.body)).toEqual({performance_history: 20});
        // Refresh Every's box is its own
        expect(root.querySelector("#tweakui-performance-refresh").value).toBe("3");
    });

    test("no refresh is asked while the last is unanswered, and a failed one keeps the figures", async () => {
        jest.useFakeTimers();
        let answer;
        const pending = new Promise(r => { answer = r; });
        const {root, fetchFn} = await started([json(report()), pending, new Error("down"), json({cpu: null, nodes: []})]);
        await jest.advanceTimersByTimeAsync(20000);
        expect(fetchFn).toHaveBeenCalledTimes(2);
        answer({ok: true, status: 200, json: () => Promise.resolve({cpu: null, memory: null, nodes: []})});
        await jest.advanceTimersByTimeAsync(3000);
        expect(fetchFn).toHaveBeenCalledTimes(3);
        await jest.advanceTimersByTimeAsync(3000);
        expect(fetchFn).toHaveBeenCalledTimes(4);
        expect(words(root.querySelector("[data-server]"))).toContain("Memory 2 GB free of 64 GB");
    });

    test("the refresh pauses while the browser tab is hidden and resumes at once when it shows again", async () => {
        jest.useFakeTimers();
        const {fetchFn} = await started([json(report()), json({cpu: null, nodes: []})]);
        Object.defineProperty(document, "hidden", {value: true, configurable: true});
        document.dispatchEvent(new Event("visibilitychange"));
        await jest.advanceTimersByTimeAsync(30000);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        Object.defineProperty(document, "hidden", {value: false, configurable: true});
        document.dispatchEvent(new Event("visibilitychange"));
        await jest.advanceTimersByTimeAsync(0);
        expect(fetchFn).toHaveBeenCalledTimes(2);
        delete document.hidden;
    });

    test("Refresh Every starts from the page's value, applies a change at once and saves it to the user's settings", async () => {
        jest.useFakeTimers();
        const saved = Object.assign({}, {performance_refresh: 7});
        const {root, fetchFn, view} = await started([json(report()), json({cpu: null, nodes: []}), json(saved), json({cpu: null, nodes: []})], 5);
        expect(view.state.seconds).toBe(5);
        await jest.advanceTimersByTimeAsync(1000);
        expect(fetchFn).toHaveBeenCalledTimes(2);
        const slider = root.querySelector(".tweakui-performance-every-slider"), box = root.querySelector("#tweakui-performance-refresh");
        slider.value = "7";
        slider.dispatchEvent(new Event("input"));
        expect(box.value).toBe("7");
        expect(view.state.seconds).toBe(7);
        slider.dispatchEvent(new Event("change"));
        await jest.advanceTimersByTimeAsync(0);
        const [url, options] = fetchFn.mock.calls[2];
        expect(url).toBe("/api/plugins/tweakui/settings");
        expect(options.method).toBe("PATCH");
        expect(JSON.parse(options.body)).toEqual({performance_refresh: 7});
        expect(window.TweakUI.settings.performance_refresh).toBe(7);
        await jest.advanceTimersByTimeAsync(6999);
        expect(fetchFn).toHaveBeenCalledTimes(3);
        await jest.advanceTimersByTimeAsync(1);
        expect(fetchFn).toHaveBeenCalledTimes(4);
    });

    test("a Refresh Every box out of range puts back the saved value and says why", async () => {
        const {root, fetchFn, view} = await started([json(report())]);
        const box = root.querySelector("#tweakui-performance-refresh");
        box.value = "12";
        box.dispatchEvent(new Event("change"));
        expect(box.value).toBe("3");
        expect(view.state.seconds).toBe(3);
        expect(root.querySelector(".tweakui-performance-every-status").textContent).toBe("Not saved: a whole number from 1 to 10");
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });
});
