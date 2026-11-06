"""
Tests of the TweakUI plugin: it registers, its scripts and stylesheet are on WebODM's pages, and each user's
settings (the data store, the API, settings.js and the settings page).
"""
import json

from django.contrib.auth.models import User
from django.test import Client
from rest_framework import status

from app.plugins import disable_plugin, enable_plugin, get_plugin_by_name
from app.plugins.data_store import UserDataStore
from app.tests.classes import BootTestCase

API = "/api/plugins/tweakui/settings"


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
        return json.loads(body.split("window.TweakUI.settings = ", 1)[1].rstrip().rstrip(";"))


class TestThePlugin(TweakUITestCase):
    def test_the_plugin_is_found_and_enabled(self):
        plugin = get_plugin_by_name("tweakui")
        self.assertIsNotNone(plugin)
        self.assertEqual(plugin.get_manifest()["name"], "TweakUI")

    def test_the_dashboard_includes_the_scripts_settings_first_and_the_stylesheet(self):
        res = self.client.get("/dashboard/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for name in ("settings.js", "main.js", "task_options.js"):
            self.assertContains(res, "<script src='/plugins/tweakui/%s'></script>" % name, html=True)
        html = res.content.decode()
        self.assertLess(html.index("/plugins/tweakui/settings.js"), html.index("/plugins/tweakui/main.js"))
        self.assertContains(res, "<link href='/plugins/tweakui/main.css' rel='stylesheet' type='text/css'>", html=True)

    def test_the_scripts_and_stylesheet_are_served(self):
        for name in ("settings.js", "main.js", "task_options.js", "settings_page.js", "main.css"):
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
        self.assertEqual(res.json(), {"show_modified_options": False})

    def test_a_change_is_saved_in_the_user_s_own_data_store(self):
        res = self.patch({"show_modified_options": True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json(), {"show_modified_options": True})
        store = UserDataStore("tweakui", User.objects.get(username="testuser"))
        self.assertEqual(store.get_json("settings"), {"show_modified_options": True})
        self.assertEqual(self.client.get(API).json(), {"show_modified_options": True})

    def test_each_user_has_their_own_settings(self):
        self.patch({"show_modified_options": True})
        other = self.login("testuser2")
        self.assertEqual(other.get(API).json(), {"show_modified_options": False})
        self.assertEqual(self.script_settings(other), {"show_modified_options": False})

    def test_unknown_settings_and_wrong_types_are_refused_and_nothing_is_saved(self):
        for data in ({"nope": True}, {"show_modified_options": "yes"}, {"show_modified_options": 1}, [True]):
            res = self.patch(data)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, data)
            self.assertIn("detail", res.json())
        self.assertEqual(self.client.get(API).json(), {"show_modified_options": False})

    def test_saved_settings_no_longer_known_or_of_the_wrong_type_fall_back_to_the_defaults(self):
        UserDataStore("tweakui", User.objects.get(username="testuser")).set_json(
            "settings", {"show_modified_options": "x", "removed": 1})
        self.assertEqual(self.client.get(API).json(), {"show_modified_options": False})

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
        self.assertEqual(self.script_settings(self.client), {"show_modified_options": True})
        self.assertEqual(self.script_settings(Client()), {"show_modified_options": False})

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

    def test_the_checkbox_shows_the_saved_value(self):
        self.assertNotContains(self.client.get("/plugins/tweakui/"), 'data-setting="show_modified_options" checked')
        self.patch({"show_modified_options": True})
        self.assertContains(self.client.get("/plugins/tweakui/"), 'data-setting="show_modified_options" checked')
