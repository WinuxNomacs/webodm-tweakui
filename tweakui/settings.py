"""
Each user's TweakUI settings: one JSON value in the plugin's per-user data store, with a default for every setting.
"""
from app.plugins.data_store import UserDataStore

KEY = "settings"

# Every setting with its default; the type of the default is the only type the setting takes
DEFAULTS = {
    # General > Task Options: the Task Options dialog's group headings show "(modified/total)"
    "show_modified_options": False,
    # General > Task Options: a task's details panel on the Dashboard shows its preset, its options as bubbles and
    # its ODX command
    "enhanced_task_details": False,
    # Themes: "webodm" (WebODM's own theme) or a preset id of themes.PRESETS
    "theme": "webodm",
}


def allowed(name, value):
    """Whether a value of the right type is one the setting takes (a setting with a list of choices)"""
    if name == "theme":
        from .themes import DEFAULT, PRESETS  # themes imports this module
        return value == DEFAULT or value in PRESETS
    return True


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
            settings.update({k: v for k, v in saved.items()
                             if k in DEFAULTS and type(v) is type(DEFAULTS[k]) and allowed(k, v)})
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
        elif not allowed(name, value):
            errors.append("Unknown %s: %s" % (name, value))
    if errors:
        raise InvalidSettings("; ".join(errors))
    settings = load(user)
    settings.update(changes)
    store(user).set_json(KEY, settings)
    return settings
