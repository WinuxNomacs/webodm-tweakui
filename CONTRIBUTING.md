# Contributing to TweakUI

Pull requests are welcome, from a fix to a whole new tweak, and there's no need to open an issue first. Discussion
happens on the pull request.

To add a tweak, follow the documentation's
[Adding a Tweak](https://winuxnomacs.github.io/webodm-tweakui/adding-a-tweak) page (`docs/adding-a-tweak.md` in this
repository). It covers the files, a worked example, the shared helpers and the checks. In short:

- Declare the setting once in `tweakui/features.py`, **off by default**.
- Write one plain ES5 script in `tweakui/public/` on the helpers of `core.js`: start it with `TweakUI.feature`, wrap
  every callback it gives WebODM in `TweakUI.guard`, and list the WebODM elements it relies on in `SELECTORS`.
- Use only WebODM's plugin extension points, never a change to WebODM itself. Use WebODM's theme classes, never
  hard-coded colours.
- Add tests, a screenshot, its documentation page and a line in `CHANGELOG.md`.
- Before sending it, run `npm test`, `npm run lint -- tweakui dev`, `.venv/bin/ruff check .` and the Django tests on
  WebODM 3.3.2 and 4.0.0. The [Developing](https://winuxnomacs.github.io/webodm-tweakui/developing) page covers the
  dev servers.

In the pull request, say what the change does, which WebODM pages it touches, and what you checked.

By contributing, you agree that your contribution is licensed under the project's licence, the
[GNU AGPL v3](LICENSE).
