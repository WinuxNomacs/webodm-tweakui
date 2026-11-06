"""
Tests of the TweakUI plugin: it registers, its scripts and stylesheet are on WebODM's pages, and each user's
settings (the data store, the API, settings.js and the settings page), and the themes (theme.css).
"""
import json

from django.contrib.auth.models import User
from django.test import Client
from rest_framework import status

from app.plugins import disable_plugin, enable_plugin, get_plugin_by_name
from app.plugins.data_store import UserDataStore
from app.tests.classes import BootTestCase

API = "/api/plugins/tweakui/settings"


def defaults(**changes):
    """Every setting at its default, but for the given changes"""
    return dict({"show_modified_options": False, "theme": "webodm"}, **changes)


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
        for name in ("settings.js", "main.js", "task_options.js", "theme_menu.js"):
            self.assertContains(res, "<script src='/plugins/tweakui/%s'></script>" % name, html=True)
        html = res.content.decode()
        self.assertLess(html.index("/plugins/tweakui/settings.js"), html.index("/plugins/tweakui/main.js"))
        for name in ("main.css", "theme.css"):
            self.assertContains(res, "<link href='/plugins/tweakui/%s' rel='stylesheet' type='text/css'>" % name,
                                html=True)

    def test_the_scripts_and_stylesheet_are_served(self):
        for name in ("settings.js", "main.js", "task_options.js", "theme_menu.js", "settings_page.js", "main.css",
                     "theme.css"):
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

    def test_the_checkbox_shows_the_saved_value(self):
        self.assertNotContains(self.client.get("/plugins/tweakui/"), 'data-setting="show_modified_options" checked')
        self.patch({"show_modified_options": True})
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="show_modified_options" checked')


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
