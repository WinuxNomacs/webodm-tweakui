from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import render
from django.utils.translation import gettext_lazy as _

from app.plugins import Menu, MountPoint, PluginBase

from . import access, custom_themes, features, settings, themes
from .api import (AccessView, FramesView, PerformanceLiveView, PerformanceView, PublishedExportView, PublishedImportView, PublishedThemeView, PublishedView,
                  SettingsView, StorageTaskView, StorageView, ThemePreviewView, ThemesExportView, ThemesImportView,
                  ThemesView, ThemeView, settings_script)


class Plugin(PluginBase):
    def main_menu(self):
        return [Menu(_("TweakUI"), self.public_url(""), "fa fa-sliders-h fa-fw")]

    # On every WebODM page (base.html), in this order (features.py): paths are relative to public/, except
    # settings.js, which is a view (app_mount_points come before public/); so is theme.css. Every feature's script is
    # on every page whatever the user's settings (WebODM asks for the list without a request); each one returns at
    # once when its feature is off
    def include_js_files(self):
        return features.scripts()

    def include_css_files(self):
        return ["main.css", "theme.css"]

    def app_mount_points(self):
        @login_required
        def settings_page(request):
            values = settings.load(request.user)
            withheld = access.withheld(request.user)
            return render(request, self.template_path("settings.html"), {
                "title": _("TweakUI"),
                "public": self.public_url(""),
                "api": "/api/plugins/{}/".format(self.get_name()),
                "settings": values,
                "categories": features.page(values, withheld),
                "templates": self.template_path(""),
                "setting_template": self.template_path("settings_setting.html"),
                "theme_groups": themes.groups(request.user),
                "theme_fields": themes.fields(),
                "import_panel": self.template_path("import_panel.html"),
                "theme_colors": {t["id"]: {"name": t["name"], "colors": t["colors"]}
                                 for t in themes.theme_list(request.user, with_colors=True)},
            })

        @login_required
        def storage_page(request):
            return render(request, self.template_path("storage.html"), {
                "title": _("Storage"),
                "public": self.public_url(""),
                "api": "/api/plugins/{}/".format(self.get_name()),
                "on": settings.load(request.user)["storage_view"],
                "withheld": access.is_withheld(request.user, "storage_view"),
            }, status=403 if access.is_withheld(request.user, "storage_view") else 200)

        @login_required
        def performance_page(request):
            values = settings.load(request.user)
            return render(request, self.template_path("performance.html"), {
                "title": _("Performance"),
                "public": self.public_url(""),
                "api": "/api/plugins/{}/".format(self.get_name()),
                "on": values["performance_view"],
                # Refresh Every and History Length, each a slider and a box at the top of the page
                "controls": [dict(features.number_control(name, values[name]), id=id, label=features.setting(name).label)
                             for id, name in (("refresh", "performance_refresh"), ("history", "performance_history"))],
                "withheld": access.is_withheld(request.user, "performance_view"),
            }, status=403 if access.is_withheld(request.user, "performance_view") else 200)

        # Administration > TweakUI Themes: the published themes, for superusers only (main.js adds the link)
        @login_required
        def published_page(request):
            if not request.user.is_superuser:
                return HttpResponseForbidden()
            published = [dict(t, swatch=[t["colors"][f] for f in themes.SWATCH]) for t in custom_themes.published()]
            return render(request, self.template_path("published.html"), {
                "title": _("TweakUI Themes"),
                "public": self.public_url(""),
                "api": "/api/plugins/{}/".format(self.get_name()),
                "published": published,
                "own": custom_themes.own(request.user),
                "theme_colors": {custom_themes.PUBLISHED + t["id"]: {"name": t["name"], "colors": t["colors"]}
                                 for t in published},
                "import_panel": self.template_path("import_panel.html"),
            })

        # Administration > TweakUI: which features users may have (access.py), for superusers only
        @login_required
        def admin_page(request):
            if not request.user.is_superuser:
                return HttpResponseForbidden()
            return render(request, self.template_path("admin.html"), {
                "title": _("TweakUI"),
                "public": self.public_url(""),
                "api": "/api/plugins/{}/".format(self.get_name()),
                "features": access.page(),
            })

        return [
            MountPoint("$", settings_page),
            MountPoint(r"admin/$", admin_page),
            MountPoint(r"admin/themes/$", published_page),
            MountPoint(r"storage/$", storage_page),
            MountPoint(r"performance/$", performance_page),
            MountPoint(r"settings\.js$", settings_script),
            MountPoint(r"theme\.css$", themes.theme_css),
        ]

    def api_mount_points(self):
        return [
            MountPoint("settings$", SettingsView.as_view()),
            MountPoint("access$", AccessView.as_view()),
            MountPoint("themes$", ThemesView.as_view()),
            MountPoint(r"themes/preview$", ThemePreviewView.as_view()),
            MountPoint(r"themes/import$", ThemesImportView.as_view()),
            MountPoint(r"themes/export$", ThemesExportView.as_view()),
            MountPoint(r"themes/(?P<theme_id>[0-9a-f]{1,32})$", ThemeView.as_view()),
            MountPoint("published$", PublishedView.as_view()),
            MountPoint(r"published/import$", PublishedImportView.as_view()),
            MountPoint(r"published/export$", PublishedExportView.as_view()),
            MountPoint(r"published/(?P<theme_id>[0-9a-f]{1,32})$", PublishedThemeView.as_view()),
            MountPoint("storage$", StorageView.as_view()),
            MountPoint("performance$", PerformanceView.as_view()),
            MountPoint(r"performance/live$", PerformanceLiveView.as_view()),
            MountPoint(r"storage/(?P<project_pk>[^/.]+)/(?P<pk>[^/.]+)$", StorageTaskView.as_view()),
            MountPoint(r"frames/(?P<project_pk>[^/.]+)/(?P<pk>[^/.]+)$", FramesView.as_view()),
        ]
