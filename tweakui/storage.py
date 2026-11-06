"""
Settings > Storage: what a user's WebODM storage holds, as WebODM's quota counts it (the size WebODM keeps for each
task of the projects the user owns), and a task's files by kind. Read only: cleaning up goes through WebODM's own
API from the page (a task's compact and remove, a project's delete), so its permissions, the processing node's
cleanup and the quota apply. Admins (superusers, whom WebODM lets delete any project) see every user's.
"""
import os

from django.contrib.auth import get_user_model
from django.db.models import Sum

from app.models import Project, Task
from nodeodm import status_codes

MB = 1024 * 1024

# Where a task's files go in its breakdown, by the folder of its assets they are in (as LuxODM's Storage page)
ASSET_KINDS = {
    "odm_orthophoto": "orthophoto",
    "odm_dem": "elevation",
    "entwine_pointcloud": "point_cloud",
    "odm_georeferencing": "point_cloud",
    "odm_texturing": "textured_model",
}
KINDS = ("photos", "orthophoto", "elevation", "point_cloud", "textured_model", "other")


def dir_size(path):
    """Bytes of the files in a folder, links not followed"""
    total = 0
    for dirpath, _dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try:
                if not os.path.islink(fp):
                    total += os.path.getsize(fp)
            except OSError:
                pass
    return total


def breakdown(task_dir):
    """A task folder's bytes by kind (KINDS, each present): the photos (the files in the folder itself, which
    WebODM's compact deletes), its assets by type, the rest"""
    sizes = dict.fromkeys(KINDS, 0)
    try:
        entries = list(os.scandir(task_dir))
    except OSError:
        return sizes
    for e in entries:
        if e.is_symlink():
            continue
        if e.is_file():
            sizes["photos"] += e.stat().st_size
        elif e.name == "assets":
            for a in os.scandir(e.path):
                if a.is_symlink():
                    continue
                kind = ASSET_KINDS.get(a.name, "other")
                sizes[kind] += a.stat().st_size if a.is_file() else dir_size(a.path)
        else:
            sizes["other"] += dir_size(e.path)
    return sizes


def task_mark(task):
    """What the page marks a task with: removing or compacting (WebODM is doing it), failed, canceled, compactable
    (completed, its photos still there), or none"""
    from app import pending_actions
    if task.pending_action == pending_actions.REMOVE:
        return "removing"
    if task.pending_action == pending_actions.COMPACT:
        return "compacting"
    if task.status == status_codes.FAILED:
        return "failed"
    if task.status == status_codes.CANCELED:
        return "canceled"
    if task.status == status_codes.COMPLETED and not task.compacted:
        return "compactable"
    return None


def task_entry(task):
    return {
        "id": str(task.id),
        "name": task.name or "",
        "status": task.status,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "size": round((task.size or 0) * MB),
        "compacted": bool(task.compacted),
        "partial": bool(task.partial),
        "mark": task_mark(task),
    }


def user_report(user):
    """A user's storage: the projects they own (largest first, each with its tasks, oldest first), what WebODM's
    quota counts as used and the quota (bytes; None without one)"""
    projects = []
    for project in Project.objects.filter(owner=user, deleting=False):
        tasks = [task_entry(t) for t in Task.objects.filter(project=project).order_by("created_at")]
        projects.append({"id": project.id, "name": project.name, "tasks": tasks,
                         "size": sum(t["size"] for t in tasks)})
    projects.sort(key=lambda p: (-p["size"], p["name"].lower()))
    profile = user.profile
    used = Task.objects.filter(project__owner=user).aggregate(total=Sum("size"))["total"] or 0
    return {
        "user": {"id": user.id, "username": user.get_username()},
        "projects": projects,
        "used": round(used * MB),
        "quota": round(profile.quota * MB) if profile.has_quota() else None,
    }


def is_admin(user):
    return bool(user.is_superuser)


def report(user):
    """The Storage view's data: the user's own storage and, for an admin, every other user's who owns a project,
    largest first"""
    data = {"admin": is_admin(user), "me": user_report(user), "others": []}
    if data["admin"]:
        owners = get_user_model().objects.filter(project__isnull=False).exclude(pk=user.pk).distinct()
        others = [user_report(u) for u in owners]
        others.sort(key=lambda r: (-r["used"], r["user"]["username"].lower()))
        data["others"] = others
    return data


def can_see(user, task):
    """The task's breakdown: for its project's owner and admins"""
    return task.project.owner_id == user.id or is_admin(user)


def task_breakdown(task):
    return {"id": str(task.id), "size": round((task.size or 0) * MB), "kinds": breakdown(task.task_path())}
