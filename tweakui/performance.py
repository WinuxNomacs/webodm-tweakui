"""
Diagnostic > Performance: how WebODM's processing nodes and server are doing, and whether they suit the tasks run on
them. Each processing node the user may use is asked for its own info (NodeODX's /info: cores, memory, queue, tasks at
a time), which WebODM doesn't keep; the server's disk and memory are WebODM's Diagnostic page's; the recent finished
tasks (completed, failed or canceled; an admin's: everyone's, as on the Storage page) come with their photos,
processing time, OpenSfM's steps and figures (odm_report/stats.json) and what their log says (task_log.py). Verdicts, sentences at the top, compare them with WebODM's hardware requirements. The server's
CPU load (no node reports its own), memory and the nodes' memory are refreshed through `live`. Read only.
"""
import json
import os
import shutil
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings as django_settings
from django.db.models import Max
from django.utils.translation import gettext as _
from guardian.shortcuts import get_objects_for_user
from pyodx import exceptions as odx_exceptions

from app.models import Task
from nodeodm import status_codes
from nodeodm.models import ProcessingNode

from . import task_log
from .storage import is_admin

GB = 1024 ** 3

# WebODM's hardware requirements (its docs' installation page): memory by number of photos (conservative, RAM or RAM
# plus swap), at least 16 GB of memory and 100 GB of free disk. Memory is sold in binary GB; a machine reports a little
# less than it has, so the server's minimum allows for that
MEMORY_TABLE = ((40, 4), (250, 16), (500, 32), (1500, 64), (2500, 128), (3500, 192), (5000, 256))
MIN_MEMORY, MIN_MEMORY_REPORTED = 16 * GB, 15 * GB
MIN_DISK = 100 * GB

# How long a node has to answer, and how many are asked at once
NODE_TIMEOUT, NODE_WORKERS = 3, 8

# Recent Processing: this many finished tasks, and a trend once there are at least TREND_MIN completed with a time per
# photo
RECENT, TREND_MIN, TREND_SAME = 10, 4, 0.1
# Photos Left Out: the task folder's files of these kinds (not the GCP, geo or alignment file), at most LEFT_MAX listed
PHOTO_EXTENSIONS = (".jpg", ".jpeg", ".tif", ".tiff", ".png", ".dng", ".raw", ".nef", ".cr2", ".arw")
NOT_PHOTOS = ("align.tif", "align.tiff")
LEFT_MAX = 500
FINISHED = {status_codes.COMPLETED: "completed", status_codes.FAILED: "failed", status_codes.CANCELED: "canceled"}


def _round(n):
    """A photo count to two significant figures: 1340 -> 1300"""
    n = round(n)
    digits = len(str(n))
    return n if digits <= 2 else int(round(n, 2 - digits))


def images_for_memory(memory):
    """About how many photos memory (bytes) suits, from MEMORY_TABLE (between its rows, a straight line); 0 under its
    first row's memory, None (more than the table goes) above its last"""
    if not memory:
        return 0
    gb = memory / GB
    if gb < MEMORY_TABLE[0][1]:
        return 0
    for (n0, g0), (n1, g1) in zip(MEMORY_TABLE, MEMORY_TABLE[1:]):
        if gb <= g1:
            return _round(n0 + (gb - g0) / (g1 - g0) * (n1 - n0))
    return None


def memory_for_images(images):
    """About how much memory (bytes) a task of so many photos needs, from MEMORY_TABLE; the last row's slope beyond it"""
    if images <= MEMORY_TABLE[0][0]:
        return MEMORY_TABLE[0][1] * GB
    pairs = list(zip(MEMORY_TABLE, MEMORY_TABLE[1:]))
    for (n0, g0), (n1, g1) in pairs:
        if images <= n1:
            return (g0 + (images - n0) / (n1 - n0) * (g1 - g0)) * GB
    (n0, g0), (n1, g1) = pairs[-1]
    return (g1 + (images - n1) / (n1 - n0) * (g1 - g0)) * GB


