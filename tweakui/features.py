"""
Every TweakUI setting, declared once: its name and default, where it sits on the settings page (a category and a
group), its label and description there, its preview screenshot, and the scripts it needs on WebODM's pages.

From this list come the defaults (settings.DEFAULTS), the settings page's controls (templates/settings.html) and
the scripts the plugin puts on every page (plugin.py). Adding a tweak starts here; the docs' "Adding a Tweak" page
has the rest.
"""
from django.utils.translation import gettext_lazy as _

# On every page before the features' scripts, in this order: the user's settings (a view, api.settings_script), the
# shared helpers, and TweakUI's side-menu items
CORE_SCRIPTS = ["settings.js", "core.js", "main.js"]


class Setting:
    """A setting. A boolean one is a checkbox on the settings page; a number one (number=(minimum, maximum, step), a
    whole-number default) a slider moving in steps with a box beside it that takes any whole number in the range, and
    unit the word after the box; one without a label has no control there (its category's template draws it). parts:
    settings shown under this one, greyed out while it is off (a part may have parts of its own). scripts: in
    public/, the ones it needs, in the order they load (a script shared by several settings is loaded once).
    admin_label and admin_help: a superuser may withhold the setting from users on Administration > TweakUI
    (access.py), where these name and describe it."""

    def __init__(self, name, default, label=None, help=None, preview=None, scripts=(), parts=(), admin_label=None,
                 admin_help=None, number=None, unit=None):
        self.name = name
        self.default = default
        self.label = label
        self.help = help
        self.preview = preview
        self.scripts = list(scripts)
        self.parts = list(parts)
        self.admin_label = admin_label
        self.admin_help = admin_help
        self.admin_control = admin_label is not None
        self.number = tuple(number) if number else None
        self.unit = unit


class Group:
    """A framed group of settings under a heading"""

    def __init__(self, title, settings):
        self.title = title
        self.settings = list(settings)


class Category:
    """A category of the settings page: a link in its navigation pane and a section. template: a template of its own,
    drawn after its groups (Themes' list of themes, editor and sample)"""

    def __init__(self, id, label, icon, groups=(), settings=(), template=None):
        self.id = id
        self.label = label
        self.icon = icon
        self.groups = list(groups)
        # Settings with no control in a group (the template's)
        self.settings = list(settings)
        self.template = template


