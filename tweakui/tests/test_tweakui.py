"""
Tests of the TweakUI plugin: it registers, its scripts and stylesheet are on WebODM's pages, and each user's
settings (the data store, the API, settings.js and the settings page), the themes (theme.css), Source Frames and
Storage.
"""
import json
import math
import os
import re
import shutil

from django.contrib.auth.models import User
from django.test import Client
from rest_framework import status

from app.plugins import disable_plugin, enable_plugin, get_plugin_by_name
from app.models import Project, Task
from app.plugins.data_store import UserDataStore
from app.tests.classes import BootTestCase

API = "/api/plugins/tweakui/settings"


def defaults(**changes):
    """Every setting at its default, but for the given changes"""
    return dict({"show_modified_options": False, "enhanced_task_details": False, "task_details_times": True,
                 "task_details_preset": True, "task_details_options": True, "task_details_command": True,
                 "task_details_step": True, "movable_controls": False, "other_tasks": False,
                 "source_frames_2d": False, "source_frames_3d": False, "zoom_override_2d": False,
                 "zoom_override_3d": False, "storage_view": False, "show_theme_menu": True, "theme": "webodm"},
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

    def test_the_dashboard_includes_the_scripts_settings_first_and_the_stylesheet(self):
        res = self.client.get("/dashboard/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for name in ("settings.js", "main.js", "task_options.js", "theme_menu.js", "movable_controls.js",
                     "other_tasks.js", "pick3d.js", "source_frames.js", "zoom_override.js"):
            self.assertContains(res, "<script src='/plugins/tweakui/%s'></script>" % name, html=True)
        html = res.content.decode()
        self.assertLess(html.index("/plugins/tweakui/settings.js"), html.index("/plugins/tweakui/main.js"))
        # The 3D pick before the scripts that use it
        for name in ("source_frames.js", "zoom_override.js"):
            self.assertLess(html.index("/plugins/tweakui/pick3d.js"), html.index("/plugins/tweakui/" + name))
        for name in ("main.css", "theme.css"):
            self.assertContains(res, "<link href='/plugins/tweakui/%s' rel='stylesheet' type='text/css'>" % name,
                                html=True)

    def test_the_scripts_and_stylesheet_are_served(self):
        for name in ("settings.js", "main.js", "task_options.js", "theme_menu.js", "movable_controls.js",
                     "other_tasks.js", "pick3d.js", "source_frames.js", "zoom_override.js", "settings_page.js",
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
    def test_a_new_user_gets_the_defaults_with_show_modified_options_off(self):
        res = self.client.get(API)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), defaults())

    def test_a_change_is_saved_in_the_user_s_own_data_store(self):
        res = self.patch({"show_modified_options": True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), defaults(show_modified_options=True))
        store = UserDataStore("tweakui", User.objects.get(username="testuser"))
        self.assertEqual(store.get_json("settings"), defaults(show_modified_options=True))
        self.assertEqual(self.client.get(API).json(), defaults(show_modified_options=True))

    def test_each_user_has_their_own_settings(self):
        self.patch({"show_modified_options": True})
        other = self.login("testuser2")
        self.assertEqual(other.get(API).json(), defaults())
        self.assertEqual(self.script_settings(other), defaults())

    def test_unknown_settings_and_wrong_types_are_refused_and_nothing_is_saved(self):
        for data in ({"nope": True}, {"show_modified_options": "yes"}, {"show_modified_options": 1}, [True],
                     {"theme": "nope"}, {"theme": 1}):
            res = self.patch(data)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, data)
            self.assertIn("detail", res.json())
        self.assertEqual(self.client.get(API).json(), defaults())

    def test_saved_settings_no_longer_known_or_of_the_wrong_type_fall_back_to_the_defaults(self):
        UserDataStore("tweakui", User.objects.get(username="testuser")).set_json(
            "settings", {"show_modified_options": "x", "removed": 1, "theme": "removed-theme"})
        self.assertEqual(self.client.get(API).json(), defaults())

    def test_logged_out_users_get_neither_the_api_nor_the_page(self):
        anonymous = Client()
        self.assertIn(anonymous.get(API).status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertIn(self.patch({"show_modified_options": True}, client=anonymous).status_code,
                      (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertEqual(anonymous.get("/plugins/tweakui/").status_code, status.HTTP_302_FOUND)

    def test_settings_js_gives_the_user_s_settings_uncached_and_the_defaults_when_logged_out(self):
        self.patch({"show_modified_options": True})
        res = self.client.get("/plugins/tweakui/settings.js")
        self.assertTrue(res["Content-Type"].startswith("application/javascript"))
        self.assertEqual(res["Cache-Control"], "no-store")
        self.assertEqual(self.script_settings(self.client), defaults(show_modified_options=True))
        self.assertEqual(self.script_settings(Client()), defaults())

    def test_a_patch_without_the_csrf_token_is_refused(self):
        client = Client(enforce_csrf_checks=True)
        client.login(username="testuser", password="test1234")
        self.assertEqual(self.patch({"show_modified_options": True}, client=client).status_code,
                         status.HTTP_403_FORBIDDEN)


class TestSettingsPage(TweakUITestCase):
    def test_the_page_opens_with_the_general_category_and_the_task_options_setting(self):
        res = self.client.get("/plugins/tweakui/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertContains(res, 'href="#general"')
        self.assertContains(res, 'data-section="general"')
        self.assertContains(res, "Task Options")
        self.assertContains(res, 'data-setting="show_modified_options"')
        self.assertContains(res, 'data-api="/api/plugins/tweakui/"')
        self.assertContains(res, "csrfmiddlewaretoken")
        self.assertNotContains(res, "{#")
        self.assertNotContains(res, "comment %}")

    def test_enhanced_task_details_and_its_parts_are_under_task_details_with_their_names(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        options, details = page.index(">Task Options</h5>"), page.index(">Task Details</h5>")
        self.assertLess(options, page.index('data-setting="show_modified_options"'))
        self.assertLess(page.index('data-setting="show_modified_options"'), details)
        self.assertLess(details, page.index('data-setting="enhanced_task_details"'))
        for name in ("Task Start and End Time", "Show Configured Task Preset", "Options as Bubbles",
                     "Show ODX Command", "Show Current Processing Stage"):
            self.assertGreater(page.index(name), details)

    def test_the_checkbox_shows_the_saved_value(self):
        self.assertNotContains(self.client.get("/plugins/tweakui/"), 'data-setting="show_modified_options" checked')
        self.patch({"show_modified_options": True})
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="show_modified_options" checked')

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
        for name in ("movable_controls", "other_tasks", "source_frames_2d", "zoom_override_2d"):
            self.assertIn('data-setting="%s">' % name, map2d)
            self.assertEqual(self.patch({name: True}).json()[name], True)
            self.assertEqual(self.script_settings(self.client)[name], True)
        self.assertEqual(self.client.get(API).json(),
                         defaults(movable_controls=True, other_tasks=True, source_frames_2d=True, zoom_override_2d=True))
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

    def test_the_dashboard_includes_the_task_details_script(self):
        self.assertContains(self.client.get("/dashboard/"), "/plugins/tweakui/task_details.js")


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
        self.assertIn("At most 50", res.json()["detail"])

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

    def test_the_themes_section_lists_my_themes_with_edit_and_every_theme_with_copy(self):
        res = self.client.get("/plugins/tweakui/")
        self.assertContains(res, "My themes")
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
        self.assertEqual(res["refused"], [{"index": 2, "name": "B", "reason": "At most 50 themes"}])
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
        self.assertContains(res, 'class="tweakui-group theme-border tweakui-import" hidden')
        theme = self.post(a_theme("Mine")).json()
        res = self.client.get("/plugins/tweakui/")
        self.assertContains(res, 'href="/api/plugins/tweakui/themes/export"')
        self.assertContains(res, 'href="/api/plugins/tweakui/themes/export?id=%s"' % theme["id"])
        self.assertContains(res, 'data-theme-action="json"', count=13)

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
        self.other = Project.objects.create(owner=User.objects.get(username="testuser2"), name="Theirs")
        self.theirs = Task.objects.create(project=self.other, name="Theirs", status=status_codes.COMPLETED, size=50.0)

    def tearDown(self):
        for task in (self.done, self.failed, self.compacted, self.removing, self.theirs):
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
                         [("Compacted", None, True), ("Going", "removing", False)])
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

    def test_the_setting_is_off_by_default_in_its_own_section_and_the_page_says_where_to_turn_it_on(self):
        page = self.client.get("/plugins/tweakui/").content.decode()
        self.assertIn('href="#storage"', page)
        section = page[page.index('<section id="tweakui-storage"'):]
        self.assertIn('data-setting="storage_view">', section[:section.index("</section>")])
        off = self.client.get("/plugins/tweakui/storage/")
        self.assertEqual(off.status_code, status.HTTP_200_OK)
        self.assertContains(off, 'href="/plugins/tweakui/#storage"')
        self.assertNotContains(off, "storage_page.js")
        self.assertEqual(self.patch({"storage_view": True}).json(), defaults(storage_view=True))
        on = self.client.get("/plugins/tweakui/storage/")
        self.assertContains(on, "storage_page.js")
        self.assertContains(on, 'data-api="/api/plugins/tweakui/"')
        self.assertContains(on, "csrfmiddlewaretoken")
        self.assertNotContains(on, "comment %}")
        self.assertEqual(self.script_settings(self.client)["storage_view"], True)
        self.assertEqual(Client().get("/plugins/tweakui/storage/").status_code, status.HTTP_302_FOUND)
