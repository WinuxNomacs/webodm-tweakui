# TweakUI for WebODM

A [WebODM](https://github.com/WebODM/WebODM) plugin of small enhancements to WebODM's interface. It works through
WebODM's plugin system only: it changes nothing in WebODM itself and can be turned off at any time in
Administration > Plugins.

**Status: experimental.**

## Features

Each user has their own TweakUI settings: the **TweakUI** item in WebODM's side menu opens them. The settings page
has a navigation pane of categories on the left (above the settings on a phone); it opens on **General**. A
change is saved as soon as it is made and applies from the next page.

### General

- **Task Options > Show Modified Options** (off by default): in the Task Options dialog (a new task's Options >
  Edit, or a task's Edit), each group heading shows how many of its options are not at ODM's default, out of how
  many it has: "Input & Preprocessing (1/13)" once ignore-gsd is enabled. The count follows your changes,
  including "Reset to default". A preset's own settings count too (the Default preset sets auto-boundary and
  dsm). Only in the grouped view; "Other Options" is counted while it is open.

## Requirements

WebODM 3.3.2 or later (tested on 3.3.2 and 4.0.0).

## Installing

Once released: in WebODM, Administration > Plugins, install TweakUI from the plugin directory, or upload
`tweakui-X.Y.Z.zip` from this repository's releases.

## Outside services

None: the plugin calls no outside service. It keeps each user's settings in WebODM's database, in the plugin's
per-user data store.

## Developing

See [CLAUDE.md](CLAUDE.md) for the dev environment (`dev/webodm.sh`), tests and the release steps.

## License

AGPL-3.0, see [LICENSE](LICENSE).
