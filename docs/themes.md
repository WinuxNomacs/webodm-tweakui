# Themes

![WebODM's Dashboard in a preset theme](../tweakui/public/previews/themes.webp)

Pick your own colours for WebODM, for you only: **WebODM's theme** (the default, whatever the administrator set in
Administration > Theme) or one of 11 presets: Catppuccin Latte, Frappé, Macchiato and Mocha; Solarized Light and
Dark; Dracula; Nord; Gruvbox Dark and Light; One Dark. Each shows a swatch of its colours; choosing one reloads the
page in it.

## My themes

![The theme editor on a copy of Catppuccin Mocha](../tweakui/public/previews/theme-editor.webp)

Your own themes, listed under **My themes** below the presets, for you only. **New theme** starts one from your
current theme's colours, and **Copy** beside any theme (WebODM's, a preset or one of your own) starts one from that
theme's. Only your own themes have **Edit**: WebODM's theme and the presets can be copied but not changed.

The editor opens below the themes, with a name and the 13 colours of WebODM's theme, named and described as in
Administration > Theme. Each colour has a picker and its value as `#rrggbb`, which you can also type (the `#` is
optional). While the editor is open, the whole page, the Sample included, shows the colours as they are, before
anything is saved. **Save** keeps the theme and makes it your theme; **Cancel** puts the page back in your theme;
**Delete** (when editing) deletes the theme, after asking. If you delete the theme you're using, you're back on
WebODM's theme.

A theme needs a name of up to 60 characters, and you can have up to 50. Your themes are also in the header's theme
menu, after the presets.

## Sample

Below the themes, a **Sample** shows WebODM's controls in the current theme: text, a link and muted text, status
labels, a progress bar, a text field, a select, a dropdown menu, buttons (one with a tooltip, one disabled) and page
numbers. They do nothing; they are there to see how the theme looks on the controls the settings page doesn't
otherwise show.

A preset fills the colours of WebODM's own theme, so it changes exactly what an administrator's theme can change,
in each WebODM version. Places WebODM always shows in white keep their white background (some icons and controls
there only work on white) with readable text: the map's layers panel, the Contours and Object Detection panels,
and the content of Administration, which keeps WebODM's own theme. Light presets have a header in their accent
colour, as WebODM's logo is white. Dropdown menus show their items in the preset's text colour (WebODM fixes them
to near-black, which a dark preset's menu background would hide).

## Theme Menu > Show the theme menu in the header

On by default.

![The theme menu open in the header](../tweakui/public/previews/theme-menu.webp)

The **paintbrush** in the header, left of the user icon, is a shortcut to the same choice on every page: it opens
the list of themes, with your current theme and WebODM's theme on top, then the presets and your own themes, and choosing one switches to it. This
setting, at the top of Themes, turns it off.
