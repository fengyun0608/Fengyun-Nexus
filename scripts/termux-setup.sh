#!/usr/bin/env bash
# 兼容旧路径：转发到仓库根目录唯一入口 termux-install.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/termux-install.sh" "$@"
