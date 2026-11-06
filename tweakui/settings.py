"""
Each user's TweakUI settings: one JSON value in the plugin's per-user data store, with a default for every setting.
"""
from app.plugins.data_store import UserDataStore

KEY = "settings"

# Every setting with its default; the type of the default is the only type the setting takes
DEFAULTS = {
    # General > Task Options: the Task Options dialog's group headings show "(modified/total)"
    "show_modified_options": False,
    # General > Task Details: a task's details panel on the Dashboard shows its preset, its options as bubbles and
    # its ODX command
    "enhanced_task_details": False,
    # Its parts, each turned off on its own: Task Start and End Time, Show Configured Task Preset, Options as
    # Bubbles, Show ODX Command and Show Current Processing Stage
    "task_details_times": True,
    "task_details_preset": True,
    "task_details_options": True,
    "task_details_command": True,
    "task_details_step": True,
    # 2D Map: the map's popup panels can be dragged by their title
    "movable_controls": False,
    # 2D Map: on a task's map, a panel of the project's other tasks' orthophotos to show over its own
    "other_tasks": False,
    # 2D Map and 3D Map: a button to pick a spot or draw an area and see the source photos that show it
    "source_frames_2d": False,
    "source_frames_3d": False,
    # 2D Map: the map zooms 3 steps further; 3D Map: the wheel zooms toward what is under the pointer
    "zoom_override_2d": False,
    "zoom_override_3d": False,
    # Storage: a Storage view under Diagnostic (or under TweakUI's side-menu item without Diagnostic)
    "storage_view": False,
    # Themes: the paintbrush menu of themes in the header
    "show_theme_menu": True,
    # Themes: "webodm" (WebODM's own theme), a preset id of themes.PRESETS, or "own:<id>", one of the user's own
    # themes (custom_themes)
    "theme": "webodm",
}


def allowed(name, value, user=None):
    """Whether a value of the right type is one the setting takes (a setting with a list of choices); an own theme
    only while the user has it"""
    if name == "theme":
        from . import custom_themes  # both import this module
        from .themes import DEFAULT, PRESETS
        if value.startswith(custom_themes.OWN):
            return custom_themes.find(user, value[len(custom_themes.OWN):]) is not None
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
                             if k in DEFAULTS and type(v) is type(DEFAULTS[k]) and allowed(k, v, user)})
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
        elif not allowed(name, value, user):
            errors.append("Unknown %s: %s" % (name, value))
    if errors:
        raise InvalidSettings("; ".join(errors))
    settings = load(user)
    settings.update(changes)
    store(user).set_json(KEY, settings)
    return settings
