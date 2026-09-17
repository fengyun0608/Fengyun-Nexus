#!/usr/bin/env bash
# Fengyun Nexus — system restart (called by #重启)
# Detach from dying gateway, wait, then boot.sh
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

DELAY="${NEXUS_RESTART_DELAY:-4}"
LOG="$ROOT/data/restart.log"
mkdir -p "$ROOT/data"

(
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] restart.sh begin  delay=${DELAY}s"
  sleep "$DELAY"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] launching boot.sh"
  if [ -x "$ROOT/boot.sh" ]; then
    exec "$ROOT/boot.sh"
  else
    exec bash "$ROOT/boot.sh"
  fi
) >>"$LOG" 2>&1 &

disown $! 2>/dev/null || true
echo "Fengyun Nexus 重启已调度"
exit 0
