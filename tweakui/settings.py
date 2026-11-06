"""
Each user's TweakUI settings: one JSON value in the plugin's per-user data store, with a default for every setting.
"""
from app.plugins.data_store import UserDataStore

KEY = "settings"

# Every setting with its default; the type of the default is the only type the setting takes
DEFAULTS = {
    # General > Task Options: the Task Options dialog's group headings show "(modified/total)"
    "show_modified_options": False,
}


class InvalidSettings(ValueError):
    pass


def store(user):
    return UserDataStore("tweakui", user)


def load(user):
    """The user's settings, with the defaults for those never set (and for anonymous users)"""
    settings = dict(DEFAULTS)
    if user is not None and user.is_authenticated:
        saved = store(user).get_json(KEY, {})
        if isinstance(saved, dict):
            settings.update({k: v for k, v in saved.items() if k in DEFAULTS and type(v) is type(DEFAULTS[k])})
    return settings


def update(user, changes):
    """Saves the given settings over the user's and returns them all; unknown names and wrong types are refused"""
    if not isinstance(changes, dict):
        raise InvalidSettings("Expected an object of settings")
    errors = []
    for name, value in changes.items():
        if name not in DEFAULTS:
            errors.append("Unknown setting: %s" % name)
        elif type(value) is not type(DEFAULTS[name]):
            errors.append("%s takes a %s" % (name, type(DEFAULTS[name]).__name__))
    if errors:
        raise InvalidSettings("; ".join(errors))
    settings = load(user)
    settings.update(changes)
    store(user).set_json(KEY, settings)
    return settings
