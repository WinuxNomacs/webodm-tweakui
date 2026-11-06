# Upcoming changes

## Phases (current and upcoming)

**Up next** (order decided by the user, 2026-11-06)
1. **Storage** (request 5) — a Storage category in the settings that turns on a Storage view under Diagnostic:
   what the user's projects and tasks take, and cleaning them up. Planned in full (decisions below).

**Later**
(nothing planned)

**Done**
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

## Storage (request 5)

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
