"""
2D Map and 3D Map > Source Frames: the source photos of a task that show a spot or an area. Each photo's pose is in
the task's shots.geojson (its camera's position in the task's coordinates, and its rotation), its lens in
cameras.json; the ground's height comes from the task's DSM, else the point cloud's mean height, else the DSM's
median (a 3D pick gives its own). A place is counted in a photo when it falls inside its frame: what hides it (a
roof, a tree) is not detected.
"""
import json
import math
import os

import numpy as np

# How many points of an area are projected into the photos (on a grid)
MAX_SAMPLES = 400
# How many corners an area takes
MAX_CORNERS = 200


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


def inside_polygon(xy, ring):
    """Which points (n x 2) are inside a ring (m x 2), by ray casting"""
    x, y = xy[:, 0], xy[:, 1]
    result = np.zeros(len(xy), dtype=bool)
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        crosses = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-300) + xi)
        result ^= crosses
        j = i
    return result


def samples(ring, count=MAX_SAMPLES):
    """Points on a grid inside a ring (its centroid when the ring is too small for the grid)"""
    ring = np.asarray(ring, dtype=float)
    x0, y0 = ring.min(axis=0)
    x1, y1 = ring.max(axis=0)
    area = abs(np.dot(ring[:, 0], np.roll(ring[:, 1], 1)) - np.dot(ring[:, 1], np.roll(ring[:, 0], 1))) / 2
    if area > 0:
        step = math.sqrt(area / count)
        xs = np.arange(x0 + step / 2, x1, step)
        ys = np.arange(y0 + step / 2, y1, step)
        if len(xs) and len(ys):
            gx, gy = np.meshgrid(xs, ys)
            grid = np.stack([gx.ravel(), gy.ravel()], axis=1)
            grid = grid[inside_polygon(grid, ring)]
            if len(grid):
                return grid
    return ring.mean(axis=0, keepdims=True)


def altitude(shot):
    """The camera's altitude (shots.geojson's third coordinate), or None"""
    coords = (shot.get("geometry") or {}).get("coordinates") or []
    return coords[2] if len(coords) > 2 else None


def rank(place, shots, cameras):
    """The photos that show a place, best first. `place` is {"spot": [x, y, z]} or {"corners": m x 3, "samples":
    n x 3}. A spot's photos are ordered by how near it is to the frame's centre; an area's by the share of its
    samples inside the frame, then by how near those are to the centre"""
    spot = "spot" in place
    pts = np.asarray([place["spot"]] if spot else place["samples"], dtype=float)
    corners = None if spot else np.asarray(place["corners"], dtype=float)
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
        seen = front & (xy[:, 0] >= 0) & (xy[:, 0] <= 1) & (xy[:, 1] >= 0) & (xy[:, 1] <= 1)
        if not seen.any():
            continue
        centre = float(np.abs(xy[seen].mean(axis=0) - 0.5).max() * 2)
        frame = {
            "filename": props["filename"],
            "camera": props.get("camera"),
            "width": props.get("width"),
            "height": props.get("height"),
            "capture_time": props.get("capture_time"),
            "altitude": altitude(shot),
            "share": round(float(seen.mean()), 4),
            "centre": round(centre, 4),
        }
        if spot:
            frame["spot"] = [round(float(v), 5) for v in xy[0]]
        else:
            cxy, cfront = project(corners, shot, cam)
            # A corner behind the camera has no place in the photo: the outline is left out then
            frame["outline"] = [[round(float(a), 5), round(float(b), 5)] for a, b in cxy] if cfront.all() else None
        found.append(frame)
    if spot:
        found.sort(key=lambda f: f["centre"])
    else:
        found.sort(key=lambda f: (-f["share"], f["centre"]))
    return found


# The task's files


def load_json(path):
    try:
        with open(path) as f:
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
    """The request's place: {"type": "Point" or "Polygon", "coordinates": GeoJSON's, "crs": "wgs84" (default) or
    "task"}; returns (kind, coords as a list of points, crs)"""
    if not isinstance(data, dict):
        raise FramesError("Expected a place")
    kind, coords, crs = data.get("type"), data.get("coordinates"), data.get("crs", "wgs84")
    if crs not in ("wgs84", "task"):
        raise FramesError("Unknown crs: %s" % crs)
    try:
        if kind == "Point":
            points = [[float(v) for v in coords]]
        elif kind == "Polygon":
            points = [[float(v) for v in p] for p in coords[0]]
            if len(points) > 1 and points[0] == points[-1]:
                points = points[:-1]
            if len(points) < 3 or len(points) > MAX_CORNERS:
                raise FramesError("An area takes 3 to %d corners" % MAX_CORNERS)
        else:
            raise FramesError("Expected a Point or a Polygon")
    except (TypeError, IndexError, ValueError) as e:
        if isinstance(e, FramesError):
            raise
        raise FramesError("Invalid coordinates")
    width = 3 if crs == "task" else 2
    if any(len(p) < 2 or len(p) > 3 or not all(math.isfinite(v) for v in p) for p in points):
        raise FramesError("Invalid coordinates")
    if crs == "task" and any(len(p) != width for p in points):
        raise FramesError("Points in the task's coordinates take x, y and z")
    return kind, points, crs


def find(task, data):
    """The photos of a task that show the place a request gives (see parse), best first"""
    kind, points, crs = parse(data)
    if "shots.geojson" not in (task.available_assets or []):
        raise FramesError("This task has no cameras")
    shots = (load_json(task.assets_path("odm_report", "shots.geojson")) or {}).get("features") or []
    cameras = load_json(task.assets_path("cameras.json")) or {}
    coords = to_task_xy(task, points, crs)
    xy = coords[:, :2]
    if crs == "task":
        given = coords[:, 2]
        fallback = float(given.mean())
    else:
        given = None
        fallback = mean_height(task)
    if kind == "Point":
        z = given if given is not None else heights(task, xy, fallback)
        return rank({"spot": [xy[0][0], xy[0][1], z[0]]}, shots, cameras)
    grid = samples(xy)
    corner_z = given if given is not None else heights(task, xy, fallback)
    grid_z = heights(task, grid, fallback)
    return rank({
        "corners": np.column_stack([xy, corner_z]),
        "samples": np.column_stack([grid, grid_z]),
    }, shots, cameras)
