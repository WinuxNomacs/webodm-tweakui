from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.utils.translation import gettext_lazy as _

from app.plugins import Menu, MountPoint, PluginBase

from . import settings
from .api import SettingsView, settings_script


class Plugin(PluginBase):
    def main_menu(self):
        return [Menu(_("TweakUI"), self.public_url(""), "fa fa-sliders-h fa-fw")]

    # On every WebODM page (base.html), in this order; paths are relative to public/, except settings.js, which is
    # a view (app_mount_points come before public/)
    def include_js_files(self):
        return ["settings.js", "main.js", "task_options.js"]

    def include_css_files(self):
        return ["main.css"]

    def app_mount_points(self):
        @login_required
        def settings_page(request):
            return render(request, self.template_path("settings.html"), {
                "title": _("TweakUI"),
                "public": self.public_url(""),
                "api": "/api/plugins/{}/".format(self.get_name()),
                "settings": settings.load(request.user),
            })

        return [
            MountPoint("$", settings_page),
            MountPoint(r"settings\.js$", settings_script),
        ]

    def api_mount_points(self):
        return [MountPoint("settings$", SettingsView.as_view())]
