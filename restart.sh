#!/usr/bin/env bash
# Legacy helper — prefer same-window restart via boot.mjs (exit 75).
# #重启 no longer spawns a new session; this is for manual ops only.
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p "$ROOT/data"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] manual restart.sh" >>"$ROOT/data/restart.log"
exec "$ROOT/boot.sh"
