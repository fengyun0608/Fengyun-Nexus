#!/usr/bin/env bash
# 兼容入口：转调统一安装器 scripts/get.sh（推荐直接远程管道）
#   curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/get.sh | bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export NEXUS_ENV="${NEXUS_ENV:-termux}"
export NEXUS_FORCE_TERMUX="${NEXUS_FORCE_TERMUX:-1}"
exec bash "$DIR/scripts/get.sh"
