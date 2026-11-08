"""
Diagnostic > Performance > Recent Processing: what a task's log (WebODM's data/console_output.txt, the processing
node's output) says the user should know. Each line is checked against a short list of ODX's known messages, each
turned into a plain sentence (a note), and the log tells whether the GPU was used and how many separate
reconstructions OpenSfM made before merging them (stats.json counts the merged one). Every other [WARNING] and [ERROR]
line goes in Other Messages, once each with how often it came; GDAL's CPLE_AppDefined warnings (one per texture) are
noise and left out. A huge log is read only at its start and end. Read only; a finished task's log is read once per
process (cached by its size and time, the sentences made for each request's language).
"""
import os
import re

from django.utils.translation import gettext as _

# A log up to this size is read whole; a larger one only its first and last LOG_PART bytes
LOG_WHOLE, LOG_PART = 32 * 1024 ** 2, 8 * 1024 ** 2
# Other Messages: at most this many, each line at most LINE_MAX characters
OTHER_MAX, LINE_MAX = 30, 300
# Logs read, by path: (size, mtime, result); at most CACHE_MAX
CACHE_MAX = 64
_cache = {}

OUT_OF_MEMORY = re.compile(r"Whoops! You ran out of memory|Child was terminated by signal 9\b|Child returned 137\b")
RETRIED = re.compile(r"OpenMVS (filtering )?ran out of memory|dem2mesh failed, retrying with lower concurrency|"
                     r"PoissonRecon failed with \d+ threads")
NOT_ENOUGH = re.compile(r"Not enough (supported images|photos in photos array|images in selected band)")
GPU_YES = re.compile(r"\] (nvidia-smi detected|CUDA drivers detected)")
GPU_NO = re.compile(r"\] (No nvidia-smi detected|No CUDA drivers detected|Disabling GPU features)")
CUDA_DEVICE = re.compile(r"--cuda-device (-?\d+)")
RECONSTRUCTIONS = re.compile(r"Multiple reconstructions detected \((\d+)\)")
GCP_UNUSED = re.compile(r"\[WARNING\] (.+) was not used \(observations: \d+\)")
LEVEL = re.compile(r"\[(WARNING|ERROR)\]\s*(.*)")
NOISE = ("CPLE_AppDefined",)


def _known():
    """ODX's messages worth a note: (key, level, pattern, sentence); a sentence with %(count)s counts the lines that
    match, with %(names)s lists what the pattern's group caught. Built when asked, so the sentences are translated
    for the request's language"""
    return (
        ("out_of_memory", "danger", OUT_OF_MEMORY,
         _("Processing ran out of memory and stopped. Give the node more memory (in Docker, give Docker more), or "
           "process fewer photos or at a lower quality.")),
        ("strange_values", "danger", re.compile(r"Processing stopped because of strange values"),
         _("Processing stopped on strange values in the reconstruction, often a sign of a problem with the photos "
           "(their overlap, blur or GPS).")),
        ("not_enough", "danger", NOT_ENOUGH, _("There weren't enough usable photos to go on.")),
        ("gcp_file", "danger", re.compile(r"problem with your coordinates/GCP file"),
         _("The GCP file seems to have a problem (its coordinates or its format).")),
        ("cpu", "danger", re.compile(r"your CPU is not supported"),
         _("The node's CPU is too old for this build of ODX.")),
        ("program", "danger", re.compile(r"Can't find a program that is required"),
         _("A program ODX needs is missing on the node.")),
        ("strange_code", "danger", re.compile(r"The program exited with a strange error code"),
         _("A program stopped with an unexpected error.")),
        ("retried", "warning", RETRIED,
         _("A step ran out of memory and was run again with less (in tiles, or with fewer threads): the node is "
           "short of memory for a task like this.")),
        ("gpu_failed", "warning", re.compile(r"OpenMVS failed with GPU"),
         _("The GPU failed while building the point cloud, so the CPU finished it (is the graphics driver up to "
           "date?).")),
        ("reconstructions", "warning", RECONSTRUCTIONS, None),
        ("no_features", "warning", re.compile(r"No features found in image "),
         _("No features were found in %(count)s photos (blurred, too dark, or of water, snow or sand), so they "
           "were left out.")),
        ("no_gps", "warning", re.compile(r"GPS position not available for "),
         _("%(count)s photos have no GPS position.")),
        ("zero_altitude", "warning", re.compile(r"images have zero altitude"),
         _("More than 5% of the photos have an altitude of zero: they may have no altitude information.")),
        ("gcp_unused", "warning", GCP_UNUSED,
         _("Ground control points not used, too few photos mark them: %(names)s.")),
        ("gcp_ignored", "warning", re.compile(r"GCP line ignored \(image not found\)"),
         _("%(count)s lines of the GCP file name photos that aren't in the task.")),
        ("bands", "warning", re.compile(r"Multi-camera setup detected, but band"),
         _("Some bands have fewer photos than the others: photos may be missing or damaged.")),
    )


