import json
import os

from django.conf import settings as django_settings
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.utils.text import slugify
from rest_framework import exceptions, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from app.plugins.views import TaskView

from app.models import Task

from . import access, custom_themes, frames, performance, settings, storage, themes


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


class ThemesImportView(APIView):
    """POST /api/plugins/tweakui/themes/import: {name, colors} themes, one object or a list, into the logged-in
    user's own (custom_themes.import_themes); answers what was added, replaced and refused"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            return Response(custom_themes.import_themes(request.user, request.data))
        except custom_themes.InvalidTheme as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


def _export(themes, theme_id, prefix):
    """A JSON file to download of a list of themes (a list of {name, colors}, <prefix>s.json) or, with theme_id, of
    just that one (an object, <prefix>-<name>.json)"""
    if theme_id:
        theme = next((t for t in themes if t["id"] == theme_id), None)
        if theme is None:
            raise exceptions.NotFound()
        data, name = custom_themes.export(theme), "%s-%s.json" % (prefix, slugify(theme["name"]) or theme_id)
    else:
        data, name = [custom_themes.export(t) for t in themes], "%ss.json" % prefix
    res = HttpResponse(json.dumps(data, indent=2) + "\n", content_type="application/json")
    res["Content-Disposition"] = 'attachment; filename="%s"' % name
    return res


class ThemesExportView(APIView):
    """GET /api/plugins/tweakui/themes/export: the logged-in user's own themes as a JSON file to download
    (tweakui-themes.json, a list of {name, colors}); with ?id=<id>, just that theme (an object)"""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return _export(custom_themes.own(request.user), request.query_params.get("id"), "tweakui-theme")


class IsSuperuser(permissions.BasePermission):
    """Administration > TweakUI and TweakUI Themes: superusers only (not other staff)"""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class AccessView(APIView):
    """GET and PATCH /api/plugins/tweakui/access: which features users may have ({name: bool}, access.py), for
    superusers"""
    permission_classes = (IsSuperuser,)

    def get(self, request):
        return Response(access.available())

    def patch(self, request):
        try:
            return Response(access.update(request.data))
        except access.InvalidAccess as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class Available(permissions.BasePermission):
    """A logged-in user whom an admin has not withheld the view's feature from (its setting: view.feature)"""
    message = "Turned off by your administrator."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not access.is_withheld(request.user, view.feature))


class PublishedView(APIView):
    """GET and POST /api/plugins/tweakui/published: the published themes, and {id} publishes a copy of one of the
    superuser's own themes (custom_themes.publish); answers {theme, replaced}"""
    permission_classes = (IsSuperuser,)

    def get(self, request):
        return Response(custom_themes.published())

    def post(self, request):
        theme_id = request.data.get("id") if isinstance(request.data, dict) else None
        if not isinstance(theme_id, str):
            return Response({"detail": "Expected the id of one of your themes"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            theme, replaced = custom_themes.publish(request.user, theme_id)
        except custom_themes.NoSuchTheme:
            raise exceptions.NotFound() from None
        except custom_themes.InvalidTheme as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"theme": theme, "replaced": replaced},
                        status=status.HTTP_200_OK if replaced else status.HTTP_201_CREATED)


class PublishedThemeView(APIView):
    """DELETE /api/plugins/tweakui/published/<id>: deletes a published theme"""
    permission_classes = (IsSuperuser,)

    def delete(self, request, theme_id=None):
        try:
            custom_themes.delete_published(theme_id)
        except custom_themes.NoSuchTheme:
            raise exceptions.NotFound() from None
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublishedImportView(APIView):
    """POST /api/plugins/tweakui/published/import: themes into the published ones, as themes/import does into
    your own"""
    permission_classes = (IsSuperuser,)

    def post(self, request):
        try:
            return Response(custom_themes.import_published(request.data))
        except custom_themes.InvalidTheme as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PublishedExportView(APIView):
    """GET /api/plugins/tweakui/published/export[?id=<id>]: the published themes as a JSON file to download
    (tweakui-published-themes.json), or one of them"""
    permission_classes = (IsSuperuser,)

    def get(self, request):
        return _export(custom_themes.published(), request.query_params.get("id"), "tweakui-published-theme")


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
    permission_classes = (Available,)
    feature = "storage_view"

    def get(self, request):
        return Response(storage.report(request.user))


class PerformanceView(APIView):
    """GET /api/plugins/tweakui/performance: the processing nodes the user may use, the server, the recent tasks
    (an admin's: everyone's) and the verdicts (performance.report)"""
    permission_classes = (Available,)
    feature = "performance_view"

    def get(self, request):
        return Response(performance.report(request.user))


class PerformanceLiveView(APIView):
    """GET /api/plugins/tweakui/performance/live[?disk=1]: what the Performance page refreshes every few seconds,
    the server's CPU counters and memory, the nodes' memory and, when asked, the disk (performance.live)"""
    permission_classes = (Available,)
    feature = "performance_view"

    def get(self, request):
        return Response(performance.live(request.user, disk=request.query_params.get("disk") == "1"))


class StorageTaskView(APIView):
    """GET /api/plugins/tweakui/storage/<project>/<task>: a task's files by kind, for its project's owner and
    admins"""
    permission_classes = (Available,)
    feature = "storage_view"

    def get(self, request, project_pk=None, pk=None):
        try:
            task = Task.objects.select_related("project").get(pk=pk, project_id=project_pk)
        except (Task.DoesNotExist, ValidationError, ValueError, TypeError):
            raise exceptions.NotFound() from None
        if not storage.can_see(request.user, task):
            raise exceptions.NotFound()
        return Response(storage.task_breakdown(task))


# WebODM's native Windows build: Enhanced Task Details shows ODX's run.bat in place of docker
WINDOWS = os.name == "nt"


def _script_json(value):
    """value as JSON for a script: json.dumps escapes no "<", so a value could close the script tag; escape it (and
    & and >) as \\u"""
    data = json.dumps(value, sort_keys=True)
    return data.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def settings_script(request):
    """/plugins/tweakui/settings.js, on every page before main.js: the user's settings as window.TweakUI.settings
    (the defaults when logged out) and, for a logged-in user, the themes they can pick (the header's theme menu)
    as window.TweakUI.themes, for a superuser window.TweakUI.superuser, window.TweakUI.desktop in WebODM's desktop
    mode and window.TweakUI.windows when WebODM runs on Windows. Never cached, so a change shows on the
    next page."""
    script = "window.TweakUI = window.TweakUI || {};\nwindow.TweakUI.settings = %s;\n" % _script_json(
        settings.load(request.user))
    if request.user.is_authenticated:
        script += "window.TweakUI.themes = %s;\n" % _script_json(themes.theme_list(request.user))
    if request.user.is_authenticated and request.user.is_superuser:
        # main.js adds Administration > TweakUI Themes to the side menu
        script += "window.TweakUI.superuser = true;\n"
    if getattr(django_settings, "DESKTOP_MODE", False):
        # WebODM hides its header (its Windows app): the theme and units menus go in the side menu
        script += "window.TweakUI.desktop = true;\n"
    if WINDOWS:
        script += "window.TweakUI.windows = true;\n"
    response = HttpResponse(script, content_type="application/javascript; charset=utf-8")
    response["Cache-Control"] = "no-store"
    return response
