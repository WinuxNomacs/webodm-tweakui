// Retakes the screenshots of TweakUI's features (the settings page's previews and the docs' images) from a running
// WebODM: `TW_USER=... TW_PASSWORD=... npm run screenshots [-- name ...]`, by default against the 4.0.0 dev server
// (TW_BASE=http://localhost:8005). It uses the account's own data, read only: the first completed task with an
// orthophoto and a textured model (or TW_TASK=<project>/<task>). It turns on the settings each shot needs and puts
// the account's settings back afterwards, also after a failure; a shot that has to add something (theme-published,
// as a superuser) deletes it again in its cleanup, also after a failure. Each image is a WebP, at most 1280 px wide, in
// tweakui/public/previews/<name>.webp.
"use strict";
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "..", "tweakui", "public", "previews");
const WIDTH = 1280, HEIGHT = 800, MAX_WIDTH = 1280;

// Every shot: its name (the image's), the settings it turns on (on top of WebODM's theme, the rest as they are;
// a Dashboard shot turns Expand Task Controls off, which expands every task of the project),
// and what it does to show the feature, returning what to capture: an element's selector, "page" for the
// viewport, or {pair: [[label, png], ...]} for images side by side (two or three). A pair turns its setting on itself.
// An optional cleanup(s) runs after the shot, also when it failed.
const SHOTS = [
    {
        name: "show-configured-option-count", settings: {show_configured_option_count: true, expand_task_controls: false},
        async run(s) {
            await s.openTask();
            await s.page.click(".expanded-panel .edit-button");
            await s.page.click('button[title="Edit Task Options"]');
            await s.page.waitForSelector(".edit-preset-dialog .option-group-header[data-tweakui-count]");
            await s.page.waitForTimeout(500);
            return ".edit-preset-dialog .modal-content";
        },
    },
    {
        name: "expand-configured-options", settings: {show_configured_option_count: true, expand_configured_options: true, expand_task_controls: false},
        async run(s) {
            await s.openTask();
            await s.page.click(".expanded-panel .edit-button");
            await s.page.click('button[title="Edit Task Options"]');
            await s.page.waitForSelector(".edit-preset-dialog .option-group[data-tweakui-expand]");
            await s.page.waitForTimeout(500);
            return ".edit-preset-dialog .modal-content";
        },
    },
    {
        // A task's Edit form with the Options dropdown open, User Presets and System Presets opened
        name: "replace-preset-options-menu", settings: {replace_preset_menu: true, expand_task_controls: false},
        async run(s) {
            await s.openTask();
            await s.page.click(".expanded-panel .edit-button");
            await s.page.waitForSelector(".tweakui-presets-button");
            await s.page.waitForTimeout(500);
            // A window tall enough for the open menu below the row (the next shot sets it back)
            await s.page.setViewportSize({width: WIDTH, height: 1200});
            await s.page.click(".tweakui-presets-button");
            // Both submenus open
            for (const key of ["user", "system"]) {
                const head = `.tweakui-presets-group-head[data-group="${key}"]`;
                if (await s.page.$(head + '[aria-expanded="false"]')) await s.page.click(head);
            }
            await s.page.mouse.move(0, 0);
            await s.page.waitForTimeout(300);
            const box = await s.page.evaluate(() => {
                const row = document.querySelector(".tweakui-presets").closest(".form-group").getBoundingClientRect();
                const menu = document.querySelector(".tweakui-presets-menu").getBoundingClientRect();
                return {x: row.left, y: row.top, right: row.right, bottom: menu.bottom};
            });
            return {clip: {x: box.x, y: box.y - 16, width: box.right - box.x, height: box.bottom - box.y + 32}};
        },
    },
    {
        name: "enhanced-task-details", settings: {enhanced_task_details: true, expand_task_controls: false},
        async run(s) {
            await s.openTask();
            await s.page.waitForSelector(".expanded-panel [data-tweakui-row]");
            await s.page.waitForTimeout(800);
            return ".expanded-panel";
        },
    },
    {
        name: "themes", settings: {theme: "catppuccin-mocha", expand_task_controls: false},
        async run(s) {
            await s.openTask();
            await s.page.waitForTimeout(800);
            return "page";
        },
    },
    {
        // The header's units menu open (the browser's unit system is the fresh profile's, Metric)
        name: "units-in-header", settings: {units_in_header: true, show_theme_menu: true},
        async run(s) {
            await s.page.goto(s.base + "/dashboard/");
            await s.page.click(".tweakui-units-menu > a");
            await s.page.waitForSelector(".tweakui-units-list", {state: "visible"});
            await s.page.waitForTimeout(300);
            const box = await s.page.$eval(".tweakui-units-list", e => { const r = e.getBoundingClientRect(); return {x: r.left, y: 0, right: r.right, bottom: r.bottom}; });
            const x = Math.max(0, box.x - 160);
            return {clip: {x, y: 0, width: Math.min(WIDTH, box.right + 120) - x, height: box.bottom + 16}};
        },
    },
    {
        // A task's map with the side menu hidden: the map takes the whole width, the tab at the left edge
        name: "hide-navigation-pane", settings: {hide_nav_pane: true},
        async run(s) {
            await s.openMap();
            await s.page.click(".tweakui-nav-tab");
            await s.page.waitForTimeout(800);
            return "page";
        },
    },
    {
        // A task's map with the side menu auto-hidden, shown over the map by the pointer at the left edge
        name: "auto-hide-navigation-pane", settings: {hide_nav_pane: true, auto_hide_nav_pane: true},
        async run(s) {
            await s.openMap();
            await s.page.mouse.move(400, 400);
            await s.page.mouse.move(2, 400, {steps: 5});
            await s.page.mouse.move(120, 300, {steps: 5});
            await s.page.waitForTimeout(800);
            return "page";
        },
    },
    {
        // A task's map with the side menu dragged down to its icons (a browser's tooltip isn't in a screenshot)
        name: "resize-navigation-pane", settings: {resize_nav_pane: true},
        async run(s) {
            await s.openMap();
            const x = await s.page.$eval(".tweakui-nav-handle", e => e.getBoundingClientRect().left + 3);
            await s.page.mouse.move(x, 400);
            await s.page.mouse.down();
            await s.page.mouse.move(80, 400, {steps: 10});
            await s.page.mouse.up();
            await s.page.mouse.move(700, 400);
            await s.page.waitForTimeout(800);
            return "page";
        },
    },
    {
        // Fireworks over the Dashboard: the first show starts 5-20 s after the page opens; taken once it's going
        name: "surprise-me", settings: {surprise_me: true, units_in_header: false},
        async run(s) {
            await s.page.goto(s.base + "/dashboard/");
            await s.page.waitForSelector(".tweakui-fireworks canvas", {timeout: 30000});
            await s.page.waitForTimeout(2500);
            return "page";
        },
    },
    {
        name: "theme-menu", settings: {show_theme_menu: true},
        async run(s) {
            await s.page.goto(s.base + "/dashboard/");
            await s.page.click(".tweakui-theme-menu > a");
            await s.page.waitForSelector(".tweakui-theme-list", {state: "visible"});
            await s.page.waitForTimeout(300);
            const box = await s.page.$eval(".tweakui-theme-list", e => { const r = e.getBoundingClientRect(); return {x: r.left, y: 0, right: r.right, bottom: r.bottom}; });
            const x = Math.max(0, box.x - 160);
            return {clip: {x, y: 0, width: Math.min(WIDTH, box.right + 16) - x, height: box.bottom + 16}};
        },
    },
    {
        // The editor on a copy of a preset, previewed on the page; nothing is saved
        name: "theme-editor", settings: {},
        async run(s) {
            await s.page.goto(s.base + "/plugins/tweakui/#themes");
            await s.page.click('[data-theme-id="catppuccin-mocha"] [data-theme-action=copy]');
            await s.page.waitForSelector("#tweakui-theme-preview", {state: "attached"});
            await s.page.waitForTimeout(500);
            return ".tweakui-editor";
        },
    },
    {
        // The Import panel with a theme pasted (Nord's colours, as Copy JSON gives them); nothing is imported
        name: "theme-import", settings: {},
        async run(s) {
            await s.page.goto(s.base + "/plugins/tweakui/#themes");
            const nord = await s.page.$eval("#tweakui-theme-colors", e => JSON.parse(e.textContent).nord.colors);
            await s.page.click("[data-theme-action=import]");
            await s.page.fill("#tweakui-import-text", JSON.stringify({name: "Night", colors: nord}, null, 2));
            await s.page.$eval("#tweakui-import-text", e => { e.setSelectionRange(0, 0); e.scrollTop = 0; });
            await s.page.waitForTimeout(300);
            return ".tweakui-import";
        },
    },
    {
        // Administration > TweakUI Themes with two sample published themes (Nord's and Gruvbox Dark's colours) and,
        // without own themes, one of the account's own to publish: added for the shot (under names not used yet) and
        // deleted afterwards
        name: "theme-published", settings: {},
        async run(s) {
            await s.page.goto(s.base + "/plugins/tweakui/");
            const colors = await s.page.$eval("#tweakui-theme-colors", e => JSON.parse(e.textContent));
            const published = await s.api("GET", "/api/plugins/tweakui/published");
            const names = published.map(t => t.name);
            s.publishedBefore = published.map(t => t.id);
            const samples = [["Harbour", colors.nord.colors], ["Field Office", colors["gruvbox-dark"].colors]]
                .filter(([name]) => !names.includes(name)).map(([name, c]) => ({name, colors: c}));
            if (samples.length) await s.api("POST", "/api/plugins/tweakui/published/import", samples);
            if (!(await s.api("GET", "/api/plugins/tweakui/themes")).length) {
                s.ownAdded = (await s.api("POST", "/api/plugins/tweakui/themes", {name: "Survey Day", colors: colors["solarized-light"].colors})).id;
            }
            await s.page.goto(s.base + "/plugins/tweakui/admin/themes/");
            await s.page.waitForTimeout(300);
            return ".tweakui-published";
        },
        async cleanup(s) {
            if (s.ownAdded) await s.api("DELETE", "/api/plugins/tweakui/themes/" + s.ownAdded);
            if (!s.publishedBefore) return;
            for (const t of await s.api("GET", "/api/plugins/tweakui/published")) {
                if (!s.publishedBefore.includes(t.id)) await s.api("DELETE", "/api/plugins/tweakui/published/" + t.id);
            }
        },
    },
    {
        // Administration > TweakUI as it is (superusers: the account must be one); nothing is changed
        name: "admin", settings: {},
        async run(s) {
            await s.page.goto(s.base + "/plugins/tweakui/admin/");
            await s.page.waitForSelector(".tweakui-admin");
            return ".tweakui-admin";
        },
    },
    {
        // Every task of the project minimized, as buttons only
        name: "expand-task-controls", settings: {expand_task_controls: true},
        async run(s) {
            await s.page.goto(s.base + "/dashboard/");
            await s.page.waitForSelector(".project-list-item");
            const project = '.project-list-item:has(.project-links a:has-text("Task"))';
            if (!(await s.page.$(project + " .task-list-item"))) await s.page.click(project + ' .project-links a:has-text("Task")');
            await s.page.waitForSelector(project + ' .task-list-item[data-tweakui-controls="buttons"] .action-buttons');
            await s.page.waitForTimeout(1000);
            return project;
        },
    },
    {
        name: "movable-controls", settings: {movable_controls: true},
        async run(s) {
            await s.openMap();
            await s.page.click(".leaflet-control-layers-control-button");
            const title = ".leaflet-control-layers-control .layers-control-panel .title";
            await s.page.waitForSelector(title, {state: "visible"});
            const h = await s.page.$eval(title, e => { const r = e.getBoundingClientRect(); return {x: r.left + 30, y: r.top + r.height / 2}; });
            await s.page.mouse.move(h.x, h.y);
            await s.page.mouse.down();
            await s.page.mouse.move(h.x - 420, h.y + 140, {steps: 10});
            await s.page.mouse.up();
            await s.page.waitForTimeout(300);
            return "page";
        },
    },
    {
        name: "other-tasks", settings: {other_tasks: true},
        async run(s) {
            await s.openMap();
            await s.page.click(".tweakui-other-tasks-button");
            await s.page.waitForSelector(".tweakui-other-task, .tweakui-other-tasks-message:not(:has-text('Loading'))", {timeout: 15000});
            await s.page.waitForTimeout(1500);
            return "page";
        },
    },
    {
        name: "source-frames-2d", settings: {source_frames_2d: true},
        async run(s) {
            await s.openMap();
            await s.page.click(".tweakui-sf-button");
            const m = await s.page.$eval(".leaflet-container", e => { const r = e.getBoundingClientRect(); return {x: r.left + r.width * 0.3, y: r.top + r.height * 0.55}; });
            await s.page.mouse.click(m.x, m.y);
            await s.sourceFramesSettled();
            return "page";
        },
    },
    {
        name: "source-frames-3d", settings: {source_frames_3d: true},
        async run(s) {
            await s.open3d();
            await s.page.click(".tweakui-sf-button");
            const p = await s.pointOnModel(0.3, 0.55);
            await s.page.mouse.click(p.x, p.y);
            await s.sourceFramesSettled();
            return "page";
        },
    },
    {
        // The search box with the middle of the task's orthophoto typed in degrees, minutes and seconds: the map has
        // flown there and marks it (coordinates send no request to Nominatim)
        name: "map-search", settings: {map_search: true},
        async run(s) {
            await s.openMap();
            const b = await s.page.evaluate(async t => {
                const res = await fetch(`/api/projects/${t.project}/tasks/${t.id}/orthophoto/metadata`, {credentials: "same-origin"});
                return (await res.json()).bounds.value;
            }, s.task);
            const dms = (v, pos, neg) => {
                const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), sec = ((a - d) * 3600 - m * 60).toFixed(1);
                return `${d}°${m}'${sec}"${v < 0 ? neg : pos}`;
            };
            await s.page.click(".tweakui-map-search-button");
            await s.page.fill(".tweakui-map-search-input", `${dms((b[1] + b[3]) / 2, "N", "S")} ${dms((b[0] + b[2]) / 2, "E", "W")}`);
            await s.page.press(".tweakui-map-search-input", "Enter");
            await s.page.waitForTimeout(3500);
            return "page";
        },
    },
    {
        name: "zoom-override-2d", settings: {zoom_override_2d: false},
        async run(s) {
            const shots = [];
            for (const on of [false, true]) {
                await s.settings({zoom_override_2d: on});
                await s.openMap();
                // the + button until it is greyed out: as far as the map goes
                for (let i = 0; i < 40 && !(await s.page.$(".leaflet-control-zoom-in.leaflet-disabled")); i++) {
                    await s.page.click(".leaflet-control-zoom-in");
                    await s.page.waitForTimeout(350);
                }
                await s.page.waitForTimeout(2500);
                shots.push([on ? "Zoom Override on: 3 steps further" : "Off: WebODM's limit", await s.page.screenshot({clip: await s.middle(".leaflet-container")})]);
            }
            return {pair: shots};
        },
    },
    {
        name: "zoom-override-3d", settings: {zoom_override_3d: false},
        async run(s) {
            // The same 15 wheel notches with the pointer on the lawn, from the task's opening view
            const shots = [];
            for (const on of [false, true]) {
                await s.settings({zoom_override_3d: on});
                await s.open3d();
                const p = await s.pointOnModel(0.75, 0.6);
                const clip = await s.middle("#potree_render_area", "#potree_sidebar_container");
                if (!on) {
                    const m = await s.marker(p);
                    shots.push(["Before", await s.page.screenshot({clip})]);
                    await m.evaluate(e => e.remove());
                }
                await s.page.mouse.move(p.x, p.y);
                for (let i = 0; i < 15; i++) {
                    await s.page.mouse.wheel(0, -100);
                    await s.page.waitForTimeout(60);
                }
                await s.page.waitForTimeout(2500);
                await s.marker(p);
                shots.push([on ? "On: toward the pointer" : "Off: toward the middle", await s.page.screenshot({clip})]);
            }
            return {pair: shots};
        },
    },
    {
        name: "storage", settings: {storage_view: true},
        async run(s) {
            await s.page.goto(s.base + "/plugins/tweakui/storage/");
            const project = `.tweakui-storage-project[data-project="${s.task.project}"] [data-act=open-project]`;
            await s.page.waitForSelector(project);
            await s.page.click(project);
            await s.page.click(`[data-task="${s.task.id}"] [data-act=open-task]`);
            await s.page.waitForSelector(`[data-task="${s.task.id}"] ~ tr .tweakui-storage-kinds, .tweakui-storage-kinds`);
            await s.page.waitForTimeout(500);
            return "page";
        },
    },
    {
        name: "performance", settings: {performance_view: true},
        async run(s) {
            await s.page.goto(s.base + "/plugins/tweakui/performance/");
            await s.page.waitForSelector(".tweakui-performance-cards");
            await s.page.waitForTimeout(500);
            return "page";
        },
    },
];

