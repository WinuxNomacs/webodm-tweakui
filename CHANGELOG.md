# Changelog

## Unreleased

- Performance View: CPU Load, the server's and each node's memory, and each drive's reads and writes per second and
  busy share are drawn as graphs over time in place of their bars, filling as the page refreshes. Hovering (or
  touching) a graph shows the readings under the pointer. History Length (1 to 30 minutes, 5 by default, a part of
  Show Performance View, also on the Performance page) sets how much time they show. The readings are kept in the page
  while it is open; the server keeps nothing.
- Performance View: Disk Activity, a card for each disk WebODM's server uses (the tasks' first, with where it is
  mounted): reads and writes per second, bytes per second and the average size of one (small ones mean scattered,
  random work), how busy the disk was and the average wait, refreshed with CPU Load. From the system's own counters
  (Linux's /proc/diskstats, Windows' disk performance counters); nothing is written to measure it.
- Header menus: TweakUI's units and theme menus come before other plugins' menus (such as DJI Thermal Analyzer's
  °C / °F), the same order on every page. On a phone with more menus than fit, they get narrower, then WebODM's name
  beside the logo is left out.
- Performance View: Recent Processing lists failed and canceled tasks too (a failure with its error), and gains
  columns from each task's report and log: photos placed of those given, area, separate reconstructions, position
  error (GPS or GCP) and whether the GPU was used. A Notes button opens what the log says the user should know (out of
  memory, photos left out, low overlap, no GPS, GCPs not used, the GPU failing...) in plain sentences with their lines,
  and the log's other warnings and errors. The photos left out are listed by name (from the task's photos and its
  report's camera positions), each with the log's reason, opening the photo, its thumbnail on hover, and Copy Names. Area and error follow WebODM's unit system.
- Performance View: the Server card shows CPU Load, as top and htop do: the total across all cores in one bar (with
  how many cores) and the load averages (no load average on Windows, which keeps none). The CPU load and the server's and nodes'
  memory refresh every 3 seconds, set by Refresh Every (1 to 10 seconds, a part of Show Performance View, also on the
  Performance page), and the disk every 10 seconds, paused while the browser tab is hidden.
- The settings page's number settings show their default after their name ("Zoom Sensitivity (Default:
  100%)", "Hide Delay (Default: 500 ms)"), and so does the Zoom Sensitivity panel on each map.
- 2D Map and 3D Map > Controls > Zoom Override > Zoom Sensitivity (100% by default): how far a mouse wheel notch
  zooms, from 10% to 200%, for each map. It is on the settings page and on the map itself: a gauge button (at the
  bottom left of the 2D map, beside Share in the 3D view) opens a slider and a box that the zoom follows at once,
  saved when let go. Away from 100% the 2D map can rest between zoom steps.
- General > Global Controls > Hide Navigation Pane > Auto-hide Navigation Pane (off by default): the side menu stays
  hidden until the pointer reaches the window's left edge, shows over the page (which keeps its size), and hides
  again after Hide Delay (200 to 3000 ms, 500 by default) once the pointer leaves it. The tab pins it open. The
  settings page gains number settings: a slider in steps with a box for any whole number in the range.
- 2D Map > Controls > Add Search Button (off by default): a button above the map's zoom buttons opens a search box.
  Coordinates (decimal degrees or degrees, minutes and seconds, with or without N/S/E/W) go straight there; an
  address or place is looked up with OpenStreetMap's Nominatim when you press Enter, with up to five results listed.
  The map flies there and marks the place until the box closes.
- Administration > TweakUI (superusers only, linked after Administration > Theme): Available to Users, where a
  superuser can withhold Storage View or Performance View from every user but superusers. A withheld setting is
  greyed with "Turned off by your administrator", and its page and API refuse them; each user's own choice is kept
  for when it is given back. Both stay available by default.
- Diagnostic > Performance View (off by default): a Performance page under Diagnostic in the side menu, with each
  processing node's cores, memory, queue and the photos per task its memory suits, the server's disk and memory, the
  last 10 completed tasks' times (an administrator's: everyone's) with a trend, and verdicts by WebODM's hardware
  requirements. The settings' Storage category is now Diagnostic, holding Storage View and Performance View.
