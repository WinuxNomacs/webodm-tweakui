from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import render
from django.utils.translation import gettext_lazy as _

from app.plugins import Menu, MountPoint, PluginBase

from . import custom_themes, settings, themes
from .api import (FramesView, PublishedExportView, PublishedImportView, PublishedThemeView, PublishedView,
                  SettingsView, StorageTaskView, StorageView, ThemePreviewView, ThemesExportView, ThemesImportView,
                  ThemesView, ThemeView, settings_script)


class Plugin(PluginBase):
    def main_menu(self):
        return [Menu(_("TweakUI"), self.public_url(""), "fa fa-sliders-h fa-fw")]

    # On every WebODM page (base.html), in this order; paths are relative to public/, except settings.js, which is
    # a view (app_mount_points come before public/); so is theme.css
    def include_js_files(self):
        return ["settings.js", "main.js", "task_options.js", "task_details.js", "task_controls.js", "theme_menu.js",
                "movable_controls.js", "other_tasks.js", "pick3d.js", "source_frames.js", "zoom_override.js"]

    def include_css_files(self):
        return ["main.css", "theme.css"]

    def app_mount_points(self):
        @login_required
        def settings_page(request):
            return render(request, self.template_path("settings.html"), {
                "title": _("TweakUI"),
                "public": self.public_url(""),
                "api": "/api/plugins/{}/".format(self.get_name()),
                "settings": settings.load(request.user),
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
            })

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

        return [
            MountPoint("$", settings_page),
            MountPoint(r"admin/themes/$", published_page),
            MountPoint(r"storage/$", storage_page),
            MountPoint(r"settings\.js$", settings_script),
            MountPoint(r"theme\.css$", themes.theme_css),
        ]

    def api_mount_points(self):
        return [
            MountPoint("settings$", SettingsView.as_view()),
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
            MountPoint(r"storage/(?P<project_pk>[^/.]+)/(?P<pk>[^/.]+)$", StorageTaskView.as_view()),
            MountPoint(r"frames/(?P<project_pk>[^/.]+)/(?P<pk>[^/.]+)$", FramesView.as_view()),
        ]
