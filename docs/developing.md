# Developing

The plugin is the `tweakui/` folder of the [repository](https://github.com/WinuxNomacs/webodm-tweakui); the tools
around it (the dev servers, tests, screenshots, this site) stay outside it. It uses only WebODM's plugin system:
the extension points of `app/plugins/plugin_base.py` and the `PluginsAPI` hooks. The repository's `CLAUDE.md`
describes the dev environment, the tests and the release steps. To add a tweak of your own, see
[Adding a Tweak](./adding-a-tweak); pull requests are welcome.

## Dev servers

`dev/webodm.sh up` runs WebODM 4.0.0 in dev mode on `localhost:8005` with `tweakui/` mounted as one of its
plugins; `TW_WEBODM=3.3.2 dev/webodm.sh up` runs 3.3.2 on `localhost:8006`. The first start takes several
minutes (WebODM's own npm install, webpack and migrations).

## WebODM's Windows app

TweakUI is also checked on WebODM's native Windows app, which differs from the Docker builds in a few ways the
plugin handles: it hides WebODM's header (desktop mode), so the Theme and Units menus go in the side menu; it logs
in by itself (single-user mode), so a check opens `/` first; it reads files in the system's encoding unless told
otherwise, so the plugin opens them as UTF-8; and it runs ODX with `run.bat` rather than docker.

From WSL, `node dev/windows-relay.js` makes it reachable on `localhost:8007`: the app listens only on Windows' own
`127.0.0.1:29800`, out of WSL's reach, and the relay pipes each connection through the app's own `python.exe`.
Nothing is installed or changed on Windows. `TW_WIN_PORT`, `TW_WIN_TARGET` and `TW_WIN_PYTHON` change the port,
the app's port and its `python.exe` for an install elsewhere.

The plugin is installed there from the zip, as a user would. A newer zip goes in as an upgrade (the plugin
directory's Update, or a POST of the zip to `/admin/app/plugin/actions/upload/` with `upgrade=1`); WebODM must then
be restarted for changes to Python code and templates.

## Checks

- Django tests, in the dev container:
  `docker exec -w /webodm tw-webapp python manage.py test --noinput coreplugins.tweakui.tests.test_tweakui`
  (and the same in `tw3-webapp` for 3.3.2).
- `npm test` (Jest), `npm run lint -- tweakui dev` (ESLint), `.venv/bin/ruff check .` (Ruff).
- `TW_USER=... TW_PASSWORD=... npm run selector-check` (`dev/selector-check.js`): opens a running WebODM's Dashboard,
  Task Options dialog, 2D map and 3D view and reports each element in the scripts' `SELECTORS` it doesn't find. Run it
  against a new WebODM version before saying TweakUI works there. It reads the user's first completed task; with
  none, it processes WebODM's own test images in a project of its own and deletes it afterwards.

## Screenshots

The features' screenshots in `tweakui/public/previews/` are both the settings page's previews and this site's
images. `TW_USER=... TW_PASSWORD=... npm run screenshots [-- name ...]` (`dev/screenshots.js`) retakes them from
a running WebODM with a user's own data, which it only reads; it puts the user's TweakUI settings back afterwards.

## This site

`npm run docs:dev` serves it locally with live reload; `npm run docs:build` builds it into `docs/.vitepress/dist`.
It is published to GitHub Pages for each release.