- Storage: a completed task's Backup downloads WebODM's own backup zip of the whole task (as Download > Backup
  does), and Backup All downloads one for each completed task ticked or in a ticked project; a project's Import adds
  a task from each zip chosen (backups or assets, as WebODM's Import), with its progress shown.
- Replace Preset Options Menu: a filter box at the top of the menu narrows the presets as you type; Enter chooses the
  first match.
- General > Just for Fun > Surprise Me > Enable Interaction (on by default): turn it off to keep the fireworks
  without the right-click's rocket, leaving the mouse to the browser and the page.
- Surprise Me: a right-click on Windows sends only its rocket; the browser's menu no longer opens too (Windows sends
  the menu event after the button's release, which the right-click had already ended).
- General > Task Options > Replace Preset Options Menu: the Options dropdown of a new or edited task becomes a menu
  with (Custom) first, then two submenus, open at first and closed with a click: User Presets (your saved presets)
  and System Presets (WebODM's, Default among them), each A-Z, in your theme's colours.
- General > Global Controls > Hide Navigation Pane: the tab cycles through three steps: the side menu's icons only
  (their names on hover, as Resize Navigation Pane's narrowest), hidden, and back at the usual width.
- Source Frames: the button reads "Open Full Frame", in Title Case like the rest of the interface.
- General > Global Controls > Resize Navigation Pane: drag the divider to resize the side menu, down to its icons
  alone (their names on hover); a double click puts back the usual width; remembered in this browser.
- General > Global Controls > Hide Navigation Pane: a tab on the side menu's divider hides the side menu, giving
  the page the whole width, and shows it again; remembered in this browser.
- 3D Map > Zoom Override: a scroll with the textured model shown no longer stutters; a burst of wheel events with
  the pointer still finds the point under it once, not on every event.
- For developers: `npm run selector-check` checks a WebODM for every element TweakUI's scripts rely on (their
  `SELECTORS`), for a new WebODM version.
- Source Frames: the full-frame viewer takes the keyboard focus when it opens and gives it back to Open Full
  Frame when it closes.
- General > Task Details > Expand Task Controls: the page address lists only the tasks you expanded fully, not
  every task shown as buttons only, so a project with hundreds of tasks no longer makes an address too long to reload.
- 3D Map > Zoom Override: a trackpad's two-finger scroll zooms as far as it scrolls, not a wheel notch per scroll
  step (far too fast, as WebODM's own 3D view does).
- Thanks, in the README and on the documentation site: the projects and people TweakUI builds on.
- Settings: a green "Saved" banner at the top of the settings for 3 seconds after each change (a red one when
  a change can't be saved), in place of the line at the bottom of the page.
- General > Just for Fun > Surprise Me: fireworks over every page every few seconds, until you turn it off, and a
  rocket to the pointer on a right-click, or Ctrl+click on a Mac ([fireworks-js](https://fireworks.js.org/) 2.10.8, MIT, included).
- General > Global Controls > Units in Header: a units menu in the header (Metric, Imperial, Imperial (US)),
  WebODM's own unit preference, kept in step with the 2D map's and 3D view's selectors.
- Themes: the Sample is framed and headed "Sample Form for Viewing Theme Effects"; the New Theme, Import and
  Export buttons sit below the My Themes heading.
- Clearer wording throughout the settings, messages and documentation; the settings "Show Theme Menu" and
  "Show Storage View" renamed in Title Case.
- A TweakUI item in the side menu, just above About, and a settings page (navigation pane, General), with each user's own settings.
- General > Task Options > Show Configured Option Count: the Task Options dialog's group headings show
  (configured/total).
- General > Task Options > Expand Configured Options: a collapsed group of the Task Options dialog still shows its
  configured options (not at their default), WebODM's own controls, ready to change; the dialog's Expand/Collapse
  button cycles Expand All, Collapse All and Collapse All but Configured.
- General > Task Details > Expand Task Controls: on the Dashboard, a minimized task still shows its buttons; the
  square beside its name cycles buttons only, expanded and fully minimized.
- General > Task Details > Enhanced Task Details: a task's details on the Dashboard show the preset its options
  match, each option in a bubble, and its ODX command (docker, or ODX's run.bat when WebODM runs on Windows) with a
  copy button; and when it started and finished (worked out from its creation and processing time); while it runs,
  its current ODM stage ("Current Step (8/13): Texturing"). Each part can be turned off on its own.
- Themes: each user picks WebODM's theme or one of 11 presets (Catppuccin ×4, Solarized ×2, Dracula, Nord,
  Gruvbox ×2, One Dark), applied through WebODM's own theme template.
- Themes > My Themes: each user's own themes; New Theme (from the current theme) or Copy (any theme) opens an
  editor of WebODM's 13 theme colours, which the page previews before Save; Edit and Delete on your own themes.
  They are also in the header's theme menu.
- Themes > My Themes: Import (a JSON file or pasted text of one theme or a list; a theme with the name of one of
  yours replaces it; a report of what was added, replaced and refused), Export (all your themes, or one), and Copy
  JSON on every theme.
- Administration > TweakUI Themes (superusers only, linked after Administration > Theme): publish a copy of one
  of your own themes, import, export and delete the published themes, which every user sees under Themes >
  Published and can choose and copy; a deleted one puts its users back on WebODM's theme.
- Themes > Sample: WebODM's controls (text, labels, a progress bar, a field, a select, a dropdown, buttons,
  pagination) in the current theme, doing nothing, below the themes.
- A paintbrush in the header, left of the user icon: a menu of the themes to switch on any page; Themes > Theme
  Menu turns it off.
- 2D Map > Movable Controls: the 2D map's panels can be dragged by their title within the map; a panel that closes
  reopens in its usual place.
- 2D Map > Compare Orthophotos from Other Tasks: on a task's map, a panel to show the project's other tasks' orthophotos over the task's
  own, each with an opacity slider.
- 2D Map and 3D Map > Source Frames: a button beside Share turns it on; each click on the 2D map or the 3D model
  moves a spot there, and a window, updated in place, lists the task's photos that show it, best first, each with
  the spot drawn on it, its properties, a full-screen viewer and a download.
- 2D Map and 3D Map > Zoom Override: the 2D map zooms in 3 steps further; in the 3D view the wheel zooms toward what
  is under the pointer.
- Storage: Diagnostic in the side menu opens to System and Storage (TweakUI's item does without Diagnostic). The
  page shows the quota and the projects you own, largest first, opening to their tasks and a task's files by kind.
  Tasks and projects are compacted or deleted one by one or ticked together, with one confirmation of what goes
  and what it frees, through WebODM's own API. Administrators also see every user's.
- On WebODM's Windows app, which has no header, the theme menu and Units in Header are items of the side menu.
- Experimental.
