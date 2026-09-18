#!/usr/bin/env bash
# 兼容入口：转调统一安装器 scripts/get.sh
# 推荐远程（永远最新）：
#   curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export NEXUS_ENV="${NEXUS_ENV:-server}"
exec bash "$DIR/scripts/get.sh"