def _node_info(node):
    """The node's own info (pyodx's NodeInfo), or None when it doesn't answer"""
    try:
        return node.api_client(timeout=NODE_TIMEOUT).info()
    except (odx_exceptions.GenericError, OSError, ValueError):
        return None


def nodes_for(user):
    """The processing nodes the user may use (as WebODM chooses one for them), by name"""
    nodes = get_objects_for_user(user, "view_processingnode", ProcessingNode, accept_global_perms=False)
    return sorted(nodes, key=lambda n: str(n).lower())


def node_entries(nodes):
    """Each node with what it says of itself, asked all at once; a node that doesn't answer keeps what WebODM last
    stored of it (online: false)"""
    nodes = list(nodes)
    infos = []
    if nodes:
        with ThreadPoolExecutor(max_workers=min(NODE_WORKERS, len(nodes))) as pool:
            infos = list(pool.map(_node_info, nodes))
    entries = []
    for node, info in zip(nodes, infos):
        entry = {
            "id": node.id, "name": str(node), "online": info is not None,
            "last_refreshed": node.last_refreshed.isoformat() if node.last_refreshed else None,
            "engine": node.engine, "engine_version": node.engine_version, "version": node.api_version,
            "queue": node.queue_count, "max_images": node.max_images,
            "cpu_cores": None, "total_memory": None, "available_memory": None, "max_parallel_tasks": None,
            "suits_images": None,
        }
        if info is not None:
            entry.update({
                "engine": info.engine, "engine_version": info.engine_version, "version": info.version,
                "queue": info.task_queue_count, "cpu_cores": info.cpu_cores, "total_memory": info.total_memory,
                "available_memory": info.available_memory, "max_parallel_tasks": info.max_parallel_tasks,
                "max_images": info.max_images if isinstance(info.max_images, (int, float)) else None,
            })
            if info.total_memory:
                entry["suits_images"] = images_for_memory(info.total_memory)
        entries.append(entry)
    return entries


def memory_stats():
    """WebODM's server's memory, as its Diagnostic page shows it ({total, free, used} in bytes; {} when unknown)"""
    try:
        from coreplugins.diagnostic.plugin import get_memory_stats
    except ImportError:
        return {}
    return get_memory_stats() or {}


def proc_stat_times(path="/proc/stat"):
    """Linux's CPU time counters for the whole machine from /proc/stat's first line, as [busy, total] (in its ticks),
    or [] without one. Idle and waiting for the disk count as not busy, as in top"""
    with open(path, encoding="ascii") as f:
        line = f.readline()
    if not line.startswith("cpu "):
        return []
    # user nice system idle iowait irq softirq steal (guest time is already in user)
    fields = [int(v) for v in line.split()[1:9]]
    total = sum(fields)
    return [total - sum(fields[3:5]), total]


def windows_times():
    """Windows' CPU time counters for the whole machine (GetSystemTimes), as [busy, total] (in 100 ns), or [] where
    they can't be read; through ctypes, as WebODM's Diagnostic page reads Windows' memory. Kernel time includes idle
    time"""
    import ctypes

    class FILETIME(ctypes.Structure):
        _fields_ = [("low", ctypes.c_uint32), ("high", ctypes.c_uint32)]

    def value(t):
        return (t.high << 32) | t.low

    idle, kernel, user = FILETIME(), FILETIME(), FILETIME()
    if not ctypes.windll.kernel32.GetSystemTimes(ctypes.byref(idle), ctypes.byref(kernel), ctypes.byref(user)):
        return []
    total = value(kernel) + value(user)
    return [total - value(idle), total]


