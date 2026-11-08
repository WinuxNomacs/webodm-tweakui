# Adding a Tweak

A tweak is a small change to WebODM's interface that each user turns on in TweakUI's settings. This page walks
through adding one, from its setting to its pull request. The [Developing](./developing) page covers the dev
servers. Pull requests are welcome; discussion happens on the pull request.

## The rules

TweakUI follows WebODM's [plugin guide](https://docs.webodm.org/plugin-development-guide), and a few rules of its
own:

- **Use only WebODM's extension points.** That means the plugin hooks of `app/plugins/plugin_base.py` and the
  `PluginsAPI` hooks in `app/static/app/js/classes/plugins/`. Never change WebODM itself. Where no hook fits, a
  script may look for WebODM's elements on the page, but it lists them (see below).
- **Off by default**, so that updating TweakUI never changes what anyone sees. A tweak that has to be on by default
  says why in its pull request.
- **No hard-coded colours.** Use WebODM's theme classes and variables (`theme-background-highlight`, `theme-border`,
  ...), so your tweak follows every theme.
- **Plain ES5 scripts with no build step.** A contributor needs no bundler. Python may use only modules in WebODM's
  `requirements.txt`, and must run on WebODM 3.3.2 (Python 3.9, Django 2.2) and 4.0.0 (Python 3.14, Django 5.2).
- **Look like WebODM and work on a phone.** Names in the interface use Title Case ("Scale Bar"); descriptions and
  messages are sentences.

## The files

| What | Where |
| --- | --- |
| The setting: name, default, label, description, preview, scripts | `tweakui/features.py` |
| The script | `tweakui/public/<name>.js` |
| Its styles, if any | its own section of `tweakui/public/main.css` |
| Its tests | `tweakui/public/__tests__/<name>.test.js` (Jest); `tweakui/tests/test_tweakui.py` for Python |
| Its screenshot | an entry in `dev/screenshots.js`, which writes `tweakui/public/previews/<preview>.webp` |
| Its documentation | its settings category's page in `docs/`, a line in `CHANGELOG.md`, and the README's summary when it changes |

`features.py` is the one list of settings. The defaults, the checkbox on the settings page and the script tags on
every WebODM page all come from it, so there is no second list to keep in step.

## A worked example: Scale Bar

The example adds a scale bar to the 2D map. WebODM's map is Leaflet, which has a scale control; the tweak adds it
through WebODM's map hook.

### 1. Declare the setting

In `tweakui/features.py`, add it to its category and group, here 2D Map > Controls:

```python
Setting("scale_bar", False, _("Scale Bar"),
        _("A scale bar in the bottom left corner of the map, in metres and in feet."),
        preview="scale-bar", scripts=["scale_bar.js"]),
```

The default is `False` (off). `preview` names the screenshot shown beside the setting; leave it out until the
screenshot exists, because a test checks that the file is there. `scripts` lists the files in `tweakui/public/`
that the setting needs, in load order. A script that several settings share loads once.

The settings page now has the checkbox. It saves to `/api/plugins/tweakui/settings`, and every page has the value
as `window.TweakUI.settings.scale_bar`.

`parts` lists settings shown under this one and greyed out while it is off; a part may have parts of its own. A
setting can also be a whole number: give it a whole-number default and `number=(minimum, maximum, step)`, with
`unit` for the word after it (Hide Delay: `Setting("auto_hide_delay", 500, ..., number=(200, 3000, 100),
unit=_("ms"))`). The settings page shows the label with the default after it ("Hide Delay (Default: 500 ms)"), a
slider moving in those steps and a box beside it that takes any whole number in the range, and the API refuses a value outside it.

A setting that superusers should be able to withhold from users also gets `admin_label` and `admin_help`: its
checkbox and description on Administration > TweakUI (`access.py`). Withheld, the setting is off for users
(`settings.load`), greyed on their settings page and refused by the settings API. A page or an API of the feature's
own checks `access.is_withheld(user, name)`, or uses the API's `Available` permission with `feature = "<name>"`.

### 2. Write the script

`tweakui/public/scale_bar.js`:

