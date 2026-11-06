# Developing

The plugin is the `tweakui/` folder of the [repository](https://github.com/WinuxNomacs/webodm-tweakui); the tools
around it (the dev servers, tests, screenshots, this site) stay outside it. It uses only WebODM's plugin system:
the extension points of `app/plugins/plugin_base.py` and the `PluginsAPI` hooks. The repository's `CLAUDE.md`
describes the dev environment, the tests and the release steps.

## Dev servers

`dev/webodm.sh up` runs WebODM 4.0.0 in dev mode on `localhost:8005` with `tweakui/` mounted as one of its
plugins; `TW_WEBODM=3.3.2 dev/webodm.sh up` runs 3.3.2 on `localhost:8006`. The first start takes several
minutes (WebODM's own npm install, webpack and migrations).

## Checks

- Django tests, in the dev container:
  `docker exec -w /webodm tw-webapp python manage.py test --noinput coreplugins.tweakui.tests.test_tweakui`
  (and the same in `tw3-webapp` for 3.3.2).
- `npm test` (Jest), `npm run lint -- tweakui dev` (ESLint), `ruff check .`.

## Screenshots

The features' screenshots in `tweakui/public/previews/` are both the settings page's previews and this site's
images. `TW_USER=... TW_PASSWORD=... npm run screenshots [-- name ...]` (`dev/screenshots.js`) retakes them from
a running WebODM with a user's own data, which it only reads; it puts the user's TweakUI settings back afterwards.

## This site

`npm run docs:dev` serves it locally with live reload; `npm run docs:build` builds it into `docs/.vitepress/dist`.
It is published to GitHub Pages for each release.
