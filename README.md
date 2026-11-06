# TweakUI for WebODM

A [WebODM](https://github.com/WebODM/WebODM) plugin of small enhancements to WebODM's interface. It works through
WebODM's plugin system only: it changes nothing in WebODM itself and can be turned off at any time in
Administration > Plugins.

**Status: experimental.**

## Features

The full documentation, with a screenshot of each feature, is at **https://winuxnomacs.github.io/webodm-tweakui/**.

Each user has their own TweakUI settings: the **TweakUI** item near the bottom of WebODM's side menu, just above
About, opens them. A change is saved as soon as it is made and applies from the next page. Beside each feature in
the settings is a screenshot of it; a click shows it full size. Every feature but the themes is off until turned on.

- [**General**](https://winuxnomacs.github.io/webodm-tweakui/general): the Task Options dialog counts each group's options that are not at their default
  (Show Modified Options); a task's details on the Dashboard show when it started and finished, its preset, its
  options as bubbles, its ODX command and, while it runs, its current step (Enhanced Task Details).
- [**Themes**](https://winuxnomacs.github.io/webodm-tweakui/themes): your own colours for WebODM, WebODM's theme or one of 11 presets (Catppuccin,
  Solarized, Dracula, Nord, Gruvbox, One Dark), and a theme menu in the header.
- [**2D Map**](https://winuxnomacs.github.io/webodm-tweakui/map-2d): panels dragged anywhere within the map (Movable Controls), the project's other tasks'
  orthophotos over the task's own (Other Tasks), the task's photos that show a clicked spot (Source Frames), and 3
  more zoom steps (Zoom Override).
- [**3D Map**](https://winuxnomacs.github.io/webodm-tweakui/map-3d): Source Frames on the model, and a wheel that zooms toward what is under the pointer
  (Zoom Override).
- [**Storage**](https://winuxnomacs.github.io/webodm-tweakui/storage): what your projects and tasks take of your quota, each task's files by kind, and
  compacting or deleting them; administrators see every user's.

## Requirements

WebODM 3.3.2 or later (tested on 3.3.2 and 4.0.0).

## Installing

Once released: in WebODM, Administration > Plugins, install TweakUI from the plugin directory, or upload
`tweakui-X.Y.Z.zip` from this repository's releases.

## Outside services

None: the plugin calls no outside service. It keeps each user's settings, including their theme, in WebODM's
database, in the plugin's per-user data store.

## Developing

See [CLAUDE.md](CLAUDE.md) for the dev environment (`dev/webodm.sh`), tests and the release steps, and the
documentation's [Developing](https://winuxnomacs.github.io/webodm-tweakui/developing) page. The features' screenshots in `tweakui/public/previews/` (the
settings page's previews and the documentation's images) are retaken from a running WebODM with
`TW_USER=... TW_PASSWORD=... npm run screenshots` (`dev/screenshots.js`). The documentation is `docs/`
(VitePress): `npm run docs:dev` to work on it, `npm run docs:build` to build it; `.github/workflows/docs.yml`
publishes it to GitHub Pages on a release tag or by hand.

## License

AGPL-3.0, see [LICENSE](LICENSE).