// The page script that turns PNGs (base64) into one WebP: side by side with a label each when there are several,
// scaled down to maxWidth
function toWebp([images, maxWidth]) {
    return Promise.all(images.map(([label, b64]) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve([label, img]);
        img.onerror = reject;
        img.src = "data:image/png;base64," + b64;
    }))).then(loaded => {
        const gap = loaded.length > 1 ? 16 : 0, band = loaded.length > 1 ? 44 : 0;
        const w = loaded.reduce((t, [, i]) => t + i.width, 0) + gap * (loaded.length - 1);
        const h = Math.max(...loaded.map(([, i]) => i.height)) + band;
        const scale = Math.min(1, maxWidth / w);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const c = canvas.getContext("2d");
        c.scale(scale, scale);
        c.fillStyle = "#ffffff";
        c.fillRect(0, 0, w, h);
        let x = 0;
        for (const [label, img] of loaded) {
            if (band) {
                c.fillStyle = "#333333";
                c.font = "bold 26px sans-serif";
                c.textBaseline = "middle";
                c.fillText(label, x + 8, band / 2);
            }
            c.drawImage(img, x, band);
            x += img.width + gap;
        }
        return canvas.toDataURL("image/webp", 0.85).split(",")[1];
    });
}

async function main(names) {
    const user = process.env.TW_USER, password = process.env.TW_PASSWORD;
    if (!user || !password) throw new Error("Set TW_USER and TW_PASSWORD to a WebODM account (the dev server's)");
    const unknown = names.filter(n => !SHOTS.some(s => s.name === n));
    if (unknown.length) throw new Error("No such shot: " + unknown.join(", ") + " (shots: " + SHOTS.map(s => s.name).join(", ") + ")");
    const shots = names.length ? SHOTS.filter(s => names.includes(s.name)) : SHOTS;

    const {chromium} = require("playwright");
    const base = (process.env.TW_BASE || "http://localhost:8005").replace(/\/$/, "");
    const browser = await chromium.launch({headless: true});
    const context = await browser.newContext({viewport: {width: WIDTH, height: HEIGHT}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(base + "/login/");
    await page.fill("#id_username", user);
    await page.fill("#id_password", password);
    await Promise.all([page.waitForNavigation(), page.click("button[type=submit], input[type=submit]")]);
    if (page.url().includes("/login")) throw new Error("Could not log in as " + user);

    const api = (method, url, body) => page.evaluate(async ([method, url, body]) => {
        const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1];
        const res = await fetch(url, {method, credentials: "same-origin",
            headers: {"Content-Type": "application/json", "X-CSRFToken": csrf}, body: body ? JSON.stringify(body) : undefined});
        if (!res.ok) throw new Error(method + " " + url + ": " + res.status);
        return res.status === 204 ? null : res.json();
    }, [method, url, body]);

    const task = await findTask(api);
    const before = await api("GET", "/api/plugins/tweakui/settings");
    const s = {
        page, base, task, api,
        settings: values => api("PATCH", "/api/plugins/tweakui/settings", values),
        // The Dashboard with the task's project open and its panel expanded, by WebODM's own query string (a project
        // item carries no id to find it by among several)
        async openTask() {
            await page.goto(`${base}/dashboard/?project_task_open=${task.project}&project_task_expanded=${task.id}`);
            await page.waitForSelector(".expanded-panel", {timeout: 15000});
        },
        async openMap() {
            await page.goto(`${base}/map/project/${task.project}/task/${task.id}/`);
            await page.waitForSelector(".leaflet-control-zoom-in");
            await page.waitForLoadState("networkidle").catch(() => {});
            await page.waitForTimeout(2000);
        },
        async open3d() {
            await page.goto(`${base}/3d/project/${task.project}/task/${task.id}/`);
            await page.waitForFunction(() => window.viewer && window.viewer.scene && window.viewer.scene.pointclouds.length, null, {timeout: 60000});
            await page.waitForTimeout(8000);
        },
        // A point of the 3D view well on the model, nearest the given fractions of the view, outside TweakUI's windows
        async pointOnModel(fx, fy) {
            const p = await page.evaluate(([fx, fy]) => {
                const v = window.viewer, r = v.renderer.domElement.getBoundingClientRect(), want = {x: r.left + r.width * fx, y: r.top + r.height * fy};
                let best = null;
                for (let y = r.top + 20; y < r.bottom - 20; y += 20) for (let x = r.left + 20; x < r.right - 20; x += 20) {
                    const e = document.elementFromPoint(x, y);
                    if (!e || e.closest(".tweakui-sf-window, .tweakui-sf-label") || !v.renderer.domElement.parentNode.contains(e)) continue;
                    // on the model there and all around it, not on an edge
                    if ([[0, 0], [-24, 0], [24, 0], [0, -24], [0, 24]].some(([dx, dy]) => !window.TweakUI.pick3d.pick(window, v, x + dx, y + dy))) continue;
                    const d = Math.hypot(x - want.x, y - want.y);
                    if (!best || d < best.d) best = {x, y, d};
                }
                return best;
            }, [fx, fy]);
            if (!p) throw new Error("No point of the 3D view is on the model");
            return p;
        },
        async sourceFramesSettled() {
            await page.waitForFunction(() => {
                const b = document.querySelector(".tweakui-sf-busy"), body = document.querySelector(".tweakui-sf-body");
                return document.querySelector(".tweakui-sf-item, .tweakui-sf-message:not(:empty)") && (!b || b.style.display === "none") && body && !/Finding/.test(body.textContent);
            }, null, {timeout: 30000});
            await page.waitForTimeout(1500);
        },
        // Where the pointer is, drawn over the page (a screenshot leaves the pointer out)
        marker(p) {
            return page.evaluateHandle(([x, y]) => {
                const m = document.createElement("div");
                m.style.cssText = `position:fixed;left:${x - 14}px;top:${y - 14}px;width:28px;height:28px;border:4px solid #ff3b30;border-radius:50%;box-shadow:0 0 0 2px #fff;z-index:99999;pointer-events:none`;
                return document.body.appendChild(m);
            }, [p.x, p.y]);
        },
        // A half of a pair: the middle of an element (right of another one over it, if any), its full height and at
        // most half the viewport wide
        middle(selector, beside) {
            return page.evaluate(([selector, beside, half]) => {
                const r = document.querySelector(selector).getBoundingClientRect(), b = beside && document.querySelector(beside);
                const left = b && b.offsetWidth ? Math.max(r.left, b.getBoundingClientRect().right) : r.left;
                const w = Math.min(half, r.right - left);
                return {x: Math.round(left + (r.right - left - w) / 2), y: Math.round(r.top), width: Math.round(w), height: Math.round(r.height)};
            }, [selector, beside, WIDTH / 2]);
        },
    };

    fs.mkdirSync(OUT, {recursive: true});
    try {
        for (const shot of shots) {
            await page.setViewportSize({width: WIDTH, height: HEIGHT});
            await api("PATCH", "/api/plugins/tweakui/settings", {...before, theme: "webodm", ...shot.settings});
            let what;
            try { what = await shot.run(s); } finally { if (shot.cleanup) await shot.cleanup(s); }
            let pngs;
            if (what === "page") pngs = [["", await page.screenshot()]];
            else if (typeof what === "string") pngs = [["", await page.locator(what).first().screenshot()]];
            else if (what.clip) pngs = [["", await page.screenshot({clip: what.clip})]];
            else pngs = what.pair;
            const webp = await page.evaluate(toWebp, [pngs.map(([l, b]) => [l, b.toString("base64")]), MAX_WIDTH]);
            const file = path.join(OUT, shot.name + ".webp");
            fs.writeFileSync(file, Buffer.from(webp, "base64"));
            console.log(shot.name, Math.round(fs.statSync(file).size / 1024) + " KB");
        }
    } finally {
        await api("PATCH", "/api/plugins/tweakui/settings", before);
        const after = await api("GET", "/api/plugins/tweakui/settings");
        console.log("settings restored:", JSON.stringify(after) === JSON.stringify(before));
        if (errors.length) console.log("page errors:", JSON.stringify(errors));
        await browser.close();
    }
}

// The task the shots show: TW_TASK, or the first completed one with an orthophoto and a textured model
async function findTask(api) {
    const wanted = process.env.TW_TASK && process.env.TW_TASK.split("/");
    for (const project of await api("GET", "/api/projects/?ordering=created_at")) {
        if (wanted && String(project.id) !== wanted[0]) continue;
        for (const t of await api("GET", `/api/projects/${project.id}/tasks/?ordering=created_at`)) {
            if (wanted ? t.id === wanted[1] : t.status === 40 && t.available_assets.includes("orthophoto.tif") && t.available_assets.includes("textured_model.zip"))
                return {project: project.id, id: t.id, name: t.name};
        }
    }
    throw new Error(wanted ? "No task " + process.env.TW_TASK : "No completed task with an orthophoto and a textured model");
}

module.exports = {SHOTS, OUT};

if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message || e); process.exit(1); });
