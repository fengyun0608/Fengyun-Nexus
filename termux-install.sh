#!/usr/bin/env bash
# 兼容入口：转调统一安装器 scripts/get.sh
# 手机端旧引用规律：…/raw/main/scripts/xxx.sh → 仓内 scripts/xxx.sh
# 推荐远程（永远最新，路径仍是 scripts/get.sh）：
#   curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export NEXUS_ENV="${NEXUS_ENV:-termux}"
export NEXUS_FORCE_TERMUX="${NEXUS_FORCE_TERMUX:-1}"
exec bash "$DIR/scripts/get.sh"
