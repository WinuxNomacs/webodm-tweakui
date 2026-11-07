# CLAUDE.md

What Claude needs to know to work on TweakUI, a WebODM plugin of interface enhancements. General working rules
(branches, phases, testing) live in the user's own CLAUDE.md; this file holds what is specific to this repository.
It is committed and public: nothing private, nothing true only on one machine. Keep it short; edit in place.

## Rules for this repository

- **The plugin is `tweakui/`**: the released zip has that folder as its single root. Dev tools (`dev/`,
  `package.json`, `eslint.config.mjs`, `ruff.toml`, `requirements-dev.txt`) stay outside it.
- **Official plugin rules only**: the guide (https://docs.webodm.org/plugin-development-guide, also
  `ignored/WebODM-Docs`) and `ignored/WebODM-Plugins/guidance/index.md`:
  - Extension points are only those of `app/plugins/plugin_base.py` (`include_js_files`, `include_css_files`,
    `build_jsx_components`, `main_menu`, `app_mount_points`, `api_mount_points`, data stores,
    `get_dynamic_script`) and the `PluginsAPI` hooks in `app/static/app/js/classes/plugins/` (`App.ready`,
    `Dashboard.*`, `Map.*`, `ModelView.addActionButton`, `SharePopup.addLinkControl`, `Workers.*`). No Django
    models or migrations (data goes in the plugin's data stores).
  - **No changes to WebODM itself.** A feature that needs a hook WebODM lacks is reported to the user first;
    a pull request to WebODM is made only after the user approves that specific change.
  - No hard-coded colours: WebODM's theme variables (`app/templates/app/theme.css`). Look like the rest of
    WebODM, work on mobile, vanilla code over libraries (Python modules only from WebODM's `requirements.txt`),
    async work through `run_function_async` (`app/plugins/worker.py`).
  - The manifest says `"experimental": true` until the user decides otherwise; licence AGPL-3.0.
  - The guide's "no tests unless asked" does not apply: the user's rules ask for tests.
- **WebODM 3.3.2 and 4.0.0 both**: 3.3.2 is Python 3.9, Django 2.2, DRF 3.13, Postgres 9.5 with PostGIS; 4.0.0 is
  Python 3.14, Django 5.2, DRF 3.18, Postgres 18 without GIS. The plugin's code runs unchanged on both: Ruff
  targets py39 (the oldest), and every change is tested on both stacks before a merge.
- **Never push and never tag.** A pushed `v*` tag publishes the docs site (`.github/workflows/docs.yml`, which
  also runs by hand); no other workflow runs. A release: Claude prepares a `release/X.Y.Z` branch (manifest
  version, `CHANGELOG.md`, `README.md`, `docs/`), builds the zip with `dev/package.sh`
  (`dist/tweakui-X.Y.Z.zip` and its sha256), runs the `release-check` skill and merges; the user tags `vX.Y.Z`,
  attaches the zip to the GitHub release and adds `{url, sha256}` to WebODM-Plugins' `directory.json`.
- **Settings are per user**: a new setting is a name and default in `DEFAULTS` (`tweakui/settings.py`), a control
  with `data-setting` in its category's section of `templates/settings.html` (a new category: a link in the
  navigation pane and a `<section data-section>`), and reads `window.TweakUI.settings` in the page scripts:
  `/plugins/tweakui/settings.js` is a view, loaded before the other scripts on every page.
- **`README.md` is the plugin's overview, `docs/` its documentation** (VitePress, a page per settings category,
  published to GitHub Pages by `.github/workflows/docs.yml` on a `v*` tag or by hand): a feature change updates
  its docs page, the README's one-line summary if it changes, and retakes its screenshot (`npm run screenshots`),
  on the same branch.
- **Names in the UI are in Title Case**: headings, buttons, menu items and setting names ("My Themes", "New Theme",
  "Show Modified Options"); descriptions and messages are sentences.
- Planned in `upcoming-changes.md`; new requests arrive in `new.md` (untracked).

## Dev environment

