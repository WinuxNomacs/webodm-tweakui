# Upcoming changes

## Phases (current and upcoming)

**Up next** (order decided by the user, 2026-11-06)
1. **Themes** — a Themes item in the settings page's navigation pane: each user picks a preset theme (Dracula,
   Nord, Catppuccin, Solarized, ...) or WebODM's own. Details below; its design is discussed before it is built.
2. **Storage** (request 5) — a Storage category in the settings that turns on a Storage view under Diagnostic:
   what the user's projects and tasks take, and cleaning them up. Details below; to be designed with the user.

**Later**
(nothing planned)

**Done**
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

## Phase 2: Themes (request 3), to be designed with the user

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

Open (for the discussion): which presets and variants (e.g. Dracula; Nord; Catppuccin Latte, Frappé, Macchiato,
Mocha; Solarized Light and Dark; others); how far dark presets go on the hard-coded places (map, 3D view, admin).

## TweakUI menu item above About (request 6) — done

What WebODM offers (checked in 3.3.2 and 4.0.0, `app/templates/app/logged_in_base.html`, the same in both):
plugins' `main_menu()` items are rendered right after Dashboard, in plugin order; then Processing Nodes,
Administration (staff), Developer Tools (dev mode, superusers), and `<li id="about-menu">` last. There is no way
to place a plugin's item elsewhere, so `main.js` (loaded in `<head>`) moves TweakUI's `<li>` just before
`#about-menu` when the page is parsed. To avoid a flash, `main.css` hides the item in its first place
(`#side-menu > li:has(> a[href="/plugins/tweakui/"])`) until the script has moved it. Always, not a setting.

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
