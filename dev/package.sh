#!/usr/bin/env bash
# Builds the release zip, dist/tweakui-<version>.zip (the version from tweakui/manifest.json), from the committed
# files of tweakui/ with LICENSE added and without the tests, and prints its sha256 for WebODM-Plugins'
# directory.json. Commit first: uncommitted changes are not in the zip.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"

version="$(python3 -c 'import json; print(json.load(open("tweakui/manifest.json"))["version"])')"
zip="dist/tweakui-$version.zip"
if [ -n "$(git status --porcelain -- tweakui LICENSE)" ]; then
    echo "tweakui/ or LICENSE has uncommitted changes: commit them first" >&2
    exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# The single root folder WebODM expects; the tests stay out (public/ is served to browsers)
git archive HEAD tweakui LICENSE | tar -x -C "$work"
mv "$work/LICENSE" "$work/tweakui/LICENSE"
rm -rf "$work/tweakui/tests" "$work/tweakui/public/__tests__"

mkdir -p dist
rm -f "$zip"
# Python's zipfile, so that no zip tool is needed; folders first, sorted, as unzip lists them. Python lists the zip
# and prints its sha256 too, the same on Linux and macOS (which has no GNU head or sha256sum)
python3 - "$work" "$repo/$zip" "$zip" <<'PY'
import hashlib, os, sys, zipfile
root, out, shown = sys.argv[1], sys.argv[2], sys.argv[3]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for folder, dirs, files in sorted(os.walk(os.path.join(root, "tweakui"))):
        dirs.sort()
        z.write(folder, os.path.relpath(folder, root))
        for name in sorted(files):
            path = os.path.join(folder, name)
            z.write(path, os.path.relpath(path, root))
print(shown)
with zipfile.ZipFile(out) as z:
    for name in z.namelist():
        print("  " + name)
with open(out, "rb") as f:
    print("sha256: " + hashlib.sha256(f.read()).hexdigest())
PY
