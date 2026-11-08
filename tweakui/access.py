"""
Administration > TweakUI: which features users may have. A setting declared with an admin_label (features.py) is
available to users unless a superuser withholds it; superusers always keep it. Kept in the plugin's global data
store as {name: false} for those withheld, so a new install and an upgrade change nothing.
"""
from app.plugins.data_store import GlobalDataStore

from . import features

KEY = "available_to_users"


class InvalidAccess(ValueError):
    pass


def controlled():
    """The settings a superuser may withhold, in the settings page's order"""
    return [s for s in features.all_settings() if s.admin_control]


def _store():
    return GlobalDataStore("tweakui")


def available():
    """{name: whether users may have it} for every controlled setting (true when never set)"""
    saved = _store().get_json(KEY, {})
    if not isinstance(saved, dict):
        saved = {}
    return {s.name: saved.get(s.name) is not False for s in controlled()}


def withheld(user):
    """The names of the settings this user may not have: none for a superuser"""
    if user is not None and user.is_authenticated and user.is_superuser:
        return set()
    return {name for name, on in available().items() if not on}


def is_withheld(user, name):
    return name in withheld(user)


def update(changes):
    """Saves {name: bool} for controlled settings and returns them all; anything else is refused"""
    if not isinstance(changes, dict):
        raise InvalidAccess("Expected an object of features")
    names = {s.name for s in controlled()}
    errors = ["Unknown feature: %s" % n for n in changes if n not in names]
    errors += ["%s takes a bool" % n for n, v in changes.items() if n in names and not isinstance(v, bool)]
    if errors:
        raise InvalidAccess("; ".join(errors))
    values = available()
    values.update(changes)
    _store().set_json(KEY, {n: False for n, on in values.items() if not on})
    return values


def page():
    """Administration > TweakUI's checkboxes: each controlled setting's label, description and whether users have it"""
    values = available()
    return [{"name": s.name, "label": s.admin_label, "help": s.admin_help, "value": values[s.name]} for s in controlled()]
