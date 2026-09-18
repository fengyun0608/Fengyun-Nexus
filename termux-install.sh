#!/usr/bin/env bash
# 兼容入口：转调统一安装器 scripts/get.sh
# 国内：curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
# 国外：curl -fsSL "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.sh" | bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export NEXUS_ENV="${NEXUS_ENV:-termux}"
export NEXUS_FORCE_TERMUX="${NEXUS_FORCE_TERMUX:-1}"
exec bash "$DIR/scripts/get.sh"