```js
// 2D Map > Controls > Scale Bar: a scale bar in the bottom left corner of the 2D map, in metres and in feet.
// UMD, so Jest can load it.
(function (root, factory) {
    var node = typeof module === "object" && module.exports;
    var api = factory(node ? require("./core") : root.TweakUI);
    if (node) module.exports = api;
    else if (root.document) root.TweakUI.feature(root, "scale_bar", api.start);
})(typeof window !== "undefined" ? window : this, function (ui) {
    "use strict";

    // The WebODM elements it relies on, to check against a new WebODM: none (the map comes through the map hook)
    var SELECTORS = {};
    var NAME = "scale_bar";

    // Adds Leaflet's scale control to a map; returns it
    function add(L, map) {
        return L.control.scale({position: "bottomleft", metric: true, imperial: true}).addTo(map);
    }

    function start(doc, win) {
        var P = win.PluginsAPI;
        if (!ui.settingsOf(win).scale_bar || !P || !P.Map || !P.Map.didAddControls) return;
        // Runs inside WebODM's map code: guarded, so an error here can't break the map
        P.Map.didAddControls(["leaflet"], ui.guard(NAME, function (args, L) {
            if (args && args.map) add(L, args.map);
        }));
    }

    return {start: start, add: add, SELECTORS: SELECTORS};
});
```

Every script follows the same pattern:

- **The wrapper at the top** loads the script in the browser and in Jest alike. In the browser,
  `TweakUI.feature(root, name, start)` starts it, and an error while it starts is logged as `TweakUI <name>:`
  without stopping the other features.
- **It returns at once when its setting is off.** All the scripts load on every page, because WebODM asks for the
  script list without knowing who is viewing the page. A tweak that is off must therefore cost nothing.
- **Every callback it gives WebODM goes through `ui.guard`.** WebODM calls a hook's callbacks inside its own code,
  so an unguarded error would break WebODM's map or task panel. The same goes for observers and for listeners on the
  whole document or window.
- **`SELECTORS` at the top** lists every WebODM element the script finds on the page (class names, ids). When WebODM
  releases a new version, this list is what gets checked: `npm run selector-check` (`dev/selector-check.js`, with
  `TW_USER` and `TW_PASSWORD` of a dev account) opens WebODM's pages and reports each selector it doesn't find. A
  script with selectors gets a line in that file's `WHERE`, naming the page they are on; a test fails until it has
  one.

### 3. Test it

`tweakui/public/__tests__/scale_bar.test.js`, run with `npm test`:

```js
const scaleBar = require("../scale_bar");

// WebODM's map hook, as a page has it: it keeps the callback, which the test then calls as WebODM would
function page(settings) {
    const hook = {};
    const win = {TweakUI: {settings}, PluginsAPI: {Map: {didAddControls: (deps, cb) => { hook.deps = deps; hook.cb = cb; }}}};
    return {win, hook};
}

test("turned on, the map gets a scale bar in its bottom left corner, in metres and feet", () => {
    const {win, hook} = page({scale_bar: true});
    scaleBar.start(document, win);
    const control = {addTo: jest.fn()};
    const L = {control: {scale: jest.fn(() => control)}};
    const map = {};
    hook.cb({map}, L);
    expect(hook.deps).toEqual(["leaflet"]);
    expect(L.control.scale).toHaveBeenCalledWith({position: "bottomleft", metric: true, imperial: true});
    expect(control.addTo).toHaveBeenCalledWith(map);
});

test("turned off, it doesn't hook into the map", () => {
    const {win, hook} = page({scale_bar: false});
    scaleBar.start(document, win);
    expect(hook.cb).toBeUndefined();
});

test("an error while adding it is logged, not thrown into WebODM's map", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const {win, hook} = page({scale_bar: true});
    scaleBar.start(document, win);
    expect(() => hook.cb({map: {}}, {control: {}})).not.toThrow();
    expect(console.error.mock.calls[0][0]).toBe("TweakUI scale_bar:");
});
```

Name tests as sentences that describe the behaviour. The Django tests in `TestFeatures` check the new setting
without any change on your part: that it is declared once, is off, has a description and a checkbox, and that its
scripts and preview exist. One change is yours: add the setting and its default to `defaults()` at the top of
`tweakui/tests/test_tweakui.py`, which lists every setting on purpose. The settings API's tests compare a user's
whole settings with it, so they fail until the new one is there.

