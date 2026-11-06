import json

from django.http import HttpResponse
from rest_framework import exceptions, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from app.plugins.views import TaskView

from app.models import Task

from . import custom_themes, frames, settings, storage, themes


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


class ThemesView(APIView):
    """GET and POST /api/plugins/tweakui/themes: the logged-in user's own themes, and a new one from {name,
    colors} (custom_themes.clean)"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(custom_themes.own(request.user))

    def post(self, request):
        try:
            return Response(custom_themes.create(request.user, request.data), status=status.HTTP_201_CREATED)
        except custom_themes.InvalidTheme as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ThemeView(APIView):
    """PUT and DELETE /api/plugins/tweakui/themes/<id>: one of the logged-in user's own themes, given a new
    {name, colors} or deleted; another user's theme is not found"""
    permission_classes = (permissions.IsAuthenticated,)

    def put(self, request, theme_id=None):
        try:
            return Response(custom_themes.update(request.user, theme_id, request.data))
        except custom_themes.InvalidTheme as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except custom_themes.NoSuchTheme:
            raise exceptions.NotFound() from None

    def delete(self, request, theme_id=None):
        try:
            custom_themes.delete(request.user, theme_id)
        except custom_themes.NoSuchTheme:
            raise exceptions.NotFound() from None
        return Response(status=status.HTTP_204_NO_CONTENT)


class ThemePreviewView(APIView):
    """POST /api/plugins/tweakui/themes/preview: the stylesheet for {name, colors}, which the theme editor shows
    while a theme is edited; nothing is saved"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            theme = custom_themes.clean(request.data)
        except custom_themes.InvalidTheme as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"css": themes.colors_css(theme["colors"])})


class FramesView(TaskView):
    """POST /api/plugins/tweakui/frames/<project>/<task>: the task's photos that show a spot (see
    frames.parse), best first; WebODM's task permissions (a public task's to anyone)"""

    def post(self, request, project_pk=None, pk=None):
        task = self.get_and_check_task(request, pk)
        if str(task.project_id) != str(project_pk):
            raise exceptions.NotFound()
        try:
            return Response({"frames": frames.find(task, request.data)})
        except frames.FramesError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class StorageView(APIView):
    """GET /api/plugins/tweakui/storage: the logged-in user's storage and, for an admin, every user's
    (storage.report)"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(storage.report(request.user))


class StorageTaskView(APIView):
    """GET /api/plugins/tweakui/storage/<project>/<task>: a task's files by kind, for its project's owner and
    admins"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, project_pk=None, pk=None):
        try:
            task = Task.objects.select_related("project").get(pk=pk, project_id=project_pk)
        except (Task.DoesNotExist, ValueError, TypeError):
            raise exceptions.NotFound() from None
        if not storage.can_see(request.user, task):
            raise exceptions.NotFound()
        return Response(storage.task_breakdown(task))


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
        script += "window.TweakUI.themes = %s;\n" % _script_json(themes.theme_list(request.user))
    response = HttpResponse(script, content_type="application/javascript; charset=utf-8")
    response["Cache-Control"] = "no-store"
    return response