def cpu_entry():
    """The server's CPU time counters ({total: [busy, total], cores: how many, load: [1, 5, 15 minutes] or None where
    the system keeps none, as on Windows}), or None where they can't be read. A load is the difference between two
    readings, which the page works out; in Docker these are the machine's (or Docker Desktop's VM's). Only the total:
    a bar per core would be too many on a large server"""
    try:
        times = windows_times() if sys.platform == "win32" else proc_stat_times()
    except (OSError, ValueError, AttributeError):
        return None
    if not times:
        return None
    try:
        load = [round(v, 2) for v in os.getloadavg()]
    except (OSError, AttributeError):
        load = None
    return {"total": times, "cores": os.cpu_count(), "load": load}


def disk_entry():
    """The disk WebODM keeps its tasks on, in bytes, or None"""
    try:
        total, used, free = shutil.disk_usage(getattr(django_settings, "MEDIA_ROOT", None) or ".")
    except OSError:
        return None
    return {"total": total, "used": used, "free": free}


def server_entry():
    """The disk WebODM keeps its tasks on and the server's memory, in bytes, and its CPU time counters"""
    memory = memory_stats()
    return {"disk": disk_entry(), "memory": memory if memory.get("total") else None, "cpu": cpu_entry()}


def live(user, disk=False):
    """What the Performance page refreshes every few seconds: the server's CPU counters and memory, each node's memory
    (the nodes the user may use, asked as for the report), and the disk when asked"""
    memory = memory_stats()
    out = {
        "cpu": cpu_entry(), "memory": memory if memory.get("total") else None,
        "nodes": [{k: n[k] for k in ("id", "online", "total_memory", "available_memory")}
                  for n in node_entries(nodes_for(user))],
    }
    if disk:
        out["disk"] = disk_entry()
    return out


