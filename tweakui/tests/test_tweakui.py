"""
Tests of the TweakUI plugin: it registers, its scripts and stylesheet are on WebODM's pages, and each user's
settings (the data store, the API, settings.js and the settings page), the themes (theme.css), Source Frames,
Storage and Performance.
"""
import json
import math
import os
import re
import shutil
import tempfile
from unittest import mock

from django.contrib.auth.models import User
from django.test import Client
from rest_framework import status

from app.plugins import disable_plugin, enable_plugin, get_plugin_by_name
from app.models import Project, Task
from app.plugins.data_store import UserDataStore
from app.tests.classes import BootTestCase
from coreplugins.tweakui import features, frames

API = "/api/plugins/tweakui/settings"


def plugin_scripts():
    """The scripts the plugin puts on every page, in order"""
    return get_plugin_by_name("tweakui").include_js_files()


def defaults(**changes):
    """Every setting at its default, but for the given changes"""
    return dict({"units_in_header": False, "hide_nav_pane": False, "auto_hide_nav_pane": False, "auto_hide_delay": 500, "resize_nav_pane": False, "show_configured_option_count": False, "expand_configured_options": False, "replace_preset_menu": False, "enhanced_task_details": False,
                 "task_details_times": True, "task_details_preset": True, "task_details_options": True, "task_details_command": True,
                 "task_details_step": True, "expand_task_controls": False, "surprise_me": False, "surprise_me_interaction": True, "movable_controls": False, "other_tasks": False,
                 "source_frames_2d": False, "source_frames_3d": False, "zoom_override_2d": False, "zoom_sensitivity_2d": 100, "map_search": False,
                 "zoom_override_3d": False, "zoom_sensitivity_3d": 100, "storage_view": False, "performance_view": False, "performance_refresh": 3, "show_theme_menu": True, "theme": "webodm"},
                **changes)


class TweakUITestCase(BootTestCase):
    def setUp(self):
        super().setUp()
        disable_plugin("tweakui")
        enable_plugin("tweakui")
        self.client = self.login("testuser")

    def tearDown(self):
        disable_plugin("tweakui")

    def login(self, username):
        client = Client()
        client.login(username=username, password="test1234")
        return client

    def patch(self, data, client=None):
        return (client or self.client).patch(API, json.dumps(data), content_type="application/json")

    def script_settings(self, client):
        res = client.get("/plugins/tweakui/settings.js")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.content.decode()
        return self.script_value(body, "settings")

    def script_value(self, body, name):
        """The JSON value settings.js gives window.TweakUI.<name>, or None"""
        for line in body.splitlines():
            if line.startswith("window.TweakUI.%s = " % name):
                return json.loads(line.split(" = ", 1)[1].rstrip(";"))
        return None


class TestThePlugin(TweakUITestCase):
    def test_the_plugin_is_found_and_enabled(self):
        plugin = get_plugin_by_name("tweakui")
        self.assertIsNotNone(plugin)
        self.assertEqual(plugin.get_manifest()["name"], "TweakUI")

    def test_the_dashboard_includes_the_scripts_settings_and_the_helpers_first_and_the_stylesheet(self):
        res = self.client.get("/dashboard/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for name in ("settings.js", "core.js", "main.js", "task_options.js", "theme_menu.js", "units_menu.js",
                     "movable_controls.js", "other_tasks.js", "pick3d.js", "source_frames.js", "zoom_override.js", "map_search.js", "surprise_me.js"):
            self.assertContains(res, "<script src='/plugins/tweakui/%s'></script>" % name, html=True)
        html = res.content.decode()
        # The settings, then the helpers (core.js), before every other script
        self.assertLess(html.index("/plugins/tweakui/settings.js"), html.index("/plugins/tweakui/core.js"))
        for name in plugin_scripts()[2:]:
            self.assertLess(html.index("/plugins/tweakui/core.js"), html.index("/plugins/tweakui/" + name), name)
        # The 3D pick before the scripts that use it
        for name in ("source_frames.js", "zoom_override.js"):
            self.assertLess(html.index("/plugins/tweakui/pick3d.js"), html.index("/plugins/tweakui/" + name))
        for name in ("main.css", "theme.css"):
            self.assertContains(res, "<link href='/plugins/tweakui/%s' rel='stylesheet' type='text/css'>" % name,
                                html=True)

    def test_the_scripts_and_stylesheet_are_served(self):
        for name in ("settings.js", "core.js", "main.js", "task_options.js", "theme_menu.js", "units_menu.js",
                     "movable_controls.js", "other_tasks.js", "pick3d.js", "source_frames.js", "zoom_override.js",
                     "map_search.js", "surprise_me.js", "settings_page.js", "vendor/fireworks-js/fireworks.umd.js",
                     "main.css", "theme.css"):
            res = self.client.get("/plugins/tweakui/" + name)
            self.assertEqual(res.status_code, status.HTTP_200_OK, name)

    def test_the_side_menu_has_a_tweakui_item_linking_to_the_settings_page(self):
        res = self.client.get("/dashboard/")
        self.assertContains(res, 'href="/plugins/tweakui/"')
        self.assertContains(res, "fa-sliders-h")

    def test_a_disabled_plugin_is_left_out_of_the_pages(self):
        disable_plugin("tweakui")
        res = self.client.get("/dashboard/")
        self.assertNotContains(res, "/plugins/tweakui/")


