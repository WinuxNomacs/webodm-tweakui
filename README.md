# TweakUI for WebODM

A [WebODM](https://github.com/WebODM/WebODM) plugin of small enhancements to WebODM's interface. It works through
WebODM's plugin system only: it changes nothing in WebODM itself and can be turned off at any time in
Administration > Plugins.

**Status: experimental.**

## Features

The full documentation, with a screenshot of each feature, is at **https://winuxnomacs.github.io/webodm-tweakui/**.

Each user has their own TweakUI settings: the **TweakUI** item near the bottom of WebODM's side menu, just above
About, opens them. A change is saved as soon as it is made and takes effect on the next page you open. Beside each
feature in the settings is a screenshot of it; click it to see it full size. Every feature is off until you turn it
on, except the theme menu.

- [**General**](https://winuxnomacs.github.io/webodm-tweakui/general): a units menu in the header, linked to the
  maps' units selector (Units in Header); in the Task Options dialog, each group's count of options not at their
  default (Show Modified Options) and those options shown under a collapsed group (Expand Configured); on the
  Dashboard, a task's start and end times, preset, options as bubbles, ODX command and current
  step (Enhanced Task Details), a minimized task's buttons kept in view (Expand Task Controls), and fireworks every
  few seconds, or at the pointer on a right-click (Surprise Me).
- [**Themes**](https://winuxnomacs.github.io/webodm-tweakui/themes): your own colours for WebODM, seen only by you: WebODM's theme,
  one of 11 presets (Catppuccin, Solarized, Dracula, Nord, Gruvbox, One Dark), your own themes copied from any theme
  with a live preview (imported and exported as JSON) or themes an administrator publishes to every user; a sample of
  WebODM's controls in the current theme, and a theme menu in the header.
- [**2D Map**](https://winuxnomacs.github.io/webodm-tweakui/map-2d): panels you can drag anywhere within the map
  (Movable Controls), the project's other tasks' orthophotos over the task's own (Compare Orthophotos from Other
  Tasks), the task's photos that show a clicked spot (Source Frames), and 3 more zoom steps (Zoom Override).
- [**3D Map**](https://winuxnomacs.github.io/webodm-tweakui/map-3d): Source Frames on the model, and a mouse wheel
  that zooms toward what is under the pointer (Zoom Override).
- [**Storage**](https://winuxnomacs.github.io/webodm-tweakui/storage): how much of your quota each project and task
  uses, each task's files by kind, and compacting or deleting them; administrators see every user's.

## Requirements

WebODM 3.3.2 or later (tested on 3.3.2 and 4.0.0).

## Installing

Once released: in WebODM, Administration > Plugins, install TweakUI from the plugin directory, or upload
`tweakui-X.Y.Z.zip` from this repository's releases.

## Outside services

None: the plugin calls no outside service. It keeps each user's settings and themes in the plugin's per-user data
store in WebODM's database, and the published themes in its global data store.

## Developing

See [CLAUDE.md](CLAUDE.md) for the dev environment (`dev/webodm.sh`), tests and the release steps, and the
documentation's [Developing](https://winuxnomacs.github.io/webodm-tweakui/developing) page. The features' screenshots in `tweakui/public/previews/` (the
settings page's previews and the documentation's images) are retaken from a running WebODM with
`TW_USER=... TW_PASSWORD=... npm run screenshots` (`dev/screenshots.js`). The documentation is `docs/`
(VitePress): `npm run docs:dev` to work on it, `npm run docs:build` to build it; `.github/workflows/docs.yml`
publishes it to GitHub Pages on a release tag or by hand.

## License

AGPL-3.0, see [LICENSE](LICENSE).

Surprise Me's fireworks are [fireworks-js](https://fireworks.js.org/) 2.10.8 by Vitalij Ryndin, MIT licence, included
in `tweakui/public/vendor/fireworks-js/` with its [LICENSE](tweakui/public/vendor/fireworks-js/LICENSE).