### 4. Try it in WebODM

Start a dev server (`dev/webodm.sh up`, then `localhost:8005` in a browser), turn on TweakUI > 2D Map > Scale Bar, and open a
task's map. The dev server mounts `tweakui/` directly, so changes to scripts show on reload. It reloads Python
changes such as `features.py` by itself. Check the browser console for errors, at desktop and phone widths, and in
a dark theme if your tweak has colours.

### 5. Screenshot and documentation

- Add an entry to `SHOTS` in `dev/screenshots.js` that turns the setting on, opens the page and returns the element
  to capture. Then run `TW_USER=... TW_PASSWORD=... npm run screenshots -- scale-bar` and add `preview="scale-bar"`
  to the setting.
- Describe the tweak on its category's page in `docs/`, here `docs/map-2d.md`, with its screenshot. Add a line under
  "Unreleased" in `CHANGELOG.md`.

## The helpers

`tweakui/public/core.js` loads on every page before the features. In the browser its helpers are on
`window.TweakUI`; in a script they come in as `ui`.

| Helper | What it does |
| --- | --- |
| `feature(win, name, start, {when, ready})` | Starts a feature: at once, or once the page is parsed with `ready: true`; only when `when(settings, win)` says so, if given |
| `guard(name, fn)` | Returns `fn`, but an error in it is logged as `TweakUI <name>:` and goes no further |
| `settingsOf(win)` | The user's TweakUI settings (the defaults on a signed-out page) |
| `ready(doc, fn)` | Calls `fn` once the page is parsed |
| `el(doc, tag, className, text)` | A new element, with its text set as text (never as HTML) |
| `whenElement(doc, win, selector, callback)` | Calls back with the element once it is on the page |
| `sideItem(doc, href)`, `sideLink(doc, label, href, icon)` | Finds a side-menu item; builds one shaped like WebODM's |
| `placeMenu(doc, win, menu, label, {before, sideBefore})` | Puts a dropdown in the header, or in the side menu on WebODM's Windows app, which has no header |
| `csrfToken(doc)` | The token WebODM's API wants with a POST, PATCH or DELETE |
| `saveSettings(doc, win, changes, fetchFn)` | Saves some of the user's settings (`{name: value}`); a promise of the saved settings, refused with the reason |
| `wholeNumber(text, min, max)` | A number setting's box: its whole number when in range, else what it should be (a message) |
| `copyText(text, doc, win)` | Copies text to the clipboard (a promise) |

`tweakui/public/pick3d.js` adds two helpers for the 3D view: `whenViewer` (the Potree viewer once the page has it)
and `pick` (the point under the pointer).

## WebODM's hooks

These are the `PluginsAPI` hooks a script can use (`app/static/app/js/classes/plugins/` in WebODM):

- `App.ready`
- `Dashboard`:
  - `addTaskActionButton`: called with each task as its panel opens.
  - `addNewTaskPanelItem`, `addNewTaskButton`, `addImportTaskItem`.
  - `presetDialogOptionsReady`: the Task Options dialog's fields.
- `Map`:
  - `willAddControls`, `didAddControls`: the Leaflet map and its layers.
  - `addActionButton`.
  - `handleClick`, `mapTypeChanged`, `sideBySideChanged` and the annotation events.
- `ModelView.addActionButton`
- `SharePopup.addLinkControl`

A tweak that needs something else uses page elements instead, and lists them in `SELECTORS`.

## Checks before a pull request

- `npm test` (Jest) and `npm run lint -- tweakui dev` (ESLint).
- `.venv/bin/ruff check .` (Ruff), if you changed Python.
- The Django tests in the dev container, on both WebODM versions:
  - `docker exec -w /webodm tw-webapp python manage.py test --noinput coreplugins.tweakui.tests.test_tweakui`
    (4.0.0).
  - The same in `tw3-webapp` (3.3.2, started with `TW_WEBODM=3.3.2 dev/webodm.sh up`).
- `npm run docs:build`, if you changed the documentation.
- Your tweak, tried in WebODM with its setting on and off.

In the pull request, say what the tweak does, which WebODM pages it touches, and what you checked.
