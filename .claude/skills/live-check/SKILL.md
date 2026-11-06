---
name: live-check
description: Check a UI change in a real headless browser against the plugin's dev servers (WebODM 4.0.0 on http://localhost:8005, 3.3.2 on http://localhost:8006), then remove whatever the check created. Use after building or fixing anything visible.
---

# Live browser check

## Login

The change is checked on 4.0.0 (http://localhost:8005); before a merge of anything visible, also on 3.3.2
(http://localhost:8006, `TW_WEBODM=3.3.2 dev/webodm.sh up`; stop it again if you started it).

Log in at `/login/` with the dev account the user has given for this machine (kept in the project memory, never
in the repo). Without one, ask the user. Never look for credentials or cookies in files, transcripts, the database
or the environment.

## Driving the browser

Prefer the Playwright MCP tools (`mcp__playwright__*`) when they are loaded. Otherwise, write a Node script in
the scratchpad that loads Playwright from this repo (`require('<repo>/node_modules/playwright')`), launches
Chromium with `headless: true` and a fresh profile, logs in, and saves screenshots to the scratchpad. Read the
screenshots back to look at them, and read the page's console messages.

## What to check

- The change itself, on the pages it touches (Dashboard, Map, 3D Model view, ...), at desktop and phone widths,
  in the light and the dark theme where colours are involved.
- `html.tweakui` is set and `/plugins/tweakui/main.js` and `main.css` load.
- The browser console has no new errors.

## Before and afterwards

Note what is there already: the user works on this server too. Give everything the check creates a name of its
own (e.g. starting "Live check"), delete only that afterwards, and say what was checked and what was removed.
