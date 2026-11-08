"""
Each user's TweakUI settings: one JSON value in the plugin's per-user data store, with a default for every setting.
"""
from app.plugins.data_store import UserDataStore

from . import features

KEY = "settings"

# Every setting with its default (features.py declares them); the type of the default is the only type the setting
# takes
DEFAULTS = features.defaults()
# A number setting's range: {name: (minimum, maximum)}
RANGES = {s.name: s.number[:2] for s in features.all_settings() if s.number}


def allowed(name, value, user=None):
    """Whether a value of the right type is one the setting takes (a setting with a list of choices); an own or a
    published theme only while it is there; a number within its range"""
    if name in RANGES:
        return RANGES[name][0] <= value <= RANGES[name][1]
    if name == "theme":
        from . import custom_themes  # both import this module
        from .themes import DEFAULT, PRESETS
        if value.startswith(custom_themes.OWN):
            return custom_themes.find(user, value[len(custom_themes.OWN):]) is not None
        if value.startswith(custom_themes.PUBLISHED):
            return custom_themes.find_published(value[len(custom_themes.PUBLISHED):]) is not None
        return value == DEFAULT or value in PRESETS
    return True


class InvalidSettings(ValueError):
    pass


def store(user):
    return UserDataStore("tweakui", user)


def saved(user):
    """The user's settings as they chose them, with the defaults for those never set (and for anonymous users)"""
    settings = dict(DEFAULTS)
    if user is not None and user.is_authenticated:
        values = store(user).get_json(KEY, {})
        if isinstance(values, dict):
            settings.update({k: v for k, v in values.items()
                             if k in DEFAULTS and type(v) is type(DEFAULTS[k]) and allowed(k, v, user)})
    return settings


def load(user):
    """The user's settings as they apply: those an admin withholds from them are off (access.py), while the user's
    own choice is kept for when it is given back"""
    from . import access  # access imports features, as this module does
    settings = saved(user)
    for name in access.withheld(user):
        settings[name] = False
    return settings


def update(user, changes):
    """Saves the given settings over the user's and returns them all as they apply (load); unknown names, wrong types
    and settings an admin withholds from the user are refused"""
    if not isinstance(changes, dict):
        raise InvalidSettings("Expected an object of settings")
    from . import access
    withheld = access.withheld(user)
    errors = []
    for name, value in changes.items():
        if name not in DEFAULTS:
            errors.append("Unknown setting: %s" % name)
        elif type(value) is not type(DEFAULTS[name]):
            errors.append("%s takes a %s" % (name, type(DEFAULTS[name]).__name__))
        elif not allowed(name, value, user) and name in RANGES:
            errors.append("%s takes %s to %s" % ((name,) + RANGES[name]))
        elif not allowed(name, value, user):
            errors.append("Unknown %s: %s" % (name, value))
        elif name in withheld:
            errors.append("Turned off by your administrator: %s" % name)
    if errors:
        raise InvalidSettings("; ".join(errors))
    settings = saved(user)
    settings.update(changes)
    store(user).set_json(KEY, settings)
    return load(user)
