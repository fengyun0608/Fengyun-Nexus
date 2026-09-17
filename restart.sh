#!/usr/bin/env bash
# Fengyun Nexus — 系统层重启可执行文件
# 由网关 #重启 调用：先等旧进程退出，再拉起 boot.sh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

DELAY="${NEXUS_RESTART_DELAY:-2}"
LOG="$ROOT/data/restart.log"
mkdir -p "$ROOT/data"

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Nexus restart begin  delay=${DELAY}s"
  sleep "$DELAY"
  if [ -x "$ROOT/boot.sh" ]; then
    exec "$ROOT/boot.sh"
  else
    exec bash "$ROOT/boot.sh"
  fi
} >>"$LOG" 2>&1 &

echo "Fengyun Nexus 重启已调度"
exit 0
