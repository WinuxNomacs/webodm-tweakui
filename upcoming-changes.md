# Upcoming changes

## Phases (current and upcoming)

**Up next**
1. **First features** — the user writes the UI enhancements they want in `new.md`; each is planned here (what it
   changes, on which page and panel, which WebODM hook or extension point it uses) before it is built. A feature
   that needs a hook WebODM lacks is reported to the user; a WebODM pull request only with their approval.

**Later**
(nothing planned)

**Done**
- **Phase 0: scaffold** — 2026-11-06, branch `scaffold`. Decided (the user, 2026-11-06): id and folder `tweakui`,
  name "TweakUI"; WebODM 3.3.2 and 4.0.0 both; changes to WebODM itself only with the user's approval.
  - Plugin: `tweakui/` (manifest 0.1.0, experimental; `plugin.py` includes `public/main.js`, which sets
    `html.tweakui`, and `public/main.css`, empty). Tests: `tweakui/tests/test_tweakui.py`,
    `tweakui/public/__tests__/main.test.js`.
  - Dev tooling copied from webodm-geojson and renamed: `dev/webodm.sh` (4.0.0 on :8005 `tw-*`, 3.3.2 on :8006
    `tw3-*`, images pinned by digest), `dev/compose.yml`, `dev/package.sh`, ESLint, Ruff, Jest,
    `.claude/skills/{test,live-check,release-check}`.
  - Checked: Ruff, ESLint, Jest 1; Django `test_tweakui` (4) and `app.tests.test_plugins` (5) on 4.0.0 and
    3.3.2; headless browser on :8005 and :8006 (welcome page, no account yet): `main.js`/`main.css` load, `html.tweakui` set.
  - Checkouts: `ignored/WebODM` at `v4.0.0` (was `master`), worktree `ignored/WebODM-3.3.2`, `ignored/WebODM-Docs`.
