# Changelog

## Unreleased

- Settings: a green "Saved" banner at the top of the settings for 3 seconds after each change (a red one when
  a change can't be saved), in place of the line at the bottom of the page.
- General > Just for Fun > Surprise Me: fireworks over every page every few seconds, until you turn it off, and a
  rocket to the pointer on a right-click ([fireworks-js](https://fireworks.js.org/) 2.10.8, MIT, included).
- General > Global Controls > Units in Header: a units menu in the header (Metric, Imperial, Imperial (US)),
  WebODM's own unit preference, kept in step with the 2D map's and 3D view's selectors.
- Themes: the Sample is framed and headed "Sample Form for Viewing Theme Effects"; the New Theme, Import and
  Export buttons sit below the My Themes heading.
- Clearer wording throughout the settings, messages and documentation; the settings "Show Theme Menu" and
  "Show Storage View" renamed in Title Case.
- A TweakUI item in the side menu, just above About, and a settings page (navigation pane, General), with each user's own settings.
- General > Task Options > Show Modified Options: the Task Options dialog's group headings show (modified/total).
- General > Task Options > Expand Configured: a collapsed group of the Task Options dialog still shows its options
  not at their default, WebODM's own controls, ready to change; the dialog's Expand/Collapse button cycles Expand
  All, Collapse All and Collapse All but Configured.
- General > Task Details > Expand Task Controls: on the Dashboard, a minimized task still shows its buttons; the
  square beside its name cycles buttons only, expanded and fully minimized.
- General > Task Details > Enhanced Task Details: a task's details on the Dashboard show the preset its options
  match, each option in a bubble, and its ODX command (docker) with a copy button; and when it started and
  finished (worked out from its creation and processing time); while it runs, its current ODM stage ("Current Step
  (8/13): Texturing"). Each part can be turned off on its own.
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
- Experimental.
