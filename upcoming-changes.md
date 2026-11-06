# Upcoming changes

## Phases (current and upcoming)

**Up next** (order decided by the user, 2026-11-06)
1. **Paintbrush toggle and task start/end times** (requests 9, 12) — two small additions to settings that
   exist: Themes > "Show the theme menu in the header", and Started/Finished rows in Enhanced Task Details.
2. **2D Map and 3D Map settings, Movable Controls** (request 10) — two new categories in the settings; with
   Movable Controls on, the 2D map's popup panels can be dragged by their title.
3. **Storage** (request 5) — a Storage category in the settings that turns on a Storage view under Diagnostic:
   what the user's projects and tasks take, and cleaning them up. Details below; to be designed with the user.

**Later**
(nothing planned)

**Done**
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

## Paintbrush toggle and task start/end times (requests 9, 12)

What there is: the paintbrush menu (`public/theme_menu.js`) is on for every user; Enhanced Task Details
(`public/task_details.js`) replaces WebODM's Options row of a task's details panel. WebODM's panel (the same in
3.3.2 and 4.0.0) has "Created on:" (`Task.created_at`) and shows the duration in the task's row
(`processing_time`, ms, from the node). WebODM stores no start or end time. Two sources exist:
- **ODM's `log.json`** in the task's assets (`/api/projects/<p>/tasks/<t>/assets/log.json`, WebODM's own route,
  both versions): `startTime` and `endTime` of the run on the node; only for tasks whose results were
  downloaded (not running, failed or canceled), and written without a time zone (the node's clock; UTC in Docker).
- **WebODM's own fields**: started = `created_at` (a dashboard upload sets it when the upload is committed),
  finished = `created_at` + `processing_time`. On the TestRGB task they are within 20 s of `log.json`'s times
  (13:38:04 / 14:24:40 against 13:38:23 / 14:24:57 UTC); they work for every task, any node, and a running one.

Decided (the user, 2026-11-06): the times come from WebODM's own fields (not `log.json`).

Design:
- **Themes > "Show the theme menu in the header"** (on by default), at the top of the Themes section; off, the
  paintbrush isn't added. Settings > Themes still picks the theme.
- **Enhanced Task Details: "Started:" and "Finished:" rows** after WebODM's "Created on:", in the browser's
  local date and time like WebODM's; a running task shows "Running", a task never processed "—".

## 2D Map and 3D Map settings, Movable Controls (request 10)

What there is (the same in 3.3.2 and 4.0.0): the 2D map's popup panels are Leaflet controls in the map's top-right
corner: Layers (`LayersControlPanel`), Contours and Object Detection (core plugins), each a `.open` wrapper with a
`.title` bar and a `.close-button`; Measure (the measure plugin's `.plugin-measure.popup`); Base Maps (Leaflet's
layers control, a list that opens while the pointer is over it).

Decided (the user, 2026-11-06): 3D Map is added now, empty ("No settings yet").

Design:
- **Settings > 2D Map** and **Settings > 3D Map**: two categories in the navigation pane.
- **2D Map > "Movable Controls"** (off by default): a panel is dragged by its title bar (mouse or touch), within
  the map; when it closes (its wrapper loses `.open`, or it is removed) its position is cleared, so it reopens
  where WebODM puts it. Base Maps and Measure have no title bar: dragged by their own edge (Base Maps closes as
  soon as the pointer leaves it, so moving it helps little).

## Storage (request 5), to be designed with the user

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

Open: none for now; details are confirmed when the phase is planned in full.
