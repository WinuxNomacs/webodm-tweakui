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

function page() {
    document.body.innerHTML = `
      <div id="tweakui-performance" data-api="/api/plugins/tweakui/">
        <div class="tweakui-performance-bar"><button data-act="refresh"></button><span class="tweakui-performance-status"></span></div>
        <div class="tweakui-performance-body"></div>
      </div>`;
    return document.getElementById("tweakui-performance");
}

const json = (data, ok = true, status = 200) => Promise.resolve({ok, status, json: () => Promise.resolve(data)});

async function started(answers) {
    const root = page();
    const fetchFn = jest.fn(() => {
        const next = answers.length > 1 ? answers.shift() : answers[0];
        return next instanceof Error ? Promise.reject(next) : next;
    });
    const view = performancePage.start(document, window, fetchFn);
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

    test("an online node's card shows its engine, cores, memory with a bar, queue, max photos and what it suits", async () => {
        const {root} = await started([json(report())]);
        const card = root.querySelector('[data-node="1"]');
        expect(card.querySelector(".label").textContent).toBe("Online");
        expect(texts(card, "tr")).toEqual(["Engine ODX 3.8.5 (API 2.4.0)", "CPU Cores 20", "Memory 48 GB free of 64 GB",
            "Queue 0 tasks (1 at a time)", "Max Photos No limit", "Suits About 1,500 photos per task"]);
        expect(card.querySelector(".progress-bar").style.width).toBe("25%");
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

    test("the server's disk and memory get bars coloured as they fill", async () => {
        const {root} = await started([json(report())]);
        const server = root.querySelector("[data-server]");
        expect(texts(server, "tr")).toEqual(["Disk 100 GB free of 1000 GB", "Memory 2 GB free of 64 GB"]);
        expect(Array.from(server.querySelectorAll(".progress-bar")).map(b => b.className.replace("progress-bar progress-bar-", "")))
            .toEqual(["warning", "danger"]);
    });

    test("recent tasks link to their map and show photos, time, time per photo, the slowest step and the node", async () => {
        const {root} = await started([json(report())]);
        const rows = root.querySelectorAll(".tweakui-performance-table tbody tr");
        expect(rows[0].querySelector("a").getAttribute("href")).toBe("/map/project/3/task/t1/");
        expect(texts(rows[0], "td").slice(2)).toEqual(["220", "13m 44s", "3.8s", "Reconstruction 1m 42s", "node-odx-1"]);
        // Another user's (an admin's view), with no name, time or stats
        expect(texts(rows[1], "td")[0]).toBe("Task of 2026-11-06 Flights of pat");
        expect(texts(rows[1], "td").slice(3, 6)).toEqual(["", "", ""]);
        expect(texts(root, ".tweakui-performance-body > p.text-muted")[0]).toBe("The last 2 completed tasks of yours, newest first.");
    });

    test("an admin's list says it holds the server's tasks, and no tasks says so", async () => {
        let {root} = await started([json(report({admin: true}))]);
        expect(root.textContent).toContain("The last 2 completed tasks on this server, newest first.");
        ({root} = await started([json(report({tasks: [], nodes: []}))]));
        expect(root.textContent).toContain("No completed tasks yet.");
        expect(root.textContent).toContain("No processing node is available to you.");
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
});
