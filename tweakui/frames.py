"""
2D Map and 3D Map > Source Frames: the source photos of a task that show a spot. Each photo's pose is in
the task's shots.geojson (its camera's position in the task's coordinates, and its rotation), its lens in
cameras.json; the ground's height comes from the task's DSM, else the point cloud's mean height, else the DSM's
median (a 3D pick gives its own). A place is counted in a photo when it falls inside its frame: what hides it (a
roof, a tree) is not detected.
"""
import json
import math
import os

import numpy as np


class FramesError(ValueError):
    pass


def rotation_matrix(r):
    """The world-to-camera rotation of an axis-angle vector (OpenSfM's, as shots.geojson gives it)"""
    r = np.asarray(r, dtype=float)
    angle = np.linalg.norm(r)
    if angle < 1e-12:
        return np.eye(3)
    k = r / angle
    kx = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(angle) * kx + (1 - math.cos(angle)) * kx.dot(kx)


def camera_id(name):
    """cameras.json's key of a shot's camera ("v2 dji m4t ..." in shots.geojson, "dji m4t ..." in cameras.json)"""
    return name[3:] if name and name.startswith("v2 ") else name


def distort(x, y, cam, limit=None):
    """Normalized image coordinates (x / z, y / z) through the camera's lens, as OpenSfM's cameras do; scaled by
    the focal length and shifted by the principal point, in units of the photo's largest side. Lens polynomials
    only hold within the photo: beyond `limit` (the squared radius of its corners) a point is carried on in a
    straight line from where the lens puts that radius"""
    kind = cam.get("projection_type", "perspective")
    fx = cam.get("focal_x", cam.get("focal", 1.0))
    fy = cam.get("focal_y", cam.get("focal", 1.0))
    k1, k2, k3 = cam.get("k1", 0.0), cam.get("k2", 0.0), cam.get("k3", 0.0)
    r2 = x * x + y * y
    scale = np.ones_like(r2)
    if limit is not None:
        far = r2 > limit
        scale = np.where(far, np.sqrt(limit / np.where(far, r2, 1.0)), 1.0)
        x, y = x * scale, y * scale
        r2 = x * x + y * y
    if kind in ("fisheye", "fisheye_opencv", "fisheye62", "fisheye624"):
        r = np.sqrt(r2)
        theta = np.arctan(r)
        t2 = theta * theta
        d = 1 + k1 * t2 + k2 * t2 * t2 + k3 * t2 * t2 * t2
        s = np.where(r > 1e-12, theta * d / np.maximum(r, 1e-12), 1.0)
        xd, yd = x * s, y * s
    else:
        radial = 1 + k1 * r2 + k2 * r2 * r2 + k3 * r2 * r2 * r2
        p1, p2 = cam.get("p1", 0.0), cam.get("p2", 0.0)
        xd = x * radial + 2 * p1 * x * y + p2 * (r2 + 2 * x * x)
        yd = y * radial + p1 * (r2 + 2 * y * y) + 2 * p2 * x * y
    return fx * xd / scale + cam.get("c_x", 0.0), fy * yd / scale + cam.get("c_y", 0.0)


def project(points, shot, cam):
    """Where world points (n x 3, the task's coordinates) fall in a photo, as fractions of its width and height
    (0 to 1 inside it), and which are in front of the camera. None for a photo that can't be projected (a 360°
    camera)"""
    props = shot["properties"]
    if cam.get("projection_type") in ("spherical", "equirectangular"):
        return None
    w, h = float(props["width"]), float(props["height"])
    size = max(w, h)
    p = (np.asarray(points, dtype=float) - np.asarray(props["translation"], dtype=float)).dot(
        rotation_matrix(props["rotation"]).T)
    front = p[:, 2] > 1e-6
    z = np.where(front, p[:, 2], 1.0)
    fx = cam.get("focal_x", cam.get("focal", 1.0))
    fy = cam.get("focal_y", cam.get("focal", 1.0))
    limit = (w / 2 / size / fx) ** 2 + (h / 2 / size / fy) ** 2
    u, v = distort(p[:, 0] / z, p[:, 1] / z, cam, limit)
    return np.stack([(u * size + w / 2) / w, (v * size + h / 2) / h], axis=1), front


def altitude(shot):
    """The camera's altitude (shots.geojson's third coordinate), or None"""
    coords = (shot.get("geometry") or {}).get("coordinates") or []
    return coords[2] if len(coords) > 2 else None


