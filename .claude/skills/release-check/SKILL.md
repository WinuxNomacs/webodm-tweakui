---
name: release-check
description: Check a release of the TweakUI plugin before merging its release/X.Y.Z branch - build the zip, install it in WebODM through Administration > Plugins as a user would, and check it live.
---

# Release check

On the `release/X.Y.Z` branch, with the version in `tweakui/manifest.json`, `CHANGELOG.md` and `README.md` updated
and committed.

1. **The tests** (the `test` skill), including WebODM's `app.tests.test_plugins`, on 4.0.0 and 3.3.2.
2. **The zip:** `dev/package.sh`. Check its listing: one root folder `tweakui/` with `manifest.json`, `plugin.py`,
   `LICENSE`; no `tests/`, `public/__tests__/`, `node_modules` or `__pycache__`. Note the sha256.
3. **WebODM without the mounted plugin:** `TW_PLUGIN_DIR=<an empty folder in the scratchpad> dev/webodm.sh up
   --force-recreate webapp worker` (4.0.0), and wait for http://localhost:8005 to answer. TweakUI's changes are gone.
4. **Install the zip as a user would:** log in as the dev admin (the `live-check` skill), Administration >
   Plugins, upload the zip with its sha256 (WebODM checks it). Restart the webapp if WebODM asks to.
5. **Live check on the installed copy** (the `live-check` skill): every feature in the README.
6. **Leave it as found:** remove the installed plugin in Administration > Plugins, then
   `dev/webodm.sh up --force-recreate webapp worker` without `TW_PLUGIN_DIR` to mount `tweakui/` again.

Then merge the release branch into `main` and tell the user: the zip and its sha256, the tag to make
(`vX.Y.Z`), where to attach the zip (the GitHub release), and the `directory.json` entry for WebODM-Plugins.
