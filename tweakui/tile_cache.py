"""
2D Map > Tile Cache: the map's orthophoto, DSM and DTM tiles, kept on disk once WebODM has rendered them.

WebODM renders every tile on request (app/api/tiler.py, Tiles) and its map asks with a random `cache` parameter, so
neither the server nor the browser reuses one. api.CachedTiles answers TweakUI's tile URL (tile_cache.js rewrites the
map's to it): WebODM's own view checks the task's permissions and renders, and what it renders is kept here under a
key that fixes the tile's content. Shared by every user who has the setting on; kept under LIMIT bytes, the least
recently used tiles going first.
"""
import hashlib
import logging
import os
import time
import uuid

from django.conf import settings as django_settings

from app.plugins.functions import get_plugins_persistent_path

logger = logging.getLogger("app.logger")

# The cache's size on disk: a setting of each user's, so no one sets this. Past it, a prune takes it under KEEP
LIMIT = 1024 ** 3
KEEP = 0.9
# A process prunes after it has written this much since its last prune (and at its first write)
PRUNE_EVERY = 50 * 1024 ** 2
# A tile served from the cache is marked used (its mtime) at most this often, to spare the disk a write per tile
TOUCH_SECONDS = 3600
# Query parameters that don't change the tile: WebODM's cache buster
IGNORED_PARAMS = ("cache",)
EXTENSIONS = ("jpg", "webp", "png")
CONTENT_TYPES = {"jpg": "image/jpg", "webp": "image/webp", "png": "image/png"}

_written = None  # bytes written by this process since its last prune; None until its first write


def folder(*paths):
    return get_plugins_persistent_path("tweakui", "tile-cache", *paths)


def key(task, raster, tile_type, z, x, y, scale, ext, query, accepts_webp):
    """The tile's key: a hash of all that decides its content. query: the request's parameters as (name, value)
    pairs. The raster's size and mtime change when the task is processed again; WebODM's version when its renderer
    may have"""
    stat = os.stat(raster)
    parts = [
        getattr(django_settings, "VERSION", ""),
        str(task.id), tile_type, str(z), str(x), str(y), str(scale or 1), ext or "",
        "&".join("{}={}".format(k, v) for k, v in sorted(query) if k not in IGNORED_PARAMS),
        str(stat.st_size), str(stat.st_mtime_ns),
        str(task.crop) if task.crop is not None else "",
        "webp" if accepts_webp else "",
    ]
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()


def get(task_id, tile_key):
    """(content, ext) of a kept tile, or None"""
    for ext in EXTENSIONS:
        path = folder(str(task_id), "{}.{}".format(tile_key, ext))
        try:
            with open(path, "rb") as f:
                content = f.read()
        except OSError:
            continue
        try:
            if time.time() - os.path.getmtime(path) > TOUCH_SECONDS:
                os.utime(path)
        except OSError:
            pass
        return content, ext
    return None


def put(task_id, tile_key, ext, content):
    """Keeps a tile: written beside its place, then moved there, so another process never reads half of one"""
    global _written
    if ext not in EXTENSIONS:
        return
    directory = folder(str(task_id))
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, "{}.{}".format(tile_key, ext))
    temporary = "{}.{}.tmp".format(path, uuid.uuid4().hex)
    try:
        with open(temporary, "wb") as f:
            f.write(content)
        os.replace(temporary, path)
    except OSError as e:
        logger.warning("TweakUI Tile Cache: cannot keep a tile: %s", e)
        try:
            os.remove(temporary)
        except OSError:
            pass
        return
    if _written is None or _written + len(content) >= PRUNE_EVERY:
        _written = 0
        prune()
    else:
        _written += len(content)


def prune(limit=None, task_ids=None):
    """Takes the cache under KEEP of the limit when it is over it, the least recently used tiles first, and removes
    the folders of tasks that no longer exist (task_ids: the existing tasks' ids, else asked of the database).
    Returns the bytes left"""
    limit = LIMIT if limit is None else limit
    root = folder()
    if not os.path.isdir(root):
        return 0
    if task_ids is None:
        from app.models import Task
        task_ids = {str(i) for i in Task.objects.values_list("id", flat=True)}
    files, total = [], 0
    for entry in os.scandir(root):
        if not entry.is_dir():
            continue
        if entry.name not in task_ids:
            _remove_folder(entry.path)
            continue
        for tile in os.scandir(entry.path):
            try:
                stat = tile.stat()
            except OSError:
                continue
            if tile.name.endswith(".tmp") and time.time() - stat.st_mtime < 60:
                continue  # another process is writing it
            files.append((stat.st_mtime, stat.st_size, tile.path))
            total += stat.st_size
    if total > limit:
        files.sort()
        for _mtime, size, path in files:
            if total <= limit * KEEP:
                break
            try:
                os.remove(path)
                total -= size
            except OSError:
                pass
    return total


def _remove_folder(path):
    for tile in os.scandir(path):
        try:
            os.remove(tile.path)
        except OSError:
            pass
    try:
        os.rmdir(path)
    except OSError:
        pass
