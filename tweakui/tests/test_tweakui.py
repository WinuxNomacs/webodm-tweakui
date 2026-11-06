"""
Tests of the TweakUI plugin: it registers, and its script and stylesheet are served and included on WebODM's pages.
"""
from django.test import Client
from rest_framework import status

from app.plugins import disable_plugin, enable_plugin, get_plugin_by_name
from app.tests.classes import BootTestCase


class TestTweakUIPlugin(BootTestCase):
    def setUp(self):
        super().setUp()
        disable_plugin("tweakui")
        enable_plugin("tweakui")
        self.client = Client()
        self.client.login(username="testuser", password="test1234")

    def tearDown(self):
        disable_plugin("tweakui")

    def test_the_plugin_is_found_and_enabled(self):
        plugin = get_plugin_by_name("tweakui")
        self.assertIsNotNone(plugin)
        self.assertEqual(plugin.get_manifest()["name"], "TweakUI")

    def test_the_dashboard_includes_the_plugin_s_script_and_stylesheet(self):
        res = self.client.get("/dashboard/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertContains(res, "<script src='/plugins/tweakui/main.js'></script>", html=True)
        self.assertContains(res, "<link href='/plugins/tweakui/main.css' rel='stylesheet' type='text/css'>", html=True)

    def test_the_script_and_stylesheet_are_served(self):
        for name in ("main.js", "main.css"):
            res = self.client.get("/plugins/tweakui/" + name)
            self.assertEqual(res.status_code, status.HTTP_200_OK, name)

    def test_a_disabled_plugin_is_left_out_of_the_pages(self):
        disable_plugin("tweakui")
        res = self.client.get("/dashboard/")
        self.assertNotContains(res, "/plugins/tweakui/main.js")
