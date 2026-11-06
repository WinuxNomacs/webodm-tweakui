"""
Tests of the TweakUI plugin: it registers, its scripts and stylesheet are on WebODM's pages, and each user's
settings (the data store, the API, settings.js and the settings page), and the themes (theme.css).
"""
import json
import math
import os
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
                 "zoom_override_3d": False, "show_theme_menu": True, "theme": "webodm"}, **changes)


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

    def test_an_areas_photos_are_ordered_by_the_share_of_it_they_show(self):
        x0, x1, y0, y1 = self.X - 50, self.X + 50, self.Y - 20, self.Y + 20
        ring = [self.lnglat(x, y) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0))]
        found = self.post({"type": "Polygon", "coordinates": [ring]}).json()["frames"]
        self.assertEqual([f["filename"] for f in found], ["a.jpg", "b.jpg"])
        # a shows all of it; b shows x from 30 - 62.5 m on: 82.5 of its 100 m
        self.assertEqual(found[0]["share"], 1.0)
        self.assertAlmostEqual(found[1]["share"], 0.825, delta=0.03)
        # Its outline in a's photo: 50 m either side is 0.8 * 0.5 of the width, 20 m 0.8 * 0.2 of the width
        outline = found[0]["outline"]
        self.assertEqual(len(outline), 4)
        self.assertAlmostEqual(min(p[0] for p in outline), 0.5 - 0.8 * 0.5, places=3)
        self.assertAlmostEqual(max(p[1] for p in outline), 0.5 + 0.8 * 0.2 * 4000 / 3000, places=3)

    def test_a_3d_pick_gives_its_own_height_in_the_tasks_coordinates(self):
        # Picked on a roof 60 m below the cameras: 30 m from b is 0.8 * 30 / 60 from its centre
        found = self.post({"type": "Point", "coordinates": [self.X, self.Y, 60.0], "crs": "task"}).json()["frames"]
        self.assertAlmostEqual(found[1]["spot"][0], 0.5 - 0.8 * 0.5, places=3)
        ring = [[self.X - 5, self.Y - 5, 20], [self.X + 5, self.Y - 5, 20], [self.X + 5, self.Y + 5, 20]]
        found = self.post({"type": "Polygon", "coordinates": [ring], "crs": "task"}).json()["frames"]
        self.assertEqual([f["share"] for f in found], [1.0, 1.0])
        res = self.post({"type": "Point", "coordinates": [self.X, self.Y], "crs": "task"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bad_places_and_tasks_without_cameras_are_refused(self):
        for data in ({}, {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}, {"type": "Point", "coordinates": "x"},
                     {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [0, 0]]]},
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
