import json

from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import settings, themes


class SettingsView(APIView):
    """GET and PATCH /api/plugins/tweakui/settings: the logged-in user's own settings"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(settings.load(request.user))

    def patch(self, request):
        try:
            return Response(settings.update(request.user, request.data))
        except settings.InvalidSettings as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


def _script_json(value):
    """value as JSON for a script: json.dumps escapes no "<", so a value could close the script tag; escape it (and
    & and >) as \\u"""
    data = json.dumps(value, sort_keys=True)
    return data.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def settings_script(request):
    """/plugins/tweakui/settings.js, on every page before main.js: the user's settings as window.TweakUI.settings
    (the defaults when logged out) and, for a logged-in user, the themes they can pick (the header's theme menu)
    as window.TweakUI.themes. Never cached, so a change shows on the next page."""
    script = "window.TweakUI = window.TweakUI || {};\nwindow.TweakUI.settings = %s;\n" % _script_json(
        settings.load(request.user))
    if request.user.is_authenticated:
        script += "window.TweakUI.themes = %s;\n" % _script_json(themes.theme_list())
    response = HttpResponse(script, content_type="application/javascript; charset=utf-8")
    response["Cache-Control"] = "no-store"
    return response
