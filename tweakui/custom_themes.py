"""
Custom themes: each user's own themes (Settings > Themes > My Themes), a list of {id, name, colors} in their data
store, and the published themes every user sees (Administration > TweakUI Themes, superusers only), a list alike in
the plugin's global data store. Every theme written is checked here first: its colours go into CSS
(themes.colors_css).
"""
import re
import uuid

from app.plugins.data_store import GlobalDataStore

from . import settings

KEY = "themes"
PUBLISHED_KEY = "published_themes"
# The theme setting's value for one of the user's own themes: "own:<id>"; for a published one: "published:<id>"
OWN = "own:"
PUBLISHED = "published:"
MAX_THEMES = 50
MAX_NAME = 60
COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
ID = re.compile(r"^[0-9a-f]{1,32}$")


class InvalidTheme(ValueError):
    pass


class NoSuchTheme(LookupError):
    pass


def clean(data):
    """A theme's {name, colors}, checked: a name of 1 to MAX_NAME characters (trimmed) and every one of WebODM's
    theme colours as #rrggbb (lowercased); other keys are left out"""
    from .themes import FIELDS  # themes imports this module
    if not isinstance(data, dict):
        raise InvalidTheme("Expected a theme object")
    errors = []
    name = data.get("name")
    name = name.strip() if isinstance(name, str) else ""
    if not name:
        errors.append("A theme needs a name")
    elif len(name) > MAX_NAME:
        errors.append("A theme's name is at most %d characters" % MAX_NAME)
    colors = data.get("colors")
    if not isinstance(colors, dict):
        errors.append("A theme needs its colours")
    else:
        missing = [f for f in FIELDS if f not in colors]
        if missing:
            errors.append("Missing colours: %s" % ", ".join(missing))
        bad = [f for f in FIELDS if f in colors and not (isinstance(colors[f], str) and COLOR.match(colors[f]))]
        if bad:
            errors.append("Colours that are not #rrggbb: %s" % ", ".join(bad))
    if errors:
        raise InvalidTheme("; ".join(errors))
    return {"name": name, "colors": {f: colors[f].lower() for f in FIELDS}}


def _valid(theme):
    try:
        return isinstance(theme.get("id"), str) and bool(ID.match(theme["id"])) and clean(theme) is not None
    except (InvalidTheme, AttributeError):
        return False


def _read(store, key):
    """A list of themes, in the order they were made; anything saved that no longer passes the checks is left out"""
    themes = store.get_json(key, [])
    return [t for t in themes if _valid(t)] if isinstance(themes, list) else []


def own(user):
    """The user's own themes"""
    if user is None or not user.is_authenticated:
        return []
    return _read(settings.store(user), KEY)


def _find(themes, theme_id):
    for theme in themes:
        if theme["id"] == theme_id:
            return theme
    return None


def find(user, theme_id):
    return _find(own(user), theme_id)


def _save(user, themes):
    settings.store(user).set_json(KEY, themes)


def _global_store():
    return GlobalDataStore("tweakui")


def published():
    """The published themes, which every user sees and can choose"""
    return _read(_global_store(), PUBLISHED_KEY)


def find_published(theme_id):
    return _find(published(), theme_id)


def _save_published(themes):
    _global_store().set_json(PUBLISHED_KEY, themes)


def create(user, data):
    """A new theme of the user's from {name, colors}; returns it with its id"""
    theme = clean(data)
    themes = own(user)
    if len(themes) >= MAX_THEMES:
        raise InvalidTheme("At most %d themes" % MAX_THEMES)
    theme = dict(theme, id=uuid.uuid4().hex[:12])
    _save(user, themes + [theme])
    return theme


def update(user, theme_id, data):
    """The user's theme theme_id given a new name and colours; returns it"""
    theme = clean(data)
    themes = own(user)
    for i, t in enumerate(themes):
        if t["id"] == theme_id:
            themes[i] = dict(theme, id=theme_id)
            _save(user, themes)
            return themes[i]
    raise NoSuchTheme(theme_id)


def delete(user, theme_id):
    """Deletes the user's theme theme_id; a user whose theme it was gets WebODM's theme (settings.load)"""
    themes = own(user)
    kept = [t for t in themes if t["id"] != theme_id]
    if len(kept) == len(themes):
        raise NoSuchTheme(theme_id)
    _save(user, kept)


# The most entries one import takes (each is checked; at most MAX_THEMES can be kept)
MAX_IMPORT = 500


def _import(themes, data):
    """Imports {name, colors} themes, one object or a list of them, into a list of themes (changed in place): a
    theme with the name of one in it replaces its colours (it keeps its id, so a user whose theme it is keeps it),
    others are added while there is room. Returns {added: [names], replaced: [names], refused: [{index, name,
    reason}]}, index counting from 1; nothing refused is kept. A later theme of the same name replaces an earlier
    one."""
    entries = [data] if isinstance(data, dict) else data
    if not isinstance(entries, list) or not entries:
        raise InvalidTheme("Expected a theme object or a list of them")
    if len(entries) > MAX_IMPORT:
        raise InvalidTheme("At most %d themes in one import" % MAX_IMPORT)
    report = {"added": [], "replaced": [], "refused": []}
    for index, entry in enumerate(entries, 1):
        try:
            theme = clean(entry)
        except InvalidTheme as e:
            name = entry.get("name") if isinstance(entry, dict) else None
            report["refused"].append({"index": index, "name": name if isinstance(name, str) else "",
                                      "reason": str(e)})
            continue
        same = [i for i, t in enumerate(themes) if t["name"] == theme["name"]]
        if same:
            themes[same[0]] = dict(theme, id=themes[same[0]]["id"])
            if theme["name"] not in report["replaced"] + report["added"]:
                report["replaced"].append(theme["name"])
        elif len(themes) >= MAX_THEMES:
            report["refused"].append({"index": index, "name": theme["name"],
                                      "reason": "At most %d themes" % MAX_THEMES})
        else:
            themes.append(dict(theme, id=uuid.uuid4().hex[:12]))
            report["added"].append(theme["name"])
    return report


def _changed(report):
    return bool(report["added"] or report["replaced"])


def import_themes(user, data):
    """Imports themes into the user's own (_import)"""
    themes = own(user)
    report = _import(themes, data)
    if _changed(report):
        _save(user, themes)
    return report


def import_published(data):
    """Imports themes into the published ones (_import)"""
    themes = published()
    report = _import(themes, data)
    if _changed(report):
        _save_published(themes)
    return report


def publish(user, theme_id):
    """Publishes a copy of the user's own theme theme_id: it replaces a published theme of the same name (which
    keeps its id), or is added while there are fewer than MAX_THEMES. Returns the published theme and whether it
    replaced one."""
    theme = find(user, theme_id)
    if theme is None:
        raise NoSuchTheme(theme_id)
    themes = published()
    report = _import(themes, export(theme))
    if report["refused"]:
        raise InvalidTheme(report["refused"][0]["reason"])
    _save_published(themes)
    return next(t for t in themes if t["name"] == theme["name"]), bool(report["replaced"])


def delete_published(theme_id):
    """Deletes the published theme theme_id; a user whose theme it was gets WebODM's theme (settings.load)"""
    themes = published()
    kept = [t for t in themes if t["id"] != theme_id]
    if len(kept) == len(themes):
        raise NoSuchTheme(theme_id)
    _save_published(kept)


def export(theme):
    """A theme as it is exported and imported: {name, colors}"""
    return {"name": theme["name"], "colors": theme["colors"]}