def _lines(path):
    """The log's lines (all of them, or a huge log's first and last LOG_PART bytes); [] without a log"""
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            if size <= LOG_WHOLE:
                data = f.read()
            else:
                data = f.read(LOG_PART) + b"\n"
                f.seek(size - LOG_PART)
                data += f.read()
    except OSError:
        return []
    return data.decode("utf-8", "replace").splitlines()


def _clip(line):
    line = line.strip()
    return line if len(line) <= LINE_MAX else line[:LINE_MAX - 1] + "…"


def scan(lines):
    """What the lines say, before it is put in sentences: {gpu: True, False or None, reconstructions: the most OpenSfM
    made (None when it doesn't say), found: [{key, level, line, count, names}] in the log's order, other: [{text,
    count}], more: how many other messages weren't listed}"""
    known = [(key, level, pattern) for key, level, pattern, _text in _known()]
    found, order = {}, []
    gpu, device, reconstructions = None, None, None
    other, other_order = {}, []
    for line in lines:
        if "nvidia-smi" in line or "CUDA drivers" in line or "Disabling GPU" in line:
            if GPU_NO.search(line):
                gpu = False
            elif GPU_YES.search(line):
                gpu = True
        if "--cuda-device" in line:
            m = CUDA_DEVICE.search(line)
            if m:
                device = m.group(1) != "-2"
        matched = False
        for key, level, pattern in known:
            m = pattern.search(line)
            if not m:
                continue
            matched = True
            if key not in found:
                found[key] = {"key": key, "level": level, "line": _clip(line), "count": 0, "names": []}
                order.append(key)
            note = found[key]
            note["count"] += 1
            if key == "reconstructions":
                reconstructions = max(reconstructions or 0, int(m.group(1)))
            elif m.groups() and m.group(1) not in note["names"]:
                note["names"].append(m.group(1))
            break
        if matched:
            continue
        m = LEVEL.search(line)
        if m and m.group(2).strip() and not any(n in line for n in NOISE):
            text = _clip(m.group(0))
            if text not in other:
                other[text] = 0
                other_order.append(text)
            other[text] += 1
    return {
        "gpu": device if gpu is None else gpu, "reconstructions": reconstructions, "found": [found[k] for k in order],
        "other": [{"text": t, "count": other[t]} for t in other_order[:OTHER_MAX]],
        "more": max(len(other_order) - OTHER_MAX, 0),
    }


def describe(scanned):
    """A scan in sentences for the request's language: {gpu, reconstructions, notes: [{key, level, text, line}], the
    most pressing first, other, more}"""
    texts = {key: text for key, _level, _pattern, text in _known()}
    notes = []
    for note in scanned["found"]:
        if note["key"] == "reconstructions":
            text = _("The photos made %(count)s separate reconstructions, which were merged into one: some areas may "
                     "not have had enough overlap.") % {"count": scanned["reconstructions"]}
        else:
            text = texts[note["key"]]
            if "%(" in text:
                text = text % {"count": "{:,}".format(note["count"]), "names": ", ".join(note["names"])}
        notes.append({"key": note["key"], "level": note["level"], "text": text, "line": note["line"]})
    notes.sort(key=lambda n: n["level"] != "danger")
    out = {k: v for k, v in scanned.items() if k != "found"}
    out["notes"] = notes
    return out


def read(task):
    """What the task's log says (describe), the log read again only when it has changed"""
    path = task.data_path("console_output.txt")
    try:
        st = os.stat(path)
        stamp = (st.st_size, st.st_mtime)
    except OSError:
        return describe(scan([]))
    hit = _cache.get(path)
    if hit and hit[0] == stamp:
        return describe(hit[1])
    scanned = scan(_lines(path))
    if len(_cache) >= CACHE_MAX:
        _cache.pop(next(iter(_cache)))
    _cache[path] = (stamp, scanned)
    return describe(scanned)