class TestSettings(TweakUITestCase):
    def test_a_new_user_gets_the_defaults_with_show_configured_option_count_off(self):
        res = self.client.get(API)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), defaults())

    def test_a_change_is_saved_in_the_user_s_own_data_store(self):
        res = self.patch({"show_configured_option_count": True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), defaults(show_configured_option_count=True))
        store = UserDataStore("tweakui", User.objects.get(username="testuser"))
        self.assertEqual(store.get_json("settings"), defaults(show_configured_option_count=True))
        self.assertEqual(self.client.get(API).json(), defaults(show_configured_option_count=True))

    def test_each_user_has_their_own_settings(self):
        self.patch({"show_configured_option_count": True})
        other = self.login("testuser2")
        self.assertEqual(other.get(API).json(), defaults())
        self.assertEqual(self.script_settings(other), defaults())

    def test_unknown_settings_and_wrong_types_are_refused_and_nothing_is_saved(self):
        for data in ({"nope": True}, {"show_configured_option_count": "yes"}, {"show_configured_option_count": 1}, [True],
                     {"theme": "nope"}, {"theme": 1}):
            res = self.patch(data)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, data)
            self.assertIn("detail", res.json())
        self.assertEqual(self.client.get(API).json(), defaults())

    def test_saved_settings_no_longer_known_or_of_the_wrong_type_fall_back_to_the_defaults(self):
        UserDataStore("tweakui", User.objects.get(username="testuser")).set_json(
            "settings", {"show_configured_option_count": "x", "removed": 1, "theme": "removed-theme"})
        self.assertEqual(self.client.get(API).json(), defaults())

    def test_logged_out_users_get_neither_the_api_nor_the_page(self):
        anonymous = Client()
        self.assertIn(anonymous.get(API).status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertIn(self.patch({"show_configured_option_count": True}, client=anonymous).status_code,
                      (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertEqual(anonymous.get("/plugins/tweakui/").status_code, status.HTTP_302_FOUND)

    def test_settings_js_gives_the_user_s_settings_uncached_and_the_defaults_when_logged_out(self):
        self.patch({"show_configured_option_count": True})
        res = self.client.get("/plugins/tweakui/settings.js")
        self.assertTrue(res["Content-Type"].startswith("application/javascript"))
        self.assertEqual(res["Cache-Control"], "no-store")
        self.assertEqual(self.script_settings(self.client), defaults(show_configured_option_count=True))
        self.assertEqual(self.script_settings(Client()), defaults())

    def test_settings_js_says_desktop_only_in_webodm_s_desktop_mode(self):
        self.assertIsNone(self.script_value(self.client.get("/plugins/tweakui/settings.js").content.decode(), "desktop"))
        with self.settings(DESKTOP_MODE=True):
            script = self.client.get("/plugins/tweakui/settings.js").content.decode()
        self.assertIs(self.script_value(script, "desktop"), True)

    def test_settings_js_says_windows_only_when_webodm_runs_on_windows(self):
        self.assertIsNone(self.script_value(self.client.get("/plugins/tweakui/settings.js").content.decode(), "windows"))
        with mock.patch("coreplugins.tweakui.api.WINDOWS", True):
            script = self.client.get("/plugins/tweakui/settings.js").content.decode()
        self.assertIs(self.script_value(script, "windows"), True)

    def test_a_patch_without_the_csrf_token_is_refused(self):
        client = Client(enforce_csrf_checks=True)
        client.login(username="testuser", password="test1234")
        self.assertEqual(self.patch({"show_configured_option_count": True}, client=client).status_code,
                         status.HTTP_403_FORBIDDEN)


class TestSettingsPage(TweakUITestCase):
    def test_the_page_opens_with_the_general_category_and_the_task_options_setting(self):
        res = self.client.get("/plugins/tweakui/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertContains(res, 'href="#general"')
        self.assertContains(res, 'data-section="general"')
        self.assertContains(res, "Task Options")
        self.assertContains(res, 'data-setting="show_configured_option_count"')
        self.assertContains(res, 'data-api="/api/plugins/tweakui/"')
        self.assertContains(res, "csrfmiddlewaretoken")
        self.assertNotContains(res, "{#")
        self.assertNotContains(res, "comment %}")

    def test_enhanced_task_details_and_its_parts_are_under_task_details_with_their_names(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        options, details = page.index(">Task Options</h5>"), page.index(">Task Details</h5>")
        self.assertLess(options, page.index('data-setting="show_configured_option_count"'))
        self.assertLess(page.index('data-setting="show_configured_option_count"'), details)
        self.assertLess(details, page.index('data-setting="enhanced_task_details"'))
        for name in ("Task Start and End Time", "Show Configured Task Preset", "Options as Bubbles",
                     "Show ODX Command", "Show Current Processing Stage"):
            self.assertGreater(page.index(name), details)

    def test_expand_configured_is_under_task_options_off_by_default_and_shows_the_saved_value(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        options, details = page.index(">Task Options</h5>"), page.index(">Task Details</h5>")
        self.assertLess(options, page.index('data-setting="expand_configured_options"'))
        self.assertLess(page.index('data-setting="expand_configured_options"'), details)
        self.assertIn("Expand Configured Options", page)
        self.assertNotIn('data-setting="expand_configured_options" checked', page)
        self.patch({"expand_configured_options": True})
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="expand_configured_options" checked')

    def test_expand_task_controls_is_under_task_details_off_by_default_and_shows_the_saved_value(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        details = page.index(">Task Details</h5>")
        self.assertLess(details, page.index('data-setting="expand_task_controls"'))
        self.assertLess(page.index('data-setting="expand_task_controls"'), page.index('id="tweakui-themes"'))
        self.assertIn("Expand Task Controls", page)
        self.assertNotIn('data-setting="expand_task_controls" checked', page)
        self.patch({"expand_task_controls": True})
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="expand_task_controls" checked')

    def test_the_checkbox_shows_the_saved_value(self):
        self.assertNotContains(self.client.get("/plugins/tweakui/"), 'data-setting="show_configured_option_count" checked')
        self.patch({"show_configured_option_count": True})
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="show_configured_option_count" checked')

    def test_enhanced_task_details_is_off_by_default_and_its_checkbox_shows_the_saved_value(self):
        page = self.client.get("/plugins/tweakui/")
        self.assertContains(page, 'data-setting="enhanced_task_details"')
        self.assertNotContains(page, 'data-setting="enhanced_task_details" checked')
        self.assertEqual(self.patch({"enhanced_task_details": True}).json(), defaults(enhanced_task_details=True))
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="enhanced_task_details" checked')

    def test_each_part_of_enhanced_task_details_is_on_by_default_under_it_and_can_be_turned_off(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        box = page[page.index('data-depends="enhanced_task_details"'):]
        for part in ("times", "preset", "options", "command", "step"):
            self.assertIn('data-setting="task_details_%s" checked' % part, box[:box.index("</section>")])
        self.assertEqual(self.patch({"task_details_command": False}).json(), defaults(task_details_command=False))
        self.assertNotContains(self.client.get("/plugins/tweakui/"), 'data-setting="task_details_command" checked')
        self.assertEqual(self.script_settings(self.client)["task_details_command"], False)

    def test_units_in_header_is_off_by_default_first_under_general_global_controls_and_can_be_turned_on(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        general = page[page.index('<section id="tweakui-general"'):]
        general = general[:general.index("</section>")]
        self.assertLess(general.index("Global Controls"), general.index("Task Options"))
        self.assertIn('data-setting="units_in_header">', general)
        self.assertIn("Units in Header", general)
        self.assertEqual(self.patch({"units_in_header": True}).json(), defaults(units_in_header=True))
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="units_in_header" checked')
        self.assertEqual(self.script_settings(self.client)["units_in_header"], True)

    def test_hide_navigation_pane_is_off_by_default_under_general_global_controls_and_can_be_turned_on(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        general = page[page.index('<section id="tweakui-general"'):]
        general = general[:general.index("</section>")]
        self.assertLess(general.index('data-setting="units_in_header"'), general.index('data-setting="hide_nav_pane">'))
        self.assertLess(general.index('data-setting="hide_nav_pane"'), general.index("Task Options"))
        self.assertIn("Hide Navigation Pane", general)
        self.assertEqual(self.patch({"hide_nav_pane": True}).json(), defaults(hide_nav_pane=True))
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="hide_nav_pane" checked')
        self.assertEqual(self.script_settings(self.client)["hide_nav_pane"], True)
        self.assertIn("nav_pane.js", plugin_scripts())

    def test_auto_hide_navigation_pane_is_an_off_part_of_hide_navigation_pane_with_its_hide_delay_within_it(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        general = page[page.index('<section id="tweakui-general"'):]
        general = general[:general.index("</section>")]
        hide_box = general.index('data-depends="hide_nav_pane"')
        auto = general.index('data-setting="auto_hide_nav_pane">')
        delay_box = general.index('data-depends="auto_hide_nav_pane"')
        self.assertLess(hide_box, auto)
        self.assertLess(auto, delay_box)
        self.assertLess(delay_box, general.index('data-setting="auto_hide_delay"'))
        self.assertLess(general.index('data-setting="auto_hide_delay"'), general.index('data-setting="resize_nav_pane"'))
        self.assertIn("Auto-hide Navigation Pane", general)
        self.assertIn("Hide Delay", general)
        self.assertIn('Hide Delay <span class="tweakui-default text-muted">(Default: 500 ms)</span>', general)
        self.assertIn('data-slider-of="auto_hide_delay" min="200" max="3000" step="100" value="500"', general)
        self.assertIn('type="number" id="tweakui-auto_hide_delay"', general)
        self.assertEqual(self.patch({"auto_hide_nav_pane": True, "auto_hide_delay": 1250}).json(),
                         defaults(auto_hide_nav_pane=True, auto_hide_delay=1250))
        self.assertIn('data-saved="1250"', self.client.get("/plugins/tweakui/").content.decode())
        self.assertEqual(self.script_settings(self.client)["auto_hide_delay"], 1250)

    def test_zoom_sensitivity_is_a_part_of_each_zoom_override_from_10_to_200_percent(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        for category, which in (("map2d", "2d"), ("map3d", "3d")):
            section = page[page.index('<section id="tweakui-%s"' % category):]
            section = section[:section.index("</section>")]
            override = section.index('data-setting="zoom_override_%s">' % which)
            box = section.index('data-depends="zoom_override_%s"' % which)
            self.assertLess(override, box)
            self.assertLess(box, section.index('data-setting="zoom_sensitivity_%s"' % which))
            self.assertIn('data-slider-of="zoom_sensitivity_%s" min="10" max="200" step="10" value="100"' % which, section)
            self.assertIn('Zoom Sensitivity <span class="tweakui-default text-muted">(Default: 100%)</span>', section)
        self.assertEqual(self.patch({"zoom_override_2d": True, "zoom_sensitivity_2d": 35, "zoom_sensitivity_3d": 200}).json(),
                         defaults(zoom_override_2d=True, zoom_sensitivity_2d=35, zoom_sensitivity_3d=200))
        self.assertEqual(self.script_settings(self.client)["zoom_sensitivity_2d"], 35)
        for value in (9, 201, 50.0):
            self.assertEqual(self.patch({"zoom_sensitivity_3d": value}).status_code, 400)
        self.assertIn("zoom_sensitivity_2d takes 10 to 200", self.patch({"zoom_sensitivity_2d": 300}).json()["detail"])

    def test_a_number_setting_refuses_a_number_out_of_its_range_or_not_whole(self):
        for value in (199, 3001, 500.0, "500", True):
            res = self.patch({"auto_hide_delay": value})
            self.assertEqual(res.status_code, 400, value)
        self.assertIn("auto_hide_delay takes 200 to 3000", self.patch({"auto_hide_delay": 5000}).json()["detail"])
        self.assertEqual(self.script_settings(self.client)["auto_hide_delay"], 500)

    def test_resize_navigation_pane_is_off_by_default_after_hide_navigation_pane_and_can_be_turned_on(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        general = page[page.index('<section id="tweakui-general"'):]
        general = general[:general.index("</section>")]
        self.assertLess(general.index('data-setting="hide_nav_pane"'), general.index('data-setting="resize_nav_pane">'))
        self.assertLess(general.index('data-setting="resize_nav_pane"'), general.index("Task Options"))
        self.assertIn("Resize Navigation Pane", general)
        self.assertEqual(self.patch({"resize_nav_pane": True}).json(), defaults(resize_nav_pane=True))
        self.assertEqual(self.script_settings(self.client)["resize_nav_pane"], True)
        self.assertEqual(plugin_scripts().count("nav_pane.js"), 1)

    def test_surprise_me_is_off_by_default_last_under_general_just_for_fun_and_can_be_turned_on(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        general = page[page.index('<section id="tweakui-general"'):]
        general = general[:general.index("</section>")]
        self.assertLess(general.index("Task Details"), general.index("Just for Fun"))
        # Last but its part, Enable Interaction (on by default)
        self.assertLess(general.index('data-setting="surprise_me">'), general.index('data-setting="surprise_me_interaction"'))
        self.assertEqual(general.rindex("data-setting="), general.index('data-setting="surprise_me_interaction"'))
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="surprise_me_interaction" checked')
        self.assertIn("Surprise Me", general)
        self.assertEqual(self.patch({"surprise_me": True}).json(), defaults(surprise_me=True))
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="surprise_me" checked')
        self.assertEqual(self.script_settings(self.client)["surprise_me"], True)

    def test_the_theme_menu_is_on_by_default_and_its_checkbox_is_in_the_themes_section(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        themes = page[page.index('<section id="tweakui-themes"'):]
        self.assertIn('data-setting="show_theme_menu" checked', themes[:themes.index("</section>")])
        self.assertEqual(self.patch({"show_theme_menu": False}).json(), defaults(show_theme_menu=False))
        self.assertNotContains(self.client.get("/plugins/tweakui/"), 'data-setting="show_theme_menu" checked')
        self.assertEqual(self.script_settings(self.client)["show_theme_menu"], False)

    def test_the_2d_map_settings_are_off_by_default_in_their_own_section_and_can_be_turned_on(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        self.assertIn('href="#map2d"', page)
        map2d = page[page.index('<section id="tweakui-map2d"'):]
        map2d = map2d[:map2d.index("</section>")]
        for name in ("movable_controls", "other_tasks", "source_frames_2d", "zoom_override_2d", "map_search"):
            self.assertIn('data-setting="%s">' % name, map2d)
            self.assertEqual(self.patch({name: True}).json()[name], True)
            self.assertEqual(self.script_settings(self.client)[name], True)
        self.assertEqual(self.client.get(API).json(),
                         defaults(movable_controls=True, other_tasks=True, source_frames_2d=True, zoom_override_2d=True,
                                  map_search=True))
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="other_tasks" checked')

    def test_the_3d_map_settings_are_off_by_default_in_their_own_section(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        self.assertIn('href="#map3d"', page)
        map3d = page[page.index('<section id="tweakui-map3d"'):]
        map3d = map3d[:map3d.index("</section>")]
        self.assertNotIn("No settings yet.", map3d)
        self.assertIn('data-setting="source_frames_3d">', map3d)
        self.assertIn('data-setting="zoom_override_3d">', map3d)
        self.assertEqual(self.patch({"source_frames_3d": True}).json(), defaults(source_frames_3d=True))
        self.assertEqual(self.patch({"zoom_override_3d": True}).json(),
                         defaults(source_frames_3d=True, zoom_override_3d=True))
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="source_frames_3d" checked')

    def test_the_dashboard_includes_the_task_details_and_task_controls_scripts(self):
        page = self.client.get("/dashboard/")
        self.assertContains(page, "/plugins/tweakui/task_details.js")
        self.assertContains(page, "/plugins/tweakui/task_controls.js")


    def test_every_preview_the_page_names_is_a_screenshot_in_the_previews_folder(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        self.assertIn('data-previews="/plugins/tweakui/previews/"', page)
        named = re.findall(r'data-preview="([a-z0-9-]+)"', page)
        folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "previews")
        shots = sorted(f[:-len(".webp")] for f in os.listdir(folder) if f.endswith(".webp"))
        self.assertIn("theme-menu", named)
        self.assertNotIn("themes", named)  # Themes shows a live sample in place of its screenshot
        for name in named:
            self.assertIn(name, shots)
        self.assertEqual(len(named), len(set(named)))
        self.assertEqual(self.client.get("/plugins/tweakui/previews/%s.webp" % named[0]).status_code,
                         status.HTTP_200_OK)

class TestFeatures(TweakUITestCase):
    """features.py, the one list of settings: what comes from it, and the rules a new tweak follows"""

    PUBLIC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
    # On by default, each for its reason: the theme menu came before its setting (turning it off is the choice), and
    # Enhanced Task Details' parts are shown once Enhanced Task Details itself is turned on, and Surprise Me's Enable
    # Interaction keeps its right-click rockets, which came before the part (turning them off is the choice)
    ON_BY_DEFAULT = frozenset({"show_theme_menu", "task_details_times", "task_details_preset", "task_details_options",
                               "task_details_command", "task_details_step", "surprise_me_interaction"})

    def test_each_setting_is_declared_once_and_its_default_is_the_settings_default(self):
        names = [s.name for s in features.all_settings()]
        self.assertEqual(len(names), len(set(names)))
        res = self.client.get(API)
        self.assertEqual(res.json(), features.defaults())

    def test_a_new_tweak_is_off_by_default(self):
        on = {s.name for s in features.all_settings() if s.default is True}
        self.assertEqual(on, self.ON_BY_DEFAULT)

    def test_each_setting_with_a_label_has_a_description_and_a_checkbox_or_a_number_on_the_settings_page(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        for s in features.all_settings():
            if not s.label:
                continue
            if s.number:
                low, high, step = s.number
                self.assertIs(type(s.default), int, s.name)
                self.assertTrue(low <= s.default <= high and (s.default - low) % step == 0, s.name)
                self.assertIn('type="number" id="tweakui-%s"' % s.name, page)
            else:
                self.assertIsInstance(s.default, bool, s.name)
            self.assertTrue(s.help, s.name)
            self.assertIn('data-setting="%s"' % s.name, page)

    def test_a_settings_parts_sit_under_it_greyed_out_while_it_is_off(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        box = page.index('data-depends="enhanced_task_details"')
        self.assertLess(page.index('data-setting="enhanced_task_details"'), box)
        for part in ("task_details_times", "task_details_step"):
            self.assertLess(box, page.index('data-setting="%s"' % part))

    def test_each_category_is_a_link_and_a_section_and_only_the_first_section_shows(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        for i, c in enumerate(features.CATEGORIES):
            self.assertIn('data-section="%s">' % c.id, page.replace(' role="tabpanel"', "").replace(" hidden", ""))
            section = re.search(r'<section id="tweakui-%s"[^>]*>' % c.id, page).group(0)
            self.assertEqual(" hidden" in section, i > 0, c.id)

    def test_each_preview_named_is_a_screenshot_in_public(self):
        for s in features.all_settings():
            if s.preview:
                self.assertTrue(os.path.isfile(os.path.join(self.PUBLIC, "previews", s.preview + ".webp")), s.preview)

    def test_the_plugin_loads_the_core_scripts_first_then_each_scripts_a_setting_needs_once(self):
        scripts = plugin_scripts()
        self.assertEqual(scripts, features.scripts())
        self.assertEqual(scripts[:3], features.CORE_SCRIPTS)
        self.assertEqual(len(scripts), len(set(scripts)))
        for s in features.all_settings():
            for name in s.scripts:
                self.assertIn(name, scripts)
                self.assertTrue(os.path.isfile(os.path.join(self.PUBLIC, name)), name)
        # A setting's scripts load in the order it gives (the 3D pick before the scripts that use it)
        for name in ("source_frames.js", "zoom_override.js"):
            self.assertLess(scripts.index("pick3d.js"), scripts.index(name))


class TestThemes(TweakUITestCase):
    def theme_css(self, client=None):
        res = (client or self.client).get("/plugins/tweakui/theme.css")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res["Content-Type"].startswith("text/css"))
        self.assertEqual(res["Cache-Control"], "no-store")
        return res.content.decode()

    def test_every_preset_fills_all_of_webodm_s_theme_colours(self):
        from app.models import Theme
        from coreplugins.tweakui.themes import FIELDS, PRESETS
        self.assertEqual(set(FIELDS), {f.name for f in Theme._meta.fields if f.get_internal_type() != "TextField"}
                         - {"id", "name"})
        self.assertEqual(len(PRESETS), 11)
        for preset in PRESETS.values():
            self.assertEqual(set(preset["colors"]), set(FIELDS), preset["name"])
            for color in preset["colors"].values():
                self.assertRegex(color, r"^#[0-9a-f]{6}$", preset["name"])

    def test_a_user_can_choose_a_preset_and_go_back_to_webodm_s_theme(self):
        self.assertEqual(self.patch({"theme": "nord"}).json(), defaults(theme="nord"))
        self.assertEqual(self.patch({"theme": "webodm"}).json(), defaults())

    def test_webodm_s_theme_and_logged_out_users_get_an_empty_stylesheet(self):
        for css in (self.theme_css(), self.theme_css(Client())):
            self.assertNotIn("{", css)

    def test_a_preset_is_webodm_s_theme_with_the_preset_s_colours_and_every_selector_prefixed(self):
        from coreplugins.tweakui.themes import PRESETS
        self.patch({"theme": "catppuccin-mocha"})
        css = self.theme_css()
        colors = PRESETS["catppuccin-mocha"]["colors"]
        self.assertIn("html body,", css)
        self.assertIn("html #navbar-top{\n\tbackground-color: %s;" % colors["header_background"], css)
        self.assertIn(colors["secondary"], css)
        self.assertNotIn("@keyframes", css)
        self.assertNotIn("#0000FF", css)  # WebODM's colour when its theme tag finds no theme
        for rule in css.split("}"):
            head = rule.split("{")[0].strip()
            if head and not head.startswith("/*"):
                for selector in head.split(","):
                    self.assertTrue(selector.strip().startswith("html "), selector)

    def test_administration_keeps_webodm_s_own_theme_variables_and_readable_text(self):
        from coreplugins.tweakui.themes import PRESETS
        self.patch({"theme": "dracula"})
        css = self.theme_css()
        self.assertNotIn("--body-bg", css)
        self.assertIn("html .admin-area,", css)
        self.assertIn("{color: %s;}" % PRESETS["dracula"]["colors"]["secondary"], css)

    def test_dropdown_menu_items_get_the_preset_s_text_colour_over_webodm_s_hard_coded_one(self):
        from coreplugins.tweakui.themes import PRESETS
        self.patch({"theme": "nord"})
        self.assertIn("html .dropdown-menu > li > a{color: %s !important;}" % PRESETS["nord"]["colors"]["primary"],
                      self.theme_css())

    def test_the_header_text_stands_out_and_light_presets_have_a_header_dark_enough_for_the_white_logo(self):
        from coreplugins.tweakui.themes import PRESETS, _luminance
        for preset in PRESETS.values():
            c = preset["colors"]
            self.assertIn(c["header_primary"], (c["primary"], c["secondary"]), preset["name"])
            self.assertLess(_luminance(c["header_background"]), 160, preset["name"])
            self.assertGreater(abs(_luminance(c["header_primary"]) - _luminance(c["header_background"])), 100,
                               preset["name"])

    def test_each_user_gets_their_own_preset(self):
        self.patch({"theme": "dracula"})
        self.assertIn("{", self.theme_css())
        self.assertNotIn("{", self.theme_css(self.login("testuser2")))

    def test_the_white_panels_get_the_preset_s_darker_colour_as_text(self):
        from coreplugins.tweakui.themes import PRESETS
        for preset, text in (("catppuccin-mocha", "secondary"), ("catppuccin-latte", "primary")):
            self.patch({"theme": preset})
            self.assertIn(".layers-control-panel,", self.theme_css())
            self.assertIn("objdetect-panel{color: %s;}" % PRESETS[preset]["colors"][text], self.theme_css())

    def test_the_themes_section_lists_webodm_s_theme_and_the_presets_with_the_saved_one_checked(self):
        res = self.client.get("/plugins/tweakui/")
        self.assertContains(res, 'href="#themes"')
        self.assertContains(res, 'value="webodm" data-setting="theme" checked', html=False)
        self.assertContains(res, 'name="theme"', count=12)
        self.assertContains(res, "Catppuccin Frapp")
        self.patch({"theme": "one-dark"})
        self.assertContains(self.client.get("/plugins/tweakui/"), 'value="one-dark" data-setting="theme" checked')

    def test_settings_js_lists_the_themes_for_the_header_menu_only_when_logged_in(self):
        from app.models import Setting
        from coreplugins.tweakui.themes import PRESETS
        themes = self.script_value(self.client.get("/plugins/tweakui/settings.js").content.decode(), "themes")
        self.assertEqual([t["id"] for t in themes], ["webodm"] + list(PRESETS))
        self.assertEqual(themes[0]["name"], "WebODM's theme")
        self.assertEqual(themes[0]["swatch"][0], Setting.objects.first().theme.secondary)
        self.assertEqual(themes[1]["swatch"][0], PRESETS["catppuccin-latte"]["colors"]["secondary"])
        self.assertIsNone(self.script_value(Client().get("/plugins/tweakui/settings.js").content.decode(), "themes"))


THEMES = "/api/plugins/tweakui/themes"


def a_theme(name="Live", **colors):
    """A theme's {name, colors}: Nord's colours, but for the given ones"""
    from coreplugins.tweakui.themes import PRESETS
    return {"name": name, "colors": dict(PRESETS["nord"]["colors"], **colors)}


class TestCustomThemes(TweakUITestCase):
    def post(self, data, client=None):
        return (client or self.client).post(THEMES, json.dumps(data), content_type="application/json")

    def put(self, theme_id, data, client=None):
        return (client or self.client).put("%s/%s" % (THEMES, theme_id), json.dumps(data),
                                           content_type="application/json")

    def test_a_user_makes_a_theme_lists_it_and_it_is_kept_in_their_own_data_store(self):
        res = self.post(a_theme("  Mine  ", primary="#ABCDEF", unknown="x"))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        theme = res.json()
        self.assertEqual(theme["name"], "Mine")
        self.assertEqual(theme["colors"]["primary"], "#abcdef")
        self.assertNotIn("unknown", theme)
        self.assertEqual(self.client.get(THEMES).json(), [theme])
        user = User.objects.get(username="testuser")
        self.assertEqual(UserDataStore("tweakui", user).get_json("themes"), [theme])

    def test_a_theme_needs_a_name_of_up_to_60_characters_and_all_13_colours_as_rrggbb(self):
        from coreplugins.tweakui.themes import PRESETS
        colors = dict(PRESETS["nord"]["colors"])
        del colors["success"]
        for data, error in ((a_theme(""), "needs a name"), (a_theme("x" * 61), "at most 60"),
                            ({"name": "No colours"}, "needs its colours"),
                            ({"name": "Missing", "colors": colors}, "Missing colours: success"),
                            (a_theme(primary="red"), "not #rrggbb: primary"),
                            (a_theme(border="#fff"), "not #rrggbb: border"),
                            (a_theme(highlight="#ffffff;}body{x"), "not #rrggbb: highlight"),
                            ([], "Expected a theme")):
            res = self.post(data)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, data)
            self.assertIn(error, res.json()["detail"])
        self.assertEqual(self.client.get(THEMES).json(), [])
        self.assertEqual(self.post(a_theme("x" * 60)).status_code, status.HTTP_201_CREATED)

    def test_a_user_has_at_most_50_themes(self):
        user = User.objects.get(username="testuser")
        UserDataStore("tweakui", user).set_json("themes", [dict(a_theme(str(i)), id="%x" % i) for i in range(50)])
        res = self.post(a_theme())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("at most 50", res.json()["detail"])

    def test_a_theme_is_changed_and_deleted_by_its_id(self):
        theme = self.post(a_theme()).json()
        res = self.put(theme["id"], a_theme("Renamed", primary="#000000"))
        self.assertEqual(res.json(), dict(a_theme("Renamed", primary="#000000"), id=theme["id"]))
        self.assertEqual(self.put(theme["id"], a_theme(primary="nope")).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.delete("%s/%s" % (THEMES, theme["id"])).status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.client.get(THEMES).json(), [])
        self.assertEqual(self.client.delete("%s/%s" % (THEMES, theme["id"])).status_code, status.HTTP_404_NOT_FOUND)

    def test_another_user_can_neither_see_change_delete_nor_choose_a_user_s_theme(self):
        theme = self.post(a_theme()).json()
        other = self.login("testuser2")
        self.assertEqual(other.get(THEMES).json(), [])
        self.assertEqual(self.put(theme["id"], a_theme("Taken"), other).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(other.delete("%s/%s" % (THEMES, theme["id"])).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.patch({"theme": "own:" + theme["id"]}, other).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.get(THEMES).json(), [theme])

    def test_logged_out_users_and_requests_without_the_csrf_token_are_refused(self):
        for res in (Client().get(THEMES), Client().post(THEMES, json.dumps(a_theme()), content_type="application/json")):
            self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        strict = Client(enforce_csrf_checks=True)
        strict.login(username="testuser", password="test1234")
        self.assertEqual(self.post(a_theme(), strict).status_code, status.HTTP_403_FORBIDDEN)

    def test_an_own_theme_once_chosen_is_the_user_s_stylesheet(self):
        from coreplugins.tweakui.themes import colors_css
        theme = self.post(a_theme(header_background="#123456")).json()
        self.assertEqual(self.patch({"theme": "own:" + theme["id"]}).json(), defaults(theme="own:" + theme["id"]))
        css = self.client.get("/plugins/tweakui/theme.css").content.decode()
        self.assertIn("html #navbar-top{\n\tbackground-color: #123456;", css)
        self.assertIn(colors_css(theme["colors"]), css)
        self.assertNotIn("{", self.login("testuser2").get("/plugins/tweakui/theme.css").content.decode())

    def test_a_deleted_or_unknown_own_theme_falls_back_to_webodm_s_theme(self):
        theme = self.post(a_theme()).json()
        self.patch({"theme": "own:" + theme["id"]})
        self.client.delete("%s/%s" % (THEMES, theme["id"]))
        self.assertEqual(self.client.get(API).json()["theme"], "webodm")
        self.assertNotIn("{", self.client.get("/plugins/tweakui/theme.css").content.decode())
        self.assertEqual(self.patch({"theme": "own:abc"}).status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_saved_theme_that_no_longer_passes_the_checks_is_left_out(self):
        user = User.objects.get(username="testuser")
        good = dict(a_theme("Good"), id="aa")
        UserDataStore("tweakui", user).set_json("themes", [good, dict(a_theme("Bad", primary="red"), id="bb"),
                                                           dict(a_theme("Bad id"), id="*/x"), "junk"])
        self.assertEqual(self.client.get(THEMES).json(), [good])

    def test_the_preview_is_the_stylesheet_of_the_colours_and_saves_nothing(self):
        from coreplugins.tweakui.themes import colors_css
        res = self.client.post(THEMES + "/preview", json.dumps(a_theme(primary="#010203")),
                               content_type="application/json")
        self.assertEqual(res.json(), {"css": colors_css(a_theme(primary="#010203")["colors"])})
        bad = self.client.post(THEMES + "/preview", json.dumps(a_theme(primary="x")), content_type="application/json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.client.get(THEMES).json(), [])

    def test_my_themes_buttons_come_below_its_heading_and_the_sample_has_its_own_frame_and_heading(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        heading = page.index('id="tweakui-themes-own"')
        self.assertLess(heading, page.index('data-theme-action="new"'))
        self.assertLess(heading, page.index('data-theme-action="import"'))
        self.assertIn('<div class="tweakui-group tweakui-sample-group theme-border-primary">', page)
        self.assertIn("Sample Form for Viewing Theme Effects", page)

    def test_the_themes_section_lists_my_themes_with_edit_and_every_theme_with_copy(self):
        res = self.client.get("/plugins/tweakui/")
        self.assertContains(res, "My Themes")
        self.assertContains(res, 'data-theme-action="new"')
        self.assertContains(res, "None yet")
        self.assertContains(res, 'data-theme-action="copy"', count=12)
        self.assertNotContains(res, 'data-theme-action="edit"')
        theme = self.post(a_theme("Mine <b>")).json()
        self.patch({"theme": "own:" + theme["id"]})
        res = self.client.get("/plugins/tweakui/")
        self.assertContains(res, 'value="own:%s" data-setting="theme" checked' % theme["id"])
        self.assertContains(res, 'data-theme-action="edit"', count=1)
        self.assertContains(res, "Mine &lt;b&gt;")
        self.assertNotContains(res, "None yet")

    def test_the_editor_has_webodm_s_13_colours_in_order_and_the_page_has_every_theme_s_colours(self):
        from coreplugins.tweakui.themes import FIELDS, PRESETS, webodm_colors
        theme = self.post(a_theme("Mine <b>")).json()
        body = self.client.get("/plugins/tweakui/").content.decode()
        self.assertEqual(re.findall(r'class="tweakui-editor-color" data-field="(\w+)"', body), list(FIELDS))
        self.assertIn("Header Background", body)
        self.assertIn("Most text, icons, and borders.", body)
        data = json.loads(re.search(r'<script id="tweakui-theme-colors" type="application/json">(.*?)</script>',
                                    body, re.DOTALL).group(1))
        self.assertEqual(list(data), ["webodm"] + list(PRESETS) + ["own:" + theme["id"]])
        self.assertEqual(data["webodm"]["colors"], webodm_colors())
        self.assertEqual(data["nord"]["colors"], PRESETS["nord"]["colors"])
        self.assertEqual(data["own:" + theme["id"]], {"name": "Mine <b>", "colors": theme["colors"]})
        self.assertNotIn("Mine <b>", body.split('id="tweakui-theme-colors"')[1].split("</script>")[0])

    def test_webodm_s_colours_are_read_as_rrggbb_from_its_theme(self):
        from app.models import Setting
        from coreplugins.tweakui.themes import webodm_colors
        theme = Setting.objects.first().theme
        theme.primary, theme.secondary, theme.border = "#ABC", "#11223344", "not a colour"
        theme.save()
        colors = webodm_colors()
        self.assertEqual((colors["primary"], colors["secondary"], colors["border"]), ("#aabbcc", "#112233", "#e7e7e7"))

    def test_settings_js_lists_the_user_s_own_themes_after_the_presets_for_the_header_menu(self):
        theme = self.post(a_theme("Mine")).json()
        themes = self.script_value(self.client.get("/plugins/tweakui/settings.js").content.decode(), "themes")
        self.assertEqual(themes[-1], {"id": "own:" + theme["id"], "name": "Mine", "group": "own",
                                      "swatch": [theme["colors"][f] for f in
                                                 ("secondary", "primary", "tertiary", "button_primary",
                                                  "header_background")]})
        self.assertEqual({t["group"] for t in themes[:-1]}, {"builtin"})
        other = self.script_value(self.login("testuser2").get("/plugins/tweakui/settings.js").content.decode(), "themes")
        self.assertEqual(len(other), 12)


    def import_(self, data, client=None):
        return (client or self.client).post(THEMES + "/import", json.dumps(data), content_type="application/json")

    def test_an_import_of_one_theme_object_adds_it(self):
        res = self.import_(a_theme("  Night  ", unknown="x"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), {"added": ["Night"], "replaced": [], "refused": []})
        [theme] = self.client.get(THEMES).json()
        self.assertEqual(theme["name"], "Night")
        self.assertEqual(theme["colors"], a_theme()["colors"])

    def test_an_import_of_a_list_replaces_by_name_keeps_the_id_and_refuses_bad_themes_with_why(self):
        mine = self.post(a_theme("Mine")).json()
        self.patch({"theme": "own:" + mine["id"]})
        colors = dict(a_theme()["colors"])
        del colors["border"]
        res = self.import_([a_theme("Mine", primary="#123456"), a_theme("New"), a_theme("Bad", primary="red"),
                            {"name": "Short", "colors": colors}, "text", a_theme("New", primary="#654321")])
        self.assertEqual(res.json(), {"added": ["New"], "replaced": ["Mine"], "refused": [
            {"index": 3, "name": "Bad", "reason": "Colours that are not #rrggbb: primary"},
            {"index": 4, "name": "Short", "reason": "Missing colours: border"},
            {"index": 5, "name": "", "reason": "Expected a theme object"}]})
        themes = self.client.get(THEMES).json()
        self.assertEqual([(t["name"], t["colors"]["primary"]) for t in themes],
                         [("Mine", "#123456"), ("New", "#654321")])
        self.assertEqual(themes[0]["id"], mine["id"])
        self.assertEqual(self.client.get("/api/plugins/tweakui/settings").json()["theme"], "own:" + mine["id"])

    def test_an_import_adds_up_to_50_themes_and_refuses_the_rest_but_still_replaces(self):
        user = User.objects.get(username="testuser")
        UserDataStore("tweakui", user).set_json("themes", [dict(a_theme(str(i)), id="%x" % i) for i in range(49)])
        res = self.import_([a_theme("A"), a_theme("B"), a_theme("0", primary="#000000")]).json()
        self.assertEqual(res["added"], ["A"])
        self.assertEqual(res["replaced"], ["0"])
        self.assertEqual(res["refused"], [{"index": 2, "name": "B", "reason": "Too many themes: at most 50"}])
        self.assertEqual(len(self.client.get(THEMES).json()), 50)

    def test_an_import_that_is_not_a_theme_or_a_list_of_them_is_refused_and_changes_nothing(self):
        for data in ([], "text", 3, [a_theme()] * 501):
            res = self.import_(data)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, data)
        self.assertIn("at most 500", self.import_([a_theme()] * 501).json()["detail"].lower())
        self.assertEqual(self.import_([a_theme(primary="red")]).json()["added"], [])
        self.assertEqual(self.client.get(THEMES).json(), [])
        strict = Client(enforce_csrf_checks=True)
        strict.login(username="testuser", password="test1234")
        self.assertEqual(self.import_(a_theme(), strict).status_code, status.HTTP_403_FORBIDDEN)

    def test_export_downloads_the_user_s_themes_as_a_list_or_one_as_an_object_that_import_takes_back(self):
        res = self.client.get(THEMES + "/export")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Disposition"], 'attachment; filename="tweakui-themes.json"')
        self.assertEqual(json.loads(res.content), [])
        one = self.post(a_theme("Night Sky!")).json()
        self.post(a_theme("Day"))
        exported = json.loads(self.client.get(THEMES + "/export").content)
        self.assertEqual(exported, [a_theme("Night Sky!"), a_theme("Day")])
        res = self.client.get(THEMES + "/export?id=" + one["id"])
        self.assertEqual(res["Content-Disposition"], 'attachment; filename="tweakui-theme-night-sky.json"')
        self.assertEqual(json.loads(res.content), a_theme("Night Sky!"))
        self.assertEqual(self.login("testuser2").get(THEMES + "/export?id=" + one["id"]).status_code,
                         status.HTTP_404_NOT_FOUND)
        self.assertEqual(json.loads(self.login("testuser2").get(THEMES + "/export").content), [])
        self.assertEqual(self.import_(exported).json()["replaced"], ["Night Sky!", "Day"])

    def test_my_themes_have_import_export_and_copy_json_and_my_own_also_export(self):
        res = self.client.get("/plugins/tweakui/")
        self.assertContains(res, 'data-theme-action="import"')
        self.assertContains(res, 'data-theme-action="json"', count=12)
        self.assertNotContains(res, 'href="/api/plugins/tweakui/themes/export"')
        self.assertContains(res, 'class="tweakui-group theme-border tweakui-import" data-import-path="themes/import" hidden')
        theme = self.post(a_theme("Mine")).json()
        res = self.client.get("/plugins/tweakui/")
        self.assertContains(res, 'href="/api/plugins/tweakui/themes/export"')
        self.assertContains(res, 'href="/api/plugins/tweakui/themes/export?id=%s"' % theme["id"])
        self.assertContains(res, 'data-theme-action="json"', count=13)


PUBLISHED = "/api/plugins/tweakui/published"
ADMIN_PAGE = "/plugins/tweakui/admin/themes/"


class TestPublishedThemes(TweakUITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.login("testsuperuser")
        User.objects.create_user(username="teststaff", password="test1234", is_staff=True)

    def own_theme(self, name, client=None, **colors):
        return (client or self.admin).post(THEMES, json.dumps(a_theme(name, **colors)),
                                           content_type="application/json").json()

    def publish(self, theme_id, client=None):
        return (client or self.admin).post(PUBLISHED, json.dumps({"id": theme_id}), content_type="application/json")

    def import_(self, data, client=None):
        return (client or self.admin).post(PUBLISHED + "/import", json.dumps(data), content_type="application/json")

    def test_only_superusers_see_the_page_and_change_published_themes(self):
        theme = self.own_theme("Mine", self.client)
        for client in (self.client, self.login("teststaff")):
            self.assertEqual(client.get(ADMIN_PAGE).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(client.get(PUBLISHED).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(self.publish(theme["id"], client).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(self.import_(a_theme(), client).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(client.get(PUBLISHED + "/export").status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(client.delete(PUBLISHED + "/abc").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Client().get(ADMIN_PAGE).status_code, status.HTTP_302_FOUND)
        self.assertEqual(self.admin.get(ADMIN_PAGE).status_code, status.HTTP_200_OK)
        self.assertEqual(self.admin.get(PUBLISHED).json(), [])
        strict = Client(enforce_csrf_checks=True)
        strict.login(username="testsuperuser", password="test1234")
        self.assertEqual(self.import_(a_theme(), strict).status_code, status.HTTP_403_FORBIDDEN)

    def test_settings_js_tells_only_superusers_to_add_the_administration_link(self):
        body = self.admin.get("/plugins/tweakui/settings.js").content.decode()
        self.assertIs(self.script_value(body, "superuser"), True)
        for client in (self.client, self.login("teststaff"), Client()):
            body = client.get("/plugins/tweakui/settings.js").content.decode()
            self.assertIsNone(self.script_value(body, "superuser"))

    def test_publishing_copies_an_own_theme_and_replaces_a_published_one_of_the_same_name(self):
        mine = self.own_theme("Night")
        res = self.publish(mine["id"])
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        published = res.json()["theme"]
        self.assertNotEqual(published["id"], mine["id"])
        self.assertEqual((published["name"], published["colors"]), ("Night", mine["colors"]))
        self.admin.put("%s/%s" % (THEMES, mine["id"]), json.dumps(a_theme("Night", primary="#123456")),
                       content_type="application/json")
        self.assertEqual(self.admin.get(PUBLISHED).json()[0]["colors"]["primary"], mine["colors"]["primary"])
        res = self.publish(mine["id"])
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), {"theme": dict(published, colors=dict(published["colors"], primary="#123456")),
                                      "replaced": True})
        self.assertEqual(len(self.admin.get(PUBLISHED).json()), 1)
        other = self.own_theme("Theirs", self.login("testuser2"))
        self.assertEqual(self.publish(other["id"]).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.publish(None).status_code, status.HTTP_400_BAD_REQUEST)

    def test_every_user_can_list_choose_and_copy_a_published_theme_but_not_change_it(self):
        published = self.publish(self.own_theme("Shared", primary="#abcdef")["id"]).json()["theme"]
        theme_id = "published:" + published["id"]
        listed = self.script_value(self.client.get("/plugins/tweakui/settings.js").content.decode(), "themes")
        self.assertEqual([t["group"] for t in listed[-1:]], ["published"])
        self.assertEqual(listed[-1]["id"], theme_id)
        own = self.own_theme("Mine", self.client)
        listed = self.script_value(self.client.get("/plugins/tweakui/settings.js").content.decode(), "themes")
        self.assertEqual([t["group"] for t in listed[-2:]], ["published", "own"])
        self.assertEqual(self.patch({"theme": theme_id}).status_code, status.HTTP_200_OK)
        css = self.client.get("/plugins/tweakui/theme.css").content.decode()
        self.assertIn("/* TweakUI theme: %s */" % theme_id, css)
        self.assertIn("#abcdef", css)
        self.assertEqual(self.client.put("%s/%s" % (THEMES, published["id"]), json.dumps(a_theme("X")),
                                         content_type="application/json").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete("%s/%s" % (THEMES, published["id"])).status_code,
                         status.HTTP_404_NOT_FOUND)
        page = self.client.get("/plugins/tweakui/")
        self.assertContains(page, 'id="tweakui-themes-published"')
        self.assertContains(page, 'data-theme-id="%s"' % theme_id)
        self.assertContains(page, 'data-theme-action="edit"', count=1)  # only Mine
        self.assertEqual(page.context["theme_colors"][theme_id]["colors"]["primary"], "#abcdef")
        self.assertIn("own:" + own["id"], page.context["theme_colors"])
        self.assertEqual(self.patch({"theme": "published:abc"}).status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_published_group_shows_only_when_there_are_published_themes(self):
        self.assertNotContains(self.client.get("/plugins/tweakui/"), 'id="tweakui-themes-published"')

    def test_a_deleted_published_theme_falls_back_to_webodm_s_theme(self):
        published = self.publish(self.own_theme("Gone")["id"]).json()["theme"]
        self.patch({"theme": "published:" + published["id"]})
        self.assertEqual(self.admin.delete("%s/%s" % (PUBLISHED, published["id"])).status_code,
                         status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.admin.delete("%s/%s" % (PUBLISHED, published["id"])).status_code,
                         status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get(API).json()["theme"], "webodm")
        self.assertEqual(self.client.get("/plugins/tweakui/theme.css").content.decode(),
                         "/* TweakUI theme: webodm */\n")

    def test_import_and_export_of_published_themes_replace_by_name_and_round_trip(self):
        self.publish(self.own_theme("Night")["id"])
        res = self.import_([a_theme("Night", primary="#111111"), a_theme("Day"), a_theme("Bad", primary="red")])
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), {"added": ["Day"], "replaced": ["Night"], "refused": [
            {"index": 3, "name": "Bad", "reason": "Colours that are not #rrggbb: primary"}]})
        self.assertEqual(self.client.get(THEMES).json(), [])  # not into anyone's own
        res = self.admin.get(PUBLISHED + "/export")
        self.assertEqual(res["Content-Disposition"], 'attachment; filename="tweakui-published-themes.json"')
        exported = json.loads(res.content)
        self.assertEqual(exported, [a_theme("Night", primary="#111111"), a_theme("Day")])
        day = self.admin.get(PUBLISHED).json()[1]
        res = self.admin.get(PUBLISHED + "/export?id=" + day["id"])
        self.assertEqual(res["Content-Disposition"], 'attachment; filename="tweakui-published-theme-day.json"')
        self.assertEqual(json.loads(res.content), a_theme("Day"))
        self.assertEqual(self.admin.get(PUBLISHED + "/export?id=abc").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.import_(exported).json()["replaced"], ["Night", "Day"])
        self.assertEqual(self.import_("text").status_code, status.HTTP_400_BAD_REQUEST)

    def test_at_most_50_published_themes(self):
        from app.plugins.data_store import GlobalDataStore
        GlobalDataStore("tweakui").set_json("published_themes",
                                            [dict(a_theme(str(i)), id="%x" % i) for i in range(50)])
        res = self.publish(self.own_theme("One more")["id"])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.json()["detail"], "Too many themes: at most 50")
        self.assertEqual(self.publish(self.own_theme("0", primary="#000000")["id"]).status_code, status.HTTP_200_OK)

    def test_the_page_lists_published_themes_with_their_actions_and_the_superuser_s_own_to_publish(self):
        res = self.admin.get(ADMIN_PAGE)
        self.assertContains(res, "None yet")
        self.assertContains(res, "You have no themes of your own yet")
        self.assertContains(res, 'data-import-path="published/import"')
        self.assertNotContains(res, 'href="/api/plugins/tweakui/published/export"')
        mine = self.own_theme("Night")
        published = self.publish(mine["id"]).json()["theme"]
        res = self.admin.get(ADMIN_PAGE)
        self.assertContains(res, 'data-theme-id="published:%s"' % published["id"])
        self.assertContains(res, 'href="/api/plugins/tweakui/published/export"')
        self.assertContains(res, 'href="/api/plugins/tweakui/published/export?id=%s"' % published["id"])
        self.assertContains(res, 'data-theme-action="delete"', count=1)
        self.assertContains(res, 'data-theme-action="json"', count=1)
        self.assertContains(res, '<option value="%s">Night</option>' % mine["id"])
        self.assertIn("published:" + published["id"], res.context["theme_colors"])


class TestSourceFrames(TweakUITestCase):
    """Two cameras 100 m above flat ground (a DSM at 20 m), looking straight down, 30 m apart in x: each photo is
    4000 x 3000 px with a focal of 0.8 (of its largest side), so it shows the ground 62.5 m either side in x"""
    X, Y, EPSG = 500000.0, 4600000.0, 32616
    DOWN = (math.pi, 0, 0)

    def setUp(self):
        super().setUp()
        self.user = User.objects.get(username="testuser")
        self.project = Project.objects.create(owner=self.user, name="Source Frames test")
        self.task = Task.objects.create(project=self.project, name="Cameras", epsg=self.EPSG,
                                        available_assets=["shots.geojson", "cameras.json", "dsm.tif"])
        self.url = "/api/plugins/tweakui/frames/%s/%s" % (self.project.id, self.task.id)
        os.makedirs(self.task.assets_path("odm_report"), exist_ok=True)
        os.makedirs(self.task.assets_path("odm_dem"), exist_ok=True)
        shots = {"type": "FeatureCollection", "features": [
            self.shot("a.jpg", self.X, 1000), self.shot("b.jpg", self.X + 30, 1001)]}
        with open(self.task.assets_path("odm_report", "shots.geojson"), "w") as f:
            json.dump(shots, f)
        with open(self.task.assets_path("cameras.json"), "w") as f:
            json.dump({"test 4000 3000 brown 0.8": {"projection_type": "brown", "width": 4000, "height": 3000,
                                                    "focal_x": 0.8, "focal_y": 0.8, "c_x": 0, "c_y": 0,
                                                    "k1": 0, "k2": 0, "k3": 0, "p1": 0, "p2": 0}}, f)
        self.write_dsm(20.0)

    def tearDown(self):
        path = self.task.task_path()
        if os.path.isdir(path) and str(self.task.id) in path:
            shutil.rmtree(path)
        super().tearDown()

    def shot(self, name, x, time):
        return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0, 120.0]},
                "properties": {"filename": name, "camera": "v2 test 4000 3000 brown 0.8", "focal": 0.8,
                               "width": 4000, "height": 3000, "capture_time": time,
                               "translation": [x, self.Y, 120.0], "rotation": list(self.DOWN)}}

    def write_dsm(self, height):
        import numpy
        import rasterio
        from rasterio.transform import from_origin
        with rasterio.open(self.task.assets_path("odm_dem", "dsm.tif"), "w", driver="GTiff", width=300, height=300,
                           count=1, dtype="float32", crs="EPSG:%s" % self.EPSG, nodata=-9999.0,
                           transform=from_origin(self.X - 150, self.Y + 150, 1, 1)) as dsm:
            dsm.write(numpy.full((1, 300, 300), height, dtype="float32"))

    def post(self, data, client=None, url=None):
        return (client or self.client).post(url or self.url, json.dumps(data), content_type="application/json")

    def lnglat(self, x, y):
        from pyproj import Transformer
        return list(Transformer.from_crs("EPSG:%s" % self.EPSG, "EPSG:4326", always_xy=True).transform(x, y))

    def test_shots_without_a_size_or_a_pose_are_left_out_and_the_others_still_found(self):
        broken = [self.shot("no-size.jpg", self.X, 1), self.shot("no-pose.jpg", self.X, 2),
                  self.shot("bad-rotation.jpg", self.X, 3), "not a shot", {"properties": None}]
        del broken[0]["properties"]["width"]
        del broken[1]["properties"]["translation"]
        broken[2]["properties"]["rotation"] = "down"
        shots = {"type": "FeatureCollection", "features": broken + [self.shot("a.jpg", self.X, 1000)]}
        with open(self.task.assets_path("odm_report", "shots.geojson"), "w") as f:
            json.dump(shots, f)
        res = self.post({"type": "Point", "coordinates": self.lnglat(self.X, self.Y)})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([f["filename"] for f in res.json()["frames"]], ["a.jpg"])

    def test_a_cameras_file_that_is_not_an_object_finds_no_photo(self):
        with open(self.task.assets_path("cameras.json"), "w") as f:
            json.dump(["not", "cameras"], f)
        res = self.post({"type": "Point", "coordinates": self.lnglat(self.X, self.Y)})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["frames"], [])

    def test_a_spots_photos_are_those_that_show_it_nearest_their_centre_first(self):
        res = self.post({"type": "Point", "coordinates": self.lnglat(self.X, self.Y)})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        found = res.json()["frames"]
        self.assertEqual([f["filename"] for f in found], ["a.jpg", "b.jpg"])
        # Below camera a: its photo's centre; 30 m from b at 100 m: 0.8 * 0.3 of the width left of its centre
        self.assertEqual(found[0]["spot"], [0.5, 0.5])
        self.assertAlmostEqual(found[1]["spot"][0], 0.5 - 0.8 * 0.3, places=3)
        self.assertEqual(found[0]["capture_time"], 1000)
        self.assertEqual(found[0]["altitude"], 120.0)
        # 70 m from a (out of its photo), 40 m from b
        found = self.post({"type": "Point", "coordinates": self.lnglat(self.X + 70, self.Y)}).json()["frames"]
        self.assertEqual([f["filename"] for f in found], ["b.jpg"])
        # Far away: none
        self.assertEqual(self.post({"type": "Point", "coordinates": self.lnglat(self.X + 500, self.Y)}).json(),
                         {"frames": []})

    def test_the_ground_height_comes_from_the_dsm_else_the_point_clouds_mean_height(self):
        # Ground 50 m higher: 70 m below the cameras, so 46 m from a is still in its photo (0.8 * 46 / 70 < 0.5 + ...)
        self.write_dsm(50.0)
        found = self.post({"type": "Point", "coordinates": self.lnglat(self.X + 40, self.Y)}).json()["frames"]
        self.assertAlmostEqual(found[-1]["spot"][0], 0.5 + 0.8 * 40 / 70, places=3)
        os.remove(self.task.assets_path("odm_dem", "dsm.tif"))
        res = self.post({"type": "Point", "coordinates": self.lnglat(self.X, self.Y)})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no ground height", res.json()["detail"])
        os.makedirs(self.task.assets_path("entwine_pointcloud"), exist_ok=True)
        with open(self.task.assets_path("entwine_pointcloud", "ept.json"), "w") as f:
            json.dump({"schema": [{"name": "Z", "mean": 50.0}]}, f)
        found = self.post({"type": "Point", "coordinates": self.lnglat(self.X + 40, self.Y)}).json()["frames"]
        self.assertAlmostEqual(found[-1]["spot"][0], 0.5 + 0.8 * 40 / 70, places=3)

    def test_a_3d_pick_gives_its_own_height_in_the_tasks_coordinates(self):
        # Picked on a roof 60 m below the cameras: 30 m from b is 0.8 * 30 / 60 from its centre
        found = self.post({"type": "Point", "coordinates": [self.X, self.Y, 60.0], "crs": "task"}).json()["frames"]
        self.assertAlmostEqual(found[1]["spot"][0], 0.5 - 0.8 * 0.5, places=3)
        res = self.post({"type": "Point", "coordinates": [self.X, self.Y], "crs": "task"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_tasks_files_are_read_as_utf_8_whatever_the_system_s_encoding(self):
        # ODM writes them in UTF-8; Windows' default encoding is cp1252, which the patch makes open()'s default
        path = self.task.assets_path("cameras.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"Caméra 4000 3000 brown 0.8": {"width": 4000}}, f, ensure_ascii=False)

        def windows_open(file, mode="r", **kwargs):
            return open(file, mode, **dict({"encoding": "cp1252"}, **kwargs))
        with mock.patch("coreplugins.tweakui.frames.open", windows_open, create=True):
            self.assertEqual(frames.load_json(path), {"Caméra 4000 3000 brown 0.8": {"width": 4000}})

    def test_anything_but_a_spot_and_tasks_without_cameras_are_refused(self):
        ring = [self.lnglat(x, y) for x, y in ((self.X, self.Y), (self.X + 9, self.Y), (self.X, self.Y + 9), (self.X, self.Y))]
        for data in ({}, {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}, {"type": "Point", "coordinates": "x"},
                     {"type": "Polygon", "coordinates": [ring]}, {"type": "Point", "coordinates": [0, 0, 0, 0]},
                     {"type": "Point", "coordinates": [0, 0], "crs": "EPSG:4326"}):
            self.assertEqual(self.post(data).status_code, status.HTTP_400_BAD_REQUEST, data)
        self.task.available_assets = ["orthophoto.tif"]
        self.task.save()
        res = self.post({"type": "Point", "coordinates": self.lnglat(self.X, self.Y)})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.json()["detail"], "This task has no cameras")

    def test_only_those_who_can_see_the_task_find_its_photos(self):
        point = {"type": "Point", "coordinates": self.lnglat(self.X, self.Y)}
        self.assertEqual(self.post(point, client=self.login("testuser2")).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.post(point, client=Client()).status_code, status.HTTP_404_NOT_FOUND)
        other = Project.objects.create(owner=self.user, name="Other")
        url = "/api/plugins/tweakui/frames/%s/%s" % (other.id, self.task.id)
        self.assertEqual(self.post(point, url=url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class TestStorage(TweakUITestCase):
    """testuser owns "User Test Project" (BootTestCase's, no tasks) and two projects of tasks of known sizes;
    testuser2 and testsuperuser own a project each"""
    MB = 1024 * 1024

    def setUp(self):
        super().setUp()
        from app import pending_actions
        from nodeodm import status_codes
        self.user = User.objects.get(username="testuser")
        self.big = Project.objects.create(owner=self.user, name="Big")
        self.small = Project.objects.create(owner=self.user, name="Small")
        self.done = Task.objects.create(project=self.big, name="Done", status=status_codes.COMPLETED, size=300.0)
        self.failed = Task.objects.create(project=self.big, name="Failed", status=status_codes.FAILED, size=20.0)
        self.compacted = Task.objects.create(project=self.small, name="Compacted", status=status_codes.COMPLETED,
                                             compacted=True, size=10.0)
        self.removing = Task.objects.create(project=self.small, name="Going", status=status_codes.CANCELED,
                                            pending_action=pending_actions.REMOVE, size=5.0)
        self.importing = Task.objects.create(project=self.small, name="Arriving", status=status_codes.RUNNING,
                                             pending_action=pending_actions.IMPORT, size=0.0)
        self.other = Project.objects.create(owner=User.objects.get(username="testuser2"), name="Theirs")
        self.theirs = Task.objects.create(project=self.other, name="Theirs", status=status_codes.COMPLETED, size=50.0)

    def tearDown(self):
        for task in (self.done, self.failed, self.compacted, self.removing, self.importing, self.theirs):
            path = task.task_path()
            if os.path.isdir(path) and str(task.id) in path:
                shutil.rmtree(path)
        super().tearDown()

    def report(self, client=None):
        res = (client or self.client).get("/api/plugins/tweakui/storage")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return res.json()

    def write(self, path, size):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(b"x" * size)

    def test_a_user_sees_the_projects_they_own_largest_first_with_their_tasks_and_sizes(self):
        r = self.report()
        self.assertFalse(r["admin"])
        self.assertEqual(r["others"], [])
        self.assertEqual(r["me"]["user"]["username"], "testuser")
        self.assertEqual([p["name"] for p in r["me"]["projects"]], ["Big", "Small", "User Test Project"])
        big = r["me"]["projects"][0]
        self.assertEqual(big["size"], 320 * self.MB)
        self.assertEqual([(t["name"], t["size"], t["mark"]) for t in big["tasks"]],
                         [("Done", 300 * self.MB, "compactable"), ("Failed", 20 * self.MB, "failed")])
        small = r["me"]["projects"][1]["tasks"]
        self.assertEqual([(t["name"], t["mark"], t["compacted"]) for t in small],
                         [("Compacted", None, True), ("Going", "removing", False), ("Arriving", "importing", False)])
        self.assertEqual(r["me"]["used"], 335 * self.MB)
        self.assertIsNone(r["me"]["quota"])
        self.assertNotIn("Theirs", json.dumps(r))

    def test_the_quota_is_the_users_and_a_shared_project_is_not_listed(self):
        from guardian.shortcuts import assign_perm
        profile = self.user.profile
        profile.quota = 1000
        profile.save()
        assign_perm("view_project", self.user, self.other)
        r = self.report()
        self.assertEqual(r["me"]["quota"], 1000 * self.MB)
        self.assertNotIn("Theirs", [p["name"] for p in r["me"]["projects"]])

    def test_a_project_being_deleted_is_not_listed(self):
        self.small.deleting = True
        self.small.save()
        self.assertNotIn("Small", [p["name"] for p in self.report()["me"]["projects"]])

    def test_an_admin_also_sees_every_other_user_who_owns_a_project_largest_first(self):
        r = self.report(self.login("testsuperuser"))
        self.assertTrue(r["admin"])
        self.assertEqual(r["me"]["user"]["username"], "testsuperuser")
        self.assertEqual([s["user"]["username"] for s in r["others"]], ["testuser", "testuser2"])
        self.assertEqual(r["others"][0]["used"], 335 * self.MB)
        self.assertEqual([p["name"] for p in r["others"][1]["projects"]], ["Theirs", "User 2 Test Project"])

    def test_an_admins_report_takes_as_many_queries_however_many_projects_and_tasks_there_are(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        client = self.login("testsuperuser")
        with CaptureQueriesContext(connection) as before:
            self.report(client)
        for i in range(3):
            project = Project.objects.create(owner=User.objects.get(username="testuser2"), name="More %d" % i)
            Task.objects.create(project=project, name="More", size=1.0)
        with CaptureQueriesContext(connection) as after:
            r = self.report(client)
        self.assertEqual(len(after), len(before))
        self.assertEqual(r["others"][1]["used"], 53 * self.MB)
        self.assertEqual(len(r["others"][1]["projects"]), 5)

    def test_a_tasks_breakdown_sorts_its_files_by_kind(self):
        self.write(os.path.join(self.done.task_path(), "a.jpg"), 1000)
        self.write(os.path.join(self.done.task_path(), "b.jpg"), 500)
        self.write(self.done.assets_path("odm_orthophoto", "odm_orthophoto.tif"), 300)
        self.write(self.done.assets_path("odm_dem", "dsm.tif"), 200)
        self.write(self.done.assets_path("entwine_pointcloud", "ept.json"), 40)
        self.write(self.done.assets_path("odm_georeferencing", "odm_georeferenced_model.laz"), 60)
        self.write(self.done.assets_path("odm_texturing", "odm_textured_model_geo.obj"), 70)
        self.write(self.done.assets_path("all.zip"), 5)
        self.write(self.done.assets_path("odm_report", "report.pdf"), 7)
        self.write(os.path.join(self.done.task_path(), "data", "x"), 3)
        res = self.client.get("/api/plugins/tweakui/storage/%s/%s" % (self.big.id, self.done.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["kinds"], {"photos": 1500, "orthophoto": 300, "elevation": 200,
                                               "point_cloud": 100, "textured_model": 70, "other": 15})
        self.assertEqual(res.json()["size"], 300 * self.MB)

    def test_a_breakdown_is_for_the_owner_and_admins_only(self):
        url = "/api/plugins/tweakui/storage/%s/%s" % (self.other.id, self.theirs.id)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.login("testuser2").get(url).status_code, status.HTTP_200_OK)
        self.assertEqual(self.login("testsuperuser").get(url).json()["kinds"]["photos"], 0)
        wrong = "/api/plugins/tweakui/storage/%s/%s" % (self.big.id, self.theirs.id)
        self.assertEqual(self.login("testuser2").get(wrong).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Client().get("/api/plugins/tweakui/storage").status_code, status.HTTP_403_FORBIDDEN)

    def test_a_task_id_that_is_not_a_uuid_is_not_found(self):
        res = self.client.get("/api/plugins/tweakui/storage/%s/not-a-uuid" % self.big.id)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_an_assets_folder_that_cannot_be_read_counts_as_nothing(self):
        self.write(os.path.join(self.done.task_path(), "a.jpg"), 1000)
        self.write(self.done.assets_path("odm_dem", "dsm.tif"), 200)
        scandir = os.scandir

        def refuse_assets(path):
            if str(path).endswith("assets"):
                raise PermissionError(path)
            return scandir(path)

        with mock.patch("coreplugins.tweakui.storage.os.scandir", side_effect=refuse_assets):
            res = self.client.get("/api/plugins/tweakui/storage/%s/%s" % (self.big.id, self.done.id))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["kinds"]["photos"], 1000)
        self.assertEqual(res.json()["kinds"]["elevation"], 0)

    def test_the_setting_is_off_by_default_in_the_diagnostic_section_and_the_page_says_where_to_turn_it_on(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        self.assertIn('href="#diagnostic"', page)
        section = page[page.index('<section id="tweakui-diagnostic"'):]
        self.assertIn('data-setting="storage_view">', section[:section.index("</section>")])
        off = self.client.get("/plugins/tweakui/storage/")
        self.assertEqual(off.status_code, status.HTTP_200_OK)
        self.assertContains(off, 'href="/plugins/tweakui/#diagnostic"')
        self.assertNotContains(off, "storage_page.js")
        self.assertEqual(self.patch({"storage_view": True}).json(), defaults(storage_view=True))
        on = self.client.get("/plugins/tweakui/storage/")
        self.assertContains(on, "storage_page.js")
        self.assertContains(on, 'data-api="/api/plugins/tweakui/"')
        self.assertContains(on, "csrfmiddlewaretoken")
        self.assertNotContains(on, "comment %}")
        self.assertEqual(self.script_settings(self.client)["storage_view"], True)
        self.assertEqual(Client().get("/plugins/tweakui/storage/").status_code, status.HTTP_302_FOUND)


class FakeInfo:
    """What pyodx's Node.info() gives for a node"""
    def __init__(self, **values):
        self.__dict__.update({"version": "2.4.0", "task_queue_count": 0, "total_memory": 64 * GB,
                              "available_memory": 48 * GB, "cpu_cores": 16, "max_images": None,
                              "max_parallel_tasks": 1, "engine": "odx", "engine_version": "3.8.5"}, **values)


GB = 1024 ** 3


class TestPerformance(TweakUITestCase):
    """testuser owns a project of completed tasks of known photos and times (one with a stats.json); testuser2 owns
    one; the processing nodes are asked through a mocked pyodx"""

    def setUp(self):
        super().setUp()
        from nodeodm import status_codes
        from nodeodm.models import ProcessingNode
        from guardian.shortcuts import assign_perm
        self.user = User.objects.get(username="testuser")
        self.project = Project.objects.create(owner=self.user, name="Flights")
        self.node = ProcessingNode.objects.create(hostname="big-node", port=3000, label="Big Node")
        self.small = ProcessingNode.objects.create(hostname="small-node", port=3000)
        self.hidden = ProcessingNode.objects.create(hostname="hidden-node", port=3000)
        for n in (self.node, self.small):
            assign_perm("view_processingnode", self.user, n)
        # Oldest first: 2, 2, 4 and 4 seconds a photo, then a running one and one without a time
        self.tasks = []
        for i, (images, ms) in enumerate([(100, 200000), (100, 200000), (200, 800000), (300, 1200000)]):
            self.tasks.append(Task.objects.create(project=self.project, name="T%d" % i, status=status_codes.COMPLETED,
                                                  images_count=images, processing_time=ms, processing_node=self.node))
        self.running = Task.objects.create(project=self.project, name="Running", status=status_codes.RUNNING,
                                           images_count=50)
        self.untimed = Task.objects.create(project=self.project, name="Untimed", status=status_codes.COMPLETED,
                                           images_count=0, processing_time=-1)
        self.other = Project.objects.create(owner=User.objects.get(username="testuser2"), name="Theirs")
        self.theirs = Task.objects.create(project=self.other, name="Theirs", status=status_codes.COMPLETED,
                                          images_count=2000, processing_time=4000000)
        stats = self.tasks[-1].assets_path("odm_report")
        os.makedirs(stats, exist_ok=True)
        with open(os.path.join(stats, "stats.json"), "w") as f:
            json.dump({"processing_statistics": {"steps_times": {"Feature Extraction": 30.5, "Reconstruction": 90.0,
                                                                 "Total Time": 130.0}},
                       "odm_processing_statistics": {"average_gsd": 1.5}}, f)
        self.patch({"performance_view": True})

    def tearDown(self):
        for task in self.tasks + [self.running, self.untimed, self.theirs]:
            path = task.task_path()
            if os.path.isdir(path) and str(task.id) in path:
                shutil.rmtree(path)
        super().tearDown()

    def report(self, infos=None, client=None):
        """The report, each node answering with infos[hostname] (a FakeInfo), or not at all when it has none"""
        from pyodx import exceptions as odx_exceptions
        infos = {"big-node": FakeInfo(), "small-node": FakeInfo(total_memory=8 * GB, available_memory=2 * GB,
                                                                  task_queue_count=3)} if infos is None else infos

        def api_client(node, timeout=30):
            client = mock.Mock()
            if node.hostname in infos:
                client.info.return_value = infos[node.hostname]
            else:
                client.info.side_effect = odx_exceptions.NodeConnectionError("refused")
            return client

        with mock.patch("nodeodm.models.ProcessingNode.api_client", autospec=True, side_effect=api_client):
            res = (client or self.client).get("/api/plugins/tweakui/performance")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return res.json()

    def test_the_nodes_the_user_may_use_are_asked_and_report_their_cores_memory_and_queue(self):
        r = self.report()
        self.assertEqual([n["name"] for n in r["nodes"]], ["Big Node", "small-node:3000"])
        big = r["nodes"][0]
        self.assertEqual((big["online"], big["cpu_cores"], big["total_memory"], big["available_memory"], big["queue"],
                          big["max_parallel_tasks"], big["engine"], big["engine_version"]),
                         (True, 16, 64 * GB, 48 * GB, 0, 1, "odx", "3.8.5"))
        self.assertEqual(big["suits_images"], 1500)
        self.assertEqual(r["nodes"][1]["suits_images"], 110)

    def test_a_node_that_does_not_answer_is_shown_as_such_with_what_webodm_last_stored(self):
        r = self.report({"big-node": FakeInfo()})
        small = r["nodes"][1]
        self.assertEqual((small["online"], small["total_memory"], small["suits_images"]), (False, None, None))
        self.assertIn({"level": "warning", "text": "small-node:3000 is not answering."}, r["verdicts"])
        none = self.report({})
        self.assertEqual(none["verdicts"][0]["level"], "danger")
        self.assertIn("No processing node is answering", none["verdicts"][0]["text"])

    def test_a_user_with_no_node_is_told_no_task_can_be_processed(self):
        r = self.report(client=self.login("testuser2"))
        self.assertEqual(r["nodes"], [])
        self.assertEqual(r["verdicts"][0]["level"], "danger")

    def test_the_recent_tasks_are_the_users_finished_ones_newest_first_with_time_per_photo_and_slowest_step(self):
        r = self.report()
        self.assertFalse(r["admin"])
        self.assertEqual([t["name"] for t in r["tasks"]], ["Untimed", "T3", "T2", "T1", "T0"])
        t3 = r["tasks"][1]
        self.assertEqual((t3["images"], t3["seconds"], t3["seconds_per_image"], t3["node"], t3["owner"]),
                         (300, 1200.0, 4.0, "Big Node", None))
        self.assertEqual(t3["slowest_step"], {"name": "Reconstruction", "seconds": 90.0})
        self.assertEqual(t3["average_gsd"], 1.5)
        untimed = r["tasks"][0]
        self.assertEqual((untimed["seconds"], untimed["seconds_per_image"], untimed["slowest_step"]), (None, None, None))
        self.assertEqual(r["largest"], 300)

    def test_the_trend_compares_the_newer_half_with_the_older_by_median_time_per_photo(self):
        trend = self.report()["trend"]
        self.assertEqual((trend["recent"], trend["earlier"], trend["change"], trend["same"]), (4.0, 2.0, 1.0, False))
        from coreplugins.tweakui import performance
        self.assertIsNone(performance.trend([{"seconds_per_image": 2}] * 3))
        self.assertTrue(performance.trend([{"seconds_per_image": s} for s in (2.1, 2.0, 2.0, 2.0)])["same"])

    def test_an_admin_sees_every_users_tasks_and_the_largest_on_the_server(self):
        r = self.report(client=self.login("testsuperuser"))
        self.assertTrue(r["admin"])
        theirs = next(t for t in r["tasks"] if t["name"] == "Theirs")
        self.assertEqual(theirs["owner"], "testuser2")
        self.assertEqual(r["largest"], 2000)
        self.assertIn("hidden-node:3000", [n["name"] for n in r["nodes"]])

    def test_the_verdicts_weigh_memory_queue_and_disk_against_webodms_requirements(self):
        r = self.report()
        texts = [v["text"] for v in r["verdicts"]]
        self.assertIn("Big Node has enough memory for your largest task (300 photos, about 19 GB).", texts)
        self.assertIn("2 tasks are waiting on small-node:3000: it processes 1 at a time.", texts)
        self.assertIn("Big Node suits about 1,500 photos per task (64 GB of memory).", texts)
        self.assertIn("small-node:3000 suits about 110 photos per task (8.0 GB of memory).", texts)
        levels = [v["level"] for v in r["verdicts"]]
        self.assertEqual(levels, sorted(levels, key=["danger", "warning", "success"].index))
        too_small = self.report({"big-node": FakeInfo(total_memory=12 * GB)})
        self.assertIn("Your largest task (300 photos) needs about 19 GB of memory; the most any node has is 12 GB. "
                      "Add memory (or swap), or split the task.", [v["text"] for v in too_small["verdicts"]])
        tiny = self.report({"big-node": FakeInfo(total_memory=2 * GB, available_memory=GB)})["verdicts"]
        self.assertEqual(tiny[0], {"level": "danger", "text": "Big Node has under 4 GB of memory (2.0 GB): too little "
                                                              "for even a small task."})
        low = shutil.disk_usage(".")._replace(free=50 * GB)
        with mock.patch("coreplugins.tweakui.performance.shutil.disk_usage", return_value=low), \
                mock.patch("coreplugins.tweakui.performance.memory_stats",
                           return_value={"total": 8 * GB, "free": 4 * GB, "used": 4 * GB}):
            texts = [v["text"] for v in self.report()["verdicts"]]
        self.assertIn("The server's disk has 50 GB free; WebODM recommends at least 100 GB.", texts)
        self.assertIn("The server has 8.0 GB of memory; WebODM recommends at least 16 GB.", texts)

    def test_the_memory_table_is_read_between_its_rows(self):
        from coreplugins.tweakui import performance
        self.assertEqual(performance.images_for_memory(16 * GB), 250)
        self.assertEqual(performance.images_for_memory(48 * GB), 1000)
        self.assertEqual(performance.images_for_memory(2 * GB), 0)
        self.assertIsNone(performance.images_for_memory(512 * GB))
        self.assertEqual(performance.memory_for_images(20), 4 * GB)
        self.assertEqual(performance.memory_for_images(1000), 48 * GB)
        self.assertEqual(performance.memory_for_images(6500), 320 * GB)

    def test_a_missing_or_partial_stats_json_leaves_the_steps_out(self):
        from coreplugins.tweakui import performance
        empty = {"steps": {}, "average_gsd": None, "photos_given": None, "photos_reconstructed": None,
                 "components": None, "area": None, "position_error": None}
        self.assertEqual(performance.read_stats(self.tasks[0]), empty)
        path = self.tasks[0].assets_path("odm_report")
        os.makedirs(path, exist_ok=True)
        for content in ("not json", "[]", ('{"processing_statistics": {"steps_times": "?", "area": "big"}, '
                                          '"reconstruction_statistics": [], "gps_errors": {"average_error": true}}')):
            with open(os.path.join(path, "stats.json"), "w") as f:
                f.write(content)
            self.assertEqual(performance.read_stats(self.tasks[0]), empty)

    def write_stats(self, task, **reconstruction):
        path = task.assets_path("odm_report")
        os.makedirs(path, exist_ok=True)
        stats = {"processing_statistics": {"area": 384.7},
                 "reconstruction_statistics": dict({"components": 1, "has_gcp": False, "initial_shots_count": 220,
                                                    "reconstructed_shots_count": 208}, **reconstruction),
                 "gps_errors": {"average_error": 0.0236}, "gcp_errors": {"average_error": 0.012}}
        with open(os.path.join(path, "stats.json"), "w") as f:
            json.dump(stats, f)

    def write_log(self, task, lines):
        os.makedirs(task.data_path(), exist_ok=True)
        with open(task.data_path("console_output.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

    def task_of(self, name, r=None):
        return next(t for t in (r or self.report())["tasks"] if t["name"] == name)

    def test_failed_and_canceled_tasks_are_listed_with_their_error_but_left_out_of_the_trend(self):
        from nodeodm import status_codes
        failed = Task.objects.create(project=self.project, name="Failed", status=status_codes.FAILED, images_count=100,
                                     processing_time=600000, last_error="Process exited with code 137")
        canceled = Task.objects.create(project=self.project, name="Canceled", status=status_codes.CANCELED,
                                       images_count=100, processing_time=1000, last_error="left over")
        for t in (failed, canceled):
            self.addCleanup(shutil.rmtree, t.task_path(), True)
        r = self.report()
        self.assertEqual([t["name"] for t in r["tasks"]], ["Canceled", "Failed", "Untimed", "T3", "T2", "T1", "T0"])
        f, c = r["tasks"][1], r["tasks"][0]
        self.assertEqual((f["status"], f["error"], f["seconds"], f["seconds_per_image"]),
                         ("failed", "Process exited with code 137", 600.0, None))
        self.assertEqual((c["status"], c["error"]), ("canceled", None))
        self.assertEqual(r["tasks"][3]["status"], "completed")
        trend = r["trend"]
        self.assertEqual((trend["recent"], trend["earlier"]), (4.0, 2.0))

    def test_the_photos_placed_area_and_position_error_come_from_stats_json(self):
        self.write_stats(self.tasks[0])
        t0 = self.task_of("T0")
        self.assertEqual((t0["photos_given"], t0["photos_reconstructed"], t0["area"], t0["reconstructions"],
                          t0["position_error"], t0["gpu"]),
                         (220, 208, 384.7, 1, {"kind": "gps", "meters": 0.0236}, None))
        self.assertEqual(t0["notes"], [{"key": "left_out", "level": "warning", "line": "",
                                        "text": "12 of 220 photos couldn't be placed in the reconstruction and were left "
                                                "out (too little overlap, or too few features)."}])
        self.write_stats(self.tasks[0], has_gcp=True, reconstructed_shots_count=220)
        t0 = self.task_of("T0")
        self.assertEqual((t0["position_error"], t0["notes"]), ({"kind": "gcp", "meters": 0.012}, []))
        # A task without a report or a log has none of them
        t1 = self.task_of("T1")
        self.assertEqual((t1["photos_given"], t1["area"], t1["reconstructions"], t1["position_error"], t1["notes"],
                          t1["other"]), (None, None, None, None, [], []))

    def test_the_photos_left_out_are_named_with_the_logs_reason_from_the_task_folder_and_the_reports_shots(self):
        from coreplugins.tweakui import performance
        task = self.tasks[0]
        self.write_stats(task, initial_shots_count=5, reconstructed_shots_count=2)
        os.makedirs(task.task_path(), exist_ok=True)
        for name in ("DJI_0001.JPG", "DJI_0002.JPG", "DJI_0003.jpg", "DJI_0004.JPG", "DJI_0005.tif", "gcp_list.txt",
                     "geo.txt", "align.tif", "align.laz"):
            open(task.task_path(name), "w").close()
        shots = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"filename": n}}
                                                           for n in ("DJI_0001.JPG", "DJI_0004.JPG")]}
        with open(task.assets_path("odm_report", "shots.geojson"), "w") as f:
            json.dump(shots, f)
        self.write_log(task, ["[WARNING] No features found in image DJI_0002.JPG",
                              "[WARNING] GPS position not available for DJI_0003.jpg"])
        note = next(n for n in self.task_of("T0")["notes"] if n["key"] == "left_out")
        self.assertTrue(note["text"].startswith("3 of 5 photos"))
        self.assertEqual(note["photos"], [{"name": "DJI_0002.JPG", "reason": "no_features"},
                                          {"name": "DJI_0003.jpg", "reason": "no_gps"},
                                          {"name": "DJI_0005.tif", "reason": None}])
        self.assertEqual(note["more"], 0)
        with mock.patch("coreplugins.tweakui.performance.LEFT_MAX", 2):
            note = next(n for n in self.task_of("T0")["notes"] if n["key"] == "left_out")
        self.assertEqual(([p["name"] for p in note["photos"]], note["more"]), (["DJI_0002.JPG", "DJI_0003.jpg"], 1))
        # A report without readable shots: the note without names
        with open(task.assets_path("odm_report", "shots.geojson"), "w") as f:
            f.write("not json")
        note = next(n for n in self.task_of("T0")["notes"] if n["key"] == "left_out")
        self.assertNotIn("photos", note)
        self.assertIsNone(performance.placed_photos(self.tasks[1]))

    def test_the_log_gives_notes_for_known_messages_and_lists_the_others_once_each(self):
        self.write_stats(self.tasks[0], reconstructed_shots_count=220)
        self.write_log(self.tasks[0], [
            "[INFO] No nvidia-smi detected",
            "[WARNING] No features found in image DJI_0001.JPG",
            "[WARNING] No features found in image DJI_0002.JPG",
            ("[WARNING] Multiple reconstructions detected (2), this might be an indicator that some areas did not have "
            "sufficient overlap"),
            ("[WARNING] Multiple reconstructions detected (3), this might be an indicator that some areas did not have "
            "sufficient overlap"),
            "[WARNING] CPLE_AppDefined in RowsPerStrip not defined ... assuming value 1",
            "[WARNING] Shots and/or GCPs are aligned on a single-line. Using vertical prior",
            "[WARNING] Shots and/or GCPs are aligned on a single-line. Using vertical prior",
            "[WARNING] GCP-7 was not used (observations: 1)",
            "[WARNING] GPS position not available for DJI_0003.JPG",
            "[ERROR] Whoops! You ran out of memory! Add more RAM to your computer",
            "[ERROR] Something else went wrong",
        ])
        t0 = self.task_of("T0")
        self.assertEqual((t0["gpu"], t0["reconstructions"]), (False, 3))
        self.assertEqual([(n["key"], n["level"]) for n in t0["notes"]],
                         [("out_of_memory", "danger"), ("no_features", "warning"), ("reconstructions", "warning"),
                          ("gcp_unused", "warning"), ("no_gps", "warning")])
        notes = {n["key"]: n for n in t0["notes"]}
        self.assertEqual(notes["no_features"]["text"], "No features were found in 2 photos (blurred, too dark, or of "
                                                        "water, snow or sand), so they were left out.")
        self.assertEqual(notes["no_features"]["line"], "[WARNING] No features found in image DJI_0001.JPG")
        self.assertIn("3 separate reconstructions", notes["reconstructions"]["text"])
        self.assertEqual(notes["gcp_unused"]["text"], "Ground control points not used, too few photos mark them: GCP-7.")
        self.assertEqual(notes["no_gps"]["text"], "1 photos have no GPS position.")
        self.assertEqual(t0["other"], [
            {"text": "[WARNING] Shots and/or GCPs are aligned on a single-line. Using vertical prior", "count": 2},
            {"text": "[ERROR] Something else went wrong", "count": 1}])
        self.assertEqual(t0["more"], 0)

    def test_the_log_says_whether_the_gpu_was_used(self):
        from coreplugins.tweakui import task_log
        scan = task_log.scan
        self.assertTrue(scan(["[INFO] nvidia-smi detected"])["gpu"])
        self.assertFalse(scan(["[INFO] Disabling GPU features (--no-gpu is set)"])["gpu"])
        self.assertTrue(scan(['[INFO] running "DensifyPointCloud" -v 0 --cuda-device -1'])["gpu"])
        self.assertFalse(scan(['[INFO] running "DensifyPointCloud" -v 0 --cuda-device -2'])["gpu"])
        self.assertFalse(scan(["[INFO] No nvidia-smi detected", "--cuda-device -1"])["gpu"])
        self.assertIsNone(scan([])["gpu"])
        failed = task_log.describe(scan(["[INFO] nvidia-smi detected", ("[WARNING] OpenMVS failed with GPU, is your "
                                         "graphics card driver up to date? Falling back to CPU.")]))
        self.assertEqual((failed["gpu"], [n["key"] for n in failed["notes"]]), (True, ["gpu_failed"]))

    def test_a_huge_log_is_read_at_its_start_and_end_and_other_messages_are_capped(self):
        from coreplugins.tweakui import task_log
        lines = ["[INFO] nvidia-smi detected", "[WARNING] Multiple reconstructions detected (4)"] + \
                ["[INFO] filler line %d" % i for i in range(2000)] + ["[ERROR] Whoops! You ran out of memory!"]
        self.write_log(self.tasks[0], lines)
        with mock.patch.object(task_log, "LOG_WHOLE", 1000), mock.patch.object(task_log, "LOG_PART", 200):
            r = task_log.read(self.tasks[0])
        self.assertEqual((r["gpu"], r["reconstructions"]), (True, 4))
        self.assertEqual([n["key"] for n in r["notes"]], ["out_of_memory", "reconstructions"])
        many = task_log.scan(["[WARNING] message %d" % i for i in range(task_log.OTHER_MAX + 5)] + ["[WARNING] " + "x" * 400])
        self.assertEqual((len(many["other"]), many["more"]), (task_log.OTHER_MAX, 6))
        self.assertEqual(len(task_log.scan(["[WARNING] " + "x" * 400])["other"][0]["text"]), task_log.LINE_MAX)

    def test_a_log_is_read_again_only_when_it_changes(self):
        from coreplugins.tweakui import task_log
        self.write_log(self.tasks[0], ["[WARNING] first"])
        self.assertEqual(task_log.read(self.tasks[0])["other"], [{"text": "[WARNING] first", "count": 1}])
        with mock.patch.object(task_log, "scan", wraps=task_log.scan) as scan:
            task_log.read(self.tasks[0])
            scan.assert_not_called()
            self.write_log(self.tasks[0], ["[WARNING] first", "[WARNING] second is longer"])
            self.assertEqual(len(task_log.read(self.tasks[0])["other"]), 2)
            scan.assert_called_once()
        self.assertEqual(task_log.read(Task(project=self.project))["notes"], [])

    def live(self, query="", infos=None):
        """The live figures, each node answering as in report()"""
        infos = {"big-node": FakeInfo(available_memory=40 * GB)} if infos is None else infos

        def api_client(node, timeout=30):
            client = mock.Mock()
            if node.hostname in infos:
                client.info.return_value = infos[node.hostname]
            else:
                client.info.side_effect = OSError("refused")
            return client

        with mock.patch("nodeodm.models.ProcessingNode.api_client", autospec=True, side_effect=api_client):
            res = self.client.get("/api/plugins/tweakui/performance/live" + query)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return res.json()

    def test_the_live_figures_are_the_servers_cpu_counters_and_memory_and_the_nodes_memory(self):
        sample = {"total": [300, 1000], "cores": 2, "load": [1.5, 1.0, 0.5]}
        with mock.patch("coreplugins.tweakui.performance.cpu_entry", return_value=sample), \
                mock.patch("coreplugins.tweakui.performance.memory_stats",
                           return_value={"total": 32 * GB, "free": 8 * GB, "used": 24 * GB}):
            r = self.live()
        self.assertEqual(r["cpu"], sample)
        self.assertEqual(r["memory"], {"total": 32 * GB, "free": 8 * GB, "used": 24 * GB})
        self.assertEqual(r["nodes"], [{"id": self.node.id, "online": True, "total_memory": 64 * GB, "available_memory": 40 * GB},
                                      {"id": self.small.id, "online": False, "total_memory": None, "available_memory": None}])
        self.assertNotIn("disk", r)
        self.assertEqual(set(self.live("?disk=1")["disk"]), {"total", "used", "free"})
        self.assertIn("cpu", self.report()["server"])

    def test_linux_cpu_counters_are_proc_stats_total_with_idle_and_iowait_as_not_busy_and_the_number_of_cores(self):
        from coreplugins.tweakui import performance
        with tempfile.NamedTemporaryFile("w", suffix="-proc-stat", delete=False) as f:
            path = f.name
            f.write("cpu  100 10 50 800 40 0 0 0 7 0\ncpu0 60 5 25 400 10 0 0 0 0 0\ncpu1 40 5 25 400 30 0 0 0 0 0\n"
                    "intr 1 2 3\nctxt 99\ncpu9 1 1 1 1 1 1 1 1\n")
        try:
            self.assertEqual(performance.proc_stat_times(path), [160, 1000])
        finally:
            os.remove(path)
        with mock.patch("coreplugins.tweakui.performance.proc_stat_times", return_value=[1, 2]), \
                mock.patch("coreplugins.tweakui.performance.sys.platform", "linux"), \
                mock.patch("coreplugins.tweakui.performance.os.cpu_count", return_value=128), \
                mock.patch("coreplugins.tweakui.performance.os.getloadavg", return_value=(1.234, 0.5, 0.25)):
            self.assertEqual(performance.cpu_entry(), {"total": [1, 2], "cores": 128, "load": [1.23, 0.5, 0.25]})
        with mock.patch("coreplugins.tweakui.performance.proc_stat_times", side_effect=OSError("no /proc")):
            self.assertIsNone(performance.cpu_entry())

    def test_windows_cpu_counters_come_from_get_system_times_with_no_load_average(self):
        import ctypes
        from coreplugins.tweakui import performance

        def get_system_times(idle, kernel, user):
            # FILETIMEs, as 100 ns: idle 600, kernel 800 (idle included), user 400
            for ref, value in ((idle, 600), (kernel, 800), (user, 400)):
                ref._obj.low, ref._obj.high = value, 0
            return 1

        windll = mock.Mock()
        windll.kernel32.GetSystemTimes.side_effect = get_system_times
        with mock.patch.object(ctypes, "windll", windll, create=True), \
                mock.patch("coreplugins.tweakui.performance.os.cpu_count", return_value=4), \
                mock.patch("coreplugins.tweakui.performance.sys.platform", "win32"), \
                mock.patch("coreplugins.tweakui.performance.os.getloadavg", side_effect=AttributeError, create=True):
            self.assertEqual(performance.cpu_entry(), {"total": [600, 1200], "cores": 4, "load": None})
        windll.kernel32.GetSystemTimes.side_effect = lambda *a: 0
        with mock.patch.object(ctypes, "windll", windll, create=True), \
                mock.patch("coreplugins.tweakui.performance.sys.platform", "win32"):
            self.assertIsNone(performance.cpu_entry())

    def test_refresh_every_is_a_part_of_show_performance_view_from_1_to_10_seconds(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        section = page[page.index('<section id="tweakui-diagnostic"'):]
        section = section[:section.index("</section>")]
        self.assertLess(section.index('data-setting="performance_view"'), section.index('data-setting="performance_refresh"'))
        self.assertIn('Refresh Every <span class="tweakui-default text-muted">(Default: 3 s)</span>', section)
        self.assertIn('data-slider-of="performance_refresh" min="1" max="10" step="1" value="3"', section)
        self.assertEqual(self.patch({"performance_refresh": 7}).json()["performance_refresh"], 7)
        for value in (0, 11, 2.5, "3"):
            self.assertEqual(self.patch({"performance_refresh": value}).status_code, 400)
        on = self.client.get("/plugins/tweakui/performance/").content.decode()
        self.assertIn('Refresh Every <span class="tweakui-default text-muted">(Default: 3 s)</span>', on)
        self.assertIn('id="tweakui-performance-refresh" class="form-control input-sm theme-border" min="1" max="10" step="1" value="7"', on)

    def test_the_page_says_where_to_turn_it_on_and_the_api_needs_a_login(self):
        self.patch({"performance_view": False})
        off = self.client.get("/plugins/tweakui/performance/")
        self.assertContains(off, 'href="/plugins/tweakui/#diagnostic"')
        self.assertNotContains(off, "performance_page.js")
        self.patch({"performance_view": True})
        on = self.client.get("/plugins/tweakui/performance/")
        self.assertContains(on, "performance_page.js")
        self.assertContains(on, 'data-api="/api/plugins/tweakui/"')
        self.assertNotContains(on, "comment %}")
        page = self.client.get("/plugins/tweakui/").content.decode()
        section = page[page.index('<section id="tweakui-diagnostic"'):]
        self.assertIn('data-setting="performance_view" checked>', section[:section.index("</section>")])
        self.assertEqual(Client().get("/plugins/tweakui/performance/").status_code, status.HTTP_302_FOUND)
        self.assertEqual(Client().get("/api/plugins/tweakui/performance").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Client().get("/api/plugins/tweakui/performance/live").status_code, status.HTTP_403_FORBIDDEN)



ACCESS = "/api/plugins/tweakui/access"
ACCESS_PAGE = "/plugins/tweakui/admin/"


class TestAccess(TweakUITestCase):
    """Administration > TweakUI: superusers withhold Storage View and Performance View from users (access.py)"""

    def setUp(self):
        super().setUp()
        self.admin = self.login("testsuperuser")
        User.objects.create_user(username="teststaff", password="test1234", is_staff=True)

    def withhold(self, **changes):
        res = self.admin.patch(ACCESS, json.dumps(changes), content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.content)
        return res.json()

    def test_only_superusers_see_the_page_and_change_what_users_may_have(self):
        for client in (self.client, self.login("teststaff")):
            self.assertEqual(client.get(ACCESS_PAGE).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(client.get(ACCESS).status_code, status.HTTP_403_FORBIDDEN)
            res = client.patch(ACCESS, json.dumps({"storage_view": False}), content_type="application/json")
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Client().get(ACCESS_PAGE).status_code, status.HTTP_302_FOUND)
        res = self.admin.get(ACCESS_PAGE)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.content.decode()
        self.assertIn("Available to Users", body)
        self.assertRegex(body, r'data-access="storage_view" checked>\s*Storage View\s*</label>')
        self.assertRegex(body, r'data-access="storage_view" checked')
        self.assertRegex(body, r'data-access="performance_view" checked')
        strict = Client(enforce_csrf_checks=True)
        strict.login(username="testsuperuser", password="test1234")
        res = strict.patch(ACCESS, json.dumps({"storage_view": False}), content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.admin.get(ACCESS).json(), {"storage_view": True, "performance_view": True})

    def test_both_are_available_until_withheld_and_only_known_features_take_a_bool(self):
        self.assertEqual(self.withhold(storage_view=False), {"storage_view": False, "performance_view": True})
        for bad in ({"theme": False}, {"performance_view": "no"}, ["storage_view"]):
            res = self.admin.patch(ACCESS, json.dumps(bad), content_type="application/json")
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, bad)
        self.assertEqual(self.withhold(storage_view=True), {"storage_view": True, "performance_view": True})
        body = self.admin.get(ACCESS_PAGE).content.decode()
        self.assertRegex(body, r'data-access="storage_view" checked')

    def test_a_withheld_setting_is_off_for_users_and_their_choice_comes_back_when_given_back(self):
        self.patch({"storage_view": True, "performance_view": True})
        self.withhold(storage_view=False)
        self.assertEqual(self.script_settings(self.client)["storage_view"], False)
        self.assertEqual(self.script_settings(self.client)["performance_view"], True)
        # Turning it on is refused; saving another setting keeps the user's choice
        res = self.patch({"storage_view": True})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Turned off by your administrator", res.json()["detail"])
        self.assertEqual(self.patch({"surprise_me": True}).json()["storage_view"], False)
        self.withhold(storage_view=True)
        self.assertEqual(self.script_settings(self.client)["storage_view"], True)

    def test_a_withheld_setting_is_greyed_with_the_reason_on_the_settings_page(self):
        self.patch({"performance_view": True})
        self.withhold(performance_view=False)
        body = self.client.get("/plugins/tweakui/").content.decode()
        self.assertRegex(body, r'data-setting="performance_view" disabled>')
        self.assertIn("Turned off by your administrator.", body)
        self.assertRegex(body, r'data-setting="storage_view">')
        body = self.admin.get("/plugins/tweakui/").content.decode()
        self.assertNotIn("Turned off by your administrator.", body)

    def test_a_withheld_feature_s_page_and_api_answer_403_to_users_and_staff_but_not_superusers(self):
        project = Project.objects.create(owner=User.objects.get(username="testuser"), name="Mine")
        task = Task.objects.create(project=project, name="T")
        task_api = "/api/plugins/tweakui/storage/%s/%s" % (project.id, task.id)
        self.withhold(storage_view=False, performance_view=False)
        for client in (self.client, self.login("teststaff")):
            res = client.get("/plugins/tweakui/storage/")
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
            self.assertIn("Storage View is turned off by your administrator.", res.content.decode())
            res = client.get("/plugins/tweakui/performance/")
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
            self.assertIn("Performance View is turned off by your administrator.", res.content.decode())
            for url in ("/api/plugins/tweakui/storage", "/api/plugins/tweakui/performance", task_api):
                self.assertEqual(client.get(url).status_code, status.HTTP_403_FORBIDDEN, url)
        self.assertEqual(self.admin.get("/plugins/tweakui/storage/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.admin.get("/api/plugins/tweakui/storage").status_code, status.HTTP_200_OK)
        with mock.patch("coreplugins.tweakui.performance.report", return_value={}):
            self.assertEqual(self.admin.get("/api/plugins/tweakui/performance").status_code, status.HTTP_200_OK)
        self.withhold(storage_view=True)
        self.assertEqual(self.client.get("/plugins/tweakui/storage/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(task_api).status_code, status.HTTP_200_OK)