CATEGORIES = [
    Category("general", _("General"), "fa fa-cog fa-fw", groups=[
        Group(_("Global Controls"), [
            Setting("units_in_header", False, _("Units in Header"),
                    _("A units menu in the header, left of the paintbrush: Metric, Imperial or Imperial (US), the same "
                      "choice as the units selector on the 2D and 3D maps, kept in step with it. In the side menu on "
                      "WebODM's Windows app, which has no header."),
                    preview="units-in-header", scripts=["units_menu.js"]),
            Setting("hide_nav_pane", False, _("Hide Navigation Pane"),
                    _("A small tab on the divider between the side menu and the page, near the top. Each click takes "
                      "the side menu one step: its icons alone (each one's name shows when you point at it), then "
                      "hidden, giving the page the whole width, then back to its usual width. Remembered in this "
                      "browser. Not on a phone, where the side menu is already the header's menu button."),
                    preview="hide-navigation-pane", scripts=["nav_pane.js"], parts=[
                        Setting("auto_hide_nav_pane", False, _("Auto-hide Navigation Pane"),
                                _("The side menu stays hidden until the pointer nears the window's left edge, then "
                                  "shows over the page (which keeps its size), and hides again once the pointer leaves "
                                  "it. The tab pins it open, and a second click unpins it."),
                                preview="auto-hide-navigation-pane", parts=[
                                    Setting("auto_hide_delay", 500, _("Hide Delay"),
                                            _("How long the side menu waits after the pointer leaves it before it "
                                              "hides."),
                                            number=(200, 3000, 100), unit=_("ms")),
                                ]),
                    ]),
            Setting("resize_nav_pane", False, _("Resize Navigation Pane"),
                    _("Drag the divider between the side menu and the page to make the side menu wider or narrower, down "
                      "to its icons alone (each one's name shows when you point at it). A double click on the divider "
                      "puts back the usual width. Remembered in this browser. Not on a phone."),
                    preview="resize-navigation-pane", scripts=["nav_pane.js"]),
        ]),
        Group(_("Task Options"), [
            Setting("show_configured_option_count", False, _("Show Configured Option Count"),
                    _("In the Task Options dialog, each group's heading shows how many of its options are configured "
                      "(not at their default), e.g. (1/13)."),
                    preview="show-configured-option-count", scripts=["task_options.js"]),
            Setting("expand_configured_options", False, _("Expand Configured Options"),
                    _("In the Task Options dialog, a collapsed group still shows its configured options (those not at "
                      "their default), so you can change them there. The Expand/Collapse button cycles Expand All, "
                      "Collapse All and Collapse All but Configured."),
                    preview="expand-configured-options", scripts=["task_options.js"]),
            Setting("replace_preset_menu", False, _("Replace Preset Options Menu"),
                    _("Replaces the Options dropdown of a new or edited task with a menu that lists its presets A-Z in "
                      "two submenus, User Presets (your own saved presets) and System Presets (WebODM's, Default among "
                      "them), below (Custom), and a box at the top that filters them as you type."),
                    preview="replace-preset-options-menu", scripts=["preset_menu.js"]),
        ]),
        Group(_("Task Details"), [
            Setting("enhanced_task_details", False, _("Enhanced Task Details"),
                    _("Adds the parts turned on below to a task's details on the Dashboard."),
                    preview="enhanced-task-details", scripts=["task_details.js"], parts=[
                        Setting("task_details_times", True, _("Task Start and End Time"),
                                _("When the task started and finished, after Created on.")),
                        Setting("task_details_preset", True, _("Show Configured Task Preset"),
                                _("The preset the task's options match, or Custom.")),
                        Setting("task_details_options", True, _("Options as Bubbles"),
                                _("Each option in its own bubble, in place of WebODM's one-line Options.")),
                        Setting("task_details_command", True, _("Show ODX Command"),
                                _("The command to run the task yourself, with a copy button.")),
                        Setting("task_details_step", True, _("Show Current Processing Stage"),
                                _("While the task runs, the ODM stage it is in, e.g. Current Step (8/13): Texturing.")),
                    ]),
            Setting("expand_task_controls", False, _("Expand Task Controls"),
                    _("On the Dashboard, a minimized task still shows its buttons (Download, Map, Report, Edit…). The "
                      "+/- beside its name cycles buttons only, expanded and fully minimized."),
                    preview="expand-task-controls", scripts=["task_controls.js"]),
        ]),
        Group(_("Just for Fun"), [
            Setting("surprise_me", False, _("Surprise Me"),
                    _("Fireworks go off over every page every few seconds until you turn this off, and with Enable "
                      "Interaction a right-click (Ctrl+click on a Mac) sends one to the pointer (Shift + right-click for "
                      "the browser's menu). They're silent and clicks go through them."),
                    preview="surprise-me", scripts=["surprise_me.js"], parts=[
                        Setting("surprise_me_interaction", True, _("Enable Interaction"),
                                _("A right-click (Ctrl+click on a Mac) sends a rocket. Turn this off to leave the mouse "
                                  "to the browser and the page: the fireworks still go off.")),
                    ]),
        ]),
    ]),
    Category("themes", _("Themes"), "fa fa-palette fa-fw", groups=[
        Group(_("Theme Menu"), [
            Setting("show_theme_menu", True, _("Show Theme Menu"),
                    _("A paintbrush in the header, left of your user icon, to change the theme from any page (in the "
                      "side menu on WebODM's Windows app, which has no header)."),
                    preview="theme-menu", scripts=["theme_menu.js"]),
        ]),
    ], settings=[
        # "webodm" (WebODM's own theme), a preset id of themes.PRESETS, "own:<id>", one of the user's own themes, or
        # "published:<id>", one an administrator published (custom_themes); settings.allowed checks it
        Setting("theme", "webodm"),
    ], template="settings_themes.html"),
    Category("map2d", _("2D Map"), "fa fa-map fa-fw", groups=[
        Group(_("Controls"), [
            Setting("movable_controls", False, _("Movable Controls"),
                    _("Drag the map's panels (Layers, Base Maps, Measure, Contours…) by their title, anywhere within "
                      "the map. A panel that closes reopens in its usual place."),
                    preview="movable-controls", scripts=["movable_controls.js"]),
            Setting("other_tasks", False, _("Compare Orthophotos from Other Tasks"),
                    _("On a task's map, a button below Layers lists the project's other tasks that have an orthophoto. "
                      "Check one to show it over this task's, with its own opacity slider."),
                    preview="other-tasks", scripts=["other_tasks.js"]),
            Setting("source_frames_2d", False, _("Source Frames"),
                    _("A button beside Share turns it on. Then click the map: a window lists the task's photos that "
                      "show that spot, best first, with each photo's details, a full-frame view and a download."),
                    preview="source-frames-2d", scripts=["pick3d.js", "source_frames.js"]),
            Setting("zoom_override_2d", False, _("Zoom Override"),
                    _("The map zooms in 3 steps further than WebODM lets it (each step twice as close), with the wheel, "
                      "the + button and a pinch."),
                    preview="zoom-override-2d", scripts=["pick3d.js", "zoom_override.js"], parts=[
                Setting("zoom_sensitivity_2d", 100, _("Zoom Sensitivity"),
                        _("How far a mouse wheel notch zooms the map: 100% as WebODM does (a whole step, or two in some "
                          "browsers), 50% half that, 200% twice. Away from 100% the map can rest between steps (its tiles "
                          "slightly scaled). A button on the map changes it too, as you zoom."),
                        preview="zoom-sensitivity-2d", number=(10, 200, 10), unit="%"),
            ]),
            Setting("map_search", False, _("Add Search Button"),
                    _("A button above the zoom buttons opens a search box. Type an address or place and press Enter "
                      "(OpenStreetMap's Nominatim looks it up), or coordinates such as 46.84, -91.99 or "
                      "46°50'24\"N 91°59'24\"W, and the map goes there."),
                    preview="map-search", scripts=["map_search.js"]),
        ]),
    ]),
    Category("map3d", _("3D Map"), "fa fa-cube fa-fw", groups=[
        Group(_("Controls"), [
            Setting("source_frames_3d", False, _("Source Frames"),
                    _("A button beside Share turns it on. Then click the model: a window lists the task's photos that "
                      "show that spot, best first, with each photo's details, a full-frame view and a download."),
                    preview="source-frames-3d", scripts=["pick3d.js", "source_frames.js"]),
            Setting("zoom_override_3d", False, _("Zoom Override"),
                    _("The mouse wheel zooms toward what is under the pointer (the points or the model) instead of the "
                      "middle of the view, so you can get close to any surface, and a trackpad's two-finger scroll "
                      "zooms at a gentle pace. Over empty space it zooms as before."),
                    preview="zoom-override-3d", scripts=["pick3d.js", "zoom_override.js"], parts=[
                Setting("zoom_sensitivity_3d", 100, _("Zoom Sensitivity"),
                        _("How far a mouse wheel notch zooms toward what is under the pointer: 100% is a tenth of the way, "
                          "50% half that, 200% twice. A button in the 3D view changes it too, as you zoom."),
                        preview="zoom-sensitivity-3d", number=(10, 200, 10), unit="%"),
            ]),
        ]),
    ]),
    Category("diagnostic", _("Diagnostic"), "fa fa-chart-pie fa-fw", groups=[
        Group(_("Storage View"), [
            # main.js adds the side-menu item; the page is the plugin's own (storage.html)
            Setting("storage_view", False, _("Show Storage View"),
                    _("Adds a Storage page under Diagnostic in the side menu (under TweakUI when the Diagnostic plugin "
                      "is off). It shows how much of your quota each project and task uses and each task's files by "
                      "kind, and lets you compact tasks (delete their photos, keep their results) or delete tasks and "
                      "projects, back up completed tasks as WebODM's backup zips and import zips into a project."),
                    preview="storage", admin_label=_("Storage View"),
                    admin_help=_("Users may turn on the Storage page: their projects' and tasks' sizes, compact, delete, "
                                 "back up and import tasks.")),
        ]),
        Group(_("Performance View"), [
            # main.js adds the side-menu item; the page is the plugin's own (performance.html)
            Setting("performance_view", False, _("Show Performance View"),
                    _("Adds a Performance page under Diagnostic in the side menu (under TweakUI when the Diagnostic "
                      "plugin is off). It shows each processing node's cores, memory and queue, the server's CPU load, "
                      "disk space and activity and memory, your recent tasks (failed ones too) with their processing times and what their "
                      "logs warn of, and whether the nodes have enough memory for your tasks, by WebODM's hardware "
                      "requirements."),
                    preview="performance", admin_label=_("Performance View"),
                    admin_help=_("Users may turn on the Performance page: the processing nodes they may use, the "
                                 "server's CPU load, disk and memory, and their recent tasks with what their logs "
                                 "warn of."),
                    parts=[
                        Setting("performance_refresh", 3, _("Refresh Every"),
                                _("How often the Performance page refreshes the CPU load, the disks' activity and "
                                  "the memory while it is open. The free disk space is refreshed every 10 seconds."),
                                number=(1, 10, 1), unit=_("s")),
                    ]),
        ]),
    ]),
]


