"""
Settings > Themes: preset colour schemes, the published themes and the user's own (custom_themes), and /plugins/tweakui/theme.css,
which applies the user's theme.

A preset (or an own theme) fills the 13 colours of WebODM's own theme (app/models/theme.py) and changes nothing else: the CSS is
WebODM's theme template (app/templates/app/theme.css) rendered with the preset's colours, so it follows whatever
each WebODM version themes. Places where WebODM hard-codes a white background keep it.
"""
import re
from types import SimpleNamespace

from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils.translation import gettext as _

from . import custom_themes, settings

DEFAULT = "webodm"

# WebODM's theme fields, in the order of Administration > Theme
FIELDS = ("primary", "secondary", "tertiary", "button_primary", "button_default", "button_danger",
          "header_background", "header_primary", "border", "highlight", "dialog_warning", "failed", "success")


def _luminance(color):
    r, g, b = (int(color[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _mix(color, background, amount):
    """color laid over background at the given opacity (0..1), as #rrggbb"""
    a = [int(color[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(background[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join("%02x" % round(x * amount + y * (1 - amount)) for x, y in zip(a, b))


def _preset(name, text, base, panel, header, border, link, button, muted, red, yellow, green):
    """A preset from a scheme's palette: buttons show their label in the base colour (as WebODM's theme does), the
    header's text is the text or base colour, whichever stands out more on it, and failed and success notifications
    are the base tinted with red and green, so the text stays readable."""
    return {
        "name": name,
        "colors": {
            "primary": text, "secondary": base, "tertiary": link,
            "button_primary": button, "button_default": muted, "button_danger": red,
            "header_background": header,
            "header_primary": max(text, base, key=lambda c: abs(_luminance(c) - _luminance(header))),
            "border": border, "highlight": panel, "dialog_warning": yellow,
            "failed": _mix(red, base, 0.25), "success": _mix(green, base, 0.25),
        },
    }


# Each scheme's published palette (text, base, panel, header, border, link, button, muted, red, yellow, green).
# The order is the one of the Themes list. WebODM's logo in the header is white, so light schemes have a header in
# their accent colour.
PRESETS = {
    "catppuccin-latte": _preset("Catppuccin Latte", "#4c4f69", "#eff1f5", "#e6e9ef", "#1e66f5", "#ccd0da",
                                "#1e66f5", "#1e66f5", "#8c8fa1", "#d20f39", "#fe640b", "#40a02b"),
    "catppuccin-frappe": _preset("Catppuccin Frappé", "#c6d0f5", "#303446", "#292c3c", "#232634", "#414559",
                                 "#8caaee", "#8caaee", "#838ba7", "#e78284", "#ef9f76", "#a6d189"),
    "catppuccin-macchiato": _preset("Catppuccin Macchiato", "#cad3f5", "#24273a", "#1e2030", "#181926", "#363a4f",
                                    "#8aadf4", "#8aadf4", "#8087a2", "#ed8796", "#f5a97f", "#a6da95"),
    "catppuccin-mocha": _preset("Catppuccin Mocha", "#cdd6f4", "#1e1e2e", "#181825", "#11111b", "#313244",
                                "#89b4fa", "#89b4fa", "#7f849c", "#f38ba8", "#fab387", "#a6e3a1"),
    "solarized-light": _preset("Solarized Light", "#586e75", "#fdf6e3", "#eee8d5", "#268bd2", "#e4ddc8",
                               "#268bd2", "#268bd2", "#93a1a1", "#dc322f", "#cb4b16", "#859900"),
    "solarized-dark": _preset("Solarized Dark", "#93a1a1", "#002b36", "#073642", "#073642", "#0e4552",
                              "#268bd2", "#268bd2", "#586e75", "#dc322f", "#cb4b16", "#859900"),
    "dracula": _preset("Dracula", "#f8f8f2", "#282a36", "#21222c", "#191a21", "#44475a",
                       "#8be9fd", "#bd93f9", "#6272a4", "#ff5555", "#ffb86c", "#50fa7b"),
    "nord": _preset("Nord", "#eceff4", "#2e3440", "#3b4252", "#242933", "#434c5e",
                    "#88c0d0", "#88c0d0", "#4c566a", "#bf616a", "#d08770", "#a3be8c"),
    "gruvbox-dark": _preset("Gruvbox Dark", "#ebdbb2", "#282828", "#32302f", "#1d2021", "#3c3836",
                            "#83a598", "#83a598", "#928374", "#fb4934", "#fe8019", "#b8bb26"),
    "gruvbox-light": _preset("Gruvbox Light", "#3c3836", "#fbf1c7", "#f2e5bc", "#076678", "#d5c4a1",
                             "#076678", "#076678", "#928374", "#9d0006", "#af3a03", "#79740e"),
    "one-dark": _preset("One Dark", "#abb2bf", "#282c34", "#21252b", "#1b1d23", "#3e4451",
                        "#61afef", "#61afef", "#5c6370", "#e06c75", "#d19a66", "#98c379"),
}

# The colours a theme's swatch shows: background, text, links, buttons, header
SWATCH = ("secondary", "primary", "tertiary", "button_primary", "header_background")


def _hex(color, default):
    """A colour of WebODM's theme as #rrggbb: Administration > Theme also takes #rgb and #rrggbbaa"""
    color = (color or "").strip().lower()
    if re.match(r"^#[0-9a-f]{3}$", color):
        color = "#" + "".join(c * 2 for c in color[1:])
    return color[:7] if re.match(r"^#[0-9a-f]{6}", color) else default


def webodm_colors():
    """The colours of the instance's WebODM theme (Administration > Theme), or its defaults without one"""
    from app.models import Setting, Theme
    setting = Setting.objects.first()
    theme = setting.theme if setting is not None else None
    return {f: _hex(getattr(theme, f, None), Theme._meta.get_field(f).default) for f in FIELDS}


def fields():
    """WebODM's theme colours as Administration > Theme names and describes them, for the theme editor"""
    from app.models import Theme
    return [{"name": f, "label": Theme._meta.get_field(f).verbose_name, "help": Theme._meta.get_field(f).help_text}
            for f in FIELDS]


def _entry(theme_id, name, colors, group):
    return {"id": theme_id, "name": name, "group": group, "swatch": [colors[f] for f in SWATCH]}


def theme_list(user=None, with_colors=False):
    """Every theme the user can pick, in the order of the Themes list: WebODM's theme (with the colours of the
    instance's theme) and the presets ("builtin"), the published ones ("published", id "published:<id>"), then the
    user's own ("own", id "own:<id>"); each with its id, name, group and swatch colours, and with its 13 colours
    when asked (the theme editor copies them)"""
    themes = [(DEFAULT, _("WebODM's theme"), webodm_colors(), "builtin")]
    themes += [(k, v["name"], v["colors"], "builtin") for k, v in PRESETS.items()]
    if user is not None and user.is_authenticated:
        themes += [(custom_themes.PUBLISHED + t["id"], t["name"], t["colors"], "published")
                   for t in custom_themes.published()]
    themes += [(custom_themes.OWN + t["id"], t["name"], t["colors"], "own") for t in custom_themes.own(user)]
    return [dict(_entry(*t), **({"colors": t[2]} if with_colors else {})) for t in themes]


def groups(user):
    """The Themes list's groups: WebODM's theme and the presets, the published themes (only when there are any),
    then the user's own (always shown, with New theme)"""
    themes = theme_list(user)
    out = [{"id": "builtin", "title": "", "themes": [t for t in themes if t["group"] == "builtin"]},
           {"id": "published", "title": _("Published"), "themes": [t for t in themes if t["group"] == "published"]},
           {"id": "own", "title": _("My themes"), "themes": [t for t in themes if t["group"] == "own"]}]
    return [g for g in out if g["themes"] or g["id"] != "published"]


def colors_of(theme_id, user):
    """The colours of the theme the setting names (a preset, a published one or one of the user's own), or None for
    WebODM's theme or a theme that is gone"""
    if theme_id in PRESETS:
        return PRESETS[theme_id]["colors"]
    theme = None
    if theme_id.startswith(custom_themes.OWN):
        theme = custom_themes.find(user, theme_id[len(custom_themes.OWN):])
    elif theme_id.startswith(custom_themes.PUBLISHED):
        theme = custom_themes.find_published(theme_id[len(custom_themes.PUBLISHED):])
    return theme["colors"] if theme else None


# WebODM's places that hard-code a white background but take the page's text colour (the theme's primary); with a
# dark preset they get its darker colour, so they look as with WebODM's default theme. Administration
# (.admin-area) is one of them, and also keeps the colours WebODM's theme gives its own variables (KEEP_WEBODM).
WHITE_PANELS = (
    ".admin-area",
    ".leaflet-control-layers-control .layers-control-panel",
    ".leaflet-control-contours .contours-panel",
    ".leaflet-control-objdetect .objdetect-panel",
)


# Rules of WebODM's theme a preset leaves out, so WebODM's own theme applies there
KEEP_WEBODM = (".admin-area",)


def _prefix_selectors(css):
    """Prefixes every selector with "html ", so the rules win over WebODM's own theme (inlined later in the page,
    with the same selectors); @keyframes are left out, as WebODM's theme already defines them, and so are the
    rules of KEEP_WEBODM"""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
    out, i = [], 0
    while True:
        start = css.find("{", i)
        if start < 0:
            break
        head = css[i:start].strip()
        depth, end = 1, start + 1
        while depth and end < len(css):
            depth += {"{": 1, "}": -1}.get(css[end], 0)
            end += 1
        body = css[start + 1:end - 1]
        if head.startswith(("@media", "@supports")):
            out.append("%s{\n%s}\n" % (head, _prefix_selectors(body)))
        elif head and not head.startswith("@") and head not in KEEP_WEBODM:
            selectors = ",\n".join("html " + s.strip() for s in head.split(",") if s.strip())
            out.append("%s{%s}\n" % (selectors, body))
        i = end
    return "".join(out)


def preset_css(preset_id):
    return colors_css(PRESETS[preset_id]["colors"])


def colors_css(colors):
    """The stylesheet for a theme's 13 colours (checked #rrggbb): WebODM's theme with them, then the white panels'
    text colour and the dropdown menus' text"""
    context = {"SETTINGS": SimpleNamespace(theme=SimpleNamespace(**colors))}
    css = _prefix_selectors(render_to_string("app/theme.css", context))
    dark = min(colors["primary"], colors["secondary"], key=_luminance)
    css += "html %s{color: %s;}\n" % (",\nhtml ".join(WHITE_PANELS), dark)
    # WebODM's theme gives the dropdown menus' items its text colour, but WebODM's main.scss sets them to #222
    # !important, which would be dark on a dark preset's menu background: give them the theme's text colour
    css += "html .dropdown-menu > li > a{color: %s !important;}\n" % colors["primary"]
    return css


def theme_css(request):
    """/plugins/tweakui/theme.css, on every page: the logged-in user's theme, or nothing for WebODM's theme"""
    theme = settings.load(request.user)["theme"]
    colors = colors_of(theme, request.user)
    css = colors_css(colors) if colors else ""
    response = HttpResponse("/* TweakUI theme: %s */\n%s" % (theme, css), content_type="text/css; charset=utf-8")
    response["Cache-Control"] = "no-store"
    return response
