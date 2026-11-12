---
name: release-check
description: Check a release of the TweakUI plugin before merging its release/X.Y.Z branch - build the zip, install it in WebODM through Administration > Plugins as a user would (and on WebODM's Windows app), and check it live.
---

# Release check

On the `release/X.Y.Z` branch, with the version in `tweakui/manifest.json`, `CHANGELOG.md` and `README.md` updated
and committed.

1. **The tests** (the `test` skill), including WebODM's `app.tests.test_plugins`, on 4.0.0 and 3.3.2.
   **The selector check** on each stack: `TW_USER=... TW_PASSWORD=... npm run selector-check` (and `TW_BASE=
   http://localhost:8006` for 3.3.2). Every selector found, exit 0; a missing one means that feature's script needs
   updating for that WebODM, and a CHANGED Leaflet that `map_tiles.js`'s overrides need checking. Run it too when WebODM releases a new version, against a stack of that version.
2. **The zip:** `dev/package.sh`. Check its listing: one root folder `tweakui/` with `manifest.json`, `plugin.py`,
   `LICENSE`; no `tests/`, `public/__tests__/`, `node_modules` or `__pycache__`. Note the sha256.
3. **WebODM without the mounted plugin:** `TW_PLUGIN_DIR=<an empty folder in the scratchpad> dev/webodm.sh up
   --force-recreate webapp worker` (4.0.0), and wait for http://localhost:8005 to answer. TweakUI's changes are gone.
   WebODM logs "Cleaned [tweakui] plugin from database": only its row in the plugin list, not its data stores
   (users' settings and themes are kept). Ask the user first: this restarts their 4.0.0 stack.
   If `/webodm/app/media/plugins/tweakui` exists (the mounted copy's Tile Cache keeps its tiles there), the upload
   is refused ("already exist"): WebODM installs an uploaded plugin in that folder. Move it aside in `tw-webapp`
   (`mv /webodm/app/media/plugins/tweakui /webodm/app/media/tweakui-tilecache-aside`) and back after step 6.
4. **Install the zip as a user would:** log in as the dev admin (the `live-check` skill), Administration >
   Plugins, upload the zip (only the plugin directory sends a sha256 for WebODM to check). Restart the webapp if WebODM asks to.
5. **Live check on the installed copy** (the `live-check` skill): every feature in the README. Expected: a 404 for a
   thermal task's thumbnail on the Dashboard (WebODM's own) and a POST to a task's `3d/scene` (WebODM's 3D view saves its
   view when it changes).
6. **Leave it as found:** remove the installed plugin in Administration > Plugins, then
   `dev/webodm.sh up --force-recreate webapp worker` without `TW_PLUGIN_DIR` to mount `tweakui/` again.

7. **WebODM's Windows app**, if the user runs it (ask): start the relay (the `live-check` skill), open `/`, then
   upgrade TweakUI with the zip as the plugin directory's Update does: a POST of the zip to
   `/admin/app/plugin/actions/upload/` with the fields `upgrade=1`, `json=1` and the page's CSRF token (Load Plugin
   refuses a plugin already installed). Ask the user to restart WebODM, then check that Administration > Plugins lists
   the new version and check live what differs there (the `live-check` skill). Leave the new version
   installed; stop the relay by its PID.

Then merge the release branch into `main` and tell the user: the zip and its sha256, the tag to make
(`vX.Y.Z`), where to attach the zip (the GitHub release), and the `directory.json` entry for WebODM-Plugins.
