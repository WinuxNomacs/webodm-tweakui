// Checks a WebODM for the elements TweakUI's scripts rely on (the SELECTORS list at the top of each script in
// tweakui/public/), so a new WebODM version is checked against the lists rather than by reading every script:
// `TW_USER=... TW_PASSWORD=... npm run selector-check`, by default against the 4.0.0 dev server
// (TW_BASE=http://localhost:8005). It opens the Dashboard, a task's panel and its Task Options dialog, the task's 2D map
// and its 3D view, and lists each selector it finds or not, by script and name; it exits with 1 when one is missing.
// It uses the account's own data, read only: the first completed task with an orthophoto and a textured model (or
// TW_TASK=<project>/<task>). With none, it processes WebODM's own 5 test images (TW_IMAGES, by default
// ignored/WebODM/nodeodm/fixtures/test_images; a minute or two) in a project "Selector check", deleted afterwards,
// also after a failure. It changes no setting.
"use strict";
const path = require("path");
const fs = require("fs");

const PUBLIC = path.join(__dirname, "..", "tweakui", "public");
const IMAGES = process.env.TW_IMAGES || path.join(__dirname, "..", "ignored", "WebODM", "nodeodm", "fixtures", "test_images");

// Where each script's selectors are, a page below. within: a selector found inside the element of another of the
// script's selectors (relative ones such as ":scope > ..." or "tbody > tr"); className: a class name, not a selector;
// pages: a selector on another page than the script's; admin: shown to administrators only. A script with selectors
// and no entry here fails the check, so a new script's list is not left out
const WHERE = {
    core: {page: "dashboard"},
    main: {page: "dashboard", admin: ["adminTheme"]},
    nav_pane: {page: "dashboard"},
    task_controls: {page: "task", className: ["open"]},
    task_details: {page: "task", within: {rows: "table"}},
    task_options: {page: "taskOptions"},
    preset_menu: {page: "taskOptions"},
    movable_controls: {page: "map", within: {titles: "control"}},
    source_frames: {page: "map", pages: {modelView: "model"}},
    pick3d: {page: "model"},
    units_menu: {page: "map"},
};
const PAGES = ["dashboard", "task", "taskOptions", "map", "model"];

// Each script's SELECTORS, read from its source: {script: {name: selector}} (scripts with an empty list left out)
function readSelectors(dir) {
    const all = {};
    fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort().forEach(file => {
        const m = fs.readFileSync(path.join(dir, file), "utf8").match(/\bvar SELECTORS = (\{[\s\S]*?\});/);
        if (!m) return;
        const list = new Function("return " + m[1])();
        if (Object.keys(list).length) all[file.replace(/\.js$/, "")] = list;
    });
    return all;
}

// The checks, by page: [{script, name, selector, within, className, admin}]; scripts with no entry in WHERE
function plan(selectors) {
    const byPage = {}, unplaced = [];
    PAGES.forEach(p => { byPage[p] = []; });
    Object.keys(selectors).forEach(script => {
        const where = WHERE[script];
        if (!where) { unplaced.push(script); return; }
        Object.keys(selectors[script]).forEach(name => {
            const page = (where.pages && where.pages[name]) || where.page;
            const within = where.within && where.within[name];
            byPage[page].push({script, name, selector: selectors[script][name],
                within: within ? selectors[script][within] : null,
                className: !!(where.className && where.className.includes(name)),
                admin: !!(where.admin && where.admin.includes(name))});
        });
    });
    return {byPage, unplaced};
}

// In the page: which of the checks are found
function found(checks) {
    return checks.map(c => {
        if (c.className) return document.getElementsByClassName(c.selector).length > 0;
        if (c.within) return [...document.querySelectorAll(c.within)].some(e => e.querySelector(c.selector));
        return !!document.querySelector(c.selector);
    });
}

