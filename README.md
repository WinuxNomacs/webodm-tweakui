# TweakUI for WebODM

A [WebODM](https://github.com/WebODM/WebODM) plugin of small enhancements to WebODM's interface. It works through
WebODM's plugin system only: it changes nothing in WebODM itself and can be turned off at any time in
Administration > Plugins.

**Status: experimental.**

## Features

Each user has their own TweakUI settings: the **TweakUI** item near the bottom of WebODM's side menu, just above About, opens them. The settings page
has a navigation pane of categories on the left (above the settings on a phone); it opens on **General**. A
change is saved as soon as it is made and applies from the next page.

### General

- **Task Options > Show Modified Options** (off by default): in the Task Options dialog (a new task's Options >
  Edit, or a task's Edit), each group heading shows how many of its options are not at ODM's default, out of how
  many it has: "Input & Preprocessing (1/13)" once ignore-gsd is enabled. The count follows your changes,
  including "Reset to default". A preset's own settings count too (the Default preset sets auto-boundary and
  dsm). Only in the grouped view; "Other Options" is counted while it is open.
- **Task Options > Enhanced Task Details** (off by default): when a task is opened on the Dashboard, its details
  show when it started and finished, its current step while it runs, and three rows in place of WebODM's one-line
  Options. Each part has its own setting under Enhanced Task Details, all on (they are greyed out while Enhanced
  Task Details is off); with Options as bubbles off, WebODM's own Options line stays.
  - **Started** and **Finished**, after "Created on", in your local time. WebODM keeps no start or end time, so
    they are worked out from what it has: Started is when the task was created, Finished that plus its processing
    time ("Running" while it runs). Created means when its upload began, and a restart counts the processing
    time again from the new run, so after a slow upload or a restart they are off by that much.
  - **Current Step**, while the task runs: the ODM stage it is in, read from the task's console every 5 seconds
    while its details are open, e.g. "Current Step (8/13): Texturing". ODM runs 13 stages (12 with
    fast-orthophoto, fewer with end-with); "Starting" before the first, "Downloading results" once ODM is done and
    WebODM fetches the results.
  - **Preset**: the preset the task's options match, found as WebODM's Edit dialog finds it (the first preset
    with exactly the same options and values), or "Custom". WebODM doesn't record a task's preset, so a preset
    edited since may no longer match.
  - **Options**: each option in its own bubble, with its value.
  - **ODX command**: the command to run the task yourself, with a copy button:
    `docker run -ti --rm -v /my/project:/datasets/code webodm/odx --project-path /datasets` followed by the task's
    options and the three the processing node adds by itself (`--pc-ept --cog --gltf`), as the node runs it.
    Replace `/my/project` with your folder, which holds the photos in `images/`; a task's boundary is read from
    `boundary.geojson` there.

### Themes

Pick your own colours for WebODM, for you only: **WebODM's theme** (the default, whatever the administrator set in
Administration > Theme) or one of 11 presets: Catppuccin Latte, Frappé, Macchiato and Mocha; Solarized Light and
Dark; Dracula; Nord; Gruvbox Dark and Light; One Dark. Each shows a swatch of its colours; choosing one reloads the
page in it.

The **paintbrush** in the header, left of the user icon, is a shortcut to the same choice on every page: it opens
the list of themes, with your current theme and WebODM's theme on top, and choosing one switches to it. **Theme
Menu > Show the theme menu in the header** (on by default, at the top of Themes) turns it off.

A preset fills the colours of WebODM's own theme, so it changes exactly what an administrator's theme can change,
in each WebODM version. Places WebODM always shows in white keep their white background (some icons and controls
there only work on white) with readable text: the map's layers panel, the Contours and Object Detection panels,
and the content of Administration, which keeps WebODM's own theme. Light presets have a header in their accent
colour, as WebODM's logo is white. Dropdown menus show their items in the preset's text colour (WebODM fixes them
to near-black, which a dark preset's menu background would hide).

## Requirements

WebODM 3.3.2 or later (tested on 3.3.2 and 4.0.0).

## Installing

Once released: in WebODM, Administration > Plugins, install TweakUI from the plugin directory, or upload
`tweakui-X.Y.Z.zip` from this repository's releases.

## Outside services

None: the plugin calls no outside service. It keeps each user's settings, including their theme, in WebODM's
database, in the plugin's per-user data store.

## Developing

See [CLAUDE.md](CLAUDE.md) for the dev environment (`dev/webodm.sh`), tests and the release steps.

## License

AGPL-3.0, see [LICENSE](LICENSE).
