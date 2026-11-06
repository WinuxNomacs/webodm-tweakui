import json

from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import settings


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


def settings_script(request):
    """/plugins/tweakui/settings.js, on every page before main.js: the user's settings as window.TweakUI.settings
    (the defaults when logged out). Never cached, so a change shows on the next page."""
    # json.dumps escapes no "<", so a value could close the script tag: escape it (and & and >) as \\u
    data = json.dumps(settings.load(request.user), sort_keys=True)
    data = data.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    response = HttpResponse("window.TweakUI = window.TweakUI || {};\nwindow.TweakUI.settings = %s;\n" % data,
                            content_type="application/javascript; charset=utf-8")
    response["Cache-Control"] = "no-store"
    return response
