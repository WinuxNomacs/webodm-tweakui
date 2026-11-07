# Upcoming changes

## Phases (current and upcoming)

**Up next**
- Nothing planned: new requests go in `new.md`.

**Later**
- **Global Controls: Temperature in Header** — deferred by the user (2026-11-07) until WebODM offers Fahrenheit or a
  cleaner hook; see "Global Controls: units and temperature in the header".

**Done**
- **Open Full Frame in Title Case** (the user's decision on the Mac review's open point, 2026-11-07) — branch
  `open-full-frame-title-case`: `source_frames.js` (the button and the photo's tooltip), `docs/map-2d.md`, CHANGELOG,
  screenshots `source-frames-2d` and `source-frames-3d` retaken.
- **Windows app: the navigation pane and Zoom Override 3D** — the navigation pane checked live in desktop mode
  (see its entry below); Zoom Override 3D's speed with a real mouse verified by the user (2026-11-07).
- **Global Controls: Hide Navigation Pane and Resize Navigation Pane** (new.md, 2026-11-07; see "Navigation pane:
  hide and resize") — `tweakui/public/nav_pane.js` (`create`: the tab; `createResize`: the handle, `clampWidth`) and
  two sections of `main.css`, tests in `__tests__/nav_pane.test.js` and `TestSettingsPage`. Branches `hide-nav-pane`
  and `resize-nav-pane`, each on both Docker stacks (Jest, Django, live: Dashboard and a map on 4.0.0, the Dashboard
  on 3.3.2, which has no task), the selector check on 4.0.0; screenshots `hide-navigation-pane` and
  `resize-navigation-pane`, `docs/general.md`. On WebODM's Windows app (upgraded from the zip, restarted by the
  user), in desktop mode: the tab 10 px from the top and the handle from the top of the window, the map widened
  999 → 1249 px, icons mode with the Theme and Units menus in the side menu, nothing at phone width, no console
  errors, settings restored.
- **Fixes from the review** (see "Fixes from the review"; findings in "Before the first release") — tested on 4.0.0
  on the Mac; then live on 3.3.2 too (2026-11-07, asked by the user), on a task processed there from 30 of TestRGB's
  images and deleted afterwards: the address keeps only the fully expanded task (and a reload brings it back fully
  expanded), the full-frame viewer takes the focus and gives it back on Escape, ten trackpad-sized wheel events zoom
  as far as one notch (4.5 against 5.0; 27.5 with Zoom Override off), a Ctrl+click leaves the menu key's menu
  alone; every feature on, no console errors, no writes. Four branches, each checked live:
  - `task-controls-address` (finding 9): `task_controls.js` `expandedSearch`, `syncAddress`; the address lists only
    the fully expanded tasks. Tests in `task_controls.test.js`.
  - `source-frames-focus` (11): `source_frames.js` `viewer`, `openFull`; checked with the keyboard on the 2D map.
    Test in `source_frames.test.js`.
  - `selector-check` (12): `dev/selector-check.js`, `npm run selector-check`, run by the `release-check` skill;
    tests in `dev/__tests__/selector-check.test.js`. Every selector found on 4.0.0.
  - `zoom-measure`: the measurement, and `zoom_override.js` `attach3d` `pickAt` (one pick per scroll burst). Test in
    `zoom_override.test.js`.
  Docs (`general.md`, `map-2d.md`, `adding-a-tweak.md`, `developing.md`), CLAUDE.md and CHANGELOG updated.
- **macOS check** (asked in chat, 2026-11-07; see "macOS check before the first release") — on the user's Mac
  (Apple Silicon, macOS 26.6, Safari 26.6): the dev tools, checks, Docker stack, Django tests and `dev/package.sh`
  work; every feature behaves the same in headless WebKit as in Chromium; the copy buttons and the trackpad checked
  by the user in Safari. Two changes, each tested on 4.0.0 and checked by the user in Safari (3.3.2 not tested, by
  the user's decision): `surprise-me-ctrl-click` (`surprise_me.js` `mousedown`/`contextmenu`; tests in
  `surprise_me.test.js`), `zoom-3d-trackpad` (`zoom_override.js` `notch`; test in `zoom_override.test.js`); docs,
  setting descriptions, CHANGELOG. The zip install step skipped by the user (WebODM's code).
- **Structure for other developers** (new.md, 2026-11-07; see "Before the first release", "the design") — three
  branches, each on both Docker stacks (Jest, Django, every feature live):
  - `shared-helpers`: `tweakui/public/core.js` (`feature`, `guard`, `el`, `csrfToken`, `copyText`, `placeMenu`,
    `whenElement`, `sideItem`, `sideLink`), every script started through `feature` with its hook callbacks, observers
    and page-wide listeners guarded (finding 6), a `SELECTORS` list at the top of each (finding 8); the theme and
    units menus no longer depend on load order. Tests: `__tests__/core.test.js`.
  - `feature-registry`: `tweakui/features.py` declares every setting; `settings.DEFAULTS`, the settings page
    (`settings.html` loop, `settings_setting.html`, `settings_themes.html`) and `plugin.py`'s script list come from
    it; the page renders the same as before. Tests: `TestFeatures` (including "a new tweak is off by default").
  - `adding-a-tweak-docs`: `docs/adding-a-tweak.md` (worked example Scale Bar, built and checked live, then removed),
    `CONTRIBUTING.md`, links from the README, Developing and the sidebar; CLAUDE.md updated.
  On WebODM's Windows app (upgraded from the zip, restarted by the user): every feature live, the Theme and Units
  menus in the side menu in their order, no console errors.
- **Review: breaking points, performance, WebODM UX** (new.md, 2026-11-07) — the findings are in "Before the first
  release". The clear bugs, each on its branch with tests, on both Docker stacks: `storage-api-errors` (`api.py`
  `StorageTaskView`, `storage.breakdown`), `storage-report-queries` (`storage.user_reports`), `frames-malformed-shots`
  (`frames.rank`, `find`, `mean_height`), `task-details-dashboard-only` (`task_details.js` `start`),
  `other-tasks-layer-error` (`other_tasks.js` `show`); Django tests in `TestStorage` and `TestSourceFrames`, Jest in
  `task_details.test.js` and `other_tasks.test.js`.
- **README splash image** (new.md, 2026-11-07) — branch `readme-splash`: `docs/public/tweakui-logo-med.jpg`
  (shown at the top of `README.md`) and the full-size `docs/public/tweakui-logo.jpg`, moved from `ignored/`. See
  "Before the first release".
- **Windows: keep it covered** (new.md, 2026-11-07) — branch `windows-coverage`: README Requirements, the docs'
  Developing page ("WebODM's Windows app"), CLAUDE.md, and the `live-check` (what to check there, the relay, no
  login) and `release-check` (step 7, the upgrade and the user's restart) skills. The machine's details stay in
  memory. See "Windows native".
- **Windows: check every feature, fix what differs** (new.md, 2026-11-07) — every category checked live on the
  Windows app through the relay, at desktop and phone width, data left as found (Compact and Delete not run on the
  user's data). Fixes, each on its branch and checked on both Docker stacks and on Windows:
  `windows-header-menus` (`theme_menu.js` `place()`/`spot()`, used by `units_menu.js`; `window.TweakUI.desktop`
  from `DESKTOP_MODE` in `api.py`; side-menu CSS in `main.css`; tests in `theme_menu.test.js`,
  `units_menu.test.js`, `test_settings_js_says_desktop_only_in_webodm_s_desktop_mode`), `windows-odx-command`
  (`task_details.js` `WINDOWS`, `cmdQuote`; `window.TweakUI.windows` from `api.WINDOWS`; docs/general.md),
  `windows-utf8` (`frames.load_json`), `screenshots-projects` (`dev/screenshots.js` `openTask`, Storage shot),
  `task-bubbles-wrap` (`main.css`). See "Windows native".
- **Windows: reach and install** (new.md, 2026-11-07) — branch `windows-install`. `dev/windows-relay.js` (new):
  http://localhost:8007 in WSL relays each connection through WSL interop to WebODM's own `python.exe`, which pipes
  it to Windows' 127.0.0.1:29800. `dist/tweakui-0.1.0.zip` installed through Administration > Plugins > Load
  Plugin (.zip); it registers without a restart, and its menu items, pages and 15 files load with no console errors.
  See "Windows native".
- **README: Thanks** (new.md, 2026-11-07) — branch `readme-thanks`. README "Thanks" (before License; the
  fireworks-js credit moved into it), `docs/thanks.md` (in the sidebar under Using TweakUI), CHANGELOG. Names and
  links checked against each project's site or GitHub profile; WebODM's README says it is not affiliated with
  OpenDroneMap and that 4.0.0 processes with ODX, so ODX and ODM are credited as the two versions' engines.
- **Settings: a "Saved" banner** (new.md, 2026-11-07) — branch `saved-banner`. Code in `public/settings_page.js`
  (`setStatus`, the `tweakuiSaved` sessionStorage flag), `templates/settings.html` (`.tweakui-banner` at the top of
  `.tweakui-sections`, the bottom line removed), `main.css`; tests in `public/__tests__/settings_page.test.js`;
  `docs/index.md`, README, CHANGELOG. See "Saved banner and thanks".
- **Surprise Me: every 4-8 s, and a rocket on a right-click** (asked in chat, 2026-11-07) — branch
  `surprise-me-clicks`. Code in `public/surprise_me.js` (`aim`, the right-click handlers, `start()` now returns a
  `stop()` that removes its listeners); tests in `public/__tests__/surprise_me.test.js`; `docs/general.md`,
  settings text, README, CHANGELOG. See "Just for Fun: Surprise Me".
- **Just for Fun: Surprise Me** (asked in chat, 2026-11-07) — branch `surprise-me`.
  - Settings > General > Just for Fun (a new group, last under General) > Surprise Me (off by default): fireworks
    over every page at random moments until it is turned off; see "Just for Fun: Surprise Me".
  - Code: `public/surprise_me.js` (new, on every page), `public/vendor/fireworks-js/` (fireworks-js 2.10.8 UMD build
    and its MIT LICENSE), `settings.py` (`surprise_me`), `templates/settings.html`, `main.css`
    (`.tweakui-fireworks`), `settings_page.js` (announces each saved change as `tweakuiSettingsChanged`).
  - Tests: `public/__tests__/surprise_me.test.js` (new), `settings_page.test.js`, `tests/test_tweakui.py`; shot
    `surprise-me`; `docs/general.md`, README (General line and credit), docs home, CHANGELOG.
- **Global Controls: Units in Header** (new.md, 2026-11-07) — branch `global-units`.
  - Settings > General > Global Controls (a new group, first under General) > Units in Header (off by default): a
    units menu in the header, left of the paintbrush (a ruler and the system's name; only the ruler on a phone),
    with WebODM's Metric, Imperial and Imperial (US). It is WebODM's own preference (`localStorage.unit_system` and
    the `onUnitSystemChanged` event): a choice in the header sets the maps' `select.unit-selector`, a choice on a map
    updates the header, as does another tab's.
  - Code: `public/units_menu.js` (new, on every page), `settings.py` (`units_in_header`), `templates/settings.html`,
    `public/main.css`, `plugin.py`. Tests: `test_tweakui.py` (the setting, the script included and served),
    `units_menu.test.js` (6 tests). Screenshot `units-in-header`; docs `docs/general.md`.
- **Theme Sample frame and My Themes buttons** (new.md, 2026-11-07) — branch `sample-frame`.
  - Settings > Themes: the Sample is headed "Sample Form for Viewing Theme Effects" and framed by a 2px border in the
    theme's text colour (`theme-border-primary`; decided with the user over a dashed border or an inset panel). The
    New Theme, Import and Export buttons sit below the "My Themes" heading.
  - Code: `templates/settings.html`, `public/main.css`. Test: `test_tweakui.py` (button order, the Sample's frame
    and heading). Docs `docs/themes.md`; screenshots `theme-import` and `theme-published` retaken (their text
    changed in the wording review).
- **"Other Tasks" setting renamed** (asked directly, 2026-11-07) — branch `rename-other-tasks`: Settings > 2D Map >
  Controls > Other Tasks is now "Compare Orthophotos from Other Tasks" (the setting's name only; the map's button and
  panel are still titled "Other Tasks"). `templates/settings.html`, `docs/map-2d.md`, README, CHANGELOG.
- **Wording review** (asked directly, 2026-11-07) — branch `wording-review`.
  - The README, `docs/` and the plugin's UI text reworded to be direct, accurate and concise: settings descriptions
    rewritten as plain sentences, Title Case for the two settings and two headings that lacked it ("Show Theme Menu",
    "Show Storage View", "Import Themes", "Publish One of Your Themes"), Storage labels ("Deleting", "Failed: can be
    deleted"), error messages ("every colour must be #rrggbb", "Too many themes: at most 50"), the docs' Task Details
    list in the settings' order, and "Every feature but the themes is off" corrected to "except the theme menu".
    User-chosen names (e.g. Show Current Processing Stage, Click Map to View Source Frame) kept.
  - Code: `templates/settings.html`, `published.html`, `import_panel.html`, `public/storage_page.js`,
    `public/theme_editor.js`, `custom_themes.py`; tests updated in `test_tweakui.py`, `storage_page.test.js`,
    `theme_editor.test.js`.
- **Expand Task Controls** (asked directly, 2026-11-07) — branch `expand-task-controls`.
  - General > Task Details > Expand Task Controls (off by default): on the Dashboard, a minimized task still shows its
    action buttons (WebODM's and the plugins'). WebODM leaves a minimized task's panel out of the page, so buttons
    only is WebODM's expanded task with its first row (details, thumbnail, console, warnings) hidden. The +/- (and
    the name) cycle buttons only (caret icon), expanded, fully minimized; the step from buttons only to expanded is
    TweakUI's alone. Decided with the user: tasks start as buttons only (TweakUI clicks their +); the checkbox is
    under Task Details, not Task Options. Fully expanded tasks are kept in sessionStorage, so a reload (which
    reopens the tasks in WebODM's `project_task_expanded`) shows them as they were; fully minimized ones come back
    as buttons only.
  - Code: `public/task_controls.js` (new, included on every page, runs on `/dashboard/`), `settings.py`
    (`expand_task_controls`), `templates/settings.html`, `public/main.css`. Tests: `test_tweakui.py` (the setting,
    the script on the Dashboard), `task_controls.test.js` (8 tests). Screenshot `expand-task-controls`; docs
    `docs/general.md`.
- **Expand Configured: a three-step Expand/Collapse button** (asked directly, 2026-11-07) — branch
  `expand-configured-cycle`.
  - With Expand Configured on, the Task Options dialog's Expand/Collapse button cycles Expand All (WebODM), Collapse
    All (WebODM, and `data-tweakui-plain` on the dialog hides the configured options too) and Collapse All but
    Configured (TweakUI alone: the click is stopped before React sees it); the dialog opens on the last. Its title
    names the next step. With no configured option, the middle step is skipped (WebODM's own two).
  - Code: `public/task_options.js` (`toggleButton`, `cycle`, `titleButton`). Tests: `task_options.test.js` (3 tests,
    a stand-in for WebODM's button handled at the document as React 16 does). Docs `docs/general.md`.
- **Expand Configured** (asked directly, 2026-11-07) — branch `expand-configured`.
  - General > Task Options > Expand Configured (off by default): in the Task Options dialog, a collapsed group shows
    its options not at ODM's default (the same ones Show Modified Options counts) under its heading, as WebODM's own
    controls. Decided with the user: the real option, not a read-only line; an option reset to its default leaves
    the list at once. Works without Show Modified Options; "Other Options" is not on the page while closed, so it
    shows nothing; the flat view is unchanged.
  - Code: `settings.py` (`expand_configured`), `templates/settings.html`, `public/task_options.js` (marks
    `data-tweakui-expand` on a collapsed group with configured options, `data-tweakui-configured` on those options
    and their subgroups), `public/main.css` (shows them over WebODM's inline `display: none`). Tests:
    `test_tweakui.py` (the setting and its checkbox), `task_options.test.js` (5 tests). Screenshot
    `expand-configured`; docs `docs/general.md`.
- **My Themes heading and Title Case** (asked directly, 2026-11-07) — branch `themes-heading-buttons`.
  - Settings > Themes: New Theme, Import (and Export, when you have themes) now sit on the left, above the My Themes
    heading (`templates/settings.html`, `.tweakui-themes-heading-stacked` in `main.css`). "My themes" became "My
    Themes", "New theme" "New Theme", the editor's "Edit theme" "Edit Theme". Names in the UI are Title Case from
    now on (`CLAUDE.md`). Tests: the renamed labels in `test_tweakui.py` and `theme_editor.test.js`; screenshot
    `theme-editor` retaken.
- **Custom themes: published** (request 21, phase C) — 2026-11-07, branch `custom-themes-published`.
  - Code: `custom_themes.py` (the published themes in the global data store, `published_themes`, checked as your
    own; `_import` shared by both lists; `publish` copies one of your own, replacing a published one of the same
    name, which keeps its id; `delete_published`), `settings.py` (`published:<id>` while it exists, else WebODM's
    theme), `themes.py` (a Published group between the presets and My themes, only when there are any; its CSS),
    `api.py` (`published` GET / POST {id}, `published/import`, `published/export[?id=]`, `published/<id>` DELETE,
    all `IsSuperuser`; settings.js sets `window.TweakUI.superuser`), `plugin.py` (the page `admin/themes/`, 403 for
    anyone but a superuser), `templates/published.html` (the list with Copy JSON, Export, Delete; Import and Export;
    Publish one of your themes), `templates/import_panel.html` (the Import panel, shared with Settings > Themes,
    its API path in `data-import-path`), `public/theme_editor.js` (starts without the editor; Delete, Publish),
    `public/main.js` (Administration > TweakUI Themes after Theme, for superusers; active and open on its page),
    `public/main.css`. Screenshot `theme-published` (`dev/screenshots.js` gained a shot `cleanup`: it adds two
    sample published themes and, without any, an own theme, and deletes them), docs `themes.md` (Published themes),
    `install.md`, README, CHANGELOG.
  - Tests: Django 9 (superusers only, also not staff, and CSRF; settings.js's flag; publish and replace by name;
    every user lists, chooses and copies but can't change one; the group only when there are any; a deleted one
    falls back; import and export round trip; 50 at most; the page), Jest 8 (the page without the editor, Copy
    JSON, Import into the published, Delete, Publish, no own themes; the menu link for superusers only, active on
    its page). Live on 4.0.0 and 3.3.2: the link after Theme (active and open on the page), Publish, Import with a
    refusal, Copy JSON (the clipboard read back), Export of all and one (the files read), Published on Settings >
    Themes, choosing it (theme.css), the header menu, Delete (the setting back to WebODM's theme), 390 px without
    overflow; everything the check made deleted and the settings put back.
- **Custom themes: import and export** (request 21, phase B) — 2026-11-06, branch `custom-themes-import`.
  - Code: `custom_themes.py` (`import_themes`: one object or a list of up to 500; a theme with the name of one of
    yours replaces its colours and keeps its id, so a user's current theme stays; others added while under 50;
    each refused one reported with its number and reason; `export`), `api.py` (`themes/import` POST → `{added,
    replaced, refused}`; `themes/export[?id=]` GET, a download: `tweakui-themes.json`, a list, or
    `tweakui-theme-<name>.json`, one object), `templates/settings.html` (My themes: Import and Export beside New
    theme; Copy JSON on every theme, Export on your own; the Import panel: a file, whose text goes in the box, or
    pasted JSON; a report; Close reloads when anything changed), `public/theme_editor.js` (Copy JSON, the panel),
    `public/task_details.js` (its clipboard copy shared as `window.TweakUI.copyText`, with the old way on plain
    http), `public/main.css` (a theme's buttons go under its name when the card is narrow, which also stops the
    presets' names breaking mid-word on 3.3.2). Screenshot `theme-import`, docs `themes.md` (Import and export),
    README, CHANGELOG.
  - Tests: Django 6 (one object, a list with replace by name / bad colour / missing colour / not an object, 50 at
    most while still replacing, not a theme or a list / over 500 / CSRF, export of all and one and back through
    import, another user's 404, the page's buttons); Jest 5 (Copy JSON, the file read and its size, the report and
    Close's reload, not JSON and the server's refusal, all refused).
  - Live on 4.0.0 and 3.3.2: Copy JSON of Nord read back from the clipboard; a file of one good and one bad theme
    (added 1, refused 1 with why), Close reloads with it listed; Export of all and of one downloaded and read;
    the export pasted back (replaced 1); 390 px without horizontal scroll; themes and settings restored.
- **Task Details section and setting names** (request 22) — 2026-11-06, branch `task-details-section`.
  - Code: `templates/settings.html` (General: Enhanced Task Details and its parts in their own group, Task Details,
    below Task Options; the parts renamed Task Start and End Time, Show Configured Task Preset, Options as Bubbles,
    Show ODX Command, Show Current Processing Stage; the rows in a task's details keep their names). Comments,
    `docs/general.md` (Task Details > Enhanced Task Details), CHANGELOG.
  - Tests: Django 1 (the group's place and the five names). Live on 4.0.0 and 3.3.2 at 1280 and 390 px.
- **Custom themes: your own** (request 21, phase A) — 2026-11-06, branch `custom-themes-own` (design below).
  - Code: `custom_themes.py` (the user's themes in their data store, `themes`; `clean` checks a name of 1-60
    characters and all 13 colours as `#rrggbb`; at most 50; ids are hex), `themes.py` (`colors_css` for any
    colours, `webodm_colors` as `#rrggbb`, `fields` from WebODM's Theme model, `theme_list(user)` with groups,
    `colors_of`), `settings.py` (`theme` takes `own:<id>` while the user has it, else WebODM's theme), `api.py`
    (`themes` GET/POST, `themes/<id>` PUT/DELETE, `themes/preview` POST → `{css}`), `templates/settings.html`
    (Settings > Themes: My themes with New theme, Copy on every theme, Edit on your own, the editor, the themes'
    colours as `json_script`), `public/theme_editor.js` (the editor and its preview, which replaces `theme.css`
    until Cancel; Save also makes it your theme), `public/theme_menu.js` (own themes after a divider),
    `public/main.css`. Screenshot `theme-editor` (`dev/screenshots.js`), docs `themes.md`, README, CHANGELOG.
  - Tests: Django 14 (`TestCustomThemes`: create, checks, 50 at most, update and delete, another user, CSRF, CSS of
    an own theme, deleted falls back, bad saved data left out, preview, the page, the editor's fields and colours,
    WebODM's colours as `#rrggbb`, settings.js); Jest 10 (`theme_editor.test.js`) and 1 (`theme_menu`: the divider).
  - Live on 4.0.0 and 3.3.2: Copy of Dracula, a typed header colour previewed on the page, Cancel puts the theme
    back, Save makes it the current theme and the header menu lists it, Edit and Delete at 390 px (no horizontal
    scroll) fall back to WebODM's theme; settings and themes restored.
- **Theme sample** (request 20) — 2026-11-06, branch `theme-sample` (design below).
  - Code: `templates/settings.html` (Settings > Themes: a "Sample" group below the swatches, in place of the
    intro's screenshot thumbnail), `public/settings_page.js` (`inertSample`: its links and form do
    nothing, so the category stays; Bootstrap's tooltip set up on the first hover, as WebODM's bundle loads after
    the script), `public/main.css` (two columns, one on a phone). README and `docs/themes.md` updated.
  - Tests: Jest 2 (the sample is inert; the tooltip); Jest 1 (`dev/`: every screenshot is shown by the settings or
    a docs page); the Django previews test now checks the page's previews exist and Themes has none.
  - Live on 4.0.0 and 3.3.2, 1280 and 390 px, WebODM's theme, Catppuccin Mocha and Solarized Light: the dropdown
    opens, the tooltip shows, links, Enter and menu items leave the page on #themes; settings restored. WebODM's
    `btn-secondary` takes the page background with no border, so it was left out (it read as plain text).
- **Documentation site** (request 19, docs phase 3) — 2026-11-06, branch `docs-site` (design below).
  - Code: `docs/` (VitePress 1.6.4, pinned): home, General, Themes, 2D Map, 3D Map, Storage, Install, Developing,
    local search; the images by a relative path to `tweakui/public/previews/` (bundled into the site at build).
    `npm run docs:dev`, `docs:build`, `docs:preview`; `.nvmrc` (Node 26). `.github/workflows/docs.yml`: build and
    deploy to Pages on a `v*` tag or by hand, actions pinned by commit. README trimmed to an overview linking to
    https://winuxnomacs.github.io/webodm-tweakui/; CLAUDE.md: a feature change updates its docs page and
    screenshot, a `v*` tag publishes the docs.
  - Checked: the build (fails on a dead link), a clean `npm ci --ignore-scripts` build as the workflow runs it, the
    built site in a browser at 1280 px light and 390 px dark: every page, all 11 images, every internal link, no
    horizontal scroll, no console errors. The workflow's first run is the user's (Pages must be on first:
    Settings > Pages > Source: GitHub Actions; a private repo needs a paid plan).
  - `npm audit`: VitePress 1.6.4 (the latest stable) brings Vite 5 and esbuild with advisories for their dev
    server only (`docs:dev`, bound to localhost); the built site is static.
- **Previews in the settings** (request 19, docs phase 2) — 2026-11-06, branch `settings-previews` (design below).
  - Code: `templates/settings.html` (`data-previews` on the page, a `data-preview` on 10 settings and on the
    Themes intro), `public/settings_page.js` (`addPreviews`: a lazy thumbnail titled with the setting's name,
    hidden if its image doesn't load; `enlarge`: the overlay, closed by Esc, a click or its x, the focus back on
    the thumbnail), `public/main.css` (thumbnail right of the description, under it on a phone; the overlay over
    Bootstrap's modal backdrop, in the theme's colours, above the side menu).
  - Tests: Jest 5 (`settings_page.test.js`); Django 1 (the page names exactly the screenshots in `previews/`).
  - Live on 4.0.0 and 3.3.2, 1280 and 390 px wide, WebODM's theme and Catppuccin Mocha: all 11 images decode
    (3.3.2 serves `.webp` as `application/octet-stream`, which browsers still show), Esc closes and refocuses;
    settings restored.
- **Feature screenshots** (request 19, docs phase 1) — 2026-11-06, branch `screenshots` (design below).
  - Code: `dev/screenshots.js` (the shot list, the login from `TW_USER` / `TW_PASSWORD`, the account's settings
    put back in a `finally`, the browser's own WebP encoding, pairs side by side with labels), `npm run
    screenshots`; 11 images in `tweakui/public/previews/` (1.2 MB): show-modified-options, enhanced-task-details,
    themes, theme-menu, movable-controls, other-tasks, source-frames-2d, source-frames-3d, zoom-override-2d (off /
    on), zoom-override-3d (before / off / on, the pointer marked), storage.
  - Tests: Jest 3 (`dev/__tests__/screenshots.test.js`: names, settings, one image per shot); ESLint covers `dev/`.
  - Run on 4.0.0 (TestRGB, only read): each image looked at; settings restored after every run.
  - Found while taking them: the 3D zoom needs a point well inside the model (an edge or a treetop lets the
    pointer's ray pass by), so the script picks one with the model all around it. The side menu in the shots
    shows the dev server's other plugins (DJI Thermal Analyzer, Developer Tools).
- **Storage** (request 5) — 2026-11-06, branch `storage` (design below).
  - Code: `tweakui/storage.py` (the report: owned projects and their tasks from `Task.size`, the quota, superusers'
    view of every owner; a task's breakdown by kind), `api.py` (`StorageView`, `StorageTaskView`), `plugin.py`
    (the page `/plugins/tweakui/storage/`, the API), `templates/storage.html`, `public/storage_page.js` (rows,
    ticks, the confirmation, WebODM's compact / remove / project delete), `public/main.js` (Diagnostic → System and
    Storage; without Diagnostic, TweakUI → Settings and Storage, expanded; before metisMenu starts, or toggling
    itself after), `settings.py` (`storage_view`), `templates/settings.html` (Settings > Storage), `main.css`.
  - Tests: Django 44 (`TestStorage` 7) on 4.0.0 and 3.3.2; Jest 106 (`storage_page` 15, `main` 10).
  - Live on 4.0.0 and 3.3.2 with a project "Live check storage" (a 16-photo and a 3-photo task) the check made and
    deleted through the page: the menu closed until clicked, open on the Storage page; TestRGB's breakdown in 130
    ms (1.1 GB of photos); Compact's confirmation freeing 86.7 MB, then the task's photos at 0 B; a ticked task
    deleted; the project deleted from its row; phone width without sideways scroll; the light (3.3.2) and dark
    (4.0.0, Solarized Dark) themes; no console errors. Not checked live: Diagnostic disabled (it would mean
    turning the plugin off on the dev server; Jest covers it).
- **Source Frames: a spot that follows the clicks** (request 18) — 2026-11-06, branch `source-frames-spot`
  (design below).
  - Code: `tweakui/public/source_frames.js` (the label, the controller, the 2D and 3D tools: one spot moved by each
    click; the window's `show` and `busy`; an older request aborted), `tweakui/frames.py` (spots only: the area's
    grid, share and outline gone), `public/main.css` (the label, the busy sign), `templates/settings.html`.
  - Tests: Jest 85 (`source_frames` 16), Django 37 (`TestSourceFrames` 5: an area refused) on 4.0.0 and 3.3.2.
  - Live on 4.0.0 (TestRGB, desktop and phone) and 3.3.2 (16 of TestRGB's photos processed by the check, deleted
    afterwards): the label from the button's click until off; each click moving the one spot and updating the
    same window in place (where it was dragged, a busy sign, the best photo chosen); three quick clicks ending on
    the last spot's photos; in 3D, a click on nothing says so; the button, Esc and the window's × ending it (a
    click then opens WebODM's popup again); lookups 19–107 ms in the browser; the 3D scene unchanged; no console
    errors; settings restored.
  - Seen while checking: the window (about 560 px wide) covers most of the 3D view at 1280 px wide (Potree's
    side panel takes the left) and the lower map on a phone; it can be dragged aside.
- **Zoom Override** (request 17) — 2026-11-06, branch `zoom-override` (design below).
  - Code: `tweakui/public/zoom_override.js` (the 2D limit, the 3D wheel), `tweakui/public/pick3d.js` (the 3D pick
    and the wait for the viewer, shared with Source Frames, which now adds its button itself),
    `tweakui/settings.py` (`zoom_override_2d`, `zoom_override_3d`), `templates/settings.html`, `tweakui/plugin.py`.
  - Tests: Jest (`zoom_override` 5, `source_frames` updated), Django (the settings, the scripts' order).
  - Live on 4.0.0 (TestRGB) and 3.3.2 (16 of TestRGB's photos processed by the check, deleted afterwards): the 2D
    map's + button goes 3 steps further (4 clicks to the limit off, 7 on); in 3D, 40 wheel notches with the
    pointer off-centre: off, the camera ended 24.5 m off the pointer's ray (zooming to the middle of the view); on,
    it moved 89.8 m along that ray (0.13 m off it), ending 1.3 m from the surface, the surface under the pointer
    18 cm from the first one, on the point cloud and on the textured model (TestRGB; 3.3.2's sparse fast-orthophoto
    cloud: 0.68 m, the notches over gaps zooming as before); the 2D and 3D action buttons with Snapshot's camera and
    Source Frames' both; the task's saved 3D scene unchanged; no console errors; settings restored.
  - Zooming moves along the pointer's ray (the pick gives only the distance): toward the point picked, the view
    drifted on a sparse point cloud, whose pick is a point beside the ray.
  - Found while checking: WebODM's `addActionButton` hooks (2D and 3D) keep only the answers given with the first
    one (`ApiFactory.js` drops the response listener a tick after the first answer). Source Frames answered at
    once and pushed out Snapshot's camera button (which loads html2canvas first); with dependencies it was pushed
    out itself. TweakUI no longer answers those hooks: Source Frames puts its button before Share itself (the 2D
    map's `.actionButtons`, the 3D view's `.model-action-buttons`), and the 3D features wait for `window.viewer`.
    A fix in WebODM (keep the listener until every plugin has answered) would be a pull request, only with the
    user's approval.
- **Source Frames** (request 16) — 2026-11-06, branch `source-frames` (design below; Area since removed by
  request 18).
  - Code: `tweakui/frames.py` (the photos' projection: poses, Brown/fisheye lenses, the ground's height, an area's
    grid, the ranking), `tweakui/api.py` (`FramesView`, `POST /api/plugins/tweakui/frames/<p>/<t>`),
    `tweakui/plugin.py`, `tweakui/settings.py` (`source_frames_2d`, `source_frames_3d`), `templates/settings.html`
    (2D Map and 3D Map > Controls), `public/source_frames.js` (the button, bar, window, viewer, the 2D and 3D tools),
    `public/main.css`.
  - Tests: Django 38 (`TestSourceFrames` +6: two synthetic cameras over a DSM), 43 with `app.tests.test_plugins`, on
    4.0.0 and 3.3.2; Jest 79 (`source_frames` 14).
  - Live on 4.0.0 (TestRGB, 220 photos, with a DSM) and 3.3.2 (16 of TestRGB's photos processed as a
    fast-orthophoto task by the check: no DSM, the point cloud's mean height; deleted afterwards), desktop and
    phone: a spot (the photo below the camera ranked first with the spot at its centre; the same branch ringed in
    every photo), an area (outline on the lawn's edges and roof lines, ranked by share), the full-frame viewer
    (zoom, arrows, Esc), the download (the page stays), the 3D view's spot and area (picked on the point cloud;
    a click on nothing says so); WebODM's light and dark themes; no console errors; settings restored.
  - Found while checking: WebODM's action-button hook keeps only the answers that come first (see Zoom Override:
    the button is now put in place by TweakUI);
    WebODM's layer popup opened on a spot's click (the clicks are taken in the capture phase while picking);
    Potree's measurements are saved by WebODM with the task's 3D scene every 3 s, so marking the 3D place with them
    wrote into TestRGB's saved scene (TweakUI's own three.js objects now; the two saved marks removed from TestRGB
    through WebODM's scene API, the rest of its scene untouched); a link styled as a button takes WebODM's link
    colour (Download is a button); the bar's × took the 3D view's white text (the theme's text colour now).
- **2D Map and 3D Map settings, Movable Controls, Other Tasks** (requests 10, 15) — 2026-11-06, branch
  `map-settings` (design below).
  - Code: `tweakui/settings.py` (`movable_controls`, `other_tasks`), `templates/settings.html` (2D Map, 3D Map),
    `tweakui/plugin.py`, `public/movable_controls.js`, `public/other_tasks.js`, `public/main.css`.
  - Tests: Jest 65 (`movable_controls` 8, `other_tasks` 7), Django 32 (+2) on 4.0.0 and 3.3.2.
  - Live on 4.0.0 (TestRGB's map, TestThermalNoPlugin as the other task) and 3.3.2 (a project of two tasks the
    check imported from TestRGB's orthophoto, deleted afterwards): Layers, Base Maps, Measure and Other Tasks
    dragged and kept inside the map, the map not dragged with them, back in place once closed; the other task's
    orthophoto over the task's own, its opacity, hidden again; no button on the project's map; phone width with a
    finger drag; no console errors of TweakUI's (only Google's base map tiles, not reachable from the check);
    settings restored.
  - Found while checking: Base Maps lets presses through to the map on touch screens, so dragging it dragged the
    map too: a press on a title bar no longer reaches the map. Base Maps closes on a map click or its close button
    (not when the pointer leaves it), and has a title bar, as Measure has a heading: all are dragged by them.
- **Enhanced Task Details: a toggle per row, Current Step** (requests 13, 14) — 2026-11-06, branch
  `task-details-rows` (design below).
  - Code: `tweakui/settings.py` (`task_details_*`), `templates/settings.html` (the toggles under Enhanced Task
    Details), `public/settings_page.js` (`data-depends`: greyed out while it is off), `public/task_details.js`
    (`parts`, `stages`, `readStep`, `stepText`; the console read on opening and at each 5 s fetch),
    `public/main.css`.
  - Tests: Jest 50 (`task_details` +7, `settings_page` +1), Django 30 on 4.0.0 and 3.3.2.
  - Live on 4.0.0 and 3.3.2: the toggles (greyed out and disabled while Enhanced Task Details is off, saved),
    parts left out on TestRGB (4.0.0) with WebODM's Options row back when bubbles are off; a 12-photo
    fast-orthophoto task created by the check: "Starting", "Current Step (4/12): Structure from Motion", then
    "(6/12): Meshing" as it ran; desktop and phone; no console errors; the task cancelled and its project deleted,
    settings restored. Found while checking: the label wrapped ("Current Step / (4/12):"), kept on one line.
- **Paintbrush toggle and task start/end times** (requests 9, 12) — 2026-11-06, branch `paintbrush-times`
  (design below).
  - Code: `tweakui/settings.py` (`show_theme_menu`), `templates/settings.html` (Themes > Theme Menu),
    `public/theme_menu.js` (no menu when off), `public/settings_page.js` (reloads on the toggle),
    `public/task_details.js` (Started/Finished rows, polling a task that hasn't ended).
  - Tests: Jest 42 (`task_details` +4, `theme_menu` +1, `settings_page` +1), Django 29 on 4.0.0 and 3.3.2.
  - Live on 4.0.0 (TestRGB: Started 7:38:04, Finished 8:24:40 local, after Created on) and both stacks for the
    toggle: off removes the paintbrush on the settings page and the dashboard, on brings it back; desktop and phone;
    no console errors; settings restored. A running task was checked in Jest only (none on the dev stacks).
- **Enhanced Task Details** (request 8) — 2026-11-06, branch `task-details` (design below).
  - Code: `tweakui/public/task_details.js` (the rows, preset matching, the command), `tweakui/settings.py`
    (`enhanced_task_details`), `templates/settings.html` (General > Task Options), `public/main.css`.
  - Tests: Jest `task_details.test.js` (9), Django (28 in all, on 4.0.0 and 3.3.2).
  - Live on 4.0.0 (the TestRGB task: Preset M4T-RGB, the user's own preset) and 3.3.2 (a partial task the check
    created: Custom, then Default once its options were the Default preset's; deleted afterwards): the rows in
    place of WebODM's Options, the copy button, desktop and phone, WebODM's theme, a dark and a light preset,
    setting off leaves WebODM's row; no console errors; settings restored.
  - Found while checking, WebODM's own: options set to `false` are refused by the API (so tasks never hold them);
    a project deleted while one of its tasks is a partial upload stays "deleting" (the worker skips partial
    tasks), so the check committed its task to let WebODM remove it.
- **Theme switcher in the header** (request 7) — 2026-11-06, branch `theme-switcher` (design below).
  - Code: `tweakui/public/theme_menu.js` (the menu), `tweakui/themes.py` (`theme_list`, swatches; dropdown text
    colour), `tweakui/api.py` (`settings.js` gives `window.TweakUI.themes`), `templates/settings.html` (the same
    list), `public/main.css`.
  - Tests: Jest `theme_menu.test.js` (8), Django (26 in all, on 4.0.0 and 3.3.2).
  - Live on 4.0.0 and 3.3.2: the paintbrush just left of the user icon on the dashboard and the map page, none
    logged out; the order (current, WebODM's theme, divider, the rest); choosing a theme reloads in it and
    Settings > Themes shows it; desktop and phone; no console errors; the admin's theme restored (Dracula on
    4.0.0, WebODM's on 3.3.2).
- **Phase 2: Themes** (request 3) — 2026-11-06, branch `themes` (design below).
  - Code: `tweakui/themes.py` (presets, `theme.css` view), `tweakui/settings.py` (`theme` setting and its
    choices), `tweakui/plugin.py` (mount, `include_css_files`), `templates/settings.html` (Themes section),
    `public/settings_page.js` (radio buttons, reload), `public/main.css` (the grid of themes).
  - Tests: Django `TestThemes` (8; 24 in all, on 4.0.0 and 3.3.2), Jest `settings_page.test.js` (+3).
  - Live on 4.0.0 and 3.3.2: all 11 presets on the dashboard, the settings page, the project map page and
    Administration (background, text, header as the preset), choosing one in Settings > Themes, the phone width,
    the layers panel (white, preset's dark text; checked with the panel's elements, as no task has a map); no
    console errors; the admin's settings restored. Not checked: the 3D view and a task's map with layers (no
    task with outputs on the dev stacks).
- **TweakUI menu item above About** (request 6) — 2026-11-06, branch `menu-above-about` (design below).
  Code: `tweakui/public/main.js` (moves the item), `tweakui/public/main.css` (hides it until moved). Tests: Jest
  `main.test.js` (4). Live on 4.0.0 and 3.3.2 (as admin): the dashboard and the TweakUI page list TweakUI just
  above About, after Administration and Developer Tools, and the link opens the settings page.
- **Phase 1: settings page and Show Modified Options** — 2026-11-06, branch `settings-page` (design below).
  - Code: `tweakui/plugin.py` (menu, page, `settings.js` view, API mount), `tweakui/settings.py` (per-user JSON in
    the data store, defaults and checks), `tweakui/api.py`, `tweakui/templates/settings.html`,
    `tweakui/public/settings_page.js`, `tweakui/public/task_options.js`, `tweakui/public/main.css`.
  - Tests: `tweakui/tests/test_tweakui.py` (15), Jest `settings_page.test.js`, `task_options.test.js` (13 with
    main's). Django tests and `app.tests.test_plugins` pass on 4.0.0 and 3.3.2.
  - Live, on both (as admin): the menu item, the page at desktop and phone width, saving and reloading the setting;
    in a new task's Edit Task Options: (0/13) on opening, Bounds & Cropping (1/4) and Digital Elevation Models
    (1/10) from the Default preset (auto-boundary, dsm), ignore-gsd -> (1/13), min-num-features -> Structure From
    Motion (1/13), Reset to default -> (0/13), search narrows the counts, flat view and back; with the setting
    off, WebODM's own numbers. A task's Edit was not checked live (the only task was processing); it is the same
    dialog. Found while checking, WebODM's own: switching to flat view and back clears typed values;
    `ProcessingNodeOption.jsx` logs a React `class` warning.
- **Phase 0: scaffold** — 2026-11-06, branch `scaffold`. Decided (the user, 2026-11-06): id and folder `tweakui`,
  name "TweakUI"; WebODM 3.3.2 and 4.0.0 both; changes to WebODM itself only with the user's approval.
  - Plugin: `tweakui/` (manifest 0.1.0, experimental; `plugin.py` includes `public/main.js`, which sets
    `html.tweakui`, and `public/main.css`, empty). Tests: `tweakui/tests/test_tweakui.py`,
    `tweakui/public/__tests__/main.test.js`.
  - Dev tooling copied from webodm-geojson and renamed: `dev/webodm.sh` (4.0.0 on :8005 `tw-*`, 3.3.2 on :8006
    `tw3-*`, images pinned by digest), `dev/compose.yml`, `dev/package.sh`, ESLint, Ruff, Jest,
    `.claude/skills/{test,live-check,release-check}`.
  - Checked: Ruff, ESLint, Jest 1; Django `test_tweakui` (4) and `app.tests.test_plugins` (5) on 4.0.0 and
    3.3.2; headless browser on :8005 and :8006 (welcome page, no account yet): `main.js`/`main.css` load, `html.tweakui` set.
  - Checkouts: `ignored/WebODM` at `v4.0.0` (was `master`), worktree `ignored/WebODM-3.3.2`, `ignored/WebODM-Docs`.

## Requests (from new.md, 2026-11-06)

1. A TweakUI menu item in WebODM's side menu, where users change their TweakUI settings.
2. In the TweakUI settings, a navigation pane that opens on a General item; more categories will be added.
3. A Themes item in that navigation pane: pick from predefined themes (Darcula/Dracula, Nord, Catppuccin,
   Solarized, ...), translated to WebODM's theme functionality; WebODM's theming reviewed thoroughly before the
   design discussion.
4. Under General, a "Task Options" section (settings that change WebODM's Task Options dialog), with "Show
   Modified Options": when on, the number after each option group's heading in that dialog shows how many of its
   options are not at their default, e.g. "Input & Preprocessing (1/13)" after enabling ignore-gsd.

Added 2026-11-06 (second new.md):

5. A Storage item in the TweakUI settings' navigation pane, where the user turns on a Storage view under
   Diagnostic: the user's WebODM storage use at a glance, like LuxODM's Storage page (`~/gitrepos/web/luxodm`,
   may be reused), and cleaning up / deleting unneeded tasks, projects and other items filling their quota.
6. Move the TweakUI side-menu item near the bottom of the side menu, just above About.
7. (2026-11-06) A Paint Brush icon in the header row, left of the user's icon; clicking it opens a dropdown of the
   available themes to change it on the fly. The current theme and WebODM's default theme are the top options. It
   sets the same theme preference as Settings > Themes: a shortcut.

8. (2026-11-06) Under Task Options settings, an option "Enhanced Task Details" that enhances the task view: the
   Preset used to create the task if available; the Options in individual bubbles, so they stand out and are
   easier to read; an item showing the exact ODX command it generates, for easy copy/paste.

Added 2026-11-06 (fourth new.md):

9. Under Themes settings, an option at the top to toggle the Paint Brush control in the header on/off.
10. Two new settings sections, 2D Map and 3D Map, for their own settings. In 2D Map, "Movable Controls": when on,
    the user can move the 2D map's popup controls around (all of WebODM's built-in ones: Contours, Layers, Base
    Maps, ...); a control that closes always reopens in its default position.
11. Without a change to WebODM: can another task of the same project be selected as a layer in a task's 2D map,
    to overlay orthophotos and compare before/after results? Dropped (the user, 2026-11-06): WebODM's project
    map (a project's View Map) lists every task's layers with Side By Side; nothing to build.
12. Task start and end times in Enhanced Task Details: the task's duration is shown, but the start and finish
    timestamps help too.

Added 2026-11-06 (fifth new.md):

13. Each part of Enhanced Task Details its own toggle in the settings (e.g. Show Start/End Timestamps, Show ODX
    Command, ...).
14. An Enhanced Task Details option for running tasks: the current step's name and number out of the steps to
    complete, e.g. "Current Step (8/15): Texturing"; how the steps are found to be discussed.

Added 2026-11-06 (sixth new.md):

15. Request 11 again: in a task's 2D map (e.g. TestRGB's), pick another task's orthophoto of the same project
    (TestThermalNoPlugin's) in Layers, to compare it with the task's own; the user couldn't find the built-in way.

Added 2026-11-06 (seventh new.md):

16. A Source Frames option in the 2D Map and 3D Map settings: a button to pick a spot or draw an area on the map,
    which opens a window with the source photos that see it, each photo's properties, and buttons to open the
    full frame or download it. For an area, the photos are ranked by how much of the area they show.

Added 2026-11-06 (eighth new.md):

17. Zoom Override in the 2D Map and 3D Map settings: on the 2D map, zoom in 3 steps further than WebODM allows; in
    the 3D view, zoom in about 3x closer. The user isn't sure how the 3D control works and asked how it should.

Added 2026-11-06 (ninth new.md):

18. Source Frames without Area, which is unnecessary: a spot covers an area, as the user can simply move it. The
    spot moves to wherever the user clicks on the map, and the window opens there; the window updates as close
    to real time as possible.

Added 2026-11-06 (tenth new.md):

19. The best documentation framework for hosting the docs on GitHub and staying in step with the repo, with
    screenshots of many key features to show what they do; where possible, the screenshots shown in TweakUI's
    settings too, so the user sees what they are turning on or off.

Added 2026-11-06 (new.md after request 21):

22. On Settings > General, Enhanced Task Details and its options in their own group titled "Task Details"; its
    options renamed: Started and Finished -> Task Start and End Time, Preset -> Show Configured Task Preset,
    Options as bubbles -> Options as Bubbles, ODX command -> Show ODX Command, Current step -> Show Current
    Processing Stage.

Decided (the user, 2026-11-06):
- **Settings are each user's own**: every logged-in user has the TweakUI menu item and changes settings for
  themselves only (the plugin's per-user data store).
- **Themes are a per-user overlay**: a user picks a preset or "WebODM's theme" (the default); nothing in WebODM's
  data changes, and turning the plugin off restores everything.
- **"Modified" means different from ODM's default**: what the dialog's own "Reset to default" button restores,
  so a preset's own settings count as modified.

## Phase 1: settings page and Show Modified Options (requests 1, 2, 4) — done

What WebODM offers (checked in 3.3.2 and 4.0.0):
- `main_menu()` adds side-menu entries (`app/plugins/menu.py`, rendered in `app/logged_in_base.html` for logged-in
  users); `app_mount_points()` adds pages under `/plugins/tweakui/`, which extend `app/logged_in_base.html`.
- `app_view_handler` (`app/plugins/views.py`) tries a plugin's mount points before its `public/` files, so
  `include_js_files(["settings.js"])` can be a view: each page gets the user's settings in `<head>`, before
  `main.js`, with no request after load.
- `UserDataStore` (`app/plugins/data_store.py`) holds per-user values (string, int, float, bool, json).
- The Task Options dialog is `EditPresetDialog.jsx`, the same in both versions. It calls
  `PluginsAPI.Dashboard.presetDialogOptionsReady({task, getExifData, options})` when it opens and when the view
  changes (grouped/flat); `options` holds each option's component by name. An option is at its default when
  `getValue()` is `undefined` (`ProcessingNodeOption.jsx`), which is also what "Reset to default" restores. Each
  group heading is `.option-group-header` with `<span class="option-count">(N)</span>`; groups are rendered while
  collapsed (hidden), except "Other Options", whose options exist only while it is open.

Design:
- **Menu**: "TweakUI" in the side menu (sliders icon), linking to `/plugins/tweakui/`.
- **Page**: `/plugins/tweakui/` (logged in), WebODM's layout; on the left a navigation pane (General; Themes in
  phase 2), on the right the selected category. Opens on General. On a phone the pane sits above the content.
- **Storage and API**: settings are one JSON value in the user's data store; `GET`/`PATCH
  /api/plugins/tweakui/settings` (the user's own only; PATCH with the session's CSRF token). Unknown keys and
  wrong types are refused. `/plugins/tweakui/settings.js` sets `window.TweakUI.settings` on every page.
- **General > Task Options > Show Modified Options**: a switch, off by default, saved as soon as it is changed.
  When on, in the Task Options dialog (New Task > Options > Edit, and a task's Edit), each group heading reads
  "(modified/total)", "(0/13)" when none, updated as options change (inputs, checkboxes, selects, "Reset to
  default"). The count is put in a `data-` attribute that a CSS rule shows instead of WebODM's own number, so
  React's re-renders of the heading don't undo it. Grouped view only (flat view has no headings).
  (Built: the attribute is on `.option-group-header`, shown by `::after`, with WebODM's `.option-count` hidden.)

Open: none.

## Phase 2: Themes (request 3) — done

What WebODM offers (checked in 3.3.2 and 4.0.0):
- One theme per instance: `Setting.theme` points at a `Theme` (`app/models/theme.py`): 13 colours (primary,
  secondary, tertiary, button primary/default/danger, header background/primary, border, highlight, dialog
  warning, failed, success), custom CSS and HTML fields. Admins edit it in Administration > Theme.
- `app/templates/app/theme.css` turns those colours into CSS (411 lines; plus helpers `complementary`,
  `scalebyiv`), inlined and cached in `base.html` **after** the plugins' CSS, then the theme's custom CSS.
  4.0.0 adds `.admin-area` CSS variables for the rewritten Administration pages.
- Only those colours are themeable: about 6 of WebODM's stylesheets set white backgrounds directly (map and 3D
  view panels, among others), so dark presets need a small extra stylesheet for those places.

Proposed design (for the discussion):
- A preset is the 13 colours plus optional extra CSS. `/plugins/tweakui/theme.css` (a view, in
  `include_css_files`) renders WebODM's own `theme.css` template with the user's preset, so the presets follow
  whatever WebODM themes in each version. Since the plugin's CSS comes before WebODM's theme, its selectors are
  made more specific (each prefixed with `html `) to win without a flash. "WebODM's theme" serves nothing.
- Themes page: a list of presets with a preview swatch of their colours; choosing one saves and reloads the look.

Decided (the user, 2026-11-06):
- **Presets change only what WebODM's theme can change.** Places where WebODM hard-codes a white background (the
  map's layers panel, the side-by-side slider, the loading screen, the 3D view's Potree panels, ...) keep it:
  usually an icon or control there only works on white. Themes apply safely wherever possible and override
  nothing else.
- Consequence to handle: WebODM's theme sets the page's text colour (`body { color: primary }`), and those white
  panels inherit it, so a dark preset's light text would be unreadable there. The preset's CSS gives those
  panels the preset's own dark colour as text colour (a preset colour, not a hard-coded one), so they stay as
  they look with WebODM's default theme. The live check covers each of them on both versions.

- **Presets** (11, plus "WebODM's theme", the default): Catppuccin Latte, Frappé, Macchiato and Mocha; Solarized
  Light and Dark; Dracula; Nord; Gruvbox Dark and Light; One Dark.

Open: none.

Plan (branch `themes`):
- **Setting**: `theme` in `DEFAULTS` (`tweakui/settings.py`), default `"webodm"`; the API accepts only a known
  preset id.
- **Presets**: `tweakui/themes.py`, one dict per preset with WebODM's 13 theme colour fields (the names of
  `app/models/theme.py`), taken from each scheme's published palette.
- **`/plugins/tweakui/theme.css`** (an app mount point, listed in `include_css_files` after `main.css`): for a
  logged-in user with a preset, renders WebODM's own `app/theme.css` template with a context whose
  `SETTINGS.theme` holds the preset's colours (WebODM's `{% theme %}` tag reads `context['SETTINGS'].theme`), so
  the CSS follows each version's template; then prefixes every selector with `html ` so it wins over WebODM's
  inline theme, which comes later in the page. Then the panels with hard-coded white backgrounds get the preset's
  dark colour as text colour (see the decision above). "WebODM's theme" or a logged-out page: an empty
  stylesheet. Not cached across users (`Cache-Control: private`).
- **Settings > Themes** (the settings page's navigation pane, new section): a list of the presets, each with a
  swatch of its colours and its name; choosing one saves it and reloads the page so the new look shows.
- **README**: the Themes section; **CHANGELOG**.
- Found in the live check and built in: Administration's content (`.admin-area`) hard-codes a white background
  in both versions, and 4.0.0's theme colours its text through variables, so presets leave the `.admin-area`
  rule to WebODM's theme and give its text the preset's dark colour. WebODM's logo is white, so light presets have
  a header in their accent colour (the header text is whichever of text and base stands out more).
- Tests: Django (setting validation; the view renders a preset's colours, prefixes selectors, is empty for the
  default and for anonymous users), Jest (the Themes section saves the choice). Live on 4.0.0 and 3.3.2: each
  preset on the dashboard, a task's map, the 3D view, the settings page and Administration; the white panels stay
  readable; the user's setting restored afterwards.

## Theme switcher in the header (request 7) — done

Builds on Themes (the `theme` setting, `PATCH /api/plugins/tweakui/settings`, the presets).
What WebODM has (the same in 3.3.2 and 4.0.0): the header's right side is `ul.nav.navbar-top-links.navbar-right`
in `logged_in_base.html` with one `li.dropdown` (the user icon and its menu), a Bootstrap 3 dropdown driven by
jQuery's data API, which also handles items added later. In single-user mode the list is left out (no user
icon).

Plan (branch `theme-switcher`):
- `settings.js` also gives the theme list, `window.TweakUI.themes`: id, name and swatch colours, WebODM's theme
  first, then the presets in the Themes list's order.
- `public/theme_menu.js` (in `include_js_files`): on a page with the header's user dropdown, puts a
  `li.dropdown` before it: a paintbrush (`fa-paint-brush`) and caret, with a `dropdown-menu` (right-aligned, as
  the user menu): the current theme (checked), WebODM's theme (when it is not the current one), a divider, then
  the other presets; each with its swatch and name. Choosing one PATCHes `theme` (the CSRF cookie) and reloads
  the page; a failure shows in the menu and changes nothing. Not shown where the header has no user icon
  (logged out, public pages, single-user mode).
- Styles in `main.css` (theme colours only; swatches from the data, as in Settings > Themes).
- README, CHANGELOG. Tests: Django (`settings.js` gives the themes), Jest (the menu's order, placement, saving,
  failure, no header). Live on 4.0.0 and 3.3.2: the dashboard, a map and the settings page, desktop and phone;
  the user's theme restored.

Open: none (single-user mode has no user icon, so no switcher, as the request places it by that icon).

Found in the live check and built in:
- WebODM's `main.scss` sets dropdown items to `#222 !important` (both versions), over its theme's text colour:
  under a dark preset every dropdown (this menu, the user menu, Import) had dark text on a dark background.
  Presets now give `.dropdown-menu > li > a` the preset's text colour (`!important`, more specific).
- On a phone the paintbrush is not at the header's edge, so the right-aligned menu went off the left of the
  screen; there it lines up with the header's right edge.

## TweakUI menu item above About (request 6) — done

What WebODM offers (checked in 3.3.2 and 4.0.0, `app/templates/app/logged_in_base.html`, the same in both):
plugins' `main_menu()` items are rendered right after Dashboard, in plugin order; then Processing Nodes,
Administration (staff), Developer Tools (dev mode, superusers), and `<li id="about-menu">` last. There is no way
to place a plugin's item elsewhere, so `main.js` (loaded in `<head>`) moves TweakUI's `<li>` just before
`#about-menu` when the page is parsed. To avoid a flash, `main.css` hides the item in its first place
(`#side-menu > li:has(> a[href="/plugins/tweakui/"])`) until the script has moved it. Always, not a setting.

## Enhanced Task Details (request 8) — done

What WebODM has (checked in 3.3.2 and 4.0.0, the same in both):
- **The panel**: on the Dashboard, a task's row expands into a details table (`TaskListItem.jsx`): Task ID (with a
  copy-to-clipboard link), Created on, Processing Node, **Options** (one comma-separated line, `name:value`,
  `boundary:geojson`, or "Default" when empty), Average GSD, Area, Points, Georeferencing, CRS, Disk Usage,
  Task Output.
- **No preset is stored with a task**: a task keeps only its options (`Task.options`). WebODM itself finds the
  preset when a task's options are edited (`EditTaskForm.findFirstPresetMatching`): the first preset (system
  ones first, then newest) with exactly the same options and values, else "Custom".
- **The command**: WebODM sends the options to the node; NodeODX adds `--pc-ept --cog --gltf` (the outputs
  WebODM needs, when the node supports them) and runs `run.sh <options> --project-path /var/www/data <uuid>`.
  It logs that line on the node only (which may be another machine): WebODM never sees it. WebODM's docs show
  ODX run by hand as `docker run -ti --rm -v /my/project:/datasets/code webodm/odx --project-path /datasets
  <options>`.
- **Hooks**: `PluginsAPI.Dashboard.addTaskActionButton` is called with the task (its id, project, options) each
  time a task's details panel opens; there is no hook into the details table itself, so the rows are added and
  WebODM's Options row hidden by the script (as Show Modified Options does in the dialog), kept in place with a
  MutationObserver when React re-renders.

Proposed design (branch `task-details`):
- **General > Task Options > Enhanced Task Details** (off by default), beside Show Modified Options.
- In a task's details panel, with the setting on:
  - **Preset:** the preset the task's options match, found as WebODM does (the presets the user can see,
    `/api/presets/`), or "Custom" when none match.
  - **Options:** each option a bubble (`name` and value, theme colours), in place of the comma-separated line;
    "Default" when the task has none.
  - **ODX command:** the command, in a monospace box with a copy button (as Task ID's), e.g.
    `docker run -ti --rm -v /my/project:/datasets/code webodm/odx --project-path /datasets --dsm
    --feature-quality ultra`; values quoted for the shell where needed; `--boundary` as a file name, as the
    command line takes a GeoJSON file.
  - Updated when the task's options are edited.
- README, CHANGELOG. Tests: Jest (matching, bubbles, the command and quoting, the setting off), Django (the
  setting). Live on 4.0.0 (the completed TestRGB task) and 3.3.2 (a task created by the check, then deleted),
  desktop and phone, a light and a dark preset.

Decided (the user, 2026-11-06):
- **Before Storage.**
- **The preset is matched as WebODM does** (existing tasks too; an edited preset may no longer match), not
  recorded at creation.
- **The command is the docker command** of WebODM's docs (`/my/project` a placeholder for the user's folder).
- **With the options the node adds** (`--pc-ept --cog --gltf`), so a run by hand gives the same outputs; false
  booleans left out, as the node does.

## Paintbrush toggle and task start/end times (requests 9, 12) — done

What there is: the paintbrush menu (`public/theme_menu.js`) is on for every user; Enhanced Task Details
(`public/task_details.js`) replaces WebODM's Options row of a task's details panel. WebODM's panel (the same in
3.3.2 and 4.0.0) has "Created on:" (`Task.created_at`) and shows the duration in the task's row
(`processing_time`, ms, from the node). WebODM stores no start or end time. Two sources exist:
- **ODM's `log.json`** in the task's assets (`/api/projects/<p>/tasks/<t>/assets/log.json`, WebODM's own route,
  both versions): `startTime` and `endTime` of the run on the node; only for tasks whose results were
  downloaded (not running, failed or canceled), and written without a time zone (the node's clock; UTC in Docker).
- **WebODM's own fields**: started = `created_at`, finished = `created_at` + `processing_time`. On the TestRGB
  task they are within 20 s of `log.json`'s times (13:38:04 / 14:24:40 against 13:38:23 / 14:24:57 UTC); they work
  for every task, any node, and a running one. But `created_at` is set when the task is created, i.e. when its
  upload begins, and a restart sets `processing_time` back to -1 and the node counts again from the new run: after
  a slow upload Finished is early by the upload's length, and after a restart both are off by the time before it.

Decided (the user, 2026-11-06, asked again once the restart and upload caveats were known): the times come from
WebODM's own fields (not `log.json`), with those caveats.

Design:
- **Themes > Theme Menu > "Show the theme menu in the header"** (on by default), at the top of the Themes section; off, the
  paintbrush isn't added. Settings > Themes still picks the theme.
- **Enhanced Task Details: "Started:" and "Finished:" rows** after WebODM's "Created on:" (found by its text),
  in the browser's local date and time like WebODM's. Started: `created_at` once the task has run (a
  `processing_time` above 0, or running). Finished: `created_at` + `processing_time` for a completed, failed or
  canceled task that ran; "Running" while it runs; "—" otherwise. While a task that hasn't ended has its panel
  open, it is fetched again every 5 s, so the rows follow it.

## Enhanced Task Details: a toggle per row, Current Step (requests 13, 14) — done

What there is: Enhanced Task Details (one setting, `enhanced_task_details`, `public/task_details.js`) adds
Started/Finished after "Created on", and Preset, Options (bubbles, WebODM's Options row hidden) and ODX command;
a task that hasn't ended is fetched again every 5 s while its panel is open. For the steps (checked in ODX 3.8.5
on the dev node and in WebODM 3.3.2 and 4.0.0):
- **ODM's pipeline** (`stages/odm_app.py`): dataset, split, merge, opensfm, openmvs, odm_filterpoints,
  odm_meshing, mvs_texturing, odm_georeferencing, odm_dem, odm_orthophoto, odm_report, odm_postprocess: 13;
  `fast-orthophoto` leaves out openmvs, `end-with` stops after the stage it names. Every stage logs
  `Running <name> stage` as it starts (a rerun too: stages skip their work inside, after that line), and
  `No more stages to run` after the last.
- **WebODM keeps the node's output** in the task's console, served by `GET /api/projects/<p>/tasks/<t>/output/
  ?line=N` (lines from N; the same in both versions). A restart clears it. After ODM, the task stays running
  while WebODM downloads and extracts the results (`running_progress` 0.85 to 1).

Decided (the user, 2026-11-06):
- **Before Movable Controls.**
- **ODM's stages only** are counted (13, 12 with fast-orthophoto, fewer with end-with), not WebODM's upload and
  download.
- **In the details panel only**, not in the task's row on the dashboard.
- **Enhanced Task Details stays the main switch**, with a toggle per row under it, all on by default.

Design (branch `task-details-rows`):
- **Settings > General > Task Options > Enhanced Task Details**, then indented under it, greyed out while it is
  off: **Started and Finished**, **Preset**, **Options as bubbles**, **ODX command**, **Current step** (settings
  `task_details_times`, `_preset`, `_options`, `_command`, `_step`, all on). With Options as bubbles off,
  WebODM's Options row stays and the other rows go after it.
- **"Current Step (n/N): Name"** after Finished (or where Started/Finished would be), only while the task runs:
  the last `Running <name> stage` line in its console, read from `/output/` (the whole console on opening, then
  only the new lines at each 5 s fetch; from the start again when the task restarts). Names: Load Dataset, Split,
  Merge, Structure from Motion, Multi-View Stereo, Filter Points, Meshing, Texturing, Georeferencing, Elevation
  Models, Orthophoto, Report, Post-processing. N from the task's options (fast-orthophoto, end-with). Before the
  first stage "Starting"; after `No more stages to run` "Downloading results" (no number).
- README, CHANGELOG. Tests: Jest (each toggle, the step from console lines, N from the options, the polling of
  new lines, a restart), Django (the defaults, the controls). Live on both stacks; a running task by restarting
  TestRGB from a late stage on 4.0.0 is not done (it changes the user's task): a task created by the check, or
  Jest only, to be seen when building.

## 2D Map and 3D Map settings, Movable Controls, Other Tasks (requests 10, 15) — done

What there is (the same in 3.3.2 and 4.0.0): the 2D map's popup panels are Leaflet controls in the map's top-right
corner: Layers (`LayersControlPanel`), Contours and Object Detection (core plugins), each a `.open` wrapper with a
`.title` bar and a `.close-button`; Measure (the measure plugin's `.plugin-measure.popup`); Base Maps (Leaflet's
layers control, a list that opens while the pointer is over it).

For Other Tasks (request 15; the same in 3.3.2 and 4.0.0): WebODM's project map (Dashboard > a project > "View
Map", `/map/project/<p>/`) loads every task's layers, and its Layers panel lists each task with its own
Orthophoto, Plant Health and Surface Model and a side-by-side button (checked live on 4.0.0 with TestProject:
TestThermalNoPlugin and TestRGB). A task's map (`/map/project/<p>/task/<t>/`) loads only that task.
`PluginsAPI.Map.didAddControls` gives the Leaflet map and the tiles (each with `meta.task`: id, project, crop);
`/api/projects/<p>/tasks/?available_assets=orthophoto.tif` lists a project's tasks with an orthophoto, and
`/api/projects/<p>/tasks/<t>/orthophoto/metadata` gives a layer's tile URL and bounds, as WebODM's map uses them
(512-px tiles).

Decided (the user, 2026-11-06): 3D Map is added now, empty ("No settings yet"). Other Tasks (request 15) is built,
in this phase: a panel on a task's map (not only a shortcut to the project's map).

Design:
- **Settings > 2D Map** and **Settings > 3D Map**: two categories in the navigation pane.
- **2D Map > "Movable Controls"** (off by default): a panel is dragged by its title bar (mouse or touch), within
  the map; when it closes (its wrapper loses `.open`, or it is removed) its position is cleared, so it reopens
  where WebODM puts it. Base Maps and Measure have no title bar: dragged by their own edge (Base Maps closes as
  soon as the pointer leaves it, so moving it helps little).
- **2D Map > "Other Tasks"** (off by default): on a task's map (not the project's map, which has them all), a
  button below Layers opens an "Other Tasks" panel, styled as Layers (title bar, close button, so Movable Controls
  drags it too): the project's other tasks with an orthophoto, each with a checkbox (shown over the task's own
  layers, cropped as its task is) and an opacity slider; none shown on opening. Nothing remembered between pages.

## Source Frames (request 16) — done

What WebODM offers (checked in 3.3.2 and 4.0.0, the same in both):
- A task with cameras has `shots.geojson` (in `available_assets`; e.g. TestRGB, 220 photos): per photo its file
  name, camera, focal length, width and height, capture time, and its pose (`translation`: the camera's position
  in the task's UTM coordinates; `rotation`: axis-angle). `cameras.json` has each camera's lens distortion
  (Brown: k1, k2, k3, p1, p2, centre). The 2D map shows the photos as a "Cameras" layer (camera markers, a popup
  with the photo and "Download Image"); the 3D view shows them as frustums, a click opens the same popup.
- `/api/projects/p/tasks/t/images/thumbnail/<file>` scales, crops, zooms and draws points on a photo
  (`size`, `center_x/y`, `zoom`, `draw_point`); `.../images/download/<file>` sends the original.
- No API gives the ground height at a spot, which a 2D spot needs (a 3D pick has it). The task's `dsm.tif` has it,
  but ODM makes a DSM only when asked (fast-orthophoto tasks have none); the point cloud's `ept.json` gives the
  points' mean height, a usable flat ground for a task without a DSM.
- Plugins add buttons to the 2D map and the 3D view with `PluginsAPI.Map.addActionButton` and
  `PluginsAPI.ModelView.addActionButton` (vanilla, as the Snapshot core plugin does: `React.createElement`); the 3D
  view's Potree viewer is `window.viewer`, and its scene is in the same UTM coordinates as the poses.

Proposed design (for the discussion):
- **Settings**: 2D Map > Controls > "Source Frames" and 3D Map > "Source Frames" (each off by default; the 3D
  category loses "No settings yet").
- **The button** shows only on a map or 3D view with a task that has cameras. It opens a small bar: "Spot" (click
  a place) or "Area" (click the corners, finish on the first one or with a double click; Esc cancels). The spot
  or area stays drawn on the map while its window is open.
- **Finding the photos** is a TweakUI API (`/api/plugins/tweakui/frames/<project>/<task>`, WebODM's task
  permissions): it takes the spot or area, finds its ground height (the DSM, else the point cloud's mean height;
  in 3D the picked point's own), projects it into every photo with its pose and lens, and returns the photos that
  see it, each with where the spot or area falls in it. An area is sampled on a grid (a few hundred points), and
  a photo's score is the share of the area it shows. Hidden places (a roof hiding the ground) are not detected:
  a photo is counted when the place is inside its frame.
- **The window** (inside the map, draggable like the map's panels): the photos, best first, as thumbnails with
  their score; the chosen one large, with the spot or area drawn on it, and its properties (file name, camera,
  capture time, size, the camera's altitude, the share of the area shown); "Open full frame" and "Download".
- **Project maps**: a project's View Map searches every task on it with cameras, each photo labelled with its task.

Decided (the user, 2026-11-06):
- **Before Storage.**
- **The 2D button is an action button** (the map's bottom-right row, beside Share and Snapshot), as in the 3D view.
- **A spot's photos are ordered by how near the spot is to the frame's centre** (an area's by the share of the
  area shown, then the same).
- **"Open full frame" opens a full-screen viewer in the page** (zoom and pan, the spot or area drawn on it, Esc
  closes it).

## Zoom Override (request 17) — done

What WebODM offers (checked in 3.3.2 and 4.0.0, the same in both):
- **2D map**: the Leaflet map stops at zoom 24 (`Map.jsx`: `maxZoom: 24`); its layers would go further (an
  orthophoto's tiles are enlarged past their own zoom, to `maxzoom + 99`; base maps alike). So zoom 24 is the only
  limit, and `map.setMaxZoom()` from the map hook lifts it: 3 steps is zoom 27, each step twice as close (the
  orthophoto's own pixels, enlarged; e.g. TestRGB's tiles stop at their native zoom and are scaled up beyond).
- **3D view** (Potree's orbit controls): there is no limit. Each wheel step goes 10% of the remaining way to the
  orbit centre (the point the view turns around, at first the middle of the scene), so it slows down as it nears
  it and never passes it: measured on TestRGB, 98 m from the centre at first, 4 m after 30 steps, 0.18 m after 60.
  What feels like a limit is the orbit centre: a surface in front of it can be neared, one beyond it can't.
  Potree has two ways round it already: a double click on the point cloud jumps close to that point and makes it
  the orbit centre (not on the textured model), and Tools > Navigation's Earth controls zoom toward the pointer.

Proposed design (for the discussion):
- **Settings**: 2D Map > Controls > "Zoom Override" and 3D Map > Controls > "Zoom Override" (each off by default).
- **2D**: the map zooms 3 steps further (zoom 27), with the wheel, the + button and a pinch.
- **3D**: the wheel zooms toward what is under the pointer (the point cloud or the textured model) instead of the
  orbit centre, and the orbit centre moves there as it zooms: any surface can be neared, as closely as wanted;
  once the pointer is on nothing, the wheel works as before.

Decided (the user, 2026-11-06):
- **Before Storage.**
- **2D: 3 steps, fixed** (zoom 27); one on/off setting.
- **3D: the wheel zooms toward what is under the pointer**, the orbit centre moving there (over nothing, as before).

## Source Frames: a spot that follows the clicks (request 18) — done

Builds on Source Frames (request 16). What it does now (`public/source_frames.js`, the same on 3.3.2 and 4.0.0):
- The action button opens a bar (2D map and 3D view): **Spot**, **Area**, **Finish** (while an area is drawn), a
  hint and ×. Spot is picked at first; a spot takes **one** click, then picking ends: another spot needs Spot again.
- Each place closes the window and opens a new one at its default place (top right), showing "Finding the
  photos…" until the list comes, the best photo selected.
- One lookup takes 12–19 ms in the server on TestRGB (220 photos, with a DSM; measured in `tw-webapp`), plus the
  request's round trip: fast enough to follow a dragged spot.

Proposed design (for the discussion):
- **Area goes**: the bar's Area and Finish buttons, the area drawing on the 2D map and in the 3D view, the
  window's "Area shown", and the API's Polygon (`frames.py`: the grid, the share; a spot's result loses `share`).
  The README, the settings' wording and the tests follow.
- **The spot follows the clicks**: while Source Frames is open, every click on the map (or on the points or the
  model in 3D) moves the spot there; a drag still pans (or orbits). The first click opens the window; later ones
  update it.
- **The window updates in place**: it stays where the user dragged it, the list and the photo are replaced when
  the new answer comes (no "Finding the photos…" in between, a small busy sign instead), and only the latest
  place's answer is shown (a newer click cancels the older request).

Decided (the user, 2026-11-06):
- **Before Storage.**
- **Click only**: a click moves the spot; the marker itself isn't dragged.
- **Each move shows the window as if opened fresh at the new spot**: the best photo selected (the spot nearest
  the frame's centre); the same spot simply moves around and the window only updates.
- **No bar**: a label "Click Map to View Source Frame" appears once the Source Frames action button is clicked
  and stays on screen the whole time Source Frames is on. The button again, Esc, or the window's × ends Source
  Frames and removes the spot.

## Storage (request 5) — done

What WebODM offers (checked in 3.3.2 and 4.0.0, the same in both):
- **Diagnostic** is a core plugin (`coreplugins/diagnostic`): one side-menu item "Diagnostic" linking to
  `/plugins/diagnostic/`, a page with the disk's and memory's free/used charts. It has no submenu and no tabs;
  admins can disable it.
- **Quota**: `Profile.quota` (MB, -1 = none); `used_quota()` is the sum of `Task.size` over the tasks of the
  projects the user **owns**. Only tasks count: nothing else of a user's is in the quota.
- `Task.size` (MB) is kept by WebODM (`update_size`, after processing, uploads, compacting) and is in the tasks
  API. A per-kind breakdown (photos, orthophoto, DEM, point cloud, textured model) needs a walk of the task folder.
- **Cleanup through WebODM's own API** (its permissions, node cleanup and quota cache): a task's `remove`
  (`POST /api/projects/<p>/tasks/<t>/remove/`), `compact` (deletes the task's photos, keeps its results; only for
  completed tasks), and `DELETE /api/projects/<p>/` (the owner deletes; a non-owner only loses access).
- LuxODM's Storage page (a fork, `app/storage.py`, `StorageView.jsx`) has two parts: each user's projects and
  tasks with sizes and their quota; and, for admins, the whole instance measured by a Celery job, with
  clear-cut leftovers (failed/canceled tasks, partial uploads, folders without a row, caches, node copies),
  opt-in daily rules and a deletion log (Django models). The admin part needs models, a beat schedule and
  file deletion on the server, which a plugin can't add the same way (no models; data stores only).

Proposed design (for the discussion):
- **Settings > Storage**: a new category in the navigation pane with "Show the Storage view" (off by default).
- **The view** (`/plugins/tweakui/storage/`, logged in): the user's quota bar ("X of Y used", or "X used"), and
  their own projects, largest first, each with its tasks (name, status, date, size); a task's breakdown by kind
  loaded when it is opened. Suggestions marked: failed / canceled tasks, completed tasks whose photos can be
  compacted. Actions per task: Compact, Delete; per project: Delete; each with a confirmation naming what goes
  and what it frees, done through WebODM's API above. Projects shared with the user are not listed (they are
  not in the user's quota).

Decided (the user, 2026-11-06):
- **Under a Diagnostic submenu**: with Storage on, TweakUI's script turns the Diagnostic side-menu item into a
  menu with "System" (WebODM's Diagnostic page) and "Storage" (TweakUI's view), as in LuxODM. If an admin
  disables Diagnostic, the Storage view has no menu entry.
- **Admins also see all users**: everyone sees and cleans their own projects; admins also see every user's
  projects and sizes (with the owner) and clean them through WebODM's API. No leftover-folder, cache or node-copy
  cleanup (that would need file deletion by the plugin on the server).

Decided when planned in full (the user, 2026-11-06):
- **A task's breakdown by kind, when it is opened**: photos, orthophoto, elevation, point cloud, textured model,
  other (LuxODM's `task_breakdown`, a read of the task's folder; the plugin never deletes files itself). It shows
  what Compact frees (the photos).
- **Checkboxes and one action**: tick tasks or projects, then Compact or Delete the selection, with one
  confirmation listing everything that goes and the total it frees; each row keeps its own buttons too.
- **Admins: grouped by user**: their own projects first, then a section per other user (largest first), each with
  the user's quota bar and their projects and tasks.
- **Without Diagnostic** (disabled by an admin): Storage becomes a sub-item of TweakUI's side-menu item, which
  turns into a parent ("Settings", "Storage"), expanded by default.

The plan:
- **Settings > Storage**: a new category in the navigation pane (icon `fa-database`) with "Show the Storage view"
  (`storage_view`, off by default) and a description saying where it appears.
- **Side menu** (`main.js`, before metisMenu starts): with `storage_view` on, the Diagnostic item becomes a parent
  "Diagnostic" with "System" (`/plugins/diagnostic/`) and "Storage" (`/plugins/tweakui/storage/`); without a
  Diagnostic item, TweakUI's item becomes a parent with "Settings" and "Storage", expanded. The current page's
  sub-item is marked active. Off: the menu is WebODM's as before.
- **The page** (`/plugins/tweakui/storage/`, an `app_mount_point`, logged in; with the setting off it says where to
  turn it on): a template on WebODM's base like the settings page, filled by `storage_page.js` (ES5).
  - Per user: the quota bar ("X of Y used", or "X used" without a quota), then the projects they own, largest
    first, each opening to its tasks (name, status, created, size, a mark for failed / canceled / compactable);
    a task opening to its breakdown.
  - Checkboxes on projects and tasks; a bar with "Compact" (completed, not yet compacted tasks only) and "Delete";
    each row's own Compact / Delete. The confirmation names each project and task and the MB freed (a task's
    size; Compact: its photos, from the breakdown when loaded, else "its photos").
  - The actions go through WebODM's API from the browser (`POST .../tasks/<t>/compact/`, `.../remove/`,
    `DELETE /api/projects/<p>/`), so its permissions, node cleanup and quota apply; the list refreshes after.
- **The plugin's API**: `GET /api/plugins/tweakui/storage` (the user's report; for admins every user's, grouped)
  and `GET /api/plugins/tweakui/storage/task/<p>/<t>` (the breakdown, for the owner or an admin). Sizes from
  `Task.size`; the quota from `Profile`.
- **Tests**: Django (the report's sums and ordering, owners only, admins' groups, the breakdown and its
  permissions, the setting); Jest (the menu restructuring both ways, the page's rendering, selection and the
  confirmation's totals, the API calls). Live on both stacks with a task the check creates and deletes.

Open: none.

## Custom themes (request 21)

The request (2026-11-06): users create their own themes, import and export them as JSON; administrators publish
themes to every user.

Builds on: `tweakui/themes.py` (a theme is WebODM's 13 theme colours, `FIELDS`; `preset_css` renders WebODM's own
theme template with them, so it works for any 13 colours; `theme_list` feeds the settings page and the header's
theme menu, `window.TweakUI.themes`), `settings.py` (the `theme` setting, checked by `allowed`; an unknown value
falls back to WebODM's theme on load), the per-user and global data stores, Settings > Themes > Sample (the
preview), `main.js` (already moves side-menu items: the TweakUI item, Storage under Diagnostic).

Decided (the user, 2026-11-06):
- **All 13 of WebODM's colours**, as in Administration > Theme. A new theme starts from a copy of **any** theme
  (WebODM's, a preset, a published one or one of your own). Built-in (and published) themes can't be edited, only
  copied.
- **Each user's own themes, plus themes an administrator publishes to every user**, read-only to them; published
  themes are managed on a page under **Administration** (import, export).
- **A JSON file** of a single theme object or a list of them: `{"name": "...", "colors": {"primary": "#rrggbb",
  ...}}` (WebODM's field names, all 13 required; other keys ignored).
- **An imported theme with the name of an existing one replaces it** (in the same list: your own, or the published).
- **Files and text**: besides the file, each theme has **Copy JSON** (the theme as a JSON string on the clipboard)
  and Import also takes pasted JSON text (the same object or list).
- **Published themes: import, or publish one of your own**: the Administration page has Import, Export, Delete and
  **Publish** (a copy of one of the administrator's own themes, made in the normal editor); no second editor.
- **Superusers only** see Administration > TweakUI Themes and change published themes (other staff don't).

Design:
- Storage: your themes in your user data store (`themes`: a list of `{id, name, colors}`); published ones in the
  plugin's global data store. Checked on the server on every write: each colour `#rrggbb` (it goes into CSS), a
  name of 1 to 60 characters, at most 50 themes per list. The `theme` setting takes `webodm`, a preset id,
  `own:<id>` or `published:<id>`; a deleted theme falls back to WebODM's theme.
- Settings > Themes: the swatches in groups, WebODM's theme and the presets, then Published, then My themes. A
  **New theme** button and a **Copy** action on every theme open the editor; your own themes also have **Edit**.
  The editor (under the swatches, above the Sample): a name, 13 labelled colour pickers (the browser's
  `input type=color`, plus the hex value) in Administration > Theme's order, Save, Cancel, and Delete for an
  existing theme. While editing, the Sample and the page show the unsaved colours (the server renders the CSS
  for them; nothing is saved until Save). The header's theme menu lists your own and the published themes too.

Phases:
- **A. Your own themes**: storage and checks, the API (list, create, update, delete, preview CSS), the editor,
  choosing one. Tests: Django (the checks, CSS of an own theme, another user can't see or change it, a deleted
  theme falls back), Jest (the editor, the preview), live on both stacks.
- **B. Import and export** on Settings > Themes: **Export** downloads `tweakui-themes.json` (all your themes; each
  own theme's menu also exports just it); **Copy JSON** on any theme puts it on the clipboard as a JSON string;
  **Import** takes a file or pasted JSON text, the server checks it and replaces by name, and
  the page says what was added, replaced or refused (and why). Tests: Django (single object, list, bad colour,
  missing field, too many, replace by name), Jest (the file read and the report), live.
- **C. Published themes**: a page `/plugins/tweakui/admin/themes/` for superusers (others get 403), linked from
  the side menu's **Administration** section by `main.js` (WebODM has no hook there; the link is added only for
  administrators). It lists the published themes with their swatches; Import (replace by name), Export (all or
  one), Delete; and **Publish** a copy of one of the administrator's own themes. Users see them under Published,
  can choose and copy them. Tests: Django (permissions, a published theme in every user's list and CSS, delete
  falls back), Jest, live.

Open: none.

## Theme sample (request 20)

The request (2026-11-06): in place of the Themes intro's thumbnail, a small form of example text and controls that
do nothing but show the current theme: dropdowns with items, labels, buttons, controls the settings page doesn't
otherwise show.

Decided (the user): **below the theme swatches** (first above them, moved below the same day); the Themes screenshot (`themes.webp`) stays
for the docs site. Contents, from what `theme.css` restyles: heading, body text, link, muted text, status labels
(`theme-background-success` / `-failed`), a progress bar, a labelled text field, a select with a disabled option, a
dropdown button with items, a divider and a disabled item, buttons (default, primary with a tooltip, danger,
disabled), pagination.

## Documentation, screenshots and previews (request 19)

Builds on: the settings page (`templates/settings.html`, one `.tweakui-setting` per checkbox, its description in
`p.text-muted`), the README's feature text (the docs' starting point), the Playwright set-up the live checks use
(`node_modules/playwright`, the dev account), `dev/package.sh` (the zip: everything committed in `tweakui/`).

Decided (the user, 2026-11-06):
- **VitePress on GitHub Pages**: Markdown in `docs/`, built with Node (already the repo's dev tooling), published
  by a workflow that runs on a pushed release tag (`v*`) or by hand (`workflow_dispatch`), never on every push, so
  the site matches the released version. The repo is private: Pages needs a paid plan or the repo public, the
  user's step before the first publish.
- **README: an overview with links**: what TweakUI is, a short list of features, requirements and install, each
  feature linking to its docs page. The full text lives only in the docs.
- **Previews: a thumbnail, click to enlarge**: right of a setting's description (under it on a phone); a click
  opens it full size over the page, Esc or a click closes it.
- **Stills in WebODM's default theme**: one WebP per feature, retaken by a script.

Phases:
1. **Feature screenshots.** `dev/screenshots.js` (Node, Playwright, headless): logs in to the 4.0.0 dev server,
   saves the account's TweakUI settings, and for each shot in a list (its name, the settings it turns on, the page,
   the steps to show it, the area to crop) sets them, takes it and restores the settings at the end, also on a
   failure. The shots: Show Modified Options (the Task Options dialog), Enhanced Task Details (a task's details),
   Themes (a page in a preset theme) and the header's theme menu, Movable Controls, Other Tasks, Source Frames in
   2D and 3D, Zoom Override 2D and 3D (a before/after pair side by side), the Storage view. The page data is the
   account's own (TestRGB on 4.0.0), only read. PNG from Playwright, turned into WebP by the browser itself
   (canvas `toDataURL("image/webp")`, no image library), at most 1280 px wide, into `tweakui/public/previews/
   <name>.webp`. `npm run screenshots`. Tests: Jest for the shot list's checks (every name a setting or a page,
   no two alike); the run itself checked by looking at each image.
2. **Previews in the settings.** A `data-preview="<name>"` on a `.tweakui-setting` (in `settings.html`) adds a
   thumbnail from `previews/` (`loading="lazy"`, an alt text from the setting's name); a click opens a full-size
   overlay (theme colours, Esc, a click or × closes it, focus back to the thumbnail). A missing image hides its
   thumbnail. Tests: Django (the page names only images that exist), Jest (the overlay), live on both stacks at
   desktop and phone widths, light and dark.
3. **Documentation site.** `docs/` (VitePress, pinned): a home page, a page per settings category (General,
   Themes, 2D Map, 3D Map, Storage) from the README's text with the screenshots, Install, Developing. The images
   come from `tweakui/public/previews/` (one copy, served to both). `npm run docs:dev` and `docs:build`;
   `.github/workflows/docs.yml` builds and deploys to Pages on a `v*` tag or by hand. README trimmed to the
   overview; CLAUDE.md: a feature change updates its docs page and retakes its screenshot. Checked: the build, the
   site served locally in the browser (links, images, phone width, dark mode). The workflow's first run is the
   user's, after a tag or by hand.

Open: none.

## Theme Sample frame and My Themes buttons (new.md, 2026-11-07)

Requests, as written:
- "Create a border around the Sample form under Themes to make it stand out as the Sample form area. Give it a
  heading of "Sample Form for Viewing Theme Effects"."
- "Move the "New Theme", Import and Export buttons underneath the "My Themes" heading"

Builds on: Settings > Themes, the Sample group (`templates/settings.html`, a `.tweakui-group theme-border` with the
h5 "Sample", like every settings group, so its 1px border doesn't set it apart) and the My Themes heading (buttons
above the h5 since the "My Themes" change earlier today, `.tweakui-themes-heading-stacked`).

Proposed: one phase, branch `sample-frame`.
- Settings > Themes > Sample: heading "Sample Form for Viewing Theme Effects"; a frame that sets it apart, colours
  from WebODM's theme classes only. Docs `docs/themes.md` (Sample section), screenshot of the settings page retaken
  if it shows it.
- Settings > Themes > My Themes: the New Theme, Import and Export buttons below the "My Themes" heading, left-aligned.
  Docs unchanged in substance (they say "beside New Theme" for Export, still true).

Decided: a 2px solid border in the theme's text colour (Accent border). Done.

## Global Controls: units and temperature in the header (new.md, 2026-11-07)

Requests, as written:
- "Under General add a section for Global Controls. Add a dropdown next to the paintbrush in the header row with the
  user's unit preference (e.g. Metric, Imperial(US, etc...)) that normally appears on the 2D and 3D maps. This
  dropdown should stay linked with those. It's essentially a shortcut for the user to set their unit preferences.
  The dropdown should only be visible and changeable when this option is enabled."
- "Under General's Global Controls, add a dropdown to the left of the Units in the header row that is only
  changeable/visible when this option is enabled. This dropdown is linked to the user's temperature algorithm
  settings in the Thermal Layers which currently only allows changing between Celsius and Kelvin. If possible, add
  Fahrenheit to the available conversions."

What WebODM does (checked in both 3.3.2 and 4.0.0, identical):
- Units: `app/static/app/js/classes/Units.js` keeps the system in `localStorage.unit_system` (`metric`, `imperial`,
  `imperialUS`; shown as Metric, Imperial, Imperial (US)) and fires a document event `onUnitSystemChanged` on a
  change. The 2D map (Map.jsx) and 3D view (ModelView.jsx) render `UnitSelector` (`select.unit-selector`), which
  reads the system once and doesn't listen for changes; measurements, histograms and the 3D view listen to the
  event. Per browser, not per user (WebODM's choice).
- Temperature: the 2D map's Thermal layer (Layers panel, a 2-band orthophoto) has an Algorithm select of server
  formulas (`app/api/formulas.py`): Celsius (`L`) and Kelvin (`L * 100 + 27315`, really centikelvin). It is per
  layer and per page (LayersControlLayer state), starts at Celsius on every map load, and its select exists only
  while the layer is expanded. Fahrenheit is not a formula; adding one is a change to WebODM's server code, so it
  would reach only future WebODM versions. WebODM's `Units.js` already shows temperatures in Fahrenheit for the
  imperial systems where it formats them (and the DJI Thermal plugin follows that).

Proposed:
- Phase 1 (branch `global-units`): Settings > General > Global Controls > "Units in Header" (off by default). On, a
  select in the header, left of the paintbrush, with WebODM's unit systems; it writes `unit_system` and fires
  `onUnitSystemChanged` as WebODM's own selector does, follows changes made on the maps (the event), and updates
  any map selector on the page so they agree. Docs `docs/general.md`, screenshot, tests.
- Phase 2: the temperature select, left of Units — depends on the decisions below.

Decided with the user (2026-11-07):
- Names "Units in Header" and, later, "Temperature in Header".
- Units only for now: the temperature select waits until Fahrenheit or a cleaner hook exists in WebODM (driving the
  Thermal layer's Algorithm through its expanded panel was offered and declined).
- No pull request to WebODM for a Fahrenheit formula for now.

## Just for Fun: Surprise Me (asked in chat, 2026-11-07)

Request: an option at the bottom of General, "Surprise Me", that randomly shows fireworks across the whole site with
fireworks-js (https://fireworks.js.org/) until the user turns it off.

Built (defaults chosen by Claude, open to change):
- fireworks-js 2.10.8 (MIT), its UMD build copied into `tweakui/public/vendor/fireworks-js/` with its LICENSE (no
  CDN, nothing loaded from outside WebODM), loaded by a script tag only when a show starts; ESLint ignores `vendor/`.
- Timing: the first show 5-20 s after a page opens, each lasting 5-10 s, then 30-90 s between shows; none starts
  while the tab is hidden; a library that fails to load is retried at the next turn.
- Silent, mouse launching off; a fixed full-page canvas (`z-index: 100000`, `pointer-events: none`) above dialogs
  and the maps' controls, so clicks go through. Random hues (the effect itself, not a theme colour).
- Changed by the user (2026-11-07, branch `surprise-me-clicks`): shows every 4-8 s (the first 4-8 s after a page
  opens; a show still lasts 5-10 s), and a right-click sends a rocket that bursts at the pointer. It has a layer of
  its own so it never ends a show; it aims through fireworks-js's internal `mouse` (2.10.8), as the library has no
  public "launch at". The browser's menu is suppressed for it, except in text fields and with Shift; a right-drag
  of more than 5 px (the 3D view's pan) and a touch long-press send nothing.
- Live on the settings page: turning it on starts a show at once, turning it off removes it at once (the settings
  page's new `tweakuiSettingsChanged` event); on other pages a change shows on the next page, like every setting.

## Saved banner and thanks (new.md, 2026-11-07)

### Requests
- "When settings are saved, show a green checkmark "Saved" banner popup at the top of settings for 3 seconds."
- "Create a thank you section in the README and list all known projects and developers that made this plugin
  possible."

### Phase 1: a "Saved" banner (branch `saved-banner`)
Builds on: the settings page (`/plugins/tweakui/`, `public/settings_page.js`). Today each setting is PATCHed as soon
as it changes and `setStatus` writes "Saved" (muted text) or "Not saved: ..." (red) into `p.tweakui-status`, a
`role="status"` line at the **bottom** of the page, below the last section, where it is often out of sight.

Proposed design:
- A banner at the top of the settings page's content pane (beside the navigation pane), fixed while the page
  scrolls: a green check (`fa fa-check-circle`) and "Saved", in WebODM's success colours (theme variables, as
  `theme-background-success`), fading in and out; it goes after 3 s, and a new save restarts the 3 s. It covers
  nothing you click (pointer events off) and keeps `role="status"`, so a screen reader still hears "Saved".
- It replaces the bottom status line (one place for the message).
- Phone width: the banner spans the page's width under WebODM's header.
- Tests: Jest (`settings_page.test.js`: shown on a save, gone after 3 s, restarted by a second save, a failure),
  live check on both stacks, the settings screenshots if one shows it; `docs/index.md` ("A change is saved...").

Decided (the user, 2026-11-07): 1 a red banner, kept until the next change; 2 the banner after the reload; 3 the
theme editor's own status left as it is.

Decisions were (the user's):
1. **A failed save**: the same banner in red with "Not saved: <reason>", kept until the next change (recommended),
   or left as today's red line at the bottom?
2. **Saves that reload the page** (Theme, Show Theme Menu, Show Storage View): show the banner after the reload
   (recommended; one sessionStorage flag), or no banner for those?
3. **Theme editor and My Themes** (New Theme, Save, Import, Publish) have their own status line in the editor:
   leave them as they are (recommended), or use the banner there too?

### Phase 2: README Thanks (branch `readme-thanks`)
A "Thanks" section in the README, before License (the fireworks-js credit under License moves into it), and the
same on the docs site (a short section on `docs/index.md`, or its own page). Known so far, from the code:
- **WebODM** and **OpenDroneMap** (ODM, ODX, NodeODM): the platform the plugin extends; Piero Toffanin and the
  contributors (linked to their contributors pages rather than listing hundreds of names).
- **In the plugin**: fireworks-js (Vitalij Ryndin, MIT).
- **What the plugin builds on through WebODM**: Leaflet (2D map), Potree (3D view), Bootstrap, Font Awesome, Django
  and Django REST framework.
- **Theme presets' palettes**: Catppuccin (the Catppuccin org), Solarized (Ethan Schoonover), Dracula (Zeno Rocha),
  Nord (Sven Greb / Arctic Ice Studio), Gruvbox (Pavel Pertsev), One Dark (Atom / GitHub).
- **Tools to build and test it**: VitePress, Jest, Playwright, ESLint, Ruff; WebODM's plugin guide and
  WebODM-Plugins directory.
Each name with its link and, for anything shipped in the zip, its licence. The names and authors are checked
against each project's own page before writing them.

Decided (the user, 2026-11-07): 4 everything listed, major contributors only (no long lists of names); 5 Piero
Toffanin named, for making WebODM possible; 6 the README and the docs site both.

Decisions were (the user's):
4. **Scope**: everything above (recommended), or only what runs in the plugin (WebODM, ODM, fireworks-js, the
   palettes)?
5. **People you want named** (testers, the WebODM maintainers by name, Claude/Anthropic as co-author)?
6. **Docs site too** (recommended), or the README only?

## Windows native (new.md, 2026-11-07)

**Request:** "We need to ensure everything works on Windows native as well. I have it installed and can start it
when needed. Same admin/admin account is used to access because it's a throwaway instance."

**What is there (checked 2026-11-07):**
- WebODM 4.0.0 native for Windows, build 172, in `C:\WebODM`: an Electron app with Python 3.14, Postgres 18,
  Valkey and NodeODX (port 29301). Waitress serves WebODM on **127.0.0.1:29800**, in production mode, without nginx.
- WSL runs in NAT mode, so it can't reach Windows' 127.0.0.1 (curl from WSL gets nothing, `curl.exe` gets a 302).
  Node isn't installed on Windows.
- Uploaded plugins go to `C:\WebODM\resources\app\data\media\plugins` (empty: TweakUI isn't installed). On
  Windows WebODM runs `npm.cmd`/`webpack-cli.cmd` only for plugins with `build_jsx_components`; TweakUI has none.
- What differs from the Docker 4.0.0 stack (same Python, Django and Postgres): the OS (paths, the default file
  encoding is cp1252, symlinks), waitress in place of the dev server, the Electron window, a native ODX in place of
  docker. The browser code is the same; the risk is in the Python code and in how the plugin is installed and served.

**What it builds on:** the release zip (`dev/package.sh`), the `live-check` and `release-check` skills.

**Proposed phases:**
1. **Reach and install.** A relay in WSL (see the decision below) makes the Windows WebODM a URL in WSL. Install
   `dist/tweakui-X.Y.Z.zip` through Administration > Plugins as a user would; check that it registers, its menu
   item, settings page, `settings.js`, `main.js`, `main.css` and `theme.css` load, with no console errors.
2. **Check every feature, fix what differs.** Live, headless, admin/admin, data left as found: General (Units in
   Header, the Task Options dialog, Enhanced Task Details, Expand Task Controls, Surprise Me), Themes (presets, My
   Themes with import/export, Published, the theme menu), 2D Map and 3D Map (Movable Controls, Compare Orthophotos,
   Source Frames, Zoom Override), Storage (sizes, compact, delete), at desktop and phone width. Fixes go on their own
   branches with tests and are checked on both Docker stacks too. Known so far: `frames.py` `load_json()` opens
   files without `encoding="utf-8"`. A fix in Python code needs WebODM restarted on Windows (Python keeps the old
   module): I'll ask you to restart it, since I never restart your servers.
   - Django tests aren't run on Windows: they import `coreplugins.tweakui`, and the uploaded plugin is elsewhere.
     The Docker 4.0.0 stack already covers the same Python, Django and Postgres, so the Windows runs check only
     what differs.
3. **Keep it covered.** README Requirements ("tested on 3.3.2 and 4.0.0, and 4.0.0 native on Windows"), the docs'
   Developing page, CLAUDE.md, and the `live-check` and `release-check` skills gain the Windows instance and the
   relay. Your machine's port and path go in memory, not the repo.

**Decisions (the user, 2026-11-07):** (1) the relay through WSL interop; (2) the instance already has tasks, so
the checks use those and create none; (3) on Windows, Enhanced Task Details shows Windows' own ODX command
(`run.bat`) in place of the docker one (built in phase 2).

**Found in phase 2 (live on Windows):**
- WebODM's Windows app runs in desktop mode (`DESKTOP_MODE`), which hides the whole header bar
  (`.navbar-header`), and in single-user mode, which leaves out the user icon's menu: the Theme Menu and Units in
  Header had nowhere to go. **Decision (the user, 2026-11-07):** when WebODM hides its header, both go in the side
  menu, just above TweakUI ("Theme" with the paintbrush, "Units" with the ruler), each opening its list as a
  submenu; Docker WebODM stays as it is.
- Source Frames, Compare Orthophotos, Movable Controls, Zoom Override, the Task Options dialog, Expand Task
  Controls, Surprise Me, Themes (presets, My Themes, import, Published) and Storage work as on Docker.
- `dev/screenshots.js` opened the wrong project on an account with several (fixed, branch `screenshots-projects`).

**Found while building phase 1:**
- The Windows build runs in single-user mode (`SINGLE_USER_MODE = not WO_HEADLESS` in its `local_settings.py`):
  opening `/` logs any browser in as its admin, with no login page. A fresh browser that opens another page first
  is sent to the Dashboard, so check scripts open `/` first. (admin/admin is still the account.)
- Load Plugin (.zip) posts the file at once; WebODM registers TweakUI without a restart (it has no root mount
  points). TweakUI stays installed there for phase 2. A later zip goes in with WebODM's upgrade (`upgrade=1`),
  which asks for a restart.
- The relay costs about 0.13 s per new connection.

**Decisions as asked:**
1. **How WSL reaches the Windows WebODM.** Proposed: a relay through WSL interop. A small script in WSL listens on
   localhost:8007 and, for each connection, starts WebODM's own `python.exe` to pipe it to 127.0.0.1:29800. Nothing
   is installed or changed on Windows, it needs no admin and no firewall rule, and it runs only during a check.
   Other options: you run a `netsh interface portproxy` rule and a firewall rule as admin (a lasting change), or
   WSL's mirrored networking (needs `wsl --shutdown`, which stops the Docker stacks).
2. **Test data on Windows.** Source Frames, Compare Orthophotos, Storage and Enhanced Task Details need finished
   tasks. If the instance has none, may I create a project named "Live check", process a small dataset in it on the
   Windows node and delete it afterwards?
3. **Enhanced Task Details' ODX command on Windows.** It shows the docker form (`docker run ... webodm/odx`). On
   native Windows, keep it as is, or show the native form (ODX's `run.bat`) when WebODM runs on Windows?

## Before the first release (new.md, 2026-11-07)

**Requests:**
1. "Review the plugin code for possible breaking points, performance improvements, and reduction of possible
   negative webodm ux impacts. This plugin will soon be released to the world so it's important to refine any points
   where the experience could breakdown before they do."
2. "This plugin's codebase is meant to be extensible to make it as simple as possible for other developers to add
   their own WebODM UI modifications. Review the code structure and refactor as needed to make the code as
   accessible as possible for future updates and additions."
3. "add ignored/tweakui-logo-med.jpg as the splash image at the top of the README. Move the image files to a
   sensible location and check them in."

**What is there (2026-11-07):**
- 13 scripts in `tweakui/public/` (about 3,300 lines of ES5, no build step) and `main.css`, all loaded on every
  WebODM page (`plugin.py` `include_js_files`) whether or not their feature is on; each reads
  `window.TweakUI.settings` from `settings.js`, a view (one data-store read per page), and `theme.css` is a view too.
  Five scripts watch the page with a `MutationObserver`.
- Python: `api.py` (the views), `settings.py`, `themes.py`, `custom_themes.py`, `storage.py`, `frames.py`.
- Adding a feature today touches up to ten places: the default in `settings.py` `DEFAULTS`, a hand-written control
  in `templates/settings.html`, the script list in `plugin.py`, the script, `main.css`, its docs page, its shot in
  `dev/screenshots.js`, Jest and Django tests, `CHANGELOG.md` and the README. CLAUDE.md describes some of this;
  there is no guide for a developer from outside.
- The logo: `ignored/tweakui-logo-med.jpg` (1366×580, 227 KB) and `ignored/tweakui-logo.jpg` (3168×1344, 3.1 MB),
  both untracked (`ignored/` is git-ignored).

**Proposed phases:**
1. **README splash image.** Move the medium logo into the repo (see decision 1) and put it above the README's
   title text, with alt text. Not in the plugin zip: `tweakui/` stays the plugin only.
2. **Review.** Every script, view and template read for:
   - Breaking points: a WebODM page or a selector that changes in a later WebODM, an error in one feature that
     stops others (or WebODM's own scripts), missing or odd data (a task with no assets, a deleted project, a
     huge project, an empty data store), a slow or failing request, two tabs, and anonymous pages (shared maps).
   - Performance: scripts and views on every page, observers that watch the whole page, polling, large API
     responses (Storage, Source Frames), and the cost to a page where every feature is off.
   - WebODM UX: anything TweakUI changes in WebODM while a feature is off, layout shifts while the page loads,
     keyboard and screen-reader use of what it adds, phone width, and what turning the plugin off leaves behind.
   The findings go in this section, each with where it is, what happens and a proposed fix. Clear bugs are fixed
   on their own branches with tests; anything that changes what a user sees, or is a larger change, is asked first.
3. **Structure for other developers** (decision 4):
   - One place that declares a feature (setting name, default, category, label, description, script, preview)
     from which the defaults, the settings page's control and the script list come, in place of three hand-kept
     lists.
   - A small shared script (`TweakUI.*`) for what features repeat: reading a setting, waiting for an element,
     adding to the side menu, safe DOM building; each feature's script wrapped so an error in it is logged and
     stops only that feature.
   - A docs page "Adding a Tweak" (and CONTRIBUTING.md pointing to it): the files, a worked example, the tests and
     the checks, and the plugin rules (only WebODM's extension points, theme variables, ES5).
   - Whether a page loads only the scripts of features that are on is weighed with the review's findings.
   - The scripts stay ES5 with no build step, as now: no bundler for contributors to learn.
4. **Fixes from the review** that the refactor didn't cover, each on its branch, on both Docker stacks and,
   where it matters there, on Windows.

**Decisions (the user, 2026-11-07):**
1. The logo goes in `docs/public/` (the docs site serves it too, so its home page can show it); the README uses
   `docs/public/tweakui-logo-med.jpg`.
2. Both files are checked in: the medium one for the README and the full-size original.
3. The review fixes clear bugs on their own branches with tests; anything that changes what a user sees, or is a
   larger change, is listed here and asked first.
4. The refactor goes all the way: a registry that declares each feature once (defaults, settings page control,
   script list), shared `TweakUI.*` helpers with each feature's errors isolated, and an "Adding a Tweak" docs page.


**Review findings (2026-11-07):** every script, view and template read; the per-page views timed on the 4.0.0 stack.

*What holds up:* each feature's script is its own `<script>`, so an error while one loads stops only that one; a
feature that is off returns before touching the page; anonymous and shared pages get the defaults (everything off,
WebODM's theme); the storage page escapes everything it writes as HTML; theme colours are checked `#rrggbb` before
they reach CSS; nothing is left behind when the plugin is disabled but its data stores (settings, themes). The two
views on every page, `settings.js` and `theme.css`, take about 13 ms and 6 queries together (with a preset theme);
the 13 scripts are revalidated from the browser's cache (Last-Modified).

*Clear bugs, fixed on their own branches with tests (nothing a user sees changes) — done, see "Done":*
1. `api.py` `StorageTaskView`: a task id that isn't a UUID raises Django's `ValidationError`, which isn't caught →
   a 500 in place of a 404. `storage.breakdown` also lets an `OSError` from the assets folder through (a 500).
2. `frames.py` `rank`/`project`: a shot in `shots.geojson` without `width`, `height`, `translation` or `rotation`
   raises `KeyError` → a 500 for the whole search; such a shot should be skipped.
3. `storage.py` `user_report`/`report`: one task query per project and per user (an admin's report on a large
   instance runs hundreds of queries); one query for all the tasks does the same.
4. `task_details.js`: with Enhanced Task Details on, every page (maps, 3D view, Administration) fetches
   `/api/presets/` and watches the whole page with a `MutationObserver`, though only the Dashboard has task panels;
   it should start on the first task WebODM gives it.
5. `other_tasks.js` `show`: an error while building a layer from the metadata (no bounds) skips the error handler,
   so the checkbox stays disabled and the rejection is unhandled.

*For the refactor (structure phase):*
6. A callback given to a `PluginsAPI` hook runs inside WebODM's own code (its event emitter calls listeners
   synchronously, e.g. `Map.jsx`'s `triggerDidAddControls`): a throw there would break WebODM's map or task panel,
   not just the feature. The shared helpers wrap every hook callback, observer and listener a feature registers in
   a try/catch that logs `TweakUI <feature>:` and goes on.
7. Loading only the scripts of features that are on: not possible through `include_js_files` (WebODM calls it without
   the request, so it can't vary per user), and a loader adding scripts later would register hooks after WebODM has
   fired them (`App.ready`, a map that mounts early). The scripts stay listed; each returns at once when its feature
   is off. Recommended: keep it so.
8. Every WebODM selector a feature relies on, named in one place per feature (its script's top), so a WebODM upgrade
   is checked against a list rather than by reading every script.

*Changes a user would see, or larger ones (asked first):*
9. **Expand Task Controls on a large project:** every minimized task is opened (hidden), so WebODM adds each one to
   the address (`project_task_expanded`, about 37 characters a task) and loads each completed task's thumbnail. A
   project of a few hundred tasks makes an address of several KB, which a proxy may refuse on reload (nginx's default
   limit for the request line is 8 KB). Proposed: TweakUI takes the tasks it opened itself back out of the address
   (`history.replaceState`); a reload still shows them as buttons only, since TweakUI opens any minimized task it
   sees. The address then lists only the tasks you expanded. The thumbnails stay (WebODM's panel).
10. **Surprise Me and reduced motion:** the fireworks flash and run on their own; with the system's "reduce motion"
    on (`prefers-reduced-motion`), proposed: no automatic shows, right-click rockets still work.
11. **Keyboard use of Source Frames:** its window and full-frame viewer don't take the focus when they open or give
    it back when they close. Proposed: the viewer takes the focus (its Close button) and gives it back to the photo
    that opened it.
12. **A selector check for new WebODM versions** (dev only, larger): a Playwright script in `dev/` that opens the
    Dashboard, the Task Options dialog, a task's map and the 3D view and reports which of the selectors (8) are
    missing; run by the `release-check` skill and when WebODM releases.

*To measure in the fixes phase:* Zoom Override's 3D wheel raycasts every mesh shown on each notch (three.js, no
spatial index); on a large textured model that may lag. Measure on the largest model at hand; if it does, pick the
point cloud first and the meshes only when it misses.

**Decisions on the findings (the user, 2026-11-07):**
- 9 Expand Task Controls: yes, TweakUI takes the tasks it opened itself back out of the address.
- 10 Surprise Me and reduced motion: leave as is (the fireworks run whatever the system's setting).
- 11 Source Frames' viewer: yes, it takes the focus (its Close button) and gives it back to the photo that opened it.
- 12 The selector check: yes, a dev script built after the refactor from each feature's selector list, run by the
  `release-check` skill and when WebODM releases.

**Structure for other developers: the design (2026-11-07):** a tweak is declared once and written as one script; what
users see doesn't change. Three branches:
1. `feature-registry`: `tweakui/features.py` lists the settings categories (General, Themes, 2D Map, 3D Map, Storage)
   and their groups; each setting has its name, default, label, description, preview, the setting it depends on and
   its scripts. `settings.py` `DEFAULTS`, `plugin.py`'s script list (all scripts kept, finding 7) and the settings
   page's controls (one loop in `settings.html`) come from it. A category's own markup (the Themes groups, editor
   and Sample Form) moves to a partial template included after its settings. Checked by comparing the settings page's
   HTML before and after.
2. `shared-helpers`: `tweakui/public/core.js`, loaded before the features, holds `TweakUI.el`, `csrfToken`,
   `copyText`, the header/side-menu placement, waiting for an element and adding a side-menu item.
   `TweakUI.feature(name, start)` starts a feature; its hook callbacks, observers and listeners are wrapped so an
   error logs `TweakUI <name>: ...` and stops only that feature (finding 6). Each script begins with a `SELECTORS`
   list of the WebODM elements it relies on (finding 8; read later by the selector check, finding 12). The scripts
   stay ES5, flat in `public/`, with no build step; each feature's CSS stays in its own section of `main.css`.
3. `adding-a-tweak-docs`: a docs page "Adding a Tweak" (the files, a worked example from the registry to the
   script, its test and its screenshot, the checks, the plugin rules), `CONTRIBUTING.md` pointing to it, and
   `CLAUDE.md` updated for the structure.
Tested: Jest and Django, every feature live on both stacks, and on Windows after the user restarts it.

**Decisions on the structure (the user, 2026-11-07):**
- Contributions: pull requests are welcome directly (no issue needed first); discussion happens on the PR.
- A new tweak is off by default, so an update never changes what a user sees; an exception gives its reason in the PR.

## macOS check before the first release (asked in chat, 2026-11-07)

**Request:** "Are there any tests that should be ran on macos prior to release? If make note of evertyhing that
needs to be done on macos."

**What differs on a Mac, and what doesn't.** TweakUI runs in the browser; on a Mac, WebODM's server runs in Docker
(Linux), the same as the 4.0.0 Docker stack here, so the Python, Django and Postgres side is already covered. What
the Linux and Windows checks don't cover is:
- **Safari (WebKit).** Every live check so far used Chromium (Playwright here, Chrome or Edge on Windows).
- **The trackpad**: pinch and two-finger scrolling send different events from a mouse wheel or a touch screen.
- **Ctrl+click** is macOS's right-click.
- **The dev tools on macOS**: Bash 3.2, BSD tools, Docker Desktop on Apple Silicon.
Already checked from Linux (2026-11-07): every pinned dev image (`dev/webodm.sh`) has a `linux/arm64` build;
`dev/webodm.sh` has no Bash 4 or GNU-only commands; `dev/package.sh` lists and hashes the zip in Python now (branch
`package-portable`; it used GNU `head -n -2` and `sha256sum`, which macOS lacks).

**To do on the Mac** (in this order; the prompt the user starts the session with points here):
1. **Tools** (the user's CLAUDE.md, "Tools in the IDE and environment"; propose, install only after approval):
   Docker Desktop, Node (version in `.nvmrc`), `uv`, then `npm install`, `npx playwright install chromium webkit`,
   `uv venv --python 3.9 .venv && uv pip install -r requirements-dev.txt`. The `ignored/` checkouts as CLAUDE.md
   says ("Dev environment"). The VSCode settings (local `.vscode/settings.json`).
   **Found (2026-11-07, macOS 26.6.2, Apple Silicon):** already there: Docker Desktop (Engine 29.5.3, Compose
   5.1.4, context `desktop-linux`, aarch64), Node 26.13.0 (matches `.nvmrc`) and npm 11.20.0 from Homebrew, uv
   0.12.10, Git 2.56.0, Bash 3.2.57, `shasum`, Safari 26.6.2; VSCode with Python, Pylance, debugpy and ESLint
   (no Ruff extension). Missing: `node_modules`, the Playwright browsers, `.venv` (the only Python 3.9 is the
   Command Line Tools' 3.9.6; uv offers a managed 3.9.25), `ignored/` (none of the checkouts), `.vscode/settings.json`,
   `.claude/settings.local.json`. No WebODM runs on the Mac yet (no listener on 8005).
   **Set up (approved by the user, 2026-11-07):** uv's Python 3.9.25 and `.venv` (`--managed-python`; Django 2.2.27,
   DRF 3.13.1, Ruff 0.17.3), `npm ci`, Playwright's Chromium 156 and WebKit 27.2 (both launch headless),
   `ignored/WebODM` at `v4.0.0` (`6de2314f`), `ignored/WebODM-Docs`, `ignored/WebODM-Plugins` (no 3.3.2 worktree),
   `.vscode/settings.json`, the VSCode Ruff extension. Claude's tool refused to write `.claude/settings.local.json`
   (its own permissions): left to the user. Pylance not yet confirmed (needs a VSCode reload).
2. **Checks**: `npm test`, `npm run lint -- tweakui dev`, `.venv/bin/ruff check .`, `npm run docs:build`.
   **Found (2026-11-07):** all pass on the Mac: Jest 16 suites, 203 tests; ESLint and Ruff clean; the docs build.
3. **Dev stack**: `dev/webodm.sh up` (4.0.0, http://localhost:8005; the first start takes several minutes), the Django
   tests in `tw-webapp` (the `test` skill), `dev/package.sh` (its sha256 must match `shasum -a 256`). A task with an
   orthophoto, a textured model and `shots.geojson` is needed for the map checks: a small dataset processed there,
   named "Live check …", deleted afterwards. The admin account there is the user's to create or give.
   **Found (2026-11-07):** Docker Desktop pulled the pinned arm64 images and the stack started
   (`Registered [coreplugins.tweakui.plugin]`); admin created with the user's login (in memory, not here). Django
   tests: 95 pass. `dev/package.sh` works with macOS's tools: `dist/tweakui-0.1.0.zip`, 60 entries under the single
   root `tweakui/`, no `.DS_Store`, `__MACOSX`, `._*` or `__pycache__`, and its sha256 matches `shasum -a 256`. Task
   "Live check macOS" (project "Live check macOS"): WebODM's own 5 test images (`nodeodm/fixtures/test_images`),
   default options, done in 70 s with an orthophoto, a textured model and `shots.geojson`.
4. **Headless WebKit** (Playwright's `webkit`, on the Mac): the live checks of `live-check` with every feature on, as
   on the other platforms, run in WebKit instead of Chromium: the console must stay free of `TweakUI <feature>:`
   errors. Put the settings back afterwards.
   **Found (2026-11-07):** Playwright WebKit 27.2, with Chromium 156 run alongside to compare; every boolean setting
   on through the settings API and put back to the defaults afterwards (checked in the database). Dashboard,
   TweakUI's settings page, Storage, TweakUI Themes, a task's 2D map and its 3D model, at 1400 px and 390 px:
   `html.tweakui` set and TweakUI's scripts loaded on each, no `TweakUI <feature>:` error, no page error. The only
   console error is the expected `localhost:35729/livereload.js`. Interactions, the same in both engines: the
   Dashboard's task expanded (Expand Task Controls' buttons, Enhanced Task Details' rows: times, preset, option
   bubbles), the Theme menu (12 themes) and the Units menu (3 systems), Source Frames on the 2D map (4 photos) and the
   3D model (5 photos). No difference between WebKit and Chromium. Not a TweakUI issue: a task's map page can take
   over 20 s to fire `load` in either engine, with or without TweakUI, while the basemap's Google tiles
   (`mt*.google.com`) load; the scripts wait for `domcontentloaded` instead. Left for step 5 (needs real input):
   trackpad drags and pinch, two-finger scroll, Ctrl+click, copying to the clipboard.
5. **Real Safari, by hand with the user** (what headless can't show), every feature on:
   - Copy buttons: Show ODX Command's copy (Dashboard, a task's details) and Copy JSON (TweakUI > Themes, My Themes).
     Also from another machine's address (http://<the Mac's IP>:8005, not a secure context): the fallback copy.
     The user has no other device (2026-11-07): Safari on the Mac itself at its LAN address does the same, since
     only `localhost` counts as secure (headless WebKit there: `isSecureContext` false).
   - Movable Controls (a task's 2D map): drag Layers, Measure and the others by their title, with the trackpad.
   - Source Frames (2D and 3D): click to list the photos, drag the window by its title, the full-frame view.
   - Zoom Override 2D: pinch on the trackpad and the + button past WebODM's limit (zoom 24); two-finger scroll.
   - Zoom Override 3D: two-finger scroll toward a surface. Compare the speed with the setting off: Potree counts
     every wheel event as a notch, and so does TweakUI, so a trackpad may zoom much faster than a mouse.
   - Surprise Me: a two-finger click (right-click) sends a rocket; Shift + two-finger click gives the browser's menu;
     **Ctrl+click** today gives the browser's menu and no rocket (`surprise_me.js` looks at `button === 2` only).
     Decision for the user: should Ctrl+click send a rocket too? **Decided (2026-11-07): yes**, Ctrl+click sends a
     rocket too (Shift still gives the browser's menu); built on its own branch after step 5, with a Jest test.
   - Theme menu and Units menu in the header; the settings page, previews and the Saved banner; Storage; TweakUI
     Themes; Task Options (Show Modified Options, Expand Configured); Expand Task Controls; Enhanced Task Details.
   - Light theme and a dark one, a narrow window (phone width).
   **Found (2026-11-07).** By the user in real Safari: Show ODX Command's copy and Copy JSON (on a new theme "Live
   check", made in the theme editor) paste correctly at `localhost` and at the Mac's LAN address (the fallback copy).
   The user asked Claude to automate the rest; done in headless WebKit (Playwright 27.2), every feature on:
   - Movable Controls: Layers, Compare Orthophotos, Object Detection, Contours and Measure, each opened and dragged
     by its title, move exactly as far as the mouse, marked `tweakui-moved`; the map doesn't pan.
   - Source Frames 2D: the window drags by its title; Open Full Frame shows the viewer, Escape closes it.
   - Zoom Override 2D: the + button stops at zoom 24 with it off, 27 with it on. The wheel zooms the same with it
     off and on (it doesn't touch the 2D wheel).
   - Zoom Override 3D, trackpad speed: 25 small wheel events (-4 px each, like a two-finger scroll) move the camera
     about 10 times as far as one mouse notch (-120), **with the setting off as with it on** (off: 10.9 vs 101.3;
     on: 11.4 vs 105.4). Potree itself counts each event as a notch; TweakUI keeps that. Not a TweakUI bug; whether
     the override should weigh events by their size is a question for the user.
   - Surprise Me: right-click suppresses the browser's menu and sends a rocket; Shift + right-click keeps the menu.
     (A first scripted run reported no suppression; two runs that logged every event showed it working in WebKit
     and Chromium.)
   - Theme menu: WebODM (light, white page) and Solarized Dark switch the page; put back to the user's "Live check".
   - Saved banner: "Saved" shows after a change. Task Options: headings show counts such as (1/5), 4 configured
     options and groups marked. Storage: "92 MB used", the task's size listed. No `TweakUI` error, no page error.
   By the user in Safari with the trackpad: a pinch zooms the 2D map smoothly, Layers drags by its title, a
   two-finger click sends a rocket with no menu; two-finger scroll in 3D "feels a bit too fast" (as measured above).
6. **Install from the zip as a user would** (the `release-check` skill, steps 4–6): Administration > Plugins in
   Safari, upload the zip built on the Mac, check it loads. **Skipped (2026-11-07), by the user's decision**: the
   upload and install are WebODM's code, not TweakUI's.
7. Record what was found here; a bug found gets its own branch and goes to the front of "Up next". Then move this to
   "Done". **Done (2026-11-07):** no bug found on macOS. Two changes from it, merged (see "Done"): Ctrl+click sends a
   rocket (the user's decision above), and Zoom Override 3D weighs each wheel event by its size (asked by the user
   after the trackpad check; confirmed with the trackpad and a mouse). Pylance checked afterwards with
   `tweakui/plugin.py` open: no problems, `django` and `app.plugins` resolve. Cleaned up: admin's settings back to the
   defaults, the "Live check" theme and the "Live check macOS" project deleted.

Not on the Mac: Windows-only checks (the relay, desktop mode) and the 3.3.2 stack (covered on Linux; start it on the
Mac only if something found there could differ on 3.3.2).

## Fixes from the review (planned 2026-11-07) — done

Findings 9, 11 and 12 of "Before the first release" (decided there) and the Zoom Override measurement. Built on the
Mac, one branch each.

1. **`task-controls-address` (9):** WebODM's task list keeps the expanded tasks in the address
   (`project_task_expanded`, `HistoryNav` on react-router's `history` v4, which keeps its own copy of the location).
   A task TweakUI opens as buttons only is taken back out with `history.replaceState` followed by a `popstate`, so
   the router's copy follows and WebODM's next toggle doesn't write it back. A task the user expands fully (a click
   WebODM never sees) is added by TweakUI. The address then lists exactly the fully expanded tasks; a reload shows
   them so, the others as buttons only. The project list doesn't refetch on this parameter (`ProjectList.jsx`
   `getParametersHash` drops it).
2. **`source-frames-focus` (11):** the full-frame viewer takes the focus (its Close button) and gives it back to
   what opened it; if another photo was chosen in the viewer, to that photo's Open Full Frame button.
3. **`selector-check` (12):** `dev/selector-check.js` reads each script's `SELECTORS` (the UMD modules in Node),
   makes a task from WebODM's 5 test images (`nodeodm/fixtures/test_images`), opens the Dashboard, the Task Options
   dialog, the task's 2D map and 3D view, reports each selector missing by script and name, then deletes the task.
   Login as `npm run screenshots` (`TW_USER`, `TW_PASSWORD`, `TW_BASE`). Run by the `release-check` skill.
4. **Zoom Override measurement:** time one wheel notch's pick (`pick3d.pick`) in the real 3D view with test meshes of
   200k, 1M and 2M triangles added to the scene (the Mac's only task is small). Over one frame (16 ms) at a realistic
   size: a fix is proposed before it is built.
   **Measured (2026-11-07):** ODM's default `mesh-size` is 200,000 vertices (the node's options), about 400k
   triangles. One notch's `pick3d.pick` in the real 3D view (a 5-image task) with a flat test mesh over the model
   (`PlaneBufferGeometry`, three.js r124, which raycasts every triangle: no spatial index), median of 20 picks:

   | Mesh in the scene | Headless WebKit | Headless Chromium |
   |---|---|---|
   | none (point cloud only) | 4 ms | 40 ms (software WebGL: Potree's pick reads pixels back) |
   | 0.4M triangles (default mesh size) | 22 ms | 50 ms |
   | 1M triangles | 49 ms | 64 ms |
   | 2M triangles | 97 ms | 86 ms |

   The mesh costs about 10 ms (Chromium) to 18 ms (WebKit) per 400k triangles, linear in its size, whenever the
   textured model is shown. Over a frame at the default size in WebKit, and a trackpad sends dozens of wheel events a
   second, each a pick: at a few hundred ms a second, the view stutters. A fix is asked of the user.
   **Decision (the user, 2026-11-07):** reuse the pick within a burst: while the pointer stays within 3 px, a wheel
   event less than 250 ms after the last reuses its point (exact: the camera moves along the ray through it).
   **Built** (`zoom_override.js` `attach3d` `pickAt`; test in `zoom_override.test.js`): 30 trackpad-sized events
   (wheelDelta 12) over a 0.4M-triangle mesh take 54 ms with the pointer still against 739 ms picking each time
   (WebKit; Chromium 139 against 1618 ms), and zoom as far.

**Decision (the user, 2026-11-07):** tested on 4.0.0 only, on the Mac (no 3.3.2 stack there); users on 3.3.2 are
advised to upgrade to 4.0.0. An exception to CLAUDE.md's "both stacks" for this phase.

## Navigation pane: hide and resize (new.md, 2026-11-07)

**Requests:**
1. "Under Global Controls, add the option "Hide Navigation Pane" that when enabled provides a small visible tab on the
   navigation pane divider near the top so when the user clicks it, it hides the navigation pane all except for the
   tab. When the user clicks the tab again, the navigation pane unhides."
2. "Under Global Controls, add the option "Resize Navigation Pane" that when enabled allows the user to hover the
   navigation pane divider and resize it. Prevent the user from resizing it too small, no further than the icons
   which always stay visible."

**What WebODM has (checked in 4.0.0's code):**
- The navigation pane is the side menu, `.navbar-default.sidebar` > `#side-menu` (`logged_in_base.html`). From 768 px
  wide (`sb-admin-2.css`) it is `position: absolute`, 250 px wide, under the 51 px header, and the page beside it is
  `#page-wrapper` with `margin-left: 250px` and a 1 px left border: that border is the divider. Narrower than 768 px
  the pane is a collapsed menu under the header's hamburger button, with no divider.
- On the Windows app (desktop mode, `base.html`) the pane is `position: fixed` at the top, with no header.
- Each item is a link with a fixed-width icon and its label (`<i class="fa ... fa-fw"></i> Label`), Bootstrap's
  10 px 15 px padding: the icons are a column about 48 px wide. Submenu items (Administration, TweakUI's Storage) are
  indented 37 px (`.nav-second-level li a`), so their icons sit further right.
- No PluginsAPI hook touches the side menu: the scripts use page elements, listed in `SELECTORS` (and in
  `dev/selector-check.js` `WHERE`). No change to WebODM is needed.
- The 2D map (Leaflet) and the 3D view (Potree) follow the window's size: after the pane changes width, a `resize`
  event on the window makes them fill the new space.

**Design (proposed):**
- Two settings under General > Global Controls, both off by default: "Hide Navigation Pane" and "Resize Navigation
  Pane"; scripts `nav_pane.js` (one script, both settings) and a section of `main.css`. Only from 768 px wide; on a
  phone's width WebODM's hamburger menu is left as it is.
- **Hide:** a small tab on the divider, near the top, in the theme's colours (`theme-background-highlight`,
  `theme-border`), with a chevron. A click hides the pane: the page takes the whole width and only the tab stays, at
  the left edge. A click again shows it. The tab has a tooltip ("Hide Navigation Pane" / "Show Navigation Pane") and
  works from the keyboard (a button).
- **Resize:** hovering the divider shows a resize cursor and highlights it; dragging (mouse, pen or touch) sets the
  pane's width, from the icons' column (the narrowest) to about half the window. Double-click resets it to WebODM's
  250 px. As it narrows, labels are cut off; at the narrowest, see the decisions.
- Both on: the tab sits on the divider, which is also the resize handle (the tab itself doesn't start a drag).
- Each change sends a window `resize` so maps fill the space. Tests in Jest; live on both stacks, a phone width, a
  dark theme and the Windows app; screenshots `hide-navigation-pane`, `resize-navigation-pane`; docs `general.md`.

**Decisions (the user, 2026-11-07):**
- The hidden state and the width are remembered **in this browser** (localStorage, per device; wrapped in try/catch,
  so a browser that blocks it just starts at WebODM's 250 px, shown), not in the account.
- At the narrowest width, **icons only, names on hover**: labels and submenu arrows hidden, each link's name as its
  tooltip, submenu items without their indent so their icons line up in the one column.

**Built (2026-11-07), and what the build found:**
- The tab is in the header (`#navbar-top`), not the body: the header has z-index 99999 and holds the side menu, so a
  tab outside it was half under the side menu. The handle is in the body, under Bootstrap's dialogs (z-index 1039).
- A width under 120 px snaps to the icons (50 px): between the two, labels showed only their first letters.
- With both on, hiding wins over the width (`:not(.tweakui-nav-hidden)`); the tab follows the width.
- The handle works from the keyboard (a `separator`: arrows, Home for the icons, End for WebODM's width).
- The Adding a Tweak guide said a new setting needed no change to the Django tests; `defaults()` in
  `test_tweakui.py` lists every setting, so it now says so.