async function main() {
    const user = process.env.TW_USER, password = process.env.TW_PASSWORD;
    if (!user || !password) throw new Error("Set TW_USER and TW_PASSWORD to a WebODM account (the dev server's)");
    const {byPage, unplaced} = plan(readSelectors(PUBLIC));

    const {chromium} = require("playwright");
    const base = (process.env.TW_BASE || "http://localhost:8005").replace(/\/$/, "");
    const browser = await chromium.launch({headless: true});
    const page = await (await browser.newContext({viewport: {width: 1400, height: 900}})).newPage();
    await page.goto(base + "/login/");
    await page.fill("#id_username", user);
    await page.fill("#id_password", password);
    await Promise.all([page.waitForNavigation(), page.click("button[type=submit], input[type=submit]")]);
    if (page.url().includes("/login")) throw new Error("Could not log in as " + user);

    const csrf = async () => (await page.context().cookies()).find(c => c.name === "csrftoken").value;
    const api = async (method, url, body) => {
        const res = await page.request.fetch(base + url, {method, data: body, headers: {"X-CSRFToken": await csrf(), Referer: base + "/"}});
        if (!res.ok()) throw new Error(method + " " + url + ": " + res.status());
        return res.status() === 204 ? null : res.json();
    };

    let made = null, failed = 0;
    try {
        let task = await findTask(api);
        if (!task) {
            made = await api("POST", "/api/projects/", {name: "Selector check"});
            task = await processTestImages(page, api, base, csrf, made.id);
        }
        // Each page, opened as a user gets to it; what can't be opened is reported and its checks count as missing
        const open = {
            async dashboard() {
                await page.goto(base + "/dashboard/");
                await page.waitForSelector("#side-menu", {state: "attached", timeout: 20000});
            },
            async task() {
                await page.goto(`${base}/dashboard/?project_task_open=${task.project}&project_task_expanded=${task.id}`);
                await page.waitForSelector(".expanded-panel", {state: "attached", timeout: 20000});
                await page.waitForTimeout(1500);
            },
            async taskOptions() {
                await open.task();
                await page.click(".expanded-panel .edit-button", {force: true});
                // The task's form loads its presets and options before its button opens the dialog
                await page.waitForSelector('button[title="Edit Task Options"]', {timeout: 15000});
                await page.waitForTimeout(1500);
                await page.click('button[title="Edit Task Options"]');
                await page.waitForSelector(".edit-preset-dialog", {state: "attached", timeout: 15000});
                await page.waitForTimeout(1000);
                // Every group open (the Expand/Collapse button: Expand All, then with TweakUI's Configured Options When Collapsed, more
                // steps), so the options and subgroups are on the page
                for (let i = 0; i < 3 && !(await page.$(".edit-preset-dialog .fa-angle-double-up")); i++) {
                    await page.click(".edit-preset-dialog button:has(.fa-angle-double-down)");
                    await page.waitForTimeout(300);
                }
            },
            async map() {
                await page.goto(`${base}/map/project/${task.project}/task/${task.id}/`, {waitUntil: "domcontentloaded"});
                await page.waitForSelector(".leaflet-control-zoom-in", {timeout: 30000});
                await page.waitForTimeout(2000);
                // The Layers panel open, so the panels' titles are on the page
                await page.click(".leaflet-control-layers-control-button");
                await page.waitForTimeout(800);
            },
            async model() {
                await page.goto(`${base}/3d/project/${task.project}/task/${task.id}/`, {waitUntil: "domcontentloaded"});
                await page.waitForFunction(() => window.viewer && window.viewer.scene, null, {timeout: 60000});
                await page.waitForTimeout(3000);
            },
        };
        console.log(`WebODM at ${base}, task ${task.project}/${task.id}${made ? " (made for the check)" : ""}`);
        for (const name of PAGES) {
            const checks = byPage[name];
            if (!checks.length) continue;
            let results;
            try {
                await open[name]();
                results = await page.evaluate(found, checks);
            } catch (e) {
                console.log(`${name}: could not open it (${e.message.split("\n")[0]})`);
                results = checks.map(() => false);
            }
            console.log(name);
            checks.forEach((c, i) => {
                if (!results[i]) failed++;
                console.log(`  ${results[i] ? "ok     " : "MISSING"} ${c.script}.${c.name}: ${c.within ? c.within + " ... " : ""}${c.selector}` +
                    (!results[i] && c.admin ? " (shown to administrators only)" : ""));
            });
        }
        unplaced.forEach(script => {
            failed++;
            console.log(`NOT CHECKED ${script}: its selectors have no page in dev/selector-check.js (WHERE)`);
        });
        console.log(failed ? `${failed} missing` : "every selector found");
    } finally {
        if (made) {
            await api("DELETE", `/api/projects/${made.id}/`).catch(e => console.log("could not delete the project:", e.message));
            console.log(`project "${made.name}" deleted`);
        }
        await browser.close();
    }
    return failed;
}

// The first completed task with an orthophoto and a textured model, or TW_TASK; null when there is none
async function findTask(api) {
    const wanted = process.env.TW_TASK && process.env.TW_TASK.split("/");
    for (const project of await api("GET", "/api/projects/?ordering=created_at")) {
        if (wanted && String(project.id) !== wanted[0]) continue;
        for (const t of await api("GET", `/api/projects/${project.id}/tasks/?ordering=created_at`)) {
            if (wanted ? t.id === wanted[1] : t.status === 40 && t.available_assets.includes("orthophoto.tif") && t.available_assets.includes("textured_model.zip"))
                return {project: project.id, id: t.id};
        }
    }
    if (wanted) throw new Error("No task " + process.env.TW_TASK);
    return null;
}

// A task of WebODM's test images in the project, processed with the default options
async function processTestImages(page, api, base, csrf, project) {
    const files = fs.readdirSync(IMAGES).filter(f => /\.jpe?g$/i.test(f));
    if (!files.length) throw new Error("No completed task to check, and no images in " + IMAGES + " to make one (TW_IMAGES)");
    const form = new FormData();
    files.forEach(f => form.append("images", new Blob([fs.readFileSync(path.join(IMAGES, f))], {type: "image/jpeg"}), f));
    form.append("name", "Selector check");
    const res = await page.request.post(`${base}/api/projects/${project}/tasks/`, {multipart: form, headers: {"X-CSRFToken": await csrf(), Referer: base + "/"}});
    if (!res.ok()) throw new Error("Could not make a task: " + res.status());
    const id = (await res.json()).id;
    console.log(`processing ${files.length} test images...`);
    for (let i = 0; i < 120; i++) {
        const t = await api("GET", `/api/projects/${project}/tasks/${id}/`);
        if (t.status === 40) return {project, id};
        if (t.status === 30 || t.status === 50) throw new Error("The test task failed or was canceled: " + (t.last_error || ""));
        await page.waitForTimeout(5000);
    }
    throw new Error("The test task took more than 10 minutes");
}

module.exports = {readSelectors, plan, WHERE, PUBLIC};

if (require.main === module) {
    main().then(failed => process.exit(failed ? 1 : 0), e => { console.error(e.message || e); process.exit(2); });
}