def _number(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def read_stats(task):
    """What the task's odm_report/stats.json says: {steps: {name: seconds} of OpenSfM's (without "Total Time"),
    average_gsd (cm), photos_given, photos_reconstructed, components (reconstructions after merging), area (m²),
    position_error: {kind: gcp or gps, meters} (the GCPs' when the task had them)}; each None (steps empty) when it is
    missing or doesn't say"""
    out = {"steps": {}, "average_gsd": None, "photos_given": None, "photos_reconstructed": None, "components": None,
           "area": None, "position_error": None}
    try:
        with open(task.assets_path("odm_report", "stats.json"), encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return out
    if not isinstance(data, dict):
        return out

    def part(name):
        v = data.get(name)
        return v if isinstance(v, dict) else {}

    processing, reconstruction = part("processing_statistics"), part("reconstruction_statistics")
    steps = processing.get("steps_times")
    if isinstance(steps, dict):
        out["steps"] = {k: v for k, v in steps.items() if k != "Total Time" and _number(v) is not None}
    out["average_gsd"] = _number(part("odm_processing_statistics").get("average_gsd"))
    out["area"] = _number(processing.get("area"))
    out["photos_given"] = _number(reconstruction.get("initial_shots_count"))
    out["photos_reconstructed"] = _number(reconstruction.get("reconstructed_shots_count"))
    out["components"] = _number(reconstruction.get("components"))
    gcp = _number(part("gcp_errors").get("average_error")) if reconstruction.get("has_gcp") else None
    gps = _number(part("gps_errors").get("average_error"))
    if gcp is not None:
        out["position_error"] = {"kind": "gcp", "meters": gcp}
    elif gps is not None:
        out["position_error"] = {"kind": "gps", "meters": gps}
    return out


def placed_photos(task):
    """The photos placed in the reconstruction, by file name (the report's odm_report/shots.geojson), or None without
    it"""
    try:
        with open(task.assets_path("odm_report", "shots.geojson"), encoding="utf-8") as f:
            data = json.load(f)
        return {(feature.get("properties") or {}).get("filename") for feature in data["features"]}
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return None


def left_out_photos(task, reasons):
    """The task's photos (WebODM keeps them in its folder) the report's shots don't name: ([{name, reason}] by name, at
    most LEFT_MAX, how many more), the reason the log's (no_features, no_gps) or None; None without a shots.geojson"""
    placed = placed_photos(task)
    if placed is None:
        return None
    left = sorted(name for name in task.scan_images()
                  if name.lower().endswith(PHOTO_EXTENSIONS) and name.lower() not in NOT_PHOTOS and name not in placed)
    return [{"name": n, "reason": reasons.get(n)} for n in left[:LEFT_MAX]], max(len(left) - LEFT_MAX, 0)


def photos_left_out(stats, task=None, reasons=None):
    """A note when stats.json says photos were left out of the reconstruction, with them by name (photos, more) when
    the task's report says which; else None"""
    given, placed = stats["photos_given"], stats["photos_reconstructed"]
    if not given or placed is None or placed >= given:
        return None
    note = {"key": "left_out", "level": "warning", "line": "",
            "text": _("%(left)s of %(given)s photos couldn't be placed in the reconstruction and were left out (too "
                      "little overlap, or too few features).") % {"left": "{:,}".format(given - placed),
                                                                  "given": "{:,}".format(given)}}
    left = left_out_photos(task, reasons or {}) if task is not None else None
    if left and left[0]:
        note["photos"], note["more"] = left
    return note


def task_entry(task, user):
    status = FINISHED.get(task.status, "completed")
    seconds = task.processing_time / 1000 if task.processing_time and task.processing_time > 0 else None
    images = task.images_count or 0
    stats = read_stats(task)
    log = task_log.read(task)
    steps = stats["steps"]
    slowest = max(steps.items(), key=lambda s: s[1]) if steps else None
    owner = task.project.owner
    notes = log["notes"]
    left = photos_left_out(stats, task, log["reasons"]) if status == "completed" else photos_left_out(stats)
    if left:
        notes = [n for n in notes if n["level"] == "danger"] + [left] + [n for n in notes if n["level"] != "danger"]
    components = stats["components"]
    reconstructions = max(log["reconstructions"] or 0, components or 0) or None
    return {
        "id": str(task.id), "project": {"id": task.project_id, "name": task.project.name},
        "name": task.name or "", "created_at": task.created_at.isoformat() if task.created_at else None,
        "owner": None if owner.id == user.id else owner.get_username(),
        "status": status, "error": (task.last_error or None) if status == "failed" else None,
        "images": images, "seconds": seconds,
        "seconds_per_image": seconds / images if seconds and images and status == "completed" else None,
        "slowest_step": {"name": slowest[0], "seconds": slowest[1]} if slowest else None,
        "average_gsd": stats["average_gsd"],
        "photos_given": stats["photos_given"], "photos_reconstructed": stats["photos_reconstructed"],
        "area": stats["area"], "reconstructions": reconstructions, "position_error": stats["position_error"],
        "gpu": log["gpu"], "notes": notes, "other": log["other"], "more": log["more"],
        "node": str(task.processing_node) if task.processing_node_id else None,
    }


def tasks_of(user):
    """The tasks Recent Processing and the largest task count: the user's own, an admin's every user's"""
    tasks = Task.objects.all()
    return tasks if is_admin(user) else tasks.filter(project__owner=user)


def recent_tasks(user):
    tasks = (tasks_of(user).filter(status__in=list(FINISHED))
             .select_related("project", "project__owner", "processing_node")
             .only("id", "name", "created_at", "status", "last_error", "images_count", "processing_time", "processing_node",
                   "project__id", "project__name", "project__owner__id", "project__owner__username",
                   "processing_node__hostname", "processing_node__port", "processing_node__label")
             .order_by("-created_at")[:RECENT])
    return [task_entry(t, user) for t in tasks]


def trend(tasks):
    """The newer half of the tasks (newest first) against the older half, by their median time per photo (only a
    completed task has one): {recent, earlier, change (recent / earlier - 1), same (within TREND_SAME)}; None with
    fewer than TREND_MIN to compare"""
    times = [t["seconds_per_image"] for t in tasks if t["seconds_per_image"]]
    if len(times) < TREND_MIN:
        return None
    half = len(times) // 2
    recent, earlier = statistics.median(times[:half]), statistics.median(times[half:])
    change = recent / earlier - 1 if earlier else 0
    return {"recent": recent, "earlier": earlier, "change": change, "same": abs(change) < TREND_SAME}


def _gb(n):
    return "{:.0f} GB".format(n / GB) if n >= 10 * GB else "{:.1f} GB".format(n / GB)


def verdicts(nodes, server, largest, admin):
    """Sentences on what the figures mean, each {level: success|warning|danger, text}, the most pressing first"""
    out = []
    online = [n for n in nodes if n["online"]]
    if not nodes:
        out.append(("danger", _("No processing node is available to you, so no task can be processed.")))
    elif not online:
        out.append(("danger", _("No processing node is answering, so no task can be processed now.")))
    for n in nodes:
        if not n["online"]:
            out.append(("warning", _("%(node)s is not answering.") % {"node": n["name"]}))
    for n in online:
        parallel = n["max_parallel_tasks"] or 1
        if n["queue"] and n["queue"] > parallel:
            out.append(("warning", _("%(count)s tasks are waiting on %(node)s: it processes %(parallel)s at a time.")
                        % {"count": n["queue"] - parallel, "node": n["name"], "parallel": parallel}))
    sized = [n for n in online if n["total_memory"]]
    if largest and sized:
        best = max(sized, key=lambda n: n["total_memory"])
        need = memory_for_images(largest)
        values = {"node": best["name"], "images": "{:,}".format(largest), "need": _gb(need),
                  "has": _gb(best["total_memory"])}
        if best["total_memory"] >= need:
            text = (_("%(node)s has enough memory for the largest task on this server (%(images)s photos, about "
                      "%(need)s).") if admin else
                    _("%(node)s has enough memory for your largest task (%(images)s photos, about %(need)s)."))
            out.append(("success", text % values))
        else:
            text = (_("The largest task on this server (%(images)s photos) needs about %(need)s of memory; the most "
                      "any node has is %(has)s. Add memory (or swap), or split the task.") if admin else
                    _("Your largest task (%(images)s photos) needs about %(need)s of memory; the most any node has is "
                      "%(has)s. Add memory (or swap), or split the task."))
            out.append(("warning", text % values))
    for n in sized:
        suits = n["suits_images"]
        if suits is None:
            text = _("%(node)s suits more than %(images)s photos per task (%(memory)s of memory).")
            suits = MEMORY_TABLE[-1][0]
        elif suits == 0:
            text = _("%(node)s has under 4 GB of memory (%(memory)s): too little for even a small task.")
        else:
            text = _("%(node)s suits about %(images)s photos per task (%(memory)s of memory).")
        out.append(("success" if suits else "danger",
                    text % {"node": n["name"], "images": "{:,}".format(suits), "memory": _gb(n["total_memory"])}))
    disk, memory = server["disk"], server["memory"]
    if disk and disk["free"] < MIN_DISK:
        out.append(("warning", _("The server's disk has %(free)s free; WebODM recommends at least 100 GB.")
                    % {"free": _gb(disk["free"])}))
    if memory and memory["total"] < MIN_MEMORY_REPORTED:
        out.append(("warning", _("The server has %(total)s of memory; WebODM recommends at least 16 GB.")
                    % {"total": _gb(memory["total"])}))
    order = {"danger": 0, "warning": 1, "success": 2}
    return [{"level": level, "text": text} for level, text in sorted(out, key=lambda v: order[v[0]])]


def report(user):
    """The Performance view's data"""
    admin = is_admin(user)
    nodes = node_entries(nodes_for(user))
    server = server_entry()
    tasks = recent_tasks(user)
    largest = tasks_of(user).aggregate(m=Max("images_count"))["m"] or 0
    return {
        "admin": admin, "nodes": nodes, "server": server, "tasks": tasks, "trend": trend(tasks),
        "largest": largest, "verdicts": verdicts(nodes, server, largest, admin),
    }
