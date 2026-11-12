# split.js

The divider TweakUI's Ortho Overlays comparison uses (`other_tasks.js`): a line and a round handle on a Leaflet map that
shows layers on one side of it, upright or across. `split.js` and `split.css` are copied unchanged from the DJI
Thermal Analyzer plugin (https://github.com/WinuxNomacs/webodm-dji-thermal, `dji-thermal/public/`, AGPL-3.0, the same
author), commit `c012b46`, and its tests are `public/__tests__/split.test.js`. Both plugins load their own copy, which
share `window.SplitDivider` and the `.split-divider` classes, so the copies stay identical: a change is made there
first, then copied here with its commit.