def all_settings():
    """Every setting, in the settings page's order (each one's parts after it)"""
    for category in CATEGORIES:
        for group in category.groups:
            for setting in group.settings:
                yield from _with_parts(setting)
        yield from category.settings


def _with_parts(setting):
    yield setting
    for part in setting.parts:
        yield from _with_parts(part)


def setting(name):
    """The setting of that name"""
    return next(s for s in all_settings() if s.name == name)


def number_control(name, value):
    """A number setting's control off the settings page (its slider, box and default), with the user's value"""
    s = setting(name)
    return {"value": value, "min": s.number[0], "max": s.number[1], "step": s.number[2], "unit": s.unit,
            "default": with_unit(s.default, s.unit)}


def defaults():
    """{name: default} of every setting"""
    return {s.name: s.default for s in all_settings()}


def scripts():
    """The scripts on every page: the core ones, then each setting's, in the settings page's order, each once"""
    names = list(CORE_SCRIPTS)
    for setting in all_settings():
        for name in setting.scripts:
            if name not in names:
                names.append(name)
    return names


def with_unit(value, unit):
    """A number with its unit as the settings show it, such as 100% or 500 ms"""
    if not unit:
        return str(value)
    return "%s%s" % (value, unit) if str(unit) == "%" else "%s %s" % (value, unit)


def page(values, withheld=()):
    """The settings page's categories, each setting with the user's value (values: settings.load) and, for a number
    setting, its default; a withheld one (access.withheld) is greyed"""
    def control(setting):
        return {"name": setting.name, "label": setting.label, "help": setting.help, "preview": setting.preview,
                "value": values.get(setting.name, setting.default), "withheld": setting.name in withheld,
                "number": ({"min": setting.number[0], "max": setting.number[1], "step": setting.number[2]}
                           if setting.number else None),
                "default": with_unit(setting.default, setting.unit) if setting.number else None,
                "unit": setting.unit, "parts": [control(p) for p in setting.parts]}

    return [{"id": c.id, "label": c.label, "icon": c.icon, "template": c.template,
             "groups": [{"title": g.title, "settings": [control(s) for s in g.settings if s.label]} for g in c.groups]}
            for c in CATEGORIES]
