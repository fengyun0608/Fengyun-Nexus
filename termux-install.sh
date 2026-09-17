#!/usr/bin/env bash
# 入口别名：转发到 scripts/termux-setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec bash "$ROOT/scripts/termux-setup.sh" "$@"
