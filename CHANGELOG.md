# Changelog

## Unreleased

### Diagnostic

- Performance View: a **General Assessment** card at the top, its left edge in its most pressing line's colour, with
  the verdicts on memory and the nodes, a line summing up Recent Processing's failed tasks and photos left out, and
  the time-per-photo trend (moved up from Recent Processing).
- Performance View > Recent Processing: **Remove Photos From Task** beside Copy Names and **Remove Photo** beside
  each name in a completed task's Photos Left Out delete those photos from the task, and the task stops using the
  processing node's copy of it, so its next Restart goes without them.
- Performance View: Refresh, Refresh Every and History Length moved from the top of the page to just above Recent
  Processing, the two sliders under Refresh.

## 1.0.0 (2026-11-09)

The first release. Every feature is off until a user turns it on in their own TweakUI settings (the **TweakUI** item
just above About in the side menu), except the theme menu. Experimental; runs on WebODM 3.3.2 and later (tested on
3.3.2, 4.0.0 and 4.0.0's Windows app).

### Settings

- A settings page for each user, with a navigation pane of categories (General, Themes, 2D Map, 3D Map, Diagnostic),
  a screenshot beside each feature, and a green "Saved" banner after each change (a red one when it can't be saved).
- Number settings have a slider and a box for any whole number in range, with their default after the name ("Hide
  Delay (Default: 500 ms)").

### General

- Global Controls > Units in Header: a units menu in the header (Metric, Imperial, Imperial (US)), kept in step with
  the 2D map's and 3D view's units selector.
- Global Controls > Hide Navigation Pane: a tab on the side menu's divider cycles the side menu through its icons
  only, hidden and its usual width; Auto-hide Navigation Pane keeps it hidden until the pointer reaches the window's
  left edge, then shows it over the page for as long as Hide Delay (200 to 3000 ms, 500 by default) after the pointer
  leaves.
- Global Controls > Resize Navigation Pane: drag the divider to resize the side menu, down to its icons alone; a
  double click puts back the usual width.
- Task Options > Show Configured Option Count: each group heading of the Task Options dialog shows how many of its
  options are not at their default, e.g. (1/13).
- Task Options > Expand Configured Options: a collapsed group still shows its configured options, ready to change;
  Expand/Collapse cycles Expand All, Collapse All and Collapse All but Configured.
- Task Options > Replace Preset Options Menu: the Options dropdown becomes a menu with (Custom), then User Presets and
  System Presets, each A-Z, a filter box that narrows them as you type, in your theme's colours.
- Task Details > Enhanced Task Details: a task's details on the Dashboard show when it started and finished, its
  current ODM stage while it runs ("Current Step (8/13): Texturing"), the preset its options match, each option in a
  bubble, and its ODX command with a copy button (docker, or ODX's run.bat on WebODM's Windows app). Each part can be
  turned off on its own.
- Task Details > Expand Task Controls: a minimized task still shows its buttons; the square beside its name cycles
  buttons only, expanded and fully minimized.
- Just for Fun > Surprise Me: silent fireworks over every page every few seconds, and a rocket to the pointer on a
  right-click unless Enable Interaction is turned off ([fireworks-js](https://fireworks.js.org/) 2.10.8, MIT,
  included).
- TweakUI's header menus come before other plugins' (such as DJI Thermal Analyzer's °C / °F), and narrow on a crowded
  phone header. On WebODM's Windows app, which has no header, the units and theme menus are items of the side menu.

### Themes

- WebODM's theme or one of 11 presets (Catppuccin ×4, Solarized ×2, Dracula, Nord, Gruvbox ×2, One Dark), seen only
  by you.
- My Themes: your own themes, started with New Theme or Copy from any theme, in an editor of WebODM's 13 theme
  colours that previews the page before Save; Import and Export as JSON, and Copy JSON on every theme.
- Published themes: superusers publish, import, export and delete themes every user can choose, in
  Administration > TweakUI Themes.
- Sample Form for Viewing Theme Effects: WebODM's controls in the current theme.
- Theme Menu > Show Theme Menu (on by default): a paintbrush in the header to switch themes from any page.

### 2D Map

- Controls > Movable Controls: the map's panels can be dragged by their title anywhere within the map.
- Controls > Compare Orthophotos from Other Tasks: the project's other tasks' orthophotos over the task's own, each
  with an opacity slider.
- Controls > Source Frames: click the map to list the task's photos that show that spot, best first, with the spot
  marked on each, its details, a full-frame viewer and a download.
- Controls > Zoom Override: 3 more zoom steps; Zoom Sensitivity (10% to 200%, 100% by default) sets how far a wheel
  notch zooms, also from a button on the map.
- Controls > Add Search Button: a search box for coordinates (decimal degrees or degrees, minutes and seconds), which
  go straight there, or an address or place, looked up with OpenStreetMap's Nominatim when you press Enter.

### 3D Map

- Controls > Source Frames: the same, by clicking the point cloud or the textured model.
- Controls > Zoom Override: the wheel zooms toward what is under the pointer, and a trackpad's scroll at a gentle
  pace; Zoom Sensitivity (10% to 200%) sets how far a notch goes, also from a button in the 3D view.

### Diagnostic

- Storage View > Show Storage View: a Storage page under Diagnostic in the side menu with your quota, your projects
  and tasks by size and each task's files by kind; compact or delete tasks and projects, back up completed tasks as
  WebODM's own backup zips, and import zips into a project. Administrators see every user's.
- Performance View > Show Performance View: a Performance page under Diagnostic with each processing node's cores,
  memory, queue and the photos per task its memory suits; the server's CPU load, memory, free disk space and each
  drive's activity (reads and writes per second, busy share, wait), drawn as graphs over time as the page refreshes
  (Refresh Every, 3 s by default; History Length, 5 minutes by default); your last 10 finished tasks (failed and
  canceled too) with times, photos placed, area, reconstructions, position error and GPU, notes from their logs in
  plain sentences, the photos left out by name, and a trend; and verdicts by WebODM's hardware requirements.

### Administration

- Administration > TweakUI (superusers only): Available to Users, to withhold Storage View or Performance View from
  every user but superusers; each user's own choice is kept for when it is given back.

### For developers

- [Adding a Tweak](https://winuxnomacs.github.io/webodm-tweakui/adding-a-tweak) and `CONTRIBUTING.md`: how to add a
  tweak, with a worked example.
- `npm run selector-check` checks a WebODM for every page element TweakUI's scripts rely on, for a new WebODM version.
