# Changelog

## Unreleased

### Settings Page

- Each setting's description is one line saying what you get, with **More** after it for the rest (how it works,
  what differs on a phone or in WebODM's Windows app); **Less** hides it again.
- On a phone, a setting's screenshot is a **Preview** link under its description, which opens it full size.
- A number setting can take a list of values, its slider stopping at just those (Fade-in Speed).
- General: Collapsible Navigation Pane (with Auto-hide and Hide Delay) and Resizable Navigation Pane are in a
  **Navigation Pane** group of their own, after Global Controls.
- Settings are named after what you get, without "Show" or "Add", and Administration uses the same names; what
  you had turned on stays on. Units in Header is now **Units Menu**; Hide, Auto-hide and Resize Navigation Pane
  are **Collapsible Navigation Pane**, **Auto-hide** and **Resizable Navigation Pane**; Show Configured Option
  Count, Expand Configured Options and Replace Preset Options Menu are **Configured Option Counts**, **Configured
  Options When Collapsed** and **Preset Menu with Filter**; Enhanced Task Details' parts are **Start and End
  Times**, **Matching Preset**, **Option Bubbles**, **ODX Command** and **Current Processing Stage**; Expand Task
  Controls is **Task Buttons When Minimized**; Surprise Me's Enable Interaction is **Rockets on Right-click**; Show
  Theme Menu is **Theme Menu**; on the 2D Map, Movable Controls, Compare Orthophotos from Other Tasks, Zoom
  Override and Add Search Button are **Movable Panels**, **Other Tasks' Orthophotos**, **Deeper Zoom** and **Map
  Search**; the 3D Map's Zoom Override is **Zoom to Pointer**; Show Storage View and Show Performance View are
  **Storage View** and **Performance View**. The documentation's old links still lead to them.

### 2D Map

- **Tile Cache** (Speed): the map's orthophoto, DSM and DTM tiles are kept on the server once WebODM has drawn them
  (up to 1 GB, shared by everyone with it on), and your browser reuses its own copy while a tile is unchanged. A
  reload or another user's look at the same place no longer has each tile drawn again. An administrator can
  withhold it on Administration > TweakUI.
  **Reuse Browser Copies**, a part of it: the browser shows the tiles it has without asking the server first; a
  task processed again gets new ones.
- **Load Ahead**, **Keep More Tiles** and **Fade-in Speed** (Speed): checkboxes, each with a slider beneath, for
  loading tiles beyond the view's edges (Distance, 25% to 100%), keeping more of them after they leave it (Amount,
  25% to 200%), and how long a tile takes to fade in (Duration, 0 to 400 ms). Load Ahead loads the tiles in view
  first, so the extra tiles never hold them up.
- **Fewer Tile Requests** (Speed): while zooming, the map asks for tiles once the zoom ends; it can help on a slow
  or unreliable connection to the server.

### Administration

- Administration > TweakUI Themes is now the **Published Themes** section of Administration > TweakUI, under
  Available to Users: one link in the side menu, and the old address opens the section.

### General

- Collapsible Navigation Pane: with the side menu hidden, the page keeps room for the tab at its left edge, so it no longer
  touches the page's title.

### Diagnostic

- Storage View: a project's actions (Import, Delete) and a task's (Backup, Compact, Delete) are in a **•••** menu at
  the row's end, as on WebODM's Dashboard; at phone width a long name breaks and a task's mark wraps, so the table
  fits the screen; the selection bar's Delete turns red only once something is selected; "Your storage" is now
  "Your Storage".
- Storage and Performance View: the bars' tracks follow the theme (a faint track in its text colour) instead of
  Bootstrap's light grey, which glared in dark themes.
- Performance View: a figure in a warning or danger colour (photos left out, several reconstructions, memory used,
  a disk's Busy) has its icon too, so it isn't told by colour alone.
- Performance View: the server's card starts with its **OS** (in Docker, the machine's kernel, where it runs when the
  kernel says so, such as WSL2 on Windows, and the container's system; on the Windows app, the Windows version, release
  and build) and **CPU** (model, architecture, cores and threads, sockets when several, and its maximum, base or
  reported clock); CPU Load counts threads when the CPU has more threads than cores.
- Performance View: Recent Processing is now **Recent Task History**.
- Performance View: **Processes**, for superusers, a section under the server's cards that opens: the top 10 processes WebODM's server
  can see by CPU and by memory (PID, command, command line with a copy button, user, CPU and memory), refreshed with
  CPU Load. In Docker that is the web container's own processes. The tables are outlined, their columns resizable
  (kept for the browser tab), and a command line wraps at its column's width, showing its first 512 characters; its
  copy button copies it whole.
- Performance View > Recent Task History: a **•••** menu at the end of each task's row, in alphabetical order: Download Report
  and View Report (for a task with a report), Download Task Logs, and Restart From Load Dataset (as WebODM's
  Restart, where the Dashboard offers it).
- Storage View: the bar above the projects says "Select one or multiple tasks or projects to back up, compact or
  delete them." until something is selected.
- Performance View: the graphs' readings survive a reload of the page (Ctrl+R or F5) in the same browser tab (its
  session storage); nothing is measured while the page isn't open.
- Performance View: each graph has its scale inside it (its top, 0, a line at half height, in 11px labels) and, for a
  drive's reads and writes, a legend; the window, the same for every graph, is said once in the page's bar ("Graphs:
  last 5 min", following History Length); the graphs are taller on desktop.
- Performance View: the page's controls are in a bar beside its heading (Updated, the graphs' window, Refresh and a
  gear button whose panel holds Refresh Every and History Length), and the notes explaining a section's figures
  (memory sizing, CPU Load, disk activity) are behind an info button beside its heading.
- Performance View > Recent Task History: the table keeps Task, Created, Photos, Time, Per Photo and Node; Slowest SfM
  Step, Area, Reconstructions, Position Error and GPU are in the row a task's **Details** button opens, above its notes
  (the button counts the notes, with the most pressing one's icon).
- Performance View: a **General Assessment** card at the top, its left edge in its most pressing line's colour, with
  the verdicts on memory and the nodes, a line summing up Recent Task History's failed tasks and photos left out, and
  the time-per-photo trend (moved up from Recent Task History).
- Performance View > Recent Task History: **Remove Photos From Task** beside Copy Names and **Remove Photo** beside
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
