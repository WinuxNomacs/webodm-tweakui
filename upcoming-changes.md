# Upcoming changes

## Phases (current and upcoming)

**Up next** (from the 2D map review, 2026-11-11, decided by the user; see "2D map review")
- **Administration: withhold Preload Tile Panning** — as Tile Cache can be: up to 25 times the tiles drawn per rest.
- **Small devices: a cap** — where the browser reports 4 GB or less or the screen is under 768 px wide, Preload Tile
  Panning goes at most 100% and Keep More Tiles at most 50%.
- **Leaflet check** — the selector check also reports a WebODM whose Leaflet isn't 1.3.1 (map_tiles.js overrides
  its private methods).

**Then**
- **Map speed: 3D Point Budget** — maybe later, as the user said (2026-11-09).

**Later**
- **Global Controls: Temperature in Header** — deferred by the user (2026-11-07) until WebODM offers Fahrenheit or a
  cleaner hook; see "Global Controls: units and temperature in the header".

**Not doing**
- **Preload Zoom Out and Preload Zoom In** — tried and dropped by the user (2026-11-11); built on branch
  `zoom-preload` (commit `b84a84b`), left unmerged. See "Map speed: Preload Zoom Out and In (dropped)".
- **Diagnostic: Logs View** — dropped by the user (2026-11-09); see "Diagnostic: Logs View (dropped)".

**Done**
- **Basemap: Fade-in Speed** (2D map review, decided 2026-11-11) — branch `basemap-fade-in`: `map_tiles.js`
  (`isBasemap`, `tweakBasemap`, `basemapsOf`: the basemaps are the map hook's `controls.autolayers.mapConfig.baseLayers`,
  a Custom one the tile layer its layer group holds; only the fade changes on them, no redraw), tests in
  `map_tiles.test.js` ("Fade-in Speed on the basemap"), description, `docs/map-2d.md`, CHANGELOG. Checked live on
  4.0.0 (default, switched and Custom basemaps); 3.3.2 has no task to open a map on, its basemap code is the same.
