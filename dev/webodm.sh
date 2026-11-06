#!/usr/bin/env bash
# A WebODM checkout in dev mode, with this repo's plugin mounted (see dev/compose.yml).
#   [TW_WEBODM=3.3.2] dev/webodm.sh up | down | logs [service] | ps | <any docker compose command>
# WebODM 4.0.0 (the default): ignored/WebODM, port 8005, livereload 35734, containers tw-webapp, tw-worker, ...,
# project and volumes webodm-tweakui. WebODM 3.3.2 (TW_WEBODM=3.3.2): ignored/WebODM-3.3.2 (a worktree of it), port
# 8006, livereload 35735, containers tw3-webapp, tw3-worker, ..., project and volumes webodm-tweakui-332.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"

# Each version's images, pinned by digest: a tag can be pushed again (3.3.2 was, on 2026-11-04), and a local
# `latest` tag can be another build (a fork's). Upgrading: move ignored/WebODM to the new tag, pull its images,
# move the digests here, `dev/webodm.sh up`, run the tests.
case "${TW_WEBODM:=4.0.0}" in
    4.0.0)
        webodm="$repo/ignored/WebODM" project=webodm-tweakui TW_PREFIX=tw port=8005 livereload=35734
        export TW_WEBAPP_IMAGE=webodm/webodm_webapp@sha256:4572838208348c189fce3bfeabd1eaa08285efd841520ff2f08460611aac14a5
        export TW_DB_IMAGE=webodm/webodm_db@sha256:6d43e32ec24c388c5d5975bf6462d21abd6959af3c43d146a2473c1db4d5019c
        export TW_BROKER_IMAGE=valkey/valkey@sha256:bf09d58e96d6b4524a15396b65b242bbe18beebbcc15a04d8ee75ddac62fae0b
        export TW_NODE_IMAGE=webodm/nodeodx@sha256:f3621054cec0829ff8d94272fa4ec9138621f034135ff9a792fe309bd7d964ad ;;
    3.3.2)
        webodm="$repo/ignored/WebODM-3.3.2" project=webodm-tweakui-332 TW_PREFIX=tw3 port=8006 livereload=35735
        export TW_WEBAPP_IMAGE=webodm/webodm_webapp@sha256:55a1d7d1eee7c1220edfb75da2b67044ebcda1b6b61b25a369cc5c087bb47d71
        export TW_DB_IMAGE=webodm/webodm_db@sha256:03f18ec0089325ec2b8975ba1781277bcdc212b6d86c9de33f6409d313e90430
        export TW_BROKER_IMAGE=redis:7.0.10
        export TW_NODE_IMAGE=webodm/nodeodx@sha256:d75a3957076af0efbbbd03a6c6d753b29802b9f1715235b42c5d7154ba68fa55 ;;
    *) echo "TW_WEBODM: 4.0.0 or 3.3.2" >&2; exit 1 ;;
esac
if [ ! -d "$webodm" ]; then
    echo "No WebODM checkout at $webodm (CLAUDE.md, Dev environment, says how to make it)" >&2; exit 1
fi
export TW_PREFIX
export WO_PORT="${WO_PORT:-$port}" TW_LIVERELOAD_PORT="${TW_LIVERELOAD_PORT:-$livereload}"
export WO_HOST=localhost WO_DEBUG=YES WO_DEV=YES WO_BROKER=redis://broker WO_DEFAULT_NODES=1
export WO_MEDIA_DIR=appmedia WO_DB_DIR=dbdata WO_SECRET_KEY="${WO_SECRET_KEY:-}"
# TW_PLUGIN_DIR=<empty dir> runs WebODM without the mounted plugin (the release check installs the zip instead)
export TW_PLUGIN_DIR="${TW_PLUGIN_DIR:-$repo/tweakui}"

compose=(docker compose -p "$project" --project-directory "$webodm"
         -f "$webodm/docker-compose.yml" -f "$webodm/docker-compose.dev.yml" -f "$repo/dev/compose.yml")

case "${1:-}" in
    # New anonymous volumes: the dev compose keeps the image's venv in one, which a new image must not reuse
    up) shift; exec "${compose[@]}" up -d --renew-anon-volumes "$@" ;;
    down) shift; exec "${compose[@]}" down --remove-orphans "$@" ;;
    logs) shift; exec "${compose[@]}" logs -f --tail 100 "$@" ;;
    "") sed -n '2,6p' "$0"; exit 1 ;;
    *) exec "${compose[@]}" "$@" ;;
esac
