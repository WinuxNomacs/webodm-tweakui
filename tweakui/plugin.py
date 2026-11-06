from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.utils.translation import gettext_lazy as _

from app.plugins import Menu, MountPoint, PluginBase

from . import settings, themes
from .api import FramesView, SettingsView, settings_script


class Plugin(PluginBase):
    def main_menu(self):
        return [Menu(_("TweakUI"), self.public_url(""), "fa fa-sliders-h fa-fw")]

    # On every WebODM page (base.html), in this order; paths are relative to public/, except settings.js, which is
    # a view (app_mount_points come before public/); so is theme.css
    def include_js_files(self):
        return ["settings.js", "main.js", "task_options.js", "task_details.js", "theme_menu.js",
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
                "themes": themes.theme_list(),
            })

        return [
            MountPoint("$", settings_page),
            MountPoint(r"settings\.js$", settings_script),
            MountPoint(r"theme\.css$", themes.theme_css),
        ]

    def api_mount_points(self):
        return [
            MountPoint("settings$", SettingsView.as_view()),
            MountPoint(r"frames/(?P<project_pk>[^/.]+)/(?P<pk>[^/.]+)$", FramesView.as_view()),
        ]