- **2D map review: two fixes** (asked in chat, 2026-11-11) — branch `review-2d-map`; see "2D map review".
- **Load Ahead in rings** (reported in chat, 2026-11-10: the thermal layer "still getting stuck but eventually pops
  in") — branch `load-ahead-rings`. Not reproduced as a stall: DJI Thermal's value tiles aren't Tile Cache's and take
  ~0.7 s each, so a new zoom level fills in over 2-3 s with Load Ahead on or off; but at 200% each rest asked for
  ~300 of them, and those the server had started when you moved finished first. The user chose rings for every
  layer: `map_tiles.viewFirst` lets tiles beyond the view come a ring of 25% at a time, nearest first, each once the
  last has loaded (a ring with none to load passed at once), back to the view on every move. Tests
  `map_tiles.test.js` (1 new); docs `map-2d.md`, CHANGELOG. Live on 4.0.0 at 125% with the user's settings
  (TestThermal): value tiles waiting at once went from ~300 to tens, and after a zoom out 30 of 35 tiles in view
  were drawn at 2 s (as with Load Ahead off); TestRGB still loads ahead to the orthophoto's edge, through Tile Cache.
- **Fix: Tile Cache hid DJI Thermal's thermal layer** (reported in chat, 2026-11-10, with Load Ahead just ticked) —
  branch `fix-tile-cache-thermal`. The map of a thermal task (TestThermal) showed the basemap but no thermal layer
  with Tile Cache on, whatever Load Ahead, Keep More or Fade-in were. DJI Thermal's Thermal Inspector replaces the
  WebODM layer's `createTile` with canvases drawn from value tiles, whose URLs it makes from `layer.getTileUrl()`;
  Tile Cache's getTileUrl gave TweakUI's URL, which DJI Thermal can't read, so no value tile was asked for.
  `map_tiles.tweak` now wraps Leaflet's own `createTile` and gives TweakUI's URL only while it makes an image; any
  other caller gets WebODM's, and a layer whose `createTile` a script has already replaced is left alone. Tests
  `map_tiles.test.js` (2 new; the Tile Cache ones ask through `createTile`); docs `map-2d.md`. Live on 4.0.0 with
  the user's own settings: TestThermal draws its thermal layer (value tiles from DJI Thermal) and TestRGB's tiles
  still all come through Tile Cache. 3.3.2 has no thermal task to check.
- **Memory estimates under the Speed sliders, Load Ahead to 200%** (asked in chat, 2026-11-10) — branch
  `memory-estimates`. The user decided: build it as proposed; "Approximately"; per layer; Load Ahead's Distance back
  up to 200% (Keep More's Amount stays at 100%); the device's memory set against them (a page can't read its own:
  `measureUserAgentSpecificMemory` needs cross-origin isolation, which WebODM lacks, and `performance.memory` is
  Chromium's rounded JavaScript heap, 19 MB on a map holding 250+ MB). `features.py`: `Setting(estimate=)` on
  Distance and Amount, `load_ahead` number (25, 200, 25); `settings_setting.html` adds a hidden
  `p.tweakui-estimate`; `settings_page.addEstimates` fills it from the window's size and `devicePixelRatio`
  (tiles counted as Leaflet does, 0.35 MB a tile), on every input, change and resize, and adds "This device has
  approximately N GB of memory" (8: "or more") at the end of the group where `navigator.deviceMemory` exists. Tests
  `settings_page.test.js` (6), `test_tweakui.py`; docs `map-2d.md`, CHANGELOG. Live on both stacks at 1400×900
  DPR 2 and a phone: the lines fill in and follow the slider (Load Ahead 200%: approximately 180 MB per layer on
  the desktop window), no console errors.
  **Measured (2026-11-10)**, headless Chromium on 4.0.0, task 94b094c9, 1400×900, Tile Cache on, settings swapped in
  `settings.js`'s response only (`scratchpad/mem_tiles.js`); PSS of every Chromium process from `/proc`:
  - A tile costs about **0.3 MB**, not the ~1 MB of a decoded 512×512 image: at DPR 2, Load Ahead 100% held 308
    tiles against 60 off, for +77 MB in the renderer and +10 MB in the network process (≈0.35 MB a tile). Tiles
    there were 35 KB median (p90 59 KB) as sent. At DPR 1, 15 → 56 tiles was +32 MB (≈0.8 MB, few tiles, noisy).
  - Chrome seems to keep tiles off screen compressed and decode only what it draws, so kept tiles cost no more than
    loaded ones: Keep More 100% after a panned loop (120 tiles against 52, many near-empty at the orthophoto's edge)
    added nothing measurable.
  - So the earlier ceilings were ~3× too high: Keep More 100% on 1920×1080 at DPR 2 is ~160 MB per layer by the estimate's count, not ~450.
    Headless renders in software; a GPU browser adds textures only for tiles on screen. Firefox may differ.
- **Tile Cache: one checkbox, Reuse Browser Copies always on** (asked in chat, 2026-11-10) — branch
  `tile-cache-one-checkbox`. The user decided: one checkbox. The `reuse_browser_copies` part is gone from
  `features.py` (a stored one is ignored; both unreleased); `map_tiles.optionsOf` puts the task's version in tile
  URLs whenever Tile Cache is on. Server unchanged (docstrings in `api.py`, `tile_cache.py`). Tests
  `test_tweakui.py`, `map_tiles.test.js`; docs `map-2d.md` (the section folded into Tile Cache's list), README,
  CHANGELOG. Live: both stacks' settings pages show Tile Cache with no part; on 4.0.0's map the version is asked
  once per load, tiles come with `private, max-age=31536000, immutable`, and a reload or a later visit shows them
  from the browser's cache with no request to the server.
- **Keep More Tiles per axis, capped at 100%** (asked in chat, 2026-11-10) — branch `keep-more-per-axis`. The user
  decided: Amount 25% to 100% (a stored 125% to 200% falls back to the 50% default), and cut the waste. Leaflet's
  `keepBuffer` is one number for all four sides; `map_tiles.keepMore` now works out columns from the view's width and
  rows from its height (`keepMargins`), gives Leaflet the larger, and after each `_update` marks the tiles beyond the
  other axis's margin not current, so Leaflet's own pruning drops them. At 100% on a 1920×1080 high-resolution view:
  10 columns and 7 rows (ceiling ~450 MB per layer, not ~600; 200% was ~1.5 GB). Tests `map_tiles.test.js` (15),
  `test_tweakui.py`; docs `map-2d.md`, CHANGELOG. Live on 4.0.0 (1400×900, DPR 2, 256 px tiles, 100%): margins 8
  columns and 6 rows; after panning down then sideways the kept rows settle at 6 where the old rule kept 8.
- **Fewer Tile Requests last in Speed, for slow connections** (asked in chat, 2026-11-10) — same branch,
  `speed-checkboxes`: moved after Fade-in Speed in `features.py` and in `docs/map-2d.md`. Its summary says it can
  help on a slow or unreliable connection to the server (the levels a zoom passes through are never asked for).
  README and CHANGELOG reordered. Live on both stacks: the Speed group's checkboxes end with it.
- **Checkboxes for Load Ahead, Keep More Tiles and Fade-in Speed** (asked in chat, 2026-11-10) — branch
  `speed-checkboxes`. The user chose: like Deeper Zoom (a checkbox, its slider beneath and greyed while off); the
  sliders start at the first step that changes something; a first tick gives 25%, 50% and 0 ms. `features.py`:
  `load_ahead_on`, `keep_more_tiles_on`, `fade_in_speed_on` (off), each with its number as a part (Distance 25–100%,
  Amount 25–200%, Duration 0–400 ms); a stored value outside the new range falls back to the default.
  `map_tiles.optionsOf` reads the checkboxes. Tests `test_tweakui.py`, `map_tiles.test.js`; docs `map-2d.md`,
  `adding-a-tweak.md`, CHANGELOG. Live on both stacks: the checkboxes are off with their sliders disabled, and ticking
  one enables its slider and saves. On 4.0.0's map, Load Ahead at 50% keeps 35 tiles ticked and 15 unticked.
- **Fade-in Speed up to 400 ms** (asked in chat, 2026-11-10) — branch `fade-in-400`: `features.py` values
  `(0, 50, 100, 200, 300, 400)`, so WebODM's 200 ms stays at the 4th stop and saved values keep their place. Tests
  `test_tweakui.py`; docs `map-2d.md`, `adding-a-tweak.md`, CHANGELOG. Live on both stacks: the slider's right end is
  400 ms and saves it, and 150 is refused with "one of 0, 50, 100, 200, 300 or 400".
- **Bug: map tiles sometimes never drawn with the Speed settings** (reported 2026-11-10) — branch
  `bug-missing-tiles-fix`. The cause was Load Ahead: the tiles beyond the view were asked for together with those in
  view (at 100%, a wheel zoom into z23 created 270 to 410 tiles and sent 300 to 590 requests). Chrome asks a server
  for 6 at a time and WebODM renders a cancelled tile to the end, so after a zoom the tiles in view waited behind the
  ones beyond. The user's console showed 6 tiles in view sent and awaiting the server. The server and WSL's localhost
  relay are quick (a z21 tile in about 40 ms; 70 ms from Windows). Fix in `map_tiles.js` (`viewFirst`): the layer's
  `_isValidTile` turns away a new tile beyond the view while the map moves or a tile is loading. Leaflet's `load`
  event, or a move's end with nothing left to load, then lets them in. A map's `movestart`/`zoomstart` cancels the
  ones beyond still loading (`_removeTile`). Test `map_tiles.test.js` (14). Live on 4.0.0 with the user's settings
  (Load Ahead 100%, Fade-in 0) at 1920×1080, DPR 1.5: within a second of each wheel zoom no tile in view is missing,
  where before it queued 200 to 350 tiles at once. 3.3.2 has the same Leaflet 1.3.1, but no task with an orthophoto
  to check on.
- **Map speed: Load Ahead, Keep More Tiles, Fade-in Speed and Reuse Browser Copies** (asked in chat, 2026-11-10)
  — branch `map-tile-loading`: `tile_cache.js` renamed `map_tiles.js` (`optionsOf`; `loadAhead`, which grows
  Leaflet's `_getTiledPixelBounds`; `keepMore`/`keepRows`, a `keepBuffer` getter; `fadeIn`, Leaflet 1.3.1's
  `_updateOpacity` with the setting's duration; `versions`, one request per task), `tile_cache.version`,
  `api.TileVersionView`, and `CachedTiles` answering `immutable` for the current `v`. `features.py`: a setting's
  `values` (a slider through a list; `settings.VALUES`, the template, `settings_page.js`), and Fewer Tile Requests
  now only `updateWhenZooming`. Tests: `test_tweakui.py` (2), `map_tiles.test.js` (13), `settings_page.test.js` (2).
  Docs `map-2d.md`, `adding-a-tweak.md`, `index.md`, README, CHANGELOG. Live on 4.0.0:
  - Load Ahead at 50% loads 51 tiles on opening instead of 29.
  - Fade-in Speed at 0 shows a tile 28 ms after it loads, against 226 ms.
  - Reuse Browser Copies serves all 33 tiles of a second visit from the browser's cache.
  - Keep More Tiles' `keepBuffer` is 2, 5 and 8 rows at 0%, 100% and 200%. The test orthophoto is too small to
    show tiles being dropped.
  - On both stacks, the Settings page's slider and box keep to Fade-in Speed's values.
  See "Map speed: loading and showing tiles".
- **Map speed: Tile Cache and Fewer Tile Requests** (asked in chat, 2026-11-09) — branch `tile-cache`:
  `tile_cache.py` (the key, get and put, prune), `api.py` (`CachedTiles`, a subclass of WebODM's `Tiles`),
  `plugin.py` (its mount point, first), `features.py` (2D Map > Speed: `tile_cache`, which can be withheld, and
  `fewer_tile_requests`), `public/tile_cache.js`. Tests: `test_tweakui.py` `TestTileCache` (6, on WebODM's orthophoto
  fixture), `tile_cache.test.js` (5). Docs `map-2d.md`, `administration.md`, `index.md`, README, CHANGELOG.
  Screenshot `admin`. Live on 4.0.0 (DPR 1 and 2), where a reload revalidates every tile with a 304, and a kept tile
  takes 16 ms against 57 ms to render on an idle server. 3.3.2 has no task with an orthophoto, so it was checked by the
  Django tests and on the Settings page. See "Map speed".
- **Performance View: the server's OS and CPU** (asked in chat, 2026-11-09) — branch `perf-server-system`:
  `performance.py` (`system_entry`, read once per process: `linux_os`/`windows_os` and `kernel_host`, `os_release`,
  `linux_cpu` from `/proc/cpuinfo` and cpufreq's maximum, `windows_cpu` from the registry and
  `GetLogicalProcessorInformation`; in `server_entry`), `performance_page.js` (`systemRows`: OS and CPU at the top of
  the server's card; `speedHtml`; CPU Load in threads when the CPU has more threads than cores). Tests:
  `test_tweakui.py` (6), `performance_page.test.js` (3). Docs `performance.md`, `index.md`, README, CHANGELOG.
  Screenshot `performance`. Live on 4.0.0 and 3.3.2 (desktop and 390px); the Windows half run in the Windows app's own
  Python 3.14 (Windows 11 25H2, build 26200, 10 cores, 20 threads). See "Performance View: the server's OS and CPU".
- **UX review: setting names** (user request, 2026-11-09) — branch `ux-setting-names`: every label in `features.py`
  as decided (see "Setting names"; the setting keys, element ids and preview files unchanged, so saved settings stay),
  and every mention in the scripts' and CSS's comments, `README.md`, `CLAUDE.md`'s example, `docs/` and
  CHANGELOG (Unreleased; 1.0.0's entries keep their names). The tab's "Hide Navigation Pane" tooltip and the
  handle's "Resize Navigation Pane" label are actions, not the setting, and stay. Docs headings renamed, each old
  anchor as released in 1.0.0 (and Recent Processing's) kept by an empty `<div id>` before it (a `<span>` in the
  heading would go into VitePress's permalink label). Tests: `test_tweakui.py`, Jest names. Screenshot
  `zoom-override-2d` (its caption). Live on 4.0.0 and 3.3.2 (Settings and Administration > TweakUI, desktop and
  390px); old anchors land on their headings in the built docs.
- **UX review, Phase C: Settings page readability** (user request, 2026-11-09) — branch `ux-settings-readability`:
  `features.py` (a setting's `summary`, one line, and `more`, the rest of its description, in place of `help`; every
  description rewritten so; a Navigation Pane group in General after Global Controls with Hide, Auto-hide, Hide Delay
  and Resize), `settings_setting.html` (the summary with a More link acting as a button, the rest hidden under it),
  `settings_page.js` (`addMore`: More and Less; `pressed`: a link acting as a button, click, Enter or Space, the
  address left alone; the preview thumbnail such a link, with a Preview text), `main.css` (on a phone the thumbnail is
  the Preview link: links take the theme's colour, which WebODM gives only to `a`). Tests: `settings_page.test.js` (2),
  `test_tweakui.py` (2: the group and its order; the summary, More and the hidden rest). Docs `index.md` (how the
  settings page reads), `general.md` (the two headings), `adding-a-tweak.md` (`summary` and `more`), CHANGELOG. No
  screenshot shows the descriptions. Live on 4.0.0 and 3.3.2 at desktop and phone width (summaries one line on
  desktop, More and Preview leave the address alone, 390px fits). Enlarging a preview on a click was already built.
- **UX review, Phase B: Performance page layout** (user request, 2026-11-09) — branch `ux-performance-layout`:
  `performance.html` (the controls in a bar beside the heading, Refresh Every and History Length in the gear's
  popover), `performance_page.js` (`headingHtml`: a section's notes behind an info button, kept open over a redraw;
  Processes, renamed from Process View, a `<details>` in Server opened and closed by its `toggle`; `spanText`: the
  graphs' window once in the bar, no time line under each graph; Recent Task History's six columns, `detailsButtonHtml`
  and `figuresHtml`: every task gets a Details row with the five figures above its notes; the Actions menu now a "•••"
  at the row's end), `core.js` (`rowMenu`/`rowMenuHtml`, the "•••" menu shared by Performance and Storage, moved from
  the Performance script), `storage_page.js` (each row's Import, Backup, Compact and Delete in a "•••" menu; the project
  row's empty date cell hidden at phone width as the others), `main.css` (the bar and popover, graphs 60px high on
  desktop with 11px labels, the Details row's figures; a scroll box contains what is positioned in it; Storage's long
  names break and marks wrap at phone width). Tests: `performance_page.test.js` (controls and popover, info notes,
  Details, the "•••" menu, Processes), `storage_page.test.js` (the row menus), `test_tweakui.py` (the template's order).
  Docs `performance.md`, `storage.md`, `adding-a-tweak.md` (the helper), README, CHANGELOG, screenshots `performance`,
  `performance-processes`, `performance-tasks`, `storage`. Live on 4.0.0 and 3.3.2 at desktop and phone width (both
  pages fit 390px). Processes' Docker note stays inside the opened section rather than behind an info button: it is
  hidden until the section opens.
- **UX review, Phase A: quick fixes** (user request, 2026-11-09) — branch `ux-quick-fixes`: `main.css` (Storage's
  row buttons stack at phone width; the bars' track from `currentColor` at 15% through `color-mix`; `#page-wrapper`
  30px from the left with the side menu hidden), `storage_page.js` and `storage.html` (Delete `btn-default` until
  something is selected; "Your Storage"), `performance_page.js` (`levelIcon`/`shareIcon` beside warning and danger
  figures). Tests: `storage_page.test.js`, `performance_page.test.js`. CHANGELOG, screenshots `storage` and
  `performance`. Live on 4.0.0 (Solarized Dark and WebODM's theme) and 3.3.2.
- **Performance View: Process View's tables outlined, resizable, command lines wrapped** (user request, 2026-11-09)
  — branch `perf-process-table`: `performance_page.js` (`table-bordered theme-border`, a `colgroup` and a resize
  handle on each heading: drag, arrow keys, double-click to reset; widths in pixels shared by both tables, kept in
  session storage; a redraw during a drag waits for it; a command line's first 512 characters, copied whole),
  `main.css` (fixed layout, 760px at least, wrapping cells), `performance.py` (`COMMAND_MAX` 32768, Windows' longest).
  Tests: `performance_page.test.js` (2). Docs `performance.md`, CHANGELOG, screenshot `performance-processes`. Live
  on 4.0.0 and 3.3.2 (a mouse drag through a refresh, reload, keys, reset, phone width).
- **Performance View: Process View** (new.md, 2026-11-09) — branch `perf-process-view`: `performance.py`
  (`linux_processes`/`linux_details` from `/proc`, `windows_processes`/`windows_details` through ctypes,
  `process_tops`: CPU from the last reading kept per server process for 60 s by pid and start time, details read only
  for the rows shown; `in_container`; `live(processes=)`), `api.py` (`PerformanceLiveView`: `?processes=1` for
  superusers only), `performance_page.js` (`processViewHtml`, `processesHtml`; on or off in session storage, asked at
  once when turned on, then with each refresh; Copy Command Line), `main.css`, `features.py` (the description). Tests:
  `test_tweakui.py` (4: two readings of a fake `/proc` with a reused pid, a vanished process, expiry and the top 10;
  command line, user and container; Windows' reader chosen and an unreadable server; superusers only),
  `performance_page.test.js` (3). Docs `performance.md` (Process View), README, CHANGELOG, screenshots `performance`
  and the new `performance-processes`. Live on 4.0.0 and 3.3.2 (the container's processes, phone width, on after a
  reload); the Windows reader run with WebODM's Windows Python (274 processes, command lines and users read), not yet
  in the Windows app (it needs a new zip and a restart).
- **Performance View: an Actions menu on each task** (new.md, 2026-11-09) — branch `perf-task-actions`:
  `performance.py` (`task_entry`'s `can_restart`, by `can_restart`: WebODM's Restart rules and nothing pending, and
  `report`), `performance_page.js` (`actionsHtml`, its items in alphabetical order; the menu opened by the page's own script, `position: fixed` by its
  button so the table's scrolling box doesn't cut it off, following it on scroll; `restartTask`: GET the task, PATCH
  its options with `rerun-from` = `can_rerun_from[1]` or none and `uuid: ""`, POST `restart/`), `main.css` (the
  Notes and Actions buttons as one group), `features.py` (the description). Tests: `test_tweakui.py` (2: the fields
  for imported, compacted, pending and reported tasks; the permission), `performance_page.test.js` (5: items, open
  and close, scroll, restart's calls, no rerun-from and a refusal). Docs `performance.md` (Actions), README,
  CHANGELOG, screenshot `performance-tasks`. Live on 4.0.0 (logs and report downloaded, report inline as a PDF,
  restart of a "Live check restart" task: rerun-from dataset, running; phone width) and 3.3.2 (the restart, queued);
  the check's tasks and projects deleted, 3.3.2's Performance View turned back off.
- **Performance View: "Recent Processing" becomes "Recent Task History"** (new.md, 2026-11-09) — branch
  `perf-recent-history`: the heading and General Assessment's link (`performance_page.js`), comments in
  `performance.py`, `task_log.py`, `main.css`, `test_tweakui.py`, `dev/screenshots.js`. Tests:
  `performance_page.test.js` (the texts). Docs `performance.md` (the section, `#recent-task-history`), CHANGELOG
  (a line for the rename; the Unreleased bullets reworded), screenshots `performance`, `performance-tasks`. Django
  136 on each stack, Jest 354. Live on 4.0.0 and 3.3.2: the heading and the link, no old name left.
- **Administration: TweakUI Themes merged into Administration > TweakUI** (new.md, 2026-11-09) — branch
  `admin-merge`: `admin.html` (a Published Themes group under Available to Users, holding `#tweakui-published` as
  the old page had it, so `theme_editor.js` works unchanged; both scripts and the themes' colours), `published.html`
  removed, `plugin.py` (`admin_page` with the published context; `admin/themes/` redirects to
  `admin/#published-themes`), `main.js` (`adminMenu`: one link), `main.css` (the section's padding), comments in
  `api.py`, `custom_themes.py`, `theme_editor.js`, `import_panel.html`. Tests: `test_tweakui.py` (the published
  tests on the merged page; 2 new: the section and its scripts, the old address), `main.test.js` (one link).
  Docs `administration.md` (Available to Users and Published Themes sections, the managing moved from `themes.md`,
  which links there), README, CHANGELOG, `dev/screenshots.js` (`admin` the first group, `theme-published` the
  section), both retaken. Django 136 on each stack, Jest 354. Live on 4.0.0 and 3.3.2: the old address lands on the
  section, one active link, a feature toggled and back ("Saved"), a "Live check theme" published and a "Live check
  import" imported through the page, both deleted through it, the own theme removed; desktop and phone, no console
  errors. While `plugin.py` was being edited it named an undefined view for a few seconds: one request to 4.0.0's
  Performance page got a 500.
- **Storage View: the selection bar's message** (new.md, 2026-11-09) — branch `storage-message`: `storage.html` and
  `storage_page.js` (`renderSelection`) say "Select one or multiple tasks or projects to back up, compact or delete
  them." Tests: `storage_page.test.js` (the whole text after a Delete, where it matched "Tick" before). Docs
  `storage.md` ("select" for "tick"), CHANGELOG, screenshot `storage`. Live on 4.0.0 (desktop and phone: it wraps
  above the buttons) and 3.3.2 (Storage View turned on for the check and back off). Django not run: no Python changed
  and no Django test reads the text.
- **Performance View: the graphs' readings kept over a reload** (new.md, 2026-11-09) — branch
  `perf-history-reload`: `performance_page.js` (`packReadings`, values to 4 decimals; `unpackReadings`, readings
  checked and those older than 30 minutes dropped, the counters only within the gap; `saveReadings` after a reading
  at most every 5 s and on hidden or `pagehide`, `restoreReadings` once Refresh Every is known; every storage call
  in try/catch). Tests: `performance_page.test.js` (2 new; sessionStorage cleared after each test). Docs
  `performance.md` (Graphs), CHANGELOG. Live on 4.0.0: 20 s of readings, F5, the CPU load at once and one unbroken
  line; a new tab empty; about 2 KB saved after 20 s.
- **Performance View: the graphs' scales and legends, 10% taller** (new.md, 2026-11-09) — branch `perf-graph-scales`:
  `performance_page.js` (`graphHtml`: the top label for every percent graph and a rate graph with readings, a 0
  label, a dashed gridline at half height, the time line from `spanText(view.span)` to Now when there is a view, a
  legend for two series; all `aria-hidden`; `GRAPH_H` 44), `main.css` (46 px, the labels, the axis, the legend's
  swatches in the lines' colour classes). Tests: `performance_page.test.js` (1 new; `words` skips `aria-hidden` text;
  two paths' coordinates for the new height). Docs `performance.md` (Graphs, Disk Activity), CHANGELOG, screenshot
  `performance`. Live on 4.0.0 (Solarized Dark) and 3.3.2 (light), desktop and phone: labels readable, no sideways
  scroll, no console errors.
- **Performance View: General Assessment** (new.md, 2026-11-09) — branch `perf-assessment`: `performance_page.js`
  (`lineHtml`; `tasksSummary` from the report's tasks: failed, of those out of memory, left photos out, a sentence of
  its own for a single task; `assessmentHtml`: the card, its edge `text-<worst level>`; the trend moved out of
  `tasksHtml`; `#tweakui-performance-recent` on Recent Processing's heading; `verdictsHtml` gone), `main.css`. Tests:
  `performance_page.test.js` (2 new). Docs `performance.md` (General Assessment), README, CHANGELOG, screenshot
  `performance`. Live on 4.0.0 (Solarized Dark: info edge, "Of the last 3 tasks on this server, 2 left photos out.")
  and 3.3.2 (WebODM's light theme: green edge), desktop and phone, no sideways scroll, no console errors. No Python
  changed, so Django wasn't run again.
- **Performance View: Remove Photos From Task** (new.md, 2026-11-09) — branch `remove-photos`: `performance.py`
  (`left_out_names`; `remove_left_out`: a completed task without a pending action, names among those left out, the
  uuid cleared by a conditional update first, the files deleted, `images_count` updated, the node's `remove_task`
  unless another task on that node shares the uuid, as WebODM's Duplicate copies it), `api.py` (`RemovePhotosView`,
  404 without view_project, 403 without change_project), `plugin.py` (the mount point), `performance_page.js`
  (`photosListHtml` with the buttons and the outcome, `removeQuestion`, `removePhotos`: confirm, POST with the CSRF
  token, the list redrawn open), `main.css` (the buttons; a task's notes sticky and the screen's width at phone width,
  the table being wider there), `features.py` (descriptions). Tests: `test_tweakui.py` (5 new), `performance_page.test.js`
  (2 new). Docs `performance.md` (Remove Photos From Task), README, CHANGELOG, screenshot `performance-tasks`. Live on
  4.0.0 on a duplicate of TestThermal named "Live check copy": one photo removed, then the other 11; the copy's
  photo count went to 208 and its list empty after a reload; the original kept its 220 photos and its uuid; the copy
  then removed. 3.3.2 has no completed task to try it on: its Django tests pass (134 on each stack).
- **Performance View: the page's controls above Recent Processing** (new.md, 2026-11-09) — branch `perf-controls`:
  `performance.html` (the body, then the bar with Refresh and its status on a line of their own, then
  `.tweakui-performance-recent`), `performance_page.js` (`render` writes Recent Processing and the closing note into
  that part), `main.css` (the bar a column; labels 15em wide and units 2.5em at 768 px and up, so the sliders line
  up), `dev/screenshots.js`. Tests: `performance_page.test.js` (1 new: the order, the same slider after a reload),
  `test_tweakui.py` (the order in the page). Docs `performance.md`, CHANGELOG (Unreleased), screenshots `performance`
  and `performance-tasks`. Live on 4.0.0 and 3.3.2 at desktop and phone widths: the server's cards, Refresh, the two
  sliders, then Recent Processing; no sideways scroll; no console errors but livereload.
- **Release 1.0.0** (2026-11-09) — branch `release/1.0.0`: manifest 1.0.0 (still experimental), CHANGELOG `1.0.0
  (2026-11-09)`, README and Install page's installing steps (a manual upload sends no sha256: only the plugin
  directory does). `dist/tweakui-1.0.0.zip`, sha256 `14f9b3568d0c6b95dcd40d2e07fd676bd4b928c5651399824b944830ff474b4b`.
  Checks: Django with WebODM's `test_plugins` (134 on 4.0.0 and 134 on 3.3.2), Jest 347, ESLint, Ruff, selector check
  on both stacks (every selector found); installed from the zip through Administration > Plugins on 4.0.0 (without
  the mounted folder) and every feature checked live, the graphs too; upgraded 0.1.0 to 1.0.0 on WebODM's Windows app
  (the Performance page's drives C: and D: live there for the first time). The tag, the GitHub release and the
  WebODM-Plugins `directory.json` entry are the user's.
- **Documentation review before the release** (new.md, 2026-11-08) — branch `docs-review`: every docs page, the
  README, CONTRIBUTING and Adding a Tweak checked against `features.py`, the scripts' figures and `core.js`. Fixed:
  the home page's cards (side menu, preset menu, Zoom Sensitivity, search, backup and import, Performance's live
  graphs and log notes; an Administration card), Performance's closing line (the disk counters), the CHANGELOG
  rewritten as a first release's notes by category. All 27 screenshots retaken (7 dated from before the maps' new
  buttons and the header's menu order). Docs build passes.
- **Diagnostic: Performance View, history graphs** (asked in chat, 2026-11-08; see "Performance View: history
  graphs") — branch `perf-history`: `features.py` (`performance_history`, History Length, 1-30 min, 5 by default, a
  part of Show Performance View), `plugin.py` and `performance.html` (Refresh Every and History Length from one loop,
  `data-control`), `performance_page.js` (`record`, up to 30 minutes of readings in the page; `graphHtml`, inline SVG,
  runs broken at gaps, a rate graph scaled by `niceCeil`; `graphTip` and the pointer's hover; `memoryGraphHtml` with
  the share used; `numberControl` for both controls; the accent read from a hidden link, `--tweakui-performance-accent`),
  `main.css`, `dev/screenshots.js` (1 s refresh, a minute's window, 30 s of readings). Tests: `performance_page.test.js`
  (5 new, others moved from bars to graphs), `test_tweakui.py` (1 new: History Length's range and control). Docs
  `performance.md` (Graphs, History Length), README, CHANGELOG, screenshot `performance`. Live on 4.0.0 (Solarized Dark
  and WebODM's light theme: Reads in the link colour, Writes in the text colour) and 3.3.2: graphs fill, the hover
  shows "26% · 1:43:22 PM" and "Reads 0/s · Writes 81/s · ...", no sideways scroll at phone width, no console errors.
- **Diagnostic: Performance View, disk activity** (new.md, 2026-11-08; see "Performance View: disk activity") —
  branch `disk-io`: `performance.py` (`mount_devices` from `/proc/self/mountinfo` without the system's mounts,
  `diskstats` from `/proc/diskstats`, `linux_drives` matching them by device or source name, the tasks' drive by the
  longest mount point MEDIA_ROOT is under; `windows_drives` through IOCTL_DISK_PERFORMANCE for each fixed drive
  letter, idle time in place of busy time; `disk_io_entry` in the report's server and in `live`),
  `performance_page.js` (`diskShares` between two readings, `driveCardHtml`, the cards beside the WebODM card in
  `[data-server-cards]`, redrawn each refresh, a note under them), `main.css`, `features.py` (descriptions),
  `dev/screenshots.js` (waits for the drives). Tests: `performance_page.test.js` (3 new), `test_tweakui.py` (2 new:
  a sample mountinfo and diskstats, Windows with ctypes mocked; the live API). Docs `performance.md` (Disk Activity),
  README, CHANGELOG, screenshot `performance`. Live on 4.0.0 and 3.3.2: `sde · Tasks` (media, venv) and `sdd`,
  refreshed every 3 s, no sideways scroll at phone width, no console errors; the Windows code run on the machine's
  Windows Python (C: as Tasks, D:), not yet in WebODM's Windows app.
- **Compatibility: DJI Thermal beside TweakUI** (new.md, 2026-11-08; see "Compatibility: DJI Thermal beside
  TweakUI") — branch `dji-thermal`: DJI Thermal's `main` (DJI Thermal Analyzer) zipped with its `DT_ZIP` and installed
  through Administration > Plugins on both stacks (an upgrade of 1.1.0 on 4.0.0), left installed. `core.js`:
  `menuSpot` puts a header menu after TweakUI's others, ahead of every other item; `keepFirst` (a MutationObserver on
  the list, at most 10 moves) moves TweakUI's menus back to the front when another plugin adds one before them;
  `fitHeader` (on placing, list changes, resize) adds `tweakui-header-compact` (8 px padding) when the list's first
  item reaches WebODM's name, then `tweakui-header-nameless` (the name hidden); `SELECTORS.user` gone, `appName` new.
  `main.css`, `dev/selector-check.js` (core's `within` gone). Tests: `core.test.js` (4 new). Docs `general.md`,
  `themes.md`, `adding-a-tweak.md`, CHANGELOG. Live on 4.0.0 and 3.3.2: "Units, Theme, °C, user" on every load and at
  phone width, each menu opens, nothing overlaps, Imperial gives °F and °C gives Metric; 4.0.0's map has DJI
  Thermal's legend and Inspector beside Other Tasks, Search and Zoom Sensitivity; no console errors. 3.3.2 has no
  task, so no map there.
- **Diagnostic: Performance View, the photos left out by name** (new.md, 2026-11-08; see "Performance View: the photos
  left out, by name") — branch `left-out`: `performance.py` (`placed_photos` from `odm_report/shots.geojson`,
  `left_out_photos`: `Task.scan_images` by photo extension, not `align.tif`, less the placed, up to 500;
  `photos_left_out` adds `photos` and `more` for a completed task), `task_log.py` (no features and no GPS catch the
  photo's name, at most 2,000; `describe` gives `reasons`), `performance_page.js` (`photosListHtml`: Photos Left Out
  (N) under the note, Copy Names through `core.copyText`, each name a link to WebODM's thumbnail at 2048 px in a new
  tab, since its download is an attachment; one fixed thumbnail box at 256 px on hover or focus, hidden on leaving or
  scrolling), `main.css`. Tests: `performance_page.test.js` (1 new), `test_tweakui.py` (1 new). Docs `performance.md`,
  README, CHANGELOG, screenshot `performance-tasks` (the list open, a name hovered; `dev/screenshots.js`). Live on
  4.0.0: TestThermal's 12 and TestThermalNoPlugin's 16 match the folder less the shots, 6 with "No features"; the
  2048 px view is inline JPEG; 12 names copied; phone width without overflow.
- **Diagnostic: Performance View, CPU Load without the per-core bars** (new.md, 2026-11-08; see "Performance View: CPU
  Load without the per-core bars") — branch `cpu-total`: `performance.py` (`proc_stat_times` reads /proc/stat's first
  line only, `windows_times` GetSystemTimes only, `cpu_entry`'s `cores` is `os.cpu_count()`), `performance_page.js`
  (`cpuShares` the total, `cpuRows` without htop's grid), `main.css` (the grid's rules and the wider Server card gone).
  Tests: `performance_page.test.js`, `test_tweakui.py` (Linux and Windows counters). Docs `performance.md`, CHANGELOG,
  screenshot `performance`. Live on 4.0.0: "8% of 20 cores" in one bar, no core bars.
- **Diagnostic: Performance View, Recent Processing and the task's log** (new.md, 2026-11-08; see "Performance View:
  Recent Processing and the task's log") — branch `recent-processing`: `task_log.py` (new: `scan` checks each log line
  against ODX's known messages, from its `stages/` and `modules/` code, and lists the other `[WARNING]`/`[ERROR]` lines
  once each, `CPLE_AppDefined` left out; the GPU from "nvidia-smi detected" / "No nvidia-smi detected" or OpenMVS's
  `--cuda-device`; `describe` puts it in sentences per request; `read` caches by size and mtime, a log over 32 MB read
  at its first and last 8 MB), `performance.py` (`read_stats` returns a dict: photos given and placed, area,
  components, GPS or GCP error; `photos_left_out`; `task_entry` adds status, error, the log's GPU, reconstructions
  (the log's count before merging, stats.json counts the merged one), notes, other; `recent_tasks` takes failed and
  canceled too; time per photo for completed only, so the trend is completed tasks'), `features.py` (help),
  `performance_page.js` (columns Photos "208 of 220", Area, Reconstructions, Position Error, GPU; failed and canceled
  under the name, a failure's notes open; the Notes button and its row, Other Messages in a `<details>`; areas and
  lengths in WebODM's `unit_system`, redrawn on `onUnitSystemChanged`; at phone width the wide columns fold into a line
  under the name), `main.css`. Tests: `performance_page.test.js` (4 new), `test_tweakui.py` (6 new: failed and
  canceled, stats.json, the notes, the GPU, a huge log and Other Messages capped, the cache). Docs `performance.md`
  (Recent Processing, Notes from the Log), README, CHANGELOG, screenshots `performance`, `performance-tasks` (new, the
  notes open). Live on 4.0.0 with the three real tasks: 2 and 3 notes (photos left out, 2 reconstructions, no features
  in 6 photos), GPU No (the logs say "No nvidia-smi detected"), imperial 4,141 ft² and 0.9 in, phone without overflow.
  "Photos resized" was dropped from the known messages: ODX no longer resizes (`--resize-to` is deprecated).
- **Diagnostic: Performance View, live CPU and memory** (new.md, 2026-11-08; see "Performance View: live CPU Load and
  refresh") — branch `performance-live`: `performance.py` (`proc_stat_times`: Linux's `/proc/stat`, idle and iowait
  not busy; `windows_times`: `GetSystemTimes` and `NtQuerySystemInformation` through ctypes; `cpu_entry` with
  `os.getloadavg` where there is one; `disk_entry`; `live`), `api.py` (`PerformanceLiveView`,
  `/api/plugins/tweakui/performance/live[?disk=1]`), `features.py` (`performance_refresh`, 1-10 s, a part of Show
  Performance View; `setting`, `number_control` for the page's own control), `plugin.py`, `performance.html` (Refresh
  Every beside Refresh), `performance_page.js` (`cpuShares` between two readings, `cpuRows`: the total, htop's grid
  of cores, load averages; the live loop: first a second after the report, then every Refresh Every seconds once the
  last is answered, the disk every 10 s, none while the tab is hidden; `everyControl`), `core.saveSettings` (now also
  Zoom Sensitivity's save), `main.css`. CPU bars use `progress-bar-success`, the only bar colour WebODM's theme sets.
  Tests: `performance_page.test.js` (7 new), `test_tweakui.py` (5 new: `/proc/stat` from a sample, Windows with
  ctypes mocked, the live API, the setting's range). Docs `performance.md`, `adding-a-tweak.md` (helpers), README,
  CHANGELOG, screenshot `performance` (`dev/screenshots.js` waits for CPU Load). Live on 4.0.0: CPU Load after 1.5 s,
  refreshes 3 s apart, the disk at 10 s, 1 s saved from the page, nothing while hidden, phone width without overflow.
- **Zoom Sensitivity: the default shown** (new.md, 2026-11-08; see "Zoom Sensitivity: the default shown") — branch
  `number-defaults`: `features.py` (`with_unit`, each number setting's `default` for the page),
  `settings_setting.html` (the label's "(Default: …)"), `zoom_override.js` (the panel's label), `main.css`
  (`.tweakui-default`). Tests: `zoom_override.test.js`, `test_tweakui.py`. Docs `map-2d.md`, `map-3d.md`,
  `adding-a-tweak.md`, CHANGELOG, screenshots `zoom-sensitivity-2d`, `-3d`. Live: the settings page on 4.0.0 (Hide
  Delay (Default: 500 ms), both Zoom Sensitivity (Default: 100%)) and both map panels; on 3.3.2 rendered server side
  and by its Django tests, the browser check waiting on a restart of its server (see the conversation of 2026-11-08).
- **2D Map and 3D Map: Zoom Sensitivity** (new.md, 2026-11-08; see "2D Map and 3D Map: Zoom Sensitivity") — branch
  `zoom-sensitivity`: `zoom_override.js` (`sensitivity`, `wheelNotch`, `leafletSteps`, `wheel2d`: Leaflet's wheel at
  100%, otherwise TweakUI's with `zoomSnap` 0, a notch that share of Leaflet's own steps on the browser; `attach3d`'s
  notch scaled; `panel` and `save`: the gauge button, slider and box, applied at once, saved on release or leaving
  the box), `features.py` (`zoom_sensitivity_2d`, `zoom_sensitivity_3d`: parts of each Zoom Override, 10-200, step
  10), `main.css`; shared helpers `core.wholeNumber` (also the settings page's) and `pick3d.beforeShare` (also Source
  Frames'). Tests: `__tests__/zoom_override.test.js` (11 new), `test_tweakui.py`. Docs `map-2d.md`, `map-3d.md`,
  README, CHANGELOG, screenshots `zoom-sensitivity-2d`, `zoom-sensitivity-3d`. Found while building: on Chrome for
  Linux and macOS WebODM's own notch is two zoom steps (Leaflet halves the wheel's pixels only on Windows), so the
  percentage is of Leaflet's steps on the browser, keeping 90% next to 100%.
  Live on both stacks (3.3.2 with a task processed and its project deleted afterwards): the 2D wheel at 50% and
  150% (Chrome on Linux: one and three steps a notch), back to 100% Leaflet's; the panel's keyboard slider, box,
  refusal, Escape; phone width and a dark theme; the 3D button before Share, a notch at 200% 1.9 times as far as at
  100%, a click outside closing it; settings put back, no console errors. Not checked on the Windows app.
- **Global Controls: Auto-hide Navigation Pane** (new.md, 2026-11-08; see "Global Controls: Auto-hide Navigation
  Pane") — branch `auto-hide-nav`: `nav_pane.js` (`create`'s `refresh`: hidden unless pinned, `peek` over the page
  near the left edge or on focus, hidden Hide Delay after the pointer leaves the pane and the tab or at once with
  Escape; the tab pins, `PINNED_KEY`), `main.css` (the pane fixed over the page below the header, the tab on its edge;
  the number setting's slider and box), `features.py` (`auto_hide_nav_pane` and its part `auto_hide_delay`; a number
  kind of setting, `number=(min, max, step)` and `unit`; parts within parts), `settings.py` (`RANGES`, out of range
  refused), `settings_setting.html`, `settings.html` (a part's parts), `settings_page.js` (`numberOf`, the slider
  saving on release, nested greying). Tests: `__tests__/nav_pane.test.js` (7 new), `settings_page.test.js` (4 new),
  `test_tweakui.py`. Docs `general.md`, `adding-a-tweak.md`, README, CHANGELOG, CLAUDE.md, screenshot
  `auto-hide-navigation-pane`. Live on both stacks (the settings page's greying, slider, box and refusal; on the
  Dashboard the edge, a 1250 ms delay, the pin over a reload, Escape, phone width, dark theme); settings put back, no
  console errors but WebODM's livereload. Not checked on the Windows app.
- **2D Map: Add Search Button** (new.md, 2026-11-08; see "2D Map: Add Search Button") — branch `map-search`:
  `tweakui/public/map_search.js` (`parseCoordinates`, `places`, `build`: the button and box, Nominatim at most once a
  second, results remembered for the visit), the `map_search` setting in `features.py`, a section of `main.css`; tests
  in `__tests__/map_search.test.js` (13) and `TestSettingsPage`/`TestPlugin`. Docs `docs/map-2d.md`, README, CHANGELOG,
  screenshot `map-search`. Live on 4.0.0 (a task's map, light and dark themes, phone width: an address through
  Nominatim, one request; coordinates with none; Escape closes and takes the marker away; no console errors but
  WebODM's own orthophoto tiles answering 404 outside the task while the map flies past). 3.3.2 has no task, so there
  only the settings page and the script loading on a project's map (no Leaflet map without a task); same Leaflet
  1.3.1 and map hook as 4.0.0. Django 112 on both stacks. Windows app not checked.
- **Administration: users' access to Storage and Performance** (asked in chat, 2026-11-08; see "Administration:
  users' access to Storage and Performance") — branch `admin-feature-access`: `access.py` (the global data store's
  `available_to_users`, `withheld(user)`: none for superusers), `features.py`'s `admin_label`/`admin_help` on Storage
  View and Performance View, `settings.py` (`saved` as chosen, `load` with withheld settings off, `update` refusing
  them), `api.py` (`AccessView`, the `Available` permission on the Storage and Performance APIs), `plugin.py`
  (`admin/` page, 403 on a withheld page), `templates/admin.html`, `public/admin_page.js`, `settings_setting.html`
  (greyed with the reason), `main.js`'s `adminMenu` (TweakUI and TweakUI Themes after Theme), `main.css`. Also:
  turning Performance View on or off reloads the settings page, as Storage View does. Tests: `TestAccess`,
  `__tests__/admin_page.test.js`, `main.test.js`, `settings_page.test.js`. Docs `administration.md` (sidebar,
  `storage.md`, `performance.md`, `adding-a-tweak.md`), README, CHANGELOG, screenshot `admin`. Live on both stacks
  with a temporary non-admin user (made and deleted) and the access setting deleted afterwards: withheld, the setting
  greyed, the side-menu item gone, page and API 403; given back, the user's choice returned; phone width, no console
  errors. Not checked on the Windows app.
- **README: WebODM Community Discord link** (new.md, 2026-11-08) — branch `readme-discord`: a Community section
  before Thanks.
- **Diagnostic: Performance View** (asked in chat, 2026-11-08; see "Diagnostic: Performance View") — branch
  `performance-view`: `performance.py` (each node the user may use asked through pyodx, 3 s, in parallel; the server's
  disk and memory; the last 10 completed tasks with stats.json's steps; the trend; the verdicts from WebODM's memory
  table), `api.py`'s `PerformanceView`, `plugin.py`'s page, `templates/performance.html`, `public/performance_page.js`,
  `main.js`'s `diagnosticMenu` (Storage and Performance under Diagnostic, or TweakUI), `main.css`; `features.py`: the
  Storage category is now Diagnostic (`#diagnostic`) with Storage View and Performance View (`performance_view`).
  Tests: `TestPerformance` (nodes mocked at pyodx's client) and the Storage page's link in `test_tweakui.py`,
  `__tests__/performance_page.test.js`, `main.test.js`. Docs `performance.md` (with `storage.md`, the sidebar, the
  home page), README, CHANGELOG, screenshot `performance`. Live on both stacks (4.0.0: one node, 3 tasks; 3.3.2: no
  completed task), desktop and phone, Refresh; settings put back, no writes, no console errors. Not checked on the
  Windows app (a new zip and a restart of WebODM there).
- **Storage: back up and import tasks** (new.md, 2026-11-08; see "Storage: back up and import tasks") — branch
  `storage-backup-import`: `storage_page.js` (`backupable`, a Backup link per completed task, `backupAll`,
  `importZip` and `importFiles`: WebODM's chunked import), `storage.html` (Backup All, the hidden file input),
  `main.css`, `storage.py` (the `importing` mark), tests in `__tests__/storage_page.test.js` and `TestStorage`,
  `features.py`'s description, `docs/storage.md`, README, CHANGELOG, screenshot `storage` retaken. Live on both stacks:
  TestThermalNoPlugin backed up from 4.0.0's Storage page (430 MB, `data/backup.json` inside), Backup All's download
  started, then the zip imported through a "Live check" project's Import on 4.0.0 and 3.3.2 (restored with its name,
  completed), backed up again on 3.3.2, the projects deleted. Found while checking: Bootstrap shows a file input in
  spite of `hidden`, so main.css hides it. Not checked on the Windows app.
- **Task Options: two settings renamed** (new.md, 2026-11-08) — Show Modified Options is Show Configured Option
  Count (`show_configured_option_count`), Expand Configured is Expand Configured Options
  (`expand_configured_options`); previews `show-configured-option-count` and `expand-configured-options`; the texts
  say configured where they said modified. Branch `rename-configured-options`: `features.py`, `task_options.js`
  (`isConfigured`), `main.css`, the tests (`test_tweakui.py`, `task_options.test.js`, `settings_page.test.js`),
  `dev/screenshots.js`, `docs/general.md`, README, CHANGELOG, CLAUDE.md; screenshots retaken. Live on both stacks
  (the settings page's names, previews and saving; the counts and expanded groups in the dialog: 4.0.0 a task's Edit,
  3.3.2 the New Task panel, never started); selector check clean. Settings put back, old keys gone from the saved
  values.
- **Dev stacks on the GPU** (asked in chat, 2026-11-08) — `dev/webodm.sh` runs the processing node on WebODM's
  `nodeodx:gpu` image with the GPU reserved when the machine has one Docker can use (`TW_GPU=auto|1|0`,
  `dev/compose.gpu.yml`); both stacks' nodes recreated, ODX's own check finds the GPU. Not yet proven by a
  processing run.
- **Windows app: this session's features** (2026-11-08, the zip with the filter, the app restarted by the user) —
  checked live through the relay on :8007, desktop mode: Hide Navigation Pane's three steps on a map, with and
  without Resize Navigation Pane (250 → icons 50 with tooltips → hidden → 250, each kept over a reload; a drag to
  320 comes back at 250); Replace Preset Options Menu on the Test Thermal Flight task's Edit form (never saved: the
  order, a system and a user preset reaching WebODM's select, the filter with real typing, Enter, both Escapes,
  phone width; a "Live check" preset made and deleted); Surprise Me's Enable Interaction (greyed while off; on, the
  right-click rocket and no menu; off, the browser's menu and the shows go on). Settings put back, no writes, no
  console errors.
- **Replace Preset Options Menu: a filter box** (the user's request, 2026-11-08) — at the top of the menu, focused on
  opening: only the presets whose names hold the text (any case) stay, their submenus open and not closable while
  filtering; "No matching presets"; Enter chooses the first match, the down arrow goes to it, Escape clears then
  closes; empty each time the menu opens. Branch `preset-menu-filter`: `preset_menu.js` (`filter`, `build`,
  `focusItem`), `main.css`, tests in `__tests__/preset_menu.test.js`, `features.py`'s description, `docs/general.md`,
  CHANGELOG, screenshot retaken. Live on both stacks with real typing (4.0.0's Edit form, 3.3.2's New Task panel).
- **Just for Fun: Enable Interaction** (the user's request, 2026-11-08) — a part of Surprise Me
  (`surprise_me_interaction`, on by default so the right-click rocket stays until turned off; listed in the tests'
  `ON_BY_DEFAULT` with its reason): off, the fireworks go on and a right-click is the browser's. Branch
  `surprise-me-interaction`: `features.py`, `surprise_me.js` (`interact`, from the settings and the settings page's
  change event), tests in `__tests__/surprise_me.test.js` and `test_tweakui.py`, `docs/general.md`, CHANGELOG. Live on
  both stacks: greyed while Surprise Me is off, turned off on the settings page it lets the menu through at once, and
  on the Dashboard; the shows go on.
- **Surprise Me: the browser's menu on a Windows right-click** (a bug the user reported, 2026-11-08) — Windows sends
  `contextmenu` after `mouseup` (Linux and Mac on the press), and the release had already ended the right-click, so
  the menu was not blocked; there since right-click rockets were added, unseen because headless Chromium on Linux
  sends it on the press. Branch `surprise-me-windows-menu`: `surprise_me.js` (`released`, `MENU_AFTER`: a release
  with no contextmenu yet blocks the one that follows within a second; the menu key later still gets its menu), tests
  in `__tests__/surprise_me.test.js` (the Windows order, which fails without the fix), live on both stacks with the
  Windows order sent as events; on Windows itself, checked by the user ("that works", 2026-11-08).
- **Task Options: Replace Preset Options Menu** (first named Sort Preset Options; the user's request, 2026-11-08; see
  "Task Options: Sort Preset Options") — branch `sort-preset-options`: `tweakui/public/preset_menu.js`, its section
  of `main.css`, tests in `__tests__/preset_menu.test.js`, `features.py`, `dev/selector-check.js` (`WHERE`),
  screenshot `replace-preset-options-menu`, `docs/general.md`, README, CHANGELOG; the System Presets submenu on
  `system-presets-submenu` (checked live alike on both stacks, screenshot retaken). Live on 4.0.0 (a task's Edit form, the user's presets
  M4T-RGB and M4T-Thermal; dark and light themes, phone width) and 3.3.2 (the New Task panel with images chosen,
  never started; a "Live check" preset made and deleted): the order, the submenu, a choice reaching WebODM's state,
  no writes, no console errors. Found while building: WebODM floats `.dropdown` right in the form, and Bootstrap's
  `.active` menu item is dark-on-dark in a light theme, so the menu uses neither.
- **Hide Navigation Pane: three steps** (the user's request, 2026-11-07) — branch `nav-tab-three-states`: the tab
  cycles shown → icons only → hidden → shown at WebODM's 250 px (a dragged width is given up, as "default size"
  asks). Icons only is Resize Navigation Pane's narrowest view (`tweakui-nav-icons`, tooltips), with or without that
  setting; it is remembered as the width (`tweakui-nav-width` = 50), which the tab alone may restore. Code in
  `nav_pane.js` (`create`'s `cycle`; `createResize`'s `choose`, `restore`, `allowIcons`), tests in
  `__tests__/nav_pane.test.js`, `features.py`'s description, `docs/general.md`, README, CHANGELOG.
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


## 2D map review (asked in chat, 2026-11-11)

The user asked for a review of the plugin's 2D map work for bugs and UX breakdowns, fixing the obvious ones and
planning the rest. Read: `map_tiles.js`, `tile_cache.py`, `api.py` (CachedTiles, TileVersionView), `zoom_override.js`,
`other_tasks.js`, against WebODM's `Map.jsx` (both versions) and Leaflet 1.3.1 (both ship it; `_updateOpacity`
matches TweakUI's copy but its 200 ms).

Fixed (branch `review-2d-map`, tests in `map_tiles.test.js`, 3 new; each fails on the old code):
- **Tile Cache showed the old crop after a new one was drawn**, until a reload. WebODM's crop button saves the crop
  and makes the task's layers again (`loadImageryLayers`), with the same tile URLs once `cache` is dropped (`crop=1`
  either way), which carried the version asked when the page opened: the browser served the tiles it kept for good
  (`immutable`). `versions.ask` now takes the crop (`cropStamp`, from WebODM's `Symbol.for("meta")` on the layer, set
  before it is added in both versions) and asks again when it differs, the tiles going without a version until it
  comes; an answer for an older crop is dropped. A layer without meta (Other Tasks' Orthophotos) asks once, as before.
  Not exercised live: it needs a crop saved on one of the user's tasks.
- **Preload Tile Panning asked for every ring at once after a layer was shown again or redrawn** (ticked again in
  the Layers panel; a new colour map or hillshade): its ring count was reset only by a move. Leaflet updates before a
  layer's add event, so the rings reset on its remove and in its redraw. Live on 4.0.0 (TestRGB, zoom 22, 200%, the
  old script served to the same browser through a route): 72 tiles at once before, 28 (the view) after, then the rings.
- Smoke check on 4.0.0 with every Speed setting on: pan, zoom and redraw on TestRGB and TestThermal, no failed tile
  and no console error. DJI Thermal's thermal layer is its own layer now (`/api/plugins/dji-thermal/...inspector`),
  which TweakUI leaves alone.

Proposed, then decided by the user (2026-11-11):
- **Basemap: Fade-in Speed and Keep More Tiles.** Most of what pops in on the map is the basemap (measured with
  Preload Zoom), which no Speed setting touches, so Fade-in Speed at 0 still leaves the basemap fading over 200 ms.
  Both ask the basemap's server for nothing more. Preload Tile Panning stays off the basemap: that would prefetch
  from someone else's server (OpenStreetMap's tile policy asks clients not to). **Decided: Fade-in Speed only**;
  Keep More Tiles stays on the task's layers. Its description says it covers the basemap too.
- **Administration > TweakUI: withhold Preload Tile Panning**, as Tile Cache can be. Without Tile Cache, each rest
  at 200% has WebODM render up to 25 times the tiles in view, for every user with it on. **Decided: yes**
  (`admin_label` and `admin_help` on `load_ahead_on`); Keep More Tiles not (it asks for nothing more).
- **Small devices.** The settings are per user, not per device: 200% chosen on a desktop applies on the user's phone
  too, and the estimate is only for the window the settings page was opened in. **Decided: cap automatically**: where
  `navigator.deviceMemory` is 4 or less (Chrome and Edge report it) or the screen is under 768 px wide (Bootstrap's
  breakpoint, as WebODM's layout), Preload Tile Panning goes at most 100% and Keep More Tiles at most 50%; the
  descriptions say so. The stored settings are unchanged; the cap is applied on the map (`map_tiles.optionsOf`).
- **Leaflet check.** `map_tiles.js` overrides Leaflet 1.3.1's private methods (`_update`, `_isValidTile`,
  `_getTiledPixelBounds`, `_updateOpacity`...); each override falls back if a method is missing, but a newer Leaflet
  with a changed method would go unnoticed. `dev/selector-check.js` (run by `release-check` and when WebODM releases)
  also reports WebODM's Leaflet version when it isn't 1.3.1. No decision needed.
- Noted, not planned: Tile Cache prunes inside a tile request, about once per 50 MB written per process; a full scan
  took 6 ms for 1,946 tiles, so about 0.1 s at the 1 GB limit.

## Map speed: Preload Zoom Out and In (dropped) (asked in chat, 2026-11-10)

Asked after "how expensive would it be to preload zoom in and out?": both, 1 to 3 levels, under 2D Map > Speed, on a
branch kept apart until the user decided. Built on `zoom-preload` (`b84a84b`, code, tests and docs): once the map
is still and every tile loaded, `map_tiles.js` `preloadZoom` loaded each WebODM tile layer's levels out (the centred
view) and in (the whole view) in images it held, 4 at a time, so Leaflet's image of the same URL showed at once.

The user saw no less pop-in at the screen edges with it at 3 levels than with it off. Measured (2026-11-11, 4.0.0,
TestRGB, 1400×900 at DPR 2, Tile Cache on, wheel zooms): it worked for the task's layer (every new orthophoto tile
held and shown in ~0 ms, against 100–360 ms off), but:
- what pops in at the edges is mostly the basemap (Google satellite, 50–110 ms a tile), which no Speed setting
  touches; the orthophoto covers only part of the view at those zooms;
- zooming in, Leaflet stretches the old level over the view, so edges go blank mainly when zooming out;
- with Tile Cache a level already seen is instant from the browser's cache, so it helped only a level's first visit;
- a preloaded tile still fades in (200 ms unless Fade-in Speed).
Offered: preload the basemap too (1 level out, or the same levels; OpenStreetMap's tile server skipped, its policy
asks clients not to prefetch). The user dropped it instead.
Probe note: a probe that wraps a layer's `createTile` makes `preloadZoom` stand down (it leaves replaced
`createTile`s alone, for DJI Thermal); watch `tileloadstart` instead.

## Map speed: loading and showing tiles (asked in chat, 2026-11-10)

The user still saw tiles pop in at the edges with Tile Cache on, and asked whether that came from WebODM's map
loading only what is on screen. It does: Leaflet 1.3.1 asks for a tile only once it is in view, and drops tiles more
than 2 rows beyond (`keepBuffer`; half-size tiles on a high-resolution screen, so a few hundred pixels). Each tile
still makes a trip to the server, even when kept, and then fades in over 200 ms, hard-coded in `_updateOpacity`.

Decided by the user: all four options. Load Ahead and Keep More Tiles are sliders whose left end is WebODM's own, each
step going further within a range TweakUI sets. Fade-in Speed is a slider of 0, 50, 100 and 200 ms (WebODM's).

The design: everything goes in Settings > 2D Map > Speed.
- **Load Ahead:** 0–100% of the view's size beyond each edge, in steps of 25%.
- **Keep More Tiles:** 0–200% of the view's larger side, in steps of 25%, in rows on top of Leaflet's 2.
- **Fade-in Speed:** a new kind of number setting, `values`.
- **Reuse Browser Copies:** a part of Tile Cache. A version per task (`/api/plugins/tweakui/tiles/<p>/<t>/version`)
  goes in the tile URL as `v=`; it's left out of the key, and when it is current the tile is `immutable` for a year.
- **Fewer Tile Requests:** gives its `keepBuffer` half to Keep More Tiles. It is still unreleased, so no one's
  setting changes meaning.

## Map speed (asked in chat, 2026-11-09)

Request: find speed-ups a plugin can make to the UI, above all to how fast the map draws and updates.

What was found (WebODM 4.0.0, measured on the dev stack under test load):
- **The map** is Leaflet 1.3.1. The orthophoto, DSM and DTM layers (`Map.jsx`) use 512 px tiles with
  `detectRetina: true` and put `cache=Math.random()` in the tile URL on every load, so the browser never reuses one.
- **Each tile is rendered on request** by rio-tiler (`app/api/tiler.py`, `Tiles`), with no Cache-Control header. The
  format is picked per tile: jpg when it's fully opaque, otherwise webp when the browser accepts it, otherwise png.
- **Timings:** at a device pixel ratio of 1, opening the map loads 6 tiles at about 200 ms each, one zoom step
  loads 12 at about 280 ms, and a reload renders all 6 again. At a ratio of 2 (HiDPI and most phones), opening loads
  20 tiles at about 390 ms each (600 ms at worst), and one zoom step 35 at about 480 ms (890 ms at worst).
- **The 3D view** (Potree) has a point budget set in `ModelView.jsx`: 1M points on iOS, 2M on other phones, 10M on a
  desktop. `window.viewer` exposes it.

Proposed, each one a setting (all off by default):
1. **Tile cache.** A TweakUI API endpoint wraps WebODM's `Tiles` view, so WebODM's permission check still applies.
   - It keeps rendered tiles in a disk cache with a size limit. The key is the task, the tile type, z/x/y, the
     query minus `cache`, the raster's size and mtime, the task's crop, and whether the browser accepts webp.
   - It answers with a private Cache-Control and an ETag, so both the server and the browser reuse tiles.
   - In the browser, the Map hook overrides each layer's `getTileUrl`, which still holds when WebODM calls `setUrl`.
2. **Standard-resolution tiles on HiDPI screens:** turn `detectRetina` off. That needs about a third of the tiles (6 instead of 20 on opening, 12 instead of 35 per zoom step), at
   the cost of a softer image.
3. **Leaflet tweaks:** `updateWhenZooming: false` (no tiles requested in the middle of a zoom) and a larger
   `keepBuffer` (tiles kept when panning back).
4. **3D Point Budget:** a number setting under 3D Map that replaces Potree's budget.

Decided by the user (2026-11-09): build the Tile Cache (1) and the Leaflet tweaks (3) now, and perhaps the 3D Point
Budget (4) as a later phase. Not the HiDPI option (2). The Tile Cache is a per-user setting.

The design:
- **Settings > 2D Map, a Speed group, two per-user settings, both off by default.** Tile Cache can be withheld on
  Administration > TweakUI, since it uses the server's disk.
  - **Tile Cache:** this user's map asks TweakUI for its orthophoto, DSM and DTM tiles.
  - **Fewer Tile Requests:** the Leaflet tweaks: `updateWhenZooming: false`, and `keepBuffer` 4 in place of 2.
- **Server:** `tile_cache.py`, with `CachedTiles` (`api.py`), a subclass of WebODM's `Tiles` view, mounted at
  `/api/plugins/tweakui/tiles/<project>/<task>/<type>/<z>/<x>/<y>[@<n>x][.<ext>]`.
  - WebODM's task permission check runs on every request, cached tile or not.
  - The key covers the task, the type, z/x/y, the scale and ext, the query minus `cache`, the raster's size and
    mtime, the task's crop, whether the browser accepts webp, and WebODM's version.
  - A tile WebODM answers with something other than 200 isn't kept.
  - Every answer carries the key as its ETag, with `private, no-cache` and `Vary: Accept`. A matching
    If-None-Match gets a 304 without rendering, since the key fixes the content.
- **Where the tiles are kept:** in `media/plugins/tweakui/tile-cache/<task>/`, shared by all users. The cache is a
  per-user setting, so no one sets its size: TweakUI keeps it under **1 GB** (`tile_cache.LIMIT`).
  - Each tile is written to a temporary file, then moved into place.
  - After every 50 MB written, a process prunes: the least recently used tiles go until the cache is under 90% of
    the limit, along with the folders of deleted tasks.
- **Browser:** `tile_cache.js`, through `Map.didAddControls`, before WebODM adds its layers.
  - It wraps the map's `addLayer`. Each tile layer whose URL is WebODM's (`/api/projects/<p>/tasks/<t>/<type>/
    tiles/`) gets a `getTileUrl` that rewrites the URL to TweakUI's and drops `cache`. This holds when WebODM calls
    `setUrl`, and covers Other Tasks' Orthophotos.
  - Layers already on the map get the same `getTileUrl`, then a redraw.

## Performance View: the server's OS and CPU (asked in chat, 2026-11-09)

Asked: the OS type and version and the CPU's model, speed and type (and the memory's speed) under Server, and the
same for the processing nodes if they support it.

What can be read (checked in both containers, a node's /info and the Windows app's Python):
- Docker: `/proc/cpuinfo` (model, threads, core ids; `physical id` missing in WSL: one socket), the clock it reports
  (WSL's is the base clock), no cpufreq in WSL (a Linux host has `cpuinfo_max_freq`); the kernel is the machine's, the
  distribution the container's; no SMBIOS (`/sys/firmware/dmi`), so no memory speed.
- Windows app: the registry's processor name and `~MHz`, `GetLogicalProcessorInformation`, the Windows build and
  `DisplayVersion`; SMBIOS through `GetSystemFirmwareTable` would give memory speed.
- Processing nodes: `/info` has cores and memory only (NodeODX reads the CPU's brand and speed but doesn't send them);
  OpenMVS writes CPU, RAM and OS into a task's log.

Decided by the user: no processing nodes (a task log's figures aren't live), no memory speed (not shown everywhere),
and the OS in Docker as the kernel with a host guess where its name says (WSL2, Docker Desktop, OrbStack) and the
container's system.

## Diagnostic: Logs View (dropped) (asked in chat, 2026-11-09)

Asked: a Logs page with the last 10 server errors and system messages, each opening to the lines around it, and a
Download Logs zip of the server's and application's logs for WebODM's support.

Built on branch `logs-view` (commit 88655f2, not merged), then dropped by the user: WebODM's application logs can't be
read by a plugin, and a log of only what the plugin sees isn't worth having. What was found:
- Docker (4.0.0 and 3.3.2): Django logs to the console only (`settings.LOGGING`), which Docker keeps outside the
  container; the worker's output goes to `/dev/null` (`worker.sh`), nginx's error log too; plugins load only in the
  web process (`boot()` from `app/urls.py`), never in the Celery worker.
- WebODM's Windows app: every service's output in `logs/app.log` (no times, overwritten at each start) and
  `logs/pgsql.log`, readable.
- The branch recorded the web process's messages itself (a logging handler started in `Plugin.register()`), with task
  failures from the database and the Windows app's logs in the zip.
- Not taken up: a pull request to WebODM writing its logs (web and worker) to files too, which would make the real
  logs readable; it would need the user's approval.

## UX review of the plugin's pages (user request, 2026-11-09)

A review of Settings, Storage, Performance, Administration > TweakUI and the Dashboard (4.0.0, Solarized Dark, 1400px
and 390px), and the feature previews. All within the plugin's extension points: no WebODM change.

### Phase A: quick fixes (branch `ux-quick-fixes`) — done

Built as planned; item 1 stacks the row's buttons at phone width (the table fits) rather than scrolling it.


1. Storage at phone width: each project's Import and Delete buttons run past the right edge, half hidden. The table
   scrolls sideways in its box at phone width (as Performance's tables do), so nothing is cut off.
2. Bootstrap's `.progress` track keeps its light grey in dark themes (WebODM's theme.css doesn't theme it): the
   plugin's bars get a track from `currentColor` at low opacity (no hard-coded colour).
3. "Your storage" → "Your Storage" (Title Case).
4. Hide Navigation Pane's tab touches each page's title: it moves clear of it.
5. Storage's Delete stays solid red (dimmed) with nothing selected: the default style until something is selected,
   red once it is.
6. Colour-only figures (Recent Task History's "208 of 220" in the warning colour) get the ⚠ icon the Notes button
   uses.

### Phase B: Performance page layout (done)

- Refresh, Updated, Refresh Every and History Length move to a bar beside the page's heading, the two sliders in a
  popover.
- The explanatory notes (CPU, disk, Docker, memory sizing, Process View) behind an ⓘ beside their heading.
- Process View as a "Processes" section inside Server that opens and closes (as the page's other `<details>`).
- Graphs: the time window said once, labels at least 11px, a little taller on desktop.
- Recent Task History: Task, Created, Photos, Time, Per Photo and Node in the table; Slowest SfM Step, Area,
  Reconstructions, Position Error and GPU in the row Notes opens (or a column chooser).
- Row actions in one place: WebODM's "•••" at the row's end, on Performance and Storage alike.
Decided (2026-11-09):
- The controls: a bar beside the "Performance" heading, "Updated 11:48 · Refresh · ⚙", the ⚙ opening a popover with
  Refresh Every and History Length (the sliders as now, saved as now).
- Recent Task History keeps Task, Created, Photos, Time, Per Photo and Node; Slowest SfM Step, Area, Reconstructions,
  Position Error and GPU move into the row below the task, which every task then has: its button becomes **Details**
  (with the notes' count and icon when there are notes), opening the five figures above the notes. The colour-and-icon
  warnings (several reconstructions) go with their figure.
- Row actions: a "•••" button at the end of each row, as on WebODM's Dashboard: Performance's Actions menu moves
  there (same items), and Storage's per-row Import and Delete become a "•••" menu (Import, Delete) at its row's end.

### Phase C: Settings page readability (built, see Done)

Decided (2026-11-09): every description becomes one line saying what you get plus More for the rest; on a phone a
Preview link in place of the thumbnail; a Navigation Pane group after Global Controls. Previews already enlarged on
a click.

### Setting names

Decided (2026-11-09): rename all, each after what you get, without "Show" or "Add"; Settings and Administration use the
same name. Old docs anchors keep working where VitePress allows (an alias heading id). The list of new names is
proposed to the user before the rename.

The list approved (2026-11-09): Units in Header → Units Menu; Hide, Auto-hide and Resize Navigation Pane →
Collapsible Navigation Pane, Auto-hide, Resizable Navigation Pane; Show Configured Option Count → Configured Option
Counts; Expand Configured Options → Configured Options When Collapsed; Replace Preset Options Menu → Preset Menu with
Filter; Task Start and End Time → Start and End Times; Show Configured Task Preset → Matching Preset; Options as
Bubbles → Option Bubbles; Show ODX Command → ODX Command; Show Current Processing Stage → Current Processing Stage;
Expand Task Controls → Task Buttons When Minimized; Enable Interaction → Rockets on Right-click; Show Theme Menu →
Theme Menu; Movable Controls → Movable Panels; Compare Orthophotos from Other Tasks → Other Tasks' Orthophotos; 2D
Zoom Override → Deeper Zoom; Add Search Button → Map Search; 3D Zoom Override → Zoom to Pointer; Show Storage View
and Show Performance View → Storage View and Performance View. Unchanged: Hide Delay, Enhanced Task Details, Surprise
Me, Source Frames (the tool's own window has that name), Zoom Sensitivity, Refresh Every, History Length.

Settings are named in mixed styles ("Show Configured Option Count", "Add Search Button", "Units in Header", "Show
Storage View", which Administration calls "Storage View"). Proposed: each named after what you get, without "Show" or
"Add". A rename touches `features.py`, the docs (headings and anchors), previews, `dev/screenshots.js` and the
CHANGELOG.

## Storage View: the selection bar's message

Request (new.md, 2026-11-09): "Storage UI, change the message at the top to say select one or multiple tasks or
projects".

Diagnostic > Storage, the bar above the projects table, says "Tick tasks or projects to back up or clean up several
at once." while nothing is ticked (`templates/storage.html` and `storage_page.js`'s `renderSelection`, which puts it
back when the selection empties). Decided (2026-11-09): it becomes **"Select one or multiple tasks or projects to back
up, compact or delete them."**, naming the bar's three buttons. One branch `storage-message`: both places, the Jest
test that reads it, `docs/storage.md` if it quotes it, the `storage` screenshot if the bar shows; CHANGELOG
(Unreleased). Live on both stacks.

## Administration: one page

Request (new.md, 2026-11-09): "Move the TweakUI Themes Administration page functionality to the TweakUI
Administration page. We don't need 2 administration pages for one plugin at this time."

Now: Administration > TweakUI (`/plugins/tweakui/admin/`, `admin.html`, `admin_page.js`: Available to Users) and
Administration > TweakUI Themes (`/plugins/tweakui/admin/themes/`, `published.html`, `theme_editor.js`: the published
themes, Import, Export, Copy JSON, Delete, Publish One of Your Themes, the import panel). `main.js`'s `adminMenu` adds
both links after WebODM's Theme item.

Decided (2026-11-09): **stacked sections** on Administration > TweakUI: Available to Users, then a **Published
Themes** section with everything TweakUI Themes has now (its heading becomes the section's, `id="published-themes"`
for a link). Plan, branch `admin-merge`:
- `plugin.py`: `admin_page` gets the published page's context; `admin/themes/` redirects to `admin/#published-themes`
  (old bookmarks, the docs' old links), superusers only as now; `published_page` and `published.html` go (the
  section moves into `admin.html`, loading both `admin_page.js` and `theme_editor.js`, checked to not clash: the
  banner and status elements, the CSRF token read once).
- `main.js`: one link, TweakUI; `adminMenu`'s "already added" check moves to the TweakUI link.
- Links to `admin/themes/` elsewhere (settings page's Published group, comments, `api.py`'s docstrings,
  `import_panel.html`) point to the new section.
- Tests: `test_tweakui.py` (the page has both sections for a superuser, 403 for others, the redirect),
  `main.test.js` (one link), `theme_editor.test.js` where it builds the published page.
- Docs: `administration.md` gets a Published Themes section (from `themes.md`'s, which then links there), README,
  CHANGELOG (Unreleased); `dev/screenshots.js`'s `theme-published` opens the section; screenshots retaken.
- Live on both stacks as a superuser: both sections work (publish, delete, import of a "Live check" theme, removed
  afterwards), the side menu shows one link and opens Administration, the old URL lands on the section; desktop and
  phone.

## Performance View: Recent Task History, task actions and Process View (new.md, 2026-11-09)

Requests (new.md, 2026-11-09):
1. "Performance UI, rename "Recent Processing" to "Recent Task History""
2. "Performance UI, is it possible to add an action button dropdown list for each Task providing the options to
   Download Task Logs, Restart Task From Load Dataset(the beginning), View Report (if a task report is available),
   Download Report (again if report available)."
3. "Performance UI, below the Server cpu and disk io information, if possible add a button to enable Process View.
   Enabling this view expands 2 tables of the Server's top 10 CPU and Memory consuming processes, CPU above Memory.
   Sorted descending with their highest relative consumers at the top of their relative table. This information
   refreshes at the same interval the page is configured for other stats like cpu/iops. Show important process
   information such as PID, command, command line, and utilization"

What they build on: Diagnostic > Performance (`performance_page.js`, `performance.py`, `api.py`'s `PerformanceView`
and `PerformanceLiveView`, `templates/performance.html`). Recent Processing is `tasksHtml`/`taskHtml` (the heading
`#tweakui-performance-recent`, which General Assessment links to); the live refresh is `performance.live`, asked every
Refresh Every seconds. All three are within the plugin's extension points: no WebODM change.

Decided (2026-11-09):
- Process View lists only what WebODM's server can see, and says so: in WebODM's Docker install that is its own web
  container (ODM's processing runs in the node's container, so it is not listed, though CPU and disk figures are
  machine-wide); on the Windows app and native installs, every process. No WebODM (docker-compose `pid: host`) change.
- Process View is for superusers only (command lines can carry passwords, tokens, other users' work): others get no
  button and the API refuses them.

### Phase 1: "Recent Processing" becomes "Recent Task History" (branch `perf-recent-history`) — done

The heading, its intro and anchor (`#tweakui-performance-recent` stays: an id, not shown), General Assessment's link
("See their Notes in Recent Task History"), every comment and docstring naming it (`performance.py`, `task_log.py`,
`performance_page.js`, `test_tweakui.py`), `docs/performance.md` (the section and its links, `#recent-task-history`),
`features.py`'s description if it names it, README, CHANGELOG (Unreleased: the earlier bullets naming Recent
Processing are reworded, since they're unreleased; 1.0.0's stay). Jest tests that read it. Screenshots
`performance` and `performance-tasks` retaken. Live on both stacks.

### Phase 2: an Actions menu on each task (branch `perf-task-actions`) — done

Built as planned, except: `rerun_from` isn't sent with the report (the page reads `can_rerun_from` and the options
from WebODM's own task API just before restarting), and the menu is opened by the page's script rather than
Bootstrap's (`data-toggle` isn't used, so its handlers don't interfere), fixed over the page by its button.

A dropdown button **Actions** on each row of Recent Task History (WebODM's Bootstrap 3 dropdown, `btn btn-default
btn-xs dropdown-toggle`, as WebODM's own task buttons; at phone width it stays in the task's cell), with:
- **Download Task Logs**: `/api/projects/<p>/tasks/<t>/output/?f=raw` (WebODM's own console download, on 3.3.2 and
  4.0.0), saved as `<task name>.txt` through a link with `download`.
- **Restart From Load Dataset**: what WebODM's Restart button does by default, `rerun-from` set to the second of the
  task's `can_rerun_from` (`dataset`) through `PATCH /api/projects/<p>/tasks/<t>/` and then `POST .../restart/`,
  after a confirm ("Restart this task from Load Dataset? Its results are replaced when it finishes."). Offered only
  when WebODM's Dashboard offers Restart: a processing node, not imported, not compacted, and the user may change the
  project (its owner, an editor, an admin). After it, the row says "Restarting..." and the page refreshes the list on
  the next Refresh (a running task leaves the list, which holds finished tasks).
- **View Report**: `.../download/report.pdf?inline=1` in a new tab (WebODM's own PDF dialog is part of its React
  Dashboard and can't be reached from a plugin page).
- **Download Report**: `.../download/report.pdf`.
The report items are there only when the task's `available_assets` has `report.pdf`. `task_entry` gains
`can_restart`, `rerun_from` and `report` (booleans and the value, worked out on the server with WebODM's own rules
and `check_project_perms`' permission). Tests: Django (the new fields for an owner, a read-only share, an imported
and a compacted task), Jest (the menu's items by those fields; the restart's two calls and its confirm). Docs
`performance.md` (Recent Task History: Actions), README if its summary changes, CHANGELOG, screenshot
`performance-tasks`. Live on both stacks: logs downloaded and the report opened and downloaded on a completed task;
the restart checked on a task created for the check ("Live check restart", a few of the sample photos), deleted
afterwards; the menu at phone width.

### Phase 3: Process View (branch `perf-process-view`) — done

Built as planned, except: the page's superuser flag is the report's `admin` (`is_admin` is `is_superuser`), and the
command line and user are read only for the processes shown (Windows has hundreds).


Under the server's card and its Disk Activity, a **Process View** button (superusers only; `aria-pressed`, its state
kept in the browser tab's session storage like the graphs, off at first). On, it opens two tables, **Top 10 by CPU**
above **Top 10 by Memory**, each sorted highest first, with **PID**, **Command** (the program's name), **Command
Line** (shortened to one line, whole in its title, with a copy button), **User**, **CPU** (% of one core, as top shows
it, and of all cores in its title) and **Memory** (resident size and % of the machine's). They refresh with the CPU
load, on Refresh Every: the live request asks `?processes=1` while Process View is on.
- Server (`performance.py`): Linux reads `/proc/<pid>/stat` (utime+stime, rss), `/proc/<pid>/cmdline`, `status`'s
  Uid (name through `pwd`); CPU is the difference of each process's time between two readings (kept in the
  server's memory per worker process for 60 s, keyed by pid and start time, so a reused pid isn't confused), the first
  reading showing memory only and CPU after the next refresh, as the CPU load does. Windows (the app) through ctypes
  as `windows_times` already does: `CreateToolhelp32Snapshot` for the list, `GetProcessTimes` and
  `GetProcessMemoryInfo`, the command line through `NtQueryInformationProcess` (class 60, Windows 8.1+), left blank
  where a process can't be opened. A process that ends mid-read is skipped. No new Python module (psutil is not in
  WebODM's requirements).
- API: `PerformanceLiveView` adds `processes` only for a superuser (`is_superuser`), else ignores the parameter;
  the page script gets an `admin`-like flag already in the report (`report.admin` is `is_admin`: checked to match
  `is_superuser`, or a separate `superuser` flag).
- A line above the tables says what is listed: "Processes WebODM's server can see. In Docker that is its own
  container: the processing node's work runs in its own and isn't listed." (shown when the server runs in a container,
  detected from `/.dockerenv` or `/proc/1/cgroup`).
- Tests: Django (parsing a fake `/proc` tree: CPU from two readings, a reused pid, a vanished process, the sort and
  the top 10; non-superusers get no processes), Jest (the button only for a superuser, the tables' order and contents,
  the request's parameter while on). Docs `performance.md` (Process View), README, CHANGELOG, screenshot of the
  tables (a new `performance-processes` shot). Live on both stacks (Docker: the container's processes) and, if the user
  runs it, the Windows app through `dev/windows-relay.js` (every process, ODX's while a task runs).

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

## Task Options: Sort Preset Options (the user's request, 2026-11-08)

**Request**: a setting "Sort Preset Options" under General > Task Options that, when on, sorts the Options preset
dropdown (the New Task panel's and a task's Edit form, EditTaskForm in WebODM) alphabetically, with a "User
Presets" submenu at the top that expands to show the user's saved presets.

**What WebODM has** (the same in 3.3.2 and 4.0.0): a native `<select class="form-control">` in the Options row
(`.form-group.form-inline`), React-controlled; its options in `/api/presets/?ordering=-system,-created_at` order,
(Custom) (id -1) first when the options were edited, system presets marked `option.system-preset` (WebODM's own
`background-color: #eee` there makes them unreadable in a dark theme), "Default" shown as `gettext("Default")`.
A native select cannot hold a submenu.

**Decided with the user**:
- TweakUI's own dropdown in theme colours, over WebODM's select (hidden, kept on the page): choosing an item sets
  the select's value and sends it a change event, so WebODM's own code selects the preset. That also avoids the dark
  theme's unreadable system presets.
- User Presets opens in the list (a click, indented items; works on a phone); it starts open when the chosen preset
  is one of the user's. No user presets: no submenu.
- Order: (Custom) when present, then Default, at the top; then User Presets; then the other system presets A-Z.
  The user's presets are A-Z inside the submenu.
- Changed by the user (2026-11-08), after seeing it: a System Presets submenu like User Presets, below it, holding
  every system preset with Default among them, A-Z; (Custom) alone at the top. Each submenu starts open when it
  holds the chosen preset (branch `system-presets-submenu`).
- Changed by the user (2026-11-08): both submenus start open (branch `presets-submenus-open`).
- Renamed by the user (2026-11-08): "Replace Preset Options Menu", which says how it works (branch
  `replace-preset-options-menu`); unreleased, so the setting's key became `replace_preset_menu` and the screenshot
  `replace-preset-options-menu` too.

**Built**: see Done.

## Task Options: two settings renamed (new.md, 2026-11-08)

**Request**: rename "Show Modified Options" to "Show Configured Option Count", and "Expand Configured" to "Expand
Configured Options" (General > Task Options, the settings page).

**Builds on**: `task_options.js` (both features), `features.py`, their screenshots (`show-modified-options`,
`expand-configured`), `docs/general.md`, README, CHANGELOG, the tests (`test_tweakui.py`, `task_options.test.js`,
`settings_page.test.js`), `dev/screenshots.js`, CLAUDE.md's mention.

**Decided with the user**: the keys and screenshots follow the names, as TweakUI is unreleased (the dev stacks'
saved values reset): `show_modified_options` → `show_configured_option_count`, `expand_configured` →
`expand_configured_options`; previews `show-configured-option-count` and `expand-configured-options`. The texts
that describe them (descriptions, docs) say "configured" where they said "modified", to match. History entries in
this file keep the old names.

**Phase**: one branch, `rename-configured-options`; Jest, Django on both stacks, the settings page live on both,
screenshots retaken, the selector check.

## Storage: back up and import tasks (new.md, 2026-11-08)

**Request**: under TweakUI's Storage page, let users export and import tasks as zip files of the whole task. An
Export button next to Compact on each task; an "Export All" that downloads several zips at once, one per ticked
task, or per task of a ticked project. **Renamed with the user (2026-11-08): Export is "Backup"**, since the zip is
WebODM's own task backup, in its format and under its name.

**What WebODM offers** (checked in 3.3.2 and 4.0.0, the same in both; no change to WebODM needed):
- **Backup**: `GET /api/projects/<p>/tasks/<t>/backup` (`TaskBackup`) streams a zip of the whole task folder
  (photos, assets, `data/backup.json` with its name, options, times, tags, crop...), named `<task>-backup.zip` by
  WebODM. It is the "Backup" item of a completed task's Download menu (`AssetDownloadButtons`, both versions).
  Permission: view the task.
- **Import**: `POST /api/projects/<p>/tasks/import` (the project's Import button uses it), one file, chunked
  Dropzone-style (`dzuuid`, `dzchunkindex`, `dztotalchunkcount`, `dzchunkbyteoffset`) for big files. WebODM
  recognises a backup (`data/backup.json` and `assets/`) and restores it: the task comes back with its name,
  options, times and photos (`Task.handle_import`, `read_backup_file`). Other zips (assets only) import as
  WebODM's usual imported task. Permission: change the project.
- So both go through WebODM's API from the browser, its permissions and quota applying, as Compact and Delete do.
  TweakUI adds no format of its own: a backup made on the Storage page is the same file as one from WebODM's
  Download menu, and either imports through the Storage page or WebODM's Import.

**Builds on**: the Storage page (`storage_page.js`: the task rows' buttons, the ticked selection, the action bar
with Compact and Delete, the status line; `storage.html`; `docs/storage.md`; the `storage` screenshot).

**Proposed design**:
- **Backup** (a task row, beside Compact; `fa-file-download` as WebODM's Backup item, title "Backup: download the
  whole task as a zip"): a download of WebODM's backup URL, the browser's own download (no memory held by the page,
  whatever the size).
- **Backup All** (the action bar, beside Compact and Delete): each ticked task, and every task of a ticked project,
  downloaded one after another (a hidden link per task, a short pause between them). The browser asks once to
  allow multiple downloads; the status line says how many started. No confirmation (nothing is changed).
- **Import** (WebODM's name for it, which takes asset zips too, not only backups): a file chooser taking one or
  more zips; each is uploaded in chunks with a progress line ("Importing 2 of 3: name.zip, 45%"), one task per
  zip, then the list refreshes. WebODM then restores each (shown with the page's "Importing" mark until done).
- **Tests**: Jest (the buttons shown per task state, Backup All's list from ticks, the downloads' URLs, the chunked
  upload's requests and progress, errors shown); Django only if the report changes. Live on both stacks: a
  "Live check" task backed up (the zip's size and `backup.json` read, then deleted from disk) and imported into a
  "Live check" project, which is deleted afterwards; on the Windows app too (large files, cp1252 not involved).

**Decided with the user** (2026-11-08):
1. **Import on each project row**: an "Import" button beside the project's Delete; the zips chosen go into that
   project, one task each.
2. **Backup for completed tasks only**, as WebODM's own Backup: the row's Backup and Backup All skip the rest
   (Backup All's status line says how many were skipped).
3. **Named Backup and Backup All**, not Export: the file is WebODM's backup. Import keeps WebODM's name.

**Phase**: one branch, `storage-backup-import`, after the renames.

## Diagnostic: Performance View (asked in chat, 2026-11-08) — done

**Request**: a Performance page under Diagnostic where a user sees at a glance how WebODM's processing node is
doing, and whether it is sized right or needs more resources. The GPU line is dropped for now (the user, 2026-11-08):
nothing in WebODM reports a GPU; only a task's log hints at it.

**What WebODM offers** (checked on both stacks; no change to WebODM needed):
- **Each processing node's own info** (`ProcessingNode.api_client().info()`, NodeODX's `/info`, pyodx in 4.0.0 and
  3.3.2 alike): `cpu_cores`, `total_memory`, `available_memory`, `task_queue_count`, `max_parallel_tasks`,
  `max_images`, `engine`, `engine_version`, `version`. WebODM keeps only the queue, max images and engine
  (`update_node_info`) and drops cores and memory, so the page asks the node itself, server side, with a short
  timeout. The dev node: 20 cores, 63 GB (53 GB free), 1 task at a time. In Docker the node sees what Docker gives it
  (on Windows and Mac, Docker's memory setting: one of WebODM's FAQ answers).
- **WebODM's server**: disk (`shutil.disk_usage`) and memory (the Diagnostic plugin's `get_memory_stats`, Linux and
  Windows), as WebODM's own Diagnostic page shows them to any logged-in user.
- **Each completed task**: `images_count`, `processing_time`, `size`; and `odm_report/stats.json`:
  `processing_statistics.steps_times` (Feature Extraction, Features Matching, Tracks Merging, Reconstruction,
  Statistics, Total Time) and `odm_processing_statistics.total_time`, `average_gsd`.
- **Sizing guidance**: WebODM's hardware requirements (docs, installation.md): at least 100 GB free disk and 16 GB
  memory; memory by number of images: 40 → 4 GB, 250 → 16, 500 → 32, 1500 → 64, 2500 → 128, 3500 → 192, 5000 → 256
  (conservative, RAM or RAM + swap).
- Not available: live CPU or GPU load of a node (its info has none); the server's load only on Linux
  (`os.getloadavg`), with no library to add (`psutil` is not in WebODM's requirements).

**Builds on**: the Storage page (its own page under Diagnostic, the side-menu item from `main.js`, a setting in
`features.py`, an API in `api.py`, the page script, docs and screenshot alike).

**Proposed design** (a setting "Show Performance View", off by default as every new tweak; its own category or
Storage's, to decide):
1. **Processing nodes**, a card each (the nodes the user may use, `get_objects_for_user`): online or not, last seen,
   engine and version, cores, memory (free of total, a bar), queue and tasks at a time, max images; and "suits about
   N images" from the memory table.
2. **Server**: disk and memory, with a warning under WebODM's minimums (100 GB free, 16 GB).
3. **Recent processing**: the user's last completed tasks (an admin's: everyone's?), with images, total time,
   seconds per image, the slowest step, the node; a short trend (faster or slower than before).
4. **Verdicts** at the top, sentences: "Enough memory for your largest task (220 images)", "This node suits about
   1500 images", "Disk under 100 GB free", "Tasks are waiting: the node runs one at a time".
- **Refresh**: on opening and with a Refresh button (each node asked with a short timeout, in parallel or one after
  another; an offline node shown as such, not an error).
- **Tests**: Django (the API with a node's info mocked: online, offline, a node the user may not use; the verdicts'
  thresholds; stats.json missing or partial), Jest (the cards, the verdicts, the bars, Refresh), both stacks live,
  the Windows app (its local node, memory on Windows), phone width; screenshot `performance`, docs page.

**Decided** (the user, 2026-11-08):
1. The Settings page's "Storage" category becomes "Diagnostic", with two groups, Storage View and Performance View
   (as the side menu has both pages under Diagnostic). The docs keep a page each (`storage.md`, `performance.md`).
2. Recent Processing: an admin (superuser) sees every user's tasks, as on the Storage page; others their own.
3. The last 10 completed tasks, with a trend line (the recent tasks' seconds per image against the earlier ones').

**Phase**: branch `performance-view` — done (see "Done").

## Administration: users' access to Storage and Performance (asked in chat, 2026-11-08)

**Request**: an admin-level control with which administrators can turn off Storage View or Performance View for
users; both stay available to users by default.

**Builds on**: Administration > TweakUI Themes (superusers only: `plugin.py`'s page, `main.js`'s side-menu link,
`api.py`'s superuser check, the plugin's global data store as `custom_themes` uses it); `settings.allowed` (a value a
user may not have is refused); `storage.is_admin` (superusers).

**Proposed design**:
- **A page for superusers**, Administration > TweakUI (or a section of the TweakUI Themes page, renamed), with a
  group "Available to Users": a checkbox per feature an admin may withhold, "Storage View" and "Performance View",
  both ticked by default. Saved in the plugin's global data store, read with the defaults when unset (so a new
  install, and an upgrade, changes nothing).
- **Declared in `features.py`**: a setting marked admin-controllable (`admin_control=True`), so the admin page's
  checkboxes come from the same list and a later feature joins with one flag.
- **When withheld**, for every user but superusers: the setting is greyed on TweakUI's settings page with "Turned
  off by your administrator", saving it on is refused (`settings.allowed`), its side-menu item is not added, and its
  page and API answer 403. A user's own choice is kept, so ticking it again on the admin page brings it back as it was.
  Superusers keep both, always (they need them to manage the server).
- **Tests**: Django (the admin API: superuser only, CSRF; withheld: the setting refused, the page and API 403, the
  side-menu flag absent from settings.js; a superuser unaffected; unset = available), Jest (the greyed setting, the
  admin page), live on both stacks with a second, non-admin "Live check" user (made and deleted), docs
  (`docs/storage.md` and the admin page), screenshot of the admin page.

**Decided** (2026-11-08):
1. **Its own page**, Administration > TweakUI, with the group "Available to Users"; TweakUI Themes stays as it is.
2. **Superusers only** change it and always keep both; staff who are not superusers are users here.
3. **Greyed with the reason** ("Turned off by your administrator") on the settings page; the user's choice is kept.

**Phase**: branch `admin-feature-access`, after Performance View (so both pages exist; it could also come first and
cover Storage alone, then Performance joins with its flag).

## 2D Map: Add Search Button (new.md, 2026-11-08) — done

**Request**: "Under 2D Map, add an option named "Add Search Button" that adds a button to the 2D Map's buttons that
when clicked opens a search box that accepts addresses or coordinates. Allowing the user to search for a location and
the map takes them there."

**What WebODM has** (both versions): no forward geocoder and no search control on the map. It already asks
OpenStreetMap's Nominatim (`nominatim.openstreetmap.org/reverse`) from the browser, for a photo's place name
(`ProjectListItem.jsx`), so a search through Nominatim adds no new kind of outside request. The 2D map's controls
are Leaflet's, reached through `PluginsAPI.Map.didAddControls` as Other Tasks and Source Frames already do.

**Builds on**: `other_tasks.js` and `source_frames.js` (a Leaflet button of TweakUI's own on the map, not
`addActionButton`, which keeps only the first answers), Movable Controls (a panel with a title bar can be dragged).

**Proposed design**: a setting "Add Search Button" under 2D Map (off by default), script `map_search.js`. A
magnifier button with the map's other buttons; a click opens a small box with a text field ("Address or
Coordinates"). Coordinates (`lat, lon` in decimal degrees, also with N/S/E/W; perhaps DMS) go straight there, with
no request; anything else is sent to Nominatim's search, whose results are listed (up to five) and the first one
chosen on Enter. The map flies to the place (to a result's bounding box when it has one), with a marker that goes
when the box closes. Escape closes the box. Tests in Jest (the coordinates' parsing, the request, the results);
live on both stacks.

**Decided** (2026-11-08): Nominatim, the search on Enter (coordinates send no request); the button with the zoom
buttons (WebODM puts those bottom left, so it sits right above + and −, not top left as the question said); decimal
degrees and degrees-minutes-seconds (and degrees with decimal minutes), with or without N/S/E/W, not UTM. The marker
is yellow, as Source Frames' spot (it must show on any imagery); the flight takes 1.5 s however far. — done

## Global Controls: Auto-hide Navigation Pane (new.md, 2026-11-08) — done

**Request**: "Under General, Global Controls, Hide Navigation Pane. Add a sub-item named Auto-hide Navigation Pane
that when enabled automatically hides the navigation pane until the user nears the navigation pane. When the user
moves away from the pane it should automatically hide again after a short delay."

**Builds on**: Hide Navigation Pane (`nav_pane.js` `create`: the tab's three steps, the `tweakui-nav-hidden` class,
the window `resize` sent after each change) and the settings' `parts` (a sub-setting greyed out while its parent is
off, as Surprise Me's Enable Interaction).

**Proposed design**: a part of Hide Navigation Pane, `auto_hide_nav_pane`, off by default. From 768 px wide, the
pane starts hidden; the pointer near the left edge (a strip of a few pixels, and the tab) shows it over the page,
without moving the page; leaving it hides it again after a short delay (about half a second), unless the pointer
comes back or a menu inside it is open. No touch (a phone width keeps WebODM's hamburger menu). Tests in Jest
(fake timers); live on both stacks and the Windows app (desktop mode, the pane fixed at the top).

**Decided** (the user, 2026-11-08):
1. **Over the page**: the pane slides over the page's left edge; the page and the maps keep their size.
2. **The tab pins the pane open** (auto-hide paused) until clicked again; remembered in this browser.
3. **With Resize Navigation Pane, the remembered width** (WebODM's 250 px if never dragged).
4. **The delay is a choice on the settings page**: "Hide Delay", a part of Auto-hide, in milliseconds (whole
   numbers: the settings' type check), a slider in steps of 100 from 200 to 3000 with a number box, default 500.
   This brings the number kind of setting (min, max, step) that Zoom Sensitivity reuses.

## 2D Map and 3D Map: Zoom Sensitivity (new.md, 2026-11-08) — done

**Request**: "Regarding the Zoom Override features for both the 2D and 3D Maps, would it be possible to add a Zoom
sensitivity feature where the user can adjust the map zoom sensitivity independently of each other along with
independent sliders for the mouse and trackpad/touchpad if possible as well. Idea is to allow the user to customize
their zoom sensitivy experience for each type of map. The slider should have locked step intervals. If possible
render a sample map of each type beneath/above their relative sliders so the user can try out their changes in
realtime."

**Builds on**: Zoom Override (`zoom_override.js`: the 2D map hook, the 3D wheel with `notch()` and `zoomAlong()`),
the settings declared in `features.py` and their `parts`, the settings page's one loop (`settings.html`,
`settings_page.js`), `settings.update`'s type check (a value must have its default's type).

**What WebODM does today** (checked in the code, the same in 3.3.2 and 4.0.0):
- **2D** (Leaflet 1.3.1, `Map.jsx`: `scrollWheelZoom: true`, default `zoomSnap` 1): the wheel's pixels are added up
  for 40 ms (`wheelDebounceTime`), divided by 4 × `wheelPxPerZoomLevel` (60) and rounded **up** to a whole zoom level.
  So a mouse notch is always at least one whole level: making the mouse gentler needs a fractional `zoomSnap` (e.g.
  0.25), which also leaves the map between levels (tiles drawn slightly scaled). A trackpad pinch arrives as a wheel
  with Ctrl held, handled the same way. Both are map options the map hook can set; no WebODM change needed.
- **3D** (Potree's orbit controls): each wheel event is one whole notch (10% of the way to the orbit centre),
  whatever its size, so a trackpad zooms far too fast; Zoom Override already counts a trackpad's small events as a
  share of a notch, but only over a surface (over nothing Potree's own wheel runs).
- **Mouse or trackpad**: a browser doesn't say which. The usual tell: a mouse sends notches (Chrome ±100 or ±120,
  Firefox whole lines), a trackpad many small pixel deltas; a pinch has Ctrl held. Smooth-scrolling mice (free-spin
  wheels, macOS acceleration) can pass for a trackpad. Touch screens pinch with touch events, not the wheel.
- **Sample maps**: Leaflet is in WebODM's webpack bundle, not a file the settings page can load; Potree is a static
  file in both versions. WebODM sends no X-Frame-Options, so the settings page can frame a task's own Map and 3D
  Model pages (same origin), where TweakUI's script runs and can take the unsaved slider values from the page.

**Decided** (the user, 2026-11-08):
1. **A part of each Zoom Override**: greyed on the settings page while that Zoom Override is off, and no effect then.
2. **10% to 200%**, the slider in locked steps of 10, with a number box beside it that takes any whole number in that
   range (the slider showing the nearest step). 100% = WebODM's own feel.
3. **3D: only Zoom Override's zoom over a surface** is scaled; over empty space Potree's wheel stays as it is (maybe
   an option later).
4. **One sensitivity per map, for the wheel**: no separate trackpad slider, since a browser can't tell a mouse from
   a trackpad reliably (to reassess if a dependable way appears). The value applies to every wheel event, so a
   trackpad's scroll follows it too; touch pinch on phones stays WebODM's.
5. **No sample views on the settings page.** Instead, a **Zoom Override control on each map** (2D Map and 3D Model
   view), shown only while that map's Zoom Override is on: clicking it opens the slider and number box, and the
   zoom follows them at once, so the feel can be tried on the map being viewed.

**Design**:
- **Settings**: `zoom_sensitivity_2d` and `zoom_sensitivity_3d`, ints (default 100), parts of `zoom_override_2d` and
  `zoom_override_3d` ("Zoom Sensitivity", under each Zoom Override on 2D Map > Controls and 3D Map > Controls).
  `features.py` gains a number kind of setting (min, max, step), drawn by the settings page's loop as the slider and
  the box; `settings.update` refuses a value out of range or not a whole number.
- **On the map**: 2D, a Leaflet control button with a magnifier-and-slider look in the bottom left corner with the
  zoom buttons (as Add Search Button), opening a small panel; 3D, a button in the 3D view's row of action buttons
  before Share (as Source Frames, not through `addActionButton`), opening the same panel. The panel's change applies
  at once and is saved to the user's settings when the slider is let go or the box is left (the settings page
  shows it next time). Escape or a click outside closes it.
- **2D effect**: the map hook sets `wheelPxPerZoomLevel` to 60 ÷ (sensitivity ÷ 100) and, below 100%, a fractional
  `zoomSnap` (so a notch can be less than a whole level; the map then rests between levels, tiles slightly scaled).
- **3D effect**: `zoomAlong`'s share of the way per notch (`STEP`, 10%) scaled by the sensitivity.
- **Tests**: Jest (the panel, the box's range, the 2D options, the 3D step, saving), Django (range and type),
  live on both stacks (Playwright's wheel on a task's map and 3D view; 3.3.2 needs a task processed and deleted
  afterwards), desktop and phone width, light and dark.

**Settled while building**: the icon is a gauge (`fa-tachometer-alt`, in both versions' Font Awesome 5.11). On the
2D map TweakUI's own wheel (Leaflet's turned off, `zoomSnap` 0) replaces Leaflet's whenever the sensitivity isn't
100%, above too: Leaflet's rounding up to a whole step can't give 150%. A notch is that share of the steps Leaflet
itself takes for it on the browser (two on Chrome for Linux and macOS, one on Windows and Firefox).

## Zoom Sensitivity: the default shown (new.md, 2026-11-08) — done

**Request**: "On the zoom sensitivity slider add the text (Default: 100%). This will help remind the user that 100%
is WebODM's default."

**Builds on**: Zoom Sensitivity's panel (`zoom_override.js` `panel`: the label "Zoom Sensitivity" above the slider,
on the 2D map's bottom-left button and the 3D view's button before Share) and the settings page's number settings
(`settings_setting.html`, shared with Auto-hide Navigation Pane's Hide Delay).

**Proposed phase**: the panel's label reads "Zoom Sensitivity (Default: 100%)", the "(Default: 100%)" in the muted
text of WebODM's theme; the screenshots `zoom-sensitivity-2d` and `-3d` retaken; Jest.

**Decided** (the user, 2026-11-08): the map panels and the settings page, where every number setting shows its default
the same way (Zoom Sensitivity's two and Hide Delay).

## Performance View: live CPU Load and refresh (new.md, 2026-11-08) — done

**Requests**: "On the Performance UI, add CPU Load values akin to top/htop along with total cpu usage percentage of
100% across all cores. Could this even work on native Windows?" and "would it be possible to refresh cpu and memory
information on a user adjustable window of seconds between 1-10, default to 3? Disk information should refresh
every 10 seconds."

**Builds on**: the Performance page (`performance.py` `report`, `performance_page.js`: nodes' cards, Server, Recent
Processing, verdicts; refreshed on opening and by its Refresh button) and the number settings (Hide Delay's slider
and box).

**What can be measured** (checked 2026-11-08):
- No processing node reports its CPU load: NodeODX's `/info` has cores and memory only. So the load is of the machine
  WebODM's server runs on, which is the node's own machine when the node is local (the dev stacks, the Windows app,
  WebODM's default install). A node on another machine shows no load, and says so.
- `psutil` is in neither WebODM's requirements nor its Windows app, so it is read without it:
  - **Linux** (and Docker, where a container's `/proc/stat` and `/proc/loadavg` are the machine's, or Docker
    Desktop's VM on Windows and Mac): each core's and the total's busy share from `/proc/stat`, and the load
    averages over 1, 5 and 15 minutes (`os.getloadavg`), as top and htop show them.
  - **Native Windows: yes**, through `ctypes` as WebODM's own Diagnostic plugin reads Windows' memory:
    `GetSystemTimes` for the total and `NtQuerySystemInformation` (processor performance) for each core. Windows
    keeps no load average, so that line is left out there.
- A load is the difference between two readings: the API returns each core's running counters and the page works out
  the share between one refresh and the next, so the server keeps nothing and never waits.

**Proposed phase**:
1. **CPU Load** in the Server card: the total as a bar and percentage (0-100% across all cores), a small bar per core
   (htop's grid, wrapping at phone width), and the load averages with the core count beside them on Linux.
2. **Refresh**: a light API (`/api/plugins/tweakui/performance/live`) with CPU counters and the server's memory every
   "Refresh Every" seconds, 1-10, 3 by default; disk every 10 s; the nodes' memory with the CPU (each node asked with
   its short timeout, a refresh skipped while the last is unanswered); paused while the browser tab is hidden. The
   full report (nodes' cards, Recent Processing, verdicts) stays on opening and Refresh.
3. **Refresh Every** is a per-user number setting, a part of Show Performance View (Settings > Diagnostic), with the
   same slider and box on the Performance page itself, saved as Zoom Sensitivity's are.
4. **Tests**: Django (the counters from a sample `/proc/stat`; Windows' path with `ctypes` mocked; the setting's range),
   Jest (shares from two readings, the bars, the timer and its pause, the disk's 10 s), live on both stacks and on the
   Windows app; docs `performance.md`, screenshot `performance` retaken.

**Decided** (the user, 2026-11-08):
1. CPU Load shows the total, a bar per core and the load averages (as above).
2. Memory stays the machine's used and free (no process list), refreshed with the CPU.

## Performance View: Recent Processing and the task's log (new.md, 2026-11-08) — done

**Request**: "On the Performance UI, under Recent Processing, what other task performance information would be
useful in this table? Could we also check the task's log for useful errors or messages the User should be made aware
of?"

**Builds on**: Recent Processing (`performance.py` `recent_tasks`, `task_entry`, `read_stats`: the last 10 completed
tasks with images, total time, time per photo, slowest step, average GSD and node).

**What a task already has** (a 220-photo task on the 4.0.0 stack, 2026-11-08):
- `odm_report/stats.json`: photos reconstructed of those given (`reconstruction_statistics`: 208 of 220),
  `components` (separate reconstructions: 1), area covered (`processing_statistics.area`: 384.7 m²), start and end
  times, reprojection error, GPS error (`gps_errors.average_error`), GCPs used (`has_gcp`, `gcp_errors`), points in
  the point cloud.
- The task: options it ran with, its size on disk, the engine's version (`odm_report` or the node).
- `data/console_output.txt` (in 3.3.2 and 4.0.0 alike): 45 `[WARNING]` lines in that task's log, most of them noise
  (`CPLE_AppDefined ... RowsPerStrip not defined`, one per texture), and among them the one that matters: "Multiple
  reconstructions detected (2), this might be an indicator that some areas did not have sufficient overlap". The log
  also says whether the GPU was used (`no_gpu: False`, `--cuda-device`), the memory OpenMVS saw (`RAM: 58.86GB`), and
  on a failure the error and often why (out of memory, killed, not enough photos).

**Proposed phase**:
1. **More columns** (to choose, below), wrapping into the row's detail at phone width.
2. **Notes from the log**: each listed task's log read server side (only its end and the lines that match, so a large
  log stays cheap) against a short list of known messages, each with a plain sentence: low overlap (multiple
  reconstructions), photos left out (reconstructed fewer than given), GPU not used or not found, out of memory or
  killed, photos resized, images without GPS; WebODM's noise (`CPLE_AppDefined`) ignored. Shown as a badge on the row
  ("2 notes") that opens them, each with its line from the log.
3. **Failed and canceled tasks** listed too (now only completed ones), with their error and the log's reason, so a
  failure isn't missed.
4. **Tests**: Django (each known message against sample logs; a missing or huge log; stats.json fields missing),
  Jest (the columns, the notes), both stacks live; docs, screenshot.

**Decided** (2026-11-08):
1. Columns added: photos reconstructed of given; area covered and separate reconstructions; GPS error (GCP error
   when GCPs were used) and GPU used. Not size on disk or the preset.
2. Failed and canceled tasks are listed too, among the last 10, marked, with their error and the log's reason.
3. Notes: the known messages, each with a plain sentence; every other `[WARNING]` and `[ERROR]` line (deduplicated,
   `CPLE_AppDefined` left out) in a collapsed "Other Messages" list under them.

## Performance View: CPU Load without the per-core bars (new.md, 2026-11-08) — done

Request: "Remove the per core cpu load meters. The CPU Load percentage of the total number of cores is sufficient. On a
server with 128 cores this would breakdown quickly."

Builds on "Performance View: live CPU Load and refresh". Diagnostic > Performance > Server: CPU Load keeps its total bar
("of N cores") and the load averages; htop's grid of a bar per core goes. The live API stops sending each core's
counters (`proc_stat_times` and `windows_times` read only the total), so a 128-core server's answer stays small.
Tests, `performance.md`, CHANGELOG and the `performance` screenshot follow. No open decisions.

## Performance View: the photos left out, by name (new.md, 2026-11-08) — done

Request: "Regarding Recent Processing, when photos are left out, is it possible to list which ones so the user can
manually reference them?"

Builds on "Performance View: Recent Processing and the task's log". WebODM keeps a task's photos in its folder
(`Task.scan_images`, the same in 3.3.2 and 4.0.0) and the report's `odm_report/shots.geojson` lists the placed ones
(`properties.filename`), so the photos left out are the folder's images (by extension: not the GCP or geo file) that
the shots don't name. The log gives a reason for some ("No features found in image NAME", "GPS position not available
for NAME"). Only for a completed task with a shots.geojson; a huge list is capped (the rest counted).

Decided by the user (2026-11-08):
- Diagnostic > Performance > Recent Processing > a task's Notes: under the "photos were left out" note, a collapsed
  "Photos Left Out (N)" list, like Other Messages, with a Copy Names button. Each name is a link that opens the photo
  in a new tab (WebODM's `/api/projects/P/tasks/T/images/download/NAME`), with its reason beside it when the log gives
  one, and hovering (or focusing) a name shows its thumbnail (`.../images/thumbnail/NAME`, as Source Frames uses).

## Performance View: history graphs (asked in chat, 2026-11-08) — done

**Request** (with a screenshot of the Server cards): "I requested if the CPU Load, Memory and Disk IO stats could be
represented in a historical graph over time instead of a percentage bar? This allows the user to watch the trend
over time as the performance page runs and updates." (Not found in `upcoming-changes.md` or the earlier requests: it
had not been recorded.)

**Builds on**: the Performance page's live refresh (`performance_page.js`: `tick` every Refresh Every seconds, the
CPU's and the disks' counters turned into shares between two readings, `cpuShares` and `diskShares`; the server's
and the nodes' memory with each refresh; the free disk space every 10 s), `barHtml`.

**Proposed**: a small graph (inline SVG, no library, WebODM's theme colours) in place of each bar that changes with
the refresh: CPU Load, the server's memory, each drive's activity; the current figure stays as text beside it. The
newest reading at the right, the window scrolling left; hovering (or touching) a graph shows the figure and the time
under the pointer. The free disk space keeps its bar (it changes slowly). The history is kept in the page while it is
open (the server stays read only and keeps nothing).

**Decided by the user** (2026-11-08):
1. The window is a new per-user setting, **History Length**, 1 to 30 minutes, 5 by default, a part of Show
   Performance View, also on the Performance page beside Refresh Every (the same slider and box).
2. The history starts when the page opens and is kept while it is open (Refresh keeps it, a reload starts again);
   the server keeps nothing.
3. Each drive: one graph with reads/s and writes/s as two lines, and one for Busy; MB/s, size per operation and wait
   stay as text.
4. The nodes' memory gets a graph too.
5. Built before the documentation review (as Disk Activity was; not asked again).

**Design**: inline SVG, the accent line in `theme-color-button-primary` (currentColor) with a light fill under it,
writes in the text colour (`theme-stroke-primary`); percent graphs from 0 to 100%, the ops graph scaled to its
highest reading in the window (shown at its top left); a gap in the line where readings stopped (the tab hidden). The
page keeps up to 30 minutes of readings, so a longer History Length shows what it has at once. The figure beside a
graph takes the warning colours its bar had. The free disk space keeps its bar.

## Performance View: disk activity (new.md, 2026-11-08) — done

**Request**: "Performance UI, is it possible to add disk iops stats (e.g. read/write ops per second, random
read/writes ops per second, etc...) for the logical drives/mounts on the WebODM server?"

**Builds on**: Performance View's Server card (`performance.py`'s `disk_entry`, free of total for MEDIA_ROOT; the
live API `/api/plugins/tweakui/performance/live`, CPU counters read raw and turned into a load by the page from two
readings, `cpuShares`; the disk refreshed every 10 s, the CPU every Refresh Every seconds).

**What the system offers** (checked in `tw-webapp`):
- Linux: `/proc/diskstats` gives each block device's counters since boot: reads and writes completed, merged,
  sectors, ms spent, ms busy (`io_ticks`). In Docker it is the machine's (here Docker Desktop's VM's), so it also
  counts the processing node's and the worker's work. `/proc/self/mountinfo` gives each mount's device (major:minor):
  here `/webodm/app/media` (the tasks) is on `sde`, `/webodm` on `sdd`. No new module needed.
- Windows (the native app): each logical drive's counters (`\LogicalDisk(C:)\Disk Reads/sec` and the others)
  through `pdh.dll` with ctypes, read raw as the CPU's GetSystemTimes is.
- Per second figures come from two readings, as CPU Load does: reads/s, writes/s, read and write MB/s, % busy,
  average wait (ms) and average size per operation.
- **Random against sequential can't be counted**: the counters don't tell them apart. What comes close is the
  average size per operation (small means scattered) and the merged share (Linux merges neighbouring requests).
  A real random IOPS figure needs a benchmark (writing and reading a test file), which would load the disk while
  tasks process.

**Proposed**: a Disk Activity part of the Server card (or a card of its own), a row per drive with reads/s and
writes/s, MB/s each way, % busy and average wait, refreshed with CPU Load; each drive named by its mount points (the
tasks' drive first, marked Tasks) on Linux, by its letter on Windows. Branch `disk-io`: `performance.py`
(`diskstats`, `mount_devices`, `windows_disk_counters`, in `live`), `performance_page.js` (rates from two readings,
the rows), `main.css`; tests in `test_tweakui.py` (a sample `/proc/diskstats` and `mountinfo`, Windows mocked) and
`performance_page.test.js`; docs `performance.md`, README, CHANGELOG, screenshot `performance`.

**Decided by the user** (2026-11-08):
1. The drives WebODM's server uses: each disk it has mounted, a row per disk named by its mount points, the tasks'
   drive first and marked Tasks; on Windows each local drive letter.
2. No benchmark: reads/s, writes/s, MB/s each way, % busy, average wait and the average size per operation (small
   means scattered) stand in for random against sequential. Counters only, no load on the disk.
3. Refreshed with CPU Load (Refresh Every seconds).
4. Built before the documentation review.

## Compatibility: DJI Thermal beside TweakUI (new.md, 2026-11-08) — done

**Request**: "Install dji-thermal plugin into the dev instance to ensure there are no compatibility issues. One
potential issue is that it adds a Temperature Unit selecter to the header bar. We'll want to make sure ours have no
trouble showing up next to it. We also own the code to dji-thermal in ~/gitrepos/web/webodm-dji-thermal, where a new
release is in the works."

**Builds on**: `core.js`'s header slot (the header's `.navbar-top-links`, made before the brand when the page has
none; the side menu in desktop mode), Units in Header and the Theme menu.

**What the code shows** (before installing anything):
- DJI Thermal's `public/units.js` `addMenu` puts its Temperature Unit menu in the same `#navbar-top
  .navbar-top-links` list, left of the user icon, and makes that list itself (after the toggle button) when the page
  has none. TweakUI reuses the list when it exists, so whichever plugin runs first makes it and both menus land in
  one list; the menus' order depends on which script runs first.
- DJI Thermal is already installed on the 4.0.0 dev stack (its DJI Thermal Analyzer is in the side menu, seen
  2026-11-08).
- In desktop mode (the Windows app, no header bar) DJI Thermal finds no `.navbar-header` and adds no menu; TweakUI
  puts its menus in the side menu.
- DJI Thermal's `release/1.1.0` is merged into its `main`, with `dist/dji-thermal-1.1.0.zip` built (untagged).

**Proposed phase**: install DJI Thermal's zip on both dev stacks through Administration > Plugins (as a user would),
then check live: the header with both plugins' menus (each opens, nothing overlaps, the order stable over reloads),
at desktop and phone width (the collapsed header), light, dark and a TweakUI theme; Units in Header and the maps'
units still linked; the 2D map with DJI Thermal's Inspector beside TweakUI's map controls (Movable Controls, Source
Frames, Zoom Override, Add Search Button); the side menu with Hide, Resize and Auto-hide Navigation Pane; no console
errors from either. A problem is fixed on whichever side it belongs (DJI Thermal's on a branch in its own repo).

**Decisions** (the user, 2026-11-08):
1. DJI Thermal's `main` as it is now (named DJI Thermal Analyzer), zipped with its `dev/package.sh` into a scratch
   folder, installed on both stacks through Administration > Plugins.
2. Left installed on both dev stacks afterwards.
3. The header menus' order is fixed: TweakUI's menus go left of any other plugin's, so Temperature Unit sits next
   to the user icon on every load.
4. The Docker stacks only; the Windows app is covered at the release check.

## Documentation review before the release (new.md, 2026-11-08)

**Request**: "Review and update the documentation as necessary so that it's information is accurate prior to
release."

**Proposed phase**: once the phases before it are merged, read every page of `docs/` (each category page, Adding a
Tweak, Developing, the home page), the README, CONTRIBUTING, CHANGELOG and CLAUDE.md against the code: each
setting's name, place and description against `features.py`, each behaviour against its script, the screenshots
against what the feature shows now (retaken where stale), the links (`npm run docs:build`). Then the release:
`release/X.Y.Z` (manifest version, CHANGELOG, README, docs), `dev/package.sh`, the `release-check` skill.

**Decided** (the user, 2026-11-08):
1. The first release is **1.0.0** (the manifest said 0.1.0).
2. It stays `"experimental": true`.

## Performance View: controls and removing photos left out (new.md, 2026-11-09)

### Requests
- "Performance UI, Recent Processing regarding Photos Left Out. Is it possible to add a "Remove Photos From Task"
  button next to "Copy Names", that when clicked removes the files in the Photos Left Out list from the task so they
  won't cause problems in future executions of the task. If possible, also add a "Remove Photo" button next to each
  photo link in the Photos Left Out list."
- "Performance UI, move the refresh and history slider controls and the Refresh button above "Recent Processing".
  Move the sliders under the refresh button."

### Phase 1: the controls above Recent Processing (branch `perf-controls`) — done
Builds on `performance.html` (the `.tweakui-performance-bar` above the body today) and `performance_page.js`
(`render`). On the Performance page, the bar (Refresh, its status, then Refresh Every and History Length) moves from
under the page's title to just above the **Recent Processing** heading, below the server's and drives' cards.
Refresh and its status sit on the first line, with the two sliders stacked under it. The bar stays in place while the
body redraws, so a slider being dragged is not replaced. The phone layout is checked, as are the docs
(`performance.md`: "at the top of the Performance page") and the `performance` screenshot.

### Phase 2: Remove Photos From Task (branch `remove-photos`) — done
Builds on Photos Left Out (`task_log.py`, the `photos` of a note; `performance_page.js`'s Copy Names) and Storage
View's task actions (permission checks, CSRF).
- **Where:** in a completed task's Notes > Photos Left Out, a **Remove Photos From Task** button beside Copy Names
  (all listed photos), and a **Remove Photo** button beside each name.
- **Decided (2026-11-09):** removal **deletes the files permanently** from the task's folder (`task.task_path()`,
  where `scan_images` finds them), after a confirmation dialog naming how many photos go. The user keeps their
  originals.
- **Decided (2026-11-09):** TweakUI also **drops the processing node's copy**. It asks the node to remove the task
  and clears the task's `uuid`, as WebODM does when a node has purged a task. The next Restart then uploads only the
  remaining photos and runs from the start (WebODM drops Rerun From itself). The task's current results stay until
  then. This writes WebODM's task record and changes nothing in WebODM's code. `images_count` is updated.
- To build: an API (POST, CSRF) that takes the task and the names. It needs `change_project` on the task's project
  and a task that isn't queued or running. It accepts only names among the task's photos that its report leaves out
  (checked on the server, through `get_image_path`'s traversal check). Afterwards the list redraws without them, and
  a note says to Restart the task to process it without them. Tests on both stacks; docs `performance.md`, README,
  CHANGELOG; the screenshot `performance-tasks` if it shows the buttons.

## Performance View: graphs' scales, readings kept over a reload, General Assessment (new.md, 2026-11-09)

### Requests
- "Performance UI, add scales and legends to the graphs so users can easily tell what the graph data means. Increase
  the height of the graphs by 10% to make them a bit taller as well."
- "Performance UI, if possible can the performance graph metrics survive a regular page refresh (ctrl-R or F5) so they
  don't start over every time? I don't want something that runs in the background while off page though."
- "Performance UI, create a section called General Assessment at the top that contains all of the performance
  assessment bullets and messages (e.g. node-odx-1 has enough memory etc....). Help make the area standout more."

### Decided (2026-11-09)
- Scales: **labels inside the graph** (not a gutter), so a graph keeps its full width.
- Readings over a reload: **this tab only** (the browser's session storage), not shared between tabs or kept after
  the tab closes.
- General Assessment: **a card with a coloured left edge** in the worst line's colour (not an alert box).
- General Assessment holds the verdicts, **the time-per-photo trend** (moved up from Recent Processing) and **a
  summary of recent tasks' problems**. No live warnings.

### Phase 1: General Assessment (branch `perf-assessment`) — done
Builds on `verdictsHtml` and `trendText` (`performance_page.js`) and `verdicts` and `task_entry` (`performance.py`).
On the Performance page, the verdict lines that sit unlabelled at the top today go into a full-width card headed
**General Assessment**, above Processing Nodes. The card has the theme's highlight background (`theme-background-highlight`)
and a thick left edge coloured by its worst line: the theme's success, warning or danger colour, read from WebODM's
classes, not hard-coded. It holds, in order:
- The verdicts as today, the most pressing first.
- A line summing up Recent Processing's problems, built from the tasks the page already has (status and notes). For
  example "2 of your last 10 tasks failed (1 ran out of memory)" or "3 tasks left photos out: see their Notes in
  Recent Processing", with a link down to Recent Processing. It is a warning when any task failed, else information,
  and there is no line when nothing is wrong. An admin's line reads "on this server".
- The time-per-photo trend sentence, moved up from under Recent Processing.
Tests: Jest (the card, its edge by level, the summary's wording, the trend moved) and Django if `performance.py`
gives the summary. Docs `performance.md` (a General Assessment section in place of "At the top are sentences..."),
README, CHANGELOG, screenshot `performance`.

### Phase 2: the graphs' scales and legends, 10% taller (branch `perf-graph-scales`) — done
Builds on `graphHtml`, `graphTip` and the graph CSS. Each graph (CPU Load, the server's and each node's Memory, a
drive's Reads/Writes and Busy) gets:
- Small muted labels inside the graph: its top value at top left (100% for a percent graph, the rate graph's top as
  today, "20/s") and 0 at bottom left, with a faint gridline at half height.
- A line under it with the window's start at left ("5 min ago", following History Length) and "Now" at right.
- A legend under a two-series graph (Reads and Writes): a swatch in each series' colour (the theme's link and text
  colours, as the lines) and its name with the unit ("Reads (/s)", "Writes (/s)"). A single-series graph is named by
  its row's label, so it needs no legend.
The graphs are 10% taller: 42 px to 46 px (`GRAPH_H` 40 to 44). The labels stay readable in the light and dark
themes, and nothing scrolls sideways at phone width. Tests: Jest (`graphHtml`'s labels, the legend, the window's start
following History Length). Docs `performance.md` (Graphs), CHANGELOG, screenshot `performance`.

### Phase 3: the graphs' readings kept over a reload (branch `perf-history-reload`) — done
Builds on `record` and `state.history`, which are kept in the page today and lost on a reload.
- The page saves its readings (`state.history`, up to History Length's longest, 30 minutes) and the last CPU and disk
  counters to the browser's **session storage** under one key. It saves after each live refresh, no more often than
  every few seconds, and when the page is hidden or unloaded.
- On opening, the page reads them back and drops readings older than 30 minutes. If the last counters are recent
  (within the gap a line breaks at), the first live reading after a reload gives a load at once, with no second
  wait. After a longer absence the line shows a gap, as it does today while the tab is hidden.
- Nothing runs while the page isn't open. Session storage belongs to the tab: a new tab starts fresh, and closing the
  tab forgets the readings. Every read and write is in a try/catch, so a private window or blocked storage just
  starts empty. The data are numbers only: 30 minutes at a 1-second refresh for about 10 series is a few hundred KB,
  well under the browser's limit, and a failed write (quota) only skips that save.
Tests: Jest (saved and read back, old readings dropped, broken or missing storage starts fresh, counters kept).
Docs `performance.md` (Graphs: "reloading the page starts again" changes), CHANGELOG.