- `ignored/WebODM` is a checkout of https://github.com/WebODM/WebODM (ignored by git), at the commit the pinned
  image was built from (tag `v4.0.0`), and `ignored/WebODM-3.3.2` a worktree of it at `v3.3.2`
  (`git -C ignored/WebODM worktree add ../WebODM-3.3.2 v3.3.2`). The dev servers run those checkouts, so a branch
  checked out there (a PR to WebODM) is live. `ignored/WebODM-Docs` is https://github.com/WebODM/Docs and
  `ignored/WebODM-Plugins` https://github.com/WebODM/WebODM-Plugins (the directory and its guidance).
- `dev/webodm.sh up | down | logs [service] | ps` runs WebODM 4.0.0 in dev mode with `tweakui/` mounted as
  `/webodm/coreplugins/tweakui`, on http://localhost:8005, containers `tw-webapp`, `tw-worker`, `tw-db`,
  `tw-broker`, `tw-node-odx-1`, project and volumes `webodm-tweakui`, so it runs beside other WebODMs (ports
  8000–8004 are other plugins' stacks). `TW_WEBODM=3.3.2 dev/webodm.sh ...` runs 3.3.2 alike on
  http://localhost:8006, containers `tw3-*`, project and volumes `webodm-tweakui-332`. Each version's images are
  pinned by digest in `dev/webodm.sh`.
- The first start runs WebODM's dev setup (npm install, webpack, migrations) for several minutes before the server
  answers. The startup log then shows `Registered [coreplugins.tweakui.plugin]`.
- **WebODM's native Windows app** (4.0.0), when the user runs it: `node dev/windows-relay.js` makes it
  http://localhost:8007 from WSL (stop the relay by its PID afterwards). It runs in single-user mode (opening `/`
  logs in as its admin: scripts open `/` first, there is no login form) and desktop mode (no header bar: the Theme
  and Units menus go in the side menu, `window.TweakUI.desktop`). Python reads files as cp1252 there unless told
  `encoding="utf-8"`. TweakUI is installed from the zip; a newer one goes in with `upgrade=1` (the `release-check`
  skill), and the user restarts WebODM for Python and template changes: never restart it yourself. Django tests
  don't run there; the Docker 4.0.0 stack covers the same Python, Django and Postgres.
- Host tools: `uv venv --python 3.9 .venv && uv pip install -r requirements-dev.txt` (Django and DRF for the IDE,
  Ruff); `npm install` (Jest, ESLint, Playwright). VSCode: interpreter `.venv`, `ignored/WebODM` on Pylance's
  extra paths (local `.vscode/settings.json`).

## Tests and checks

The `test`, `live-check` and `release-check` skills in `.claude/skills` have the steps.

- Django: `docker exec -w /webodm tw-webapp python manage.py test --noinput coreplugins.tweakui.tests.test_tweakui`
  (4.0.0) and, before a merge, the same in `tw3-webapp` (3.3.2). One run at a time per stack: a stack's runs share
  its test database (the two stacks' are separate).
- Jest: `npm test` at the repo root (jsdom). ESLint: `npm run lint -- tweakui dev` (the scripts in `public/` are ES5).
- Screenshots: `TW_USER=... TW_PASSWORD=... npm run screenshots [-- name ...]` (`dev/screenshots.js`, the 4.0.0 dev
  server, or `TW_BASE`) retakes `tweakui/public/previews/<name>.webp`, the settings' previews and the docs' images.
  A feature change that changes what a shot shows retakes it; a new feature gets a shot in its list.
- Docs: `npm run docs:build` (fails on a dead link); `npm run docs:dev` serves them with live reload.
- Ruff: `.venv/bin/ruff check .`
- Live checks: headless Playwright (Node) against http://localhost:8005 (4.0.0) and http://localhost:8006 (3.3.2)
  with a dev account from the user. Expected console error in dev mode: `localhost:35729/livereload.js` refused
  (WebODM's pages ask for that port; these stacks map livereload to 35734/35735).
- WebODM's Django CSRF check applies to a plugin's API (WebODM routes it through a plain Django view): a POST,
  PATCH or DELETE needs the session's CSRF token even with basic or JWT authentication.