def rank(spot, shots, cameras):
    """The photos that show a spot ([x, y, z], the task's coordinates), ordered by how near it is to the frame's
    centre"""
    pts = np.asarray([spot], dtype=float)
    found = []
    for shot in shots:
        props = shot.get("properties") or {}
        cam = cameras.get(camera_id(props.get("camera")))
        if cam is None or not props.get("filename"):
            continue
        projected = project(pts, shot, cam)
        if projected is None:
            continue
        xy, front = projected
        u, v = xy[0]
        if not (front[0] and 0 <= u <= 1 and 0 <= v <= 1):
            continue
        found.append({
            "filename": props["filename"],
            "camera": props.get("camera"),
            "width": props.get("width"),
            "height": props.get("height"),
            "capture_time": props.get("capture_time"),
            "altitude": altitude(shot),
            "centre": round(float(max(abs(u - 0.5), abs(v - 0.5)) * 2), 4),
            "spot": [round(float(u), 5), round(float(v), 5)],
        })
    found.sort(key=lambda f: f["centre"])
    return found


# The task's files


def load_json(path):
    """A JSON file of the task's (ODM writes them in UTF-8, whatever the system's encoding: cp1252 on Windows), or
    None"""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def mean_height(task):
    """The point cloud's mean height (its Entwine statistics), or None"""
    ept = load_json(task.assets_path("entwine_pointcloud", "ept.json")) or {}
    for dim in ept.get("schema") or []:
        if dim.get("name") == "Z" and dim.get("mean") is not None:
            return float(dim["mean"])
    return None


def heights(task, xy, fallback):
    """The DSM's height at each point (n x 2, the task's coordinates); where it has none (outside it, or a hole),
    `fallback`, else the DSM's median height"""
    z = np.full(len(xy), np.nan)
    path = task.assets_path("odm_dem", "dsm.tif")
    if os.path.isfile(path) and len(xy):
        import rasterio
        with rasterio.open(path) as dsm:
            z = np.array([v[0] for v in dsm.sample([(float(a), float(b)) for a, b in xy])], dtype=float)
            if dsm.nodata is not None:
                z[z == dsm.nodata] = np.nan
            if fallback is None and np.isnan(z).any():
                # A coarse read is enough for a median
                overview = dsm.read(1, out_shape=(min(dsm.height, 256), min(dsm.width, 256)), masked=True)
                valid = overview.compressed()
                if len(valid):
                    fallback = float(np.median(valid))
    if fallback is None and np.isnan(z).any():
        raise FramesError("This task has no ground height there (no DSM, and no point cloud to estimate it)")
    return np.where(np.isnan(z), fallback if fallback is not None else 0.0, z)


def to_task_xy(task, coords, crs):
    """[x, y(, z)] coordinates in the task's coordinates, from longitude and latitude (crs "wgs84") or already in
    them (crs "task", a 3D pick)"""
    coords = np.asarray(coords, dtype=float)
    if crs == "task":
        return coords
    if not task.epsg:
        raise FramesError("This task is not georeferenced")
    from pyproj import Transformer
    t = Transformer.from_crs("EPSG:4326", "EPSG:%s" % task.epsg, always_xy=True)
    x, y = t.transform(coords[:, 0], coords[:, 1])
    return np.stack([np.asarray(x), np.asarray(y)], axis=1)


def parse(data):
    """The request's spot: {"type": "Point", "coordinates": GeoJSON's, "crs": "wgs84" (default) or "task"};
    returns (the point, crs)"""
    if not isinstance(data, dict):
        raise FramesError("Expected a spot")
    kind, coords, crs = data.get("type"), data.get("coordinates"), data.get("crs", "wgs84")
    if crs not in ("wgs84", "task"):
        raise FramesError("Unknown crs: %s" % crs)
    if kind != "Point":
        raise FramesError("Expected a Point")
    try:
        point = [float(v) for v in coords]
    except (TypeError, ValueError):
        raise FramesError("Invalid coordinates")
    if len(point) < 2 or len(point) > 3 or not all(math.isfinite(v) for v in point):
        raise FramesError("Invalid coordinates")
    if crs == "task" and len(point) != 3:
        raise FramesError("A point in the task's coordinates takes x, y and z")
    return point, crs


def find(task, data):
    """The photos of a task that show the spot a request gives (see parse), best first"""
    point, crs = parse(data)
    if "shots.geojson" not in (task.available_assets or []):
        raise FramesError("This task has no cameras")
    shots = (load_json(task.assets_path("odm_report", "shots.geojson")) or {}).get("features") or []
    cameras = load_json(task.assets_path("cameras.json")) or {}
    coords = to_task_xy(task, [point], crs)
    x, y = coords[0][0], coords[0][1]
    if crs == "task":
        z = coords[0][2]
    else:
        z = heights(task, coords[:, :2], mean_height(task))[0]
    return rank([x, y, z], shots, cameras)
