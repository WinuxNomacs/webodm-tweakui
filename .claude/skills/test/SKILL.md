---
name: test
description: Run the TweakUI plugin's checks (Ruff, ESLint, Jest, Django tests in the dev container) before committing or merging.
---

# Tests and checks

From the repo root, with the dev stack up (`dev/webodm.sh ps`; start it with `dev/webodm.sh up`). The default
stack is WebODM 4.0.0 (`tw-webapp`, :8005); before a merge, the Django tests also run on 3.3.2
(`TW_WEBODM=3.3.2 dev/webodm.sh up`, `tw3-webapp`, :8006).

1. **Ruff** (Python 3.9 syntax, the oldest WebODM's, and lint): `.venv/bin/ruff check .`
2. **ESLint** (the ES5 scripts in `tweakui/public`): `npm run lint -- tweakui`
3. **Jest**: `npm test` (add a path or `-t "<name>"` to run fewer).
4. **Django**: `docker exec -w /webodm tw-webapp python manage.py test --noinput coreplugins.tweakui.tests.test_tweakui`.
   Before a merge, also WebODM's plugin tests: `app.tests.test_plugins`, and both again in `tw3-webapp`
   (3.3.2). Never two Django runs at once on one stack: they share its test database.
   A test run starts WebODM in test mode, which adds a `test` plugin row to the dev database; until the webapp
   restarts, Administration > Plugins fails (500). Remove the row afterwards:
   `docker exec -w /webodm tw-webapp python manage.py shell -c "from app.plugins.functions import sync_plugin_db; sync_plugin_db()"`
   (in `tw3-webapp` after a 3.3.2 run).
5. **WebODM's own Jest** (for changes to `ignored/WebODM`, which need the user's approval): `docker exec -w /webodm
   tw-webapp npx jest`. Some suites need the UI mocks first:
   `docker exec -w /webodm tw-webapp python manage.py test app.tests.test_generate_ui_mocks --noinput`.

A failure is reported with its output. Before calling one pre-existing, check whether it also fails on `main`.
