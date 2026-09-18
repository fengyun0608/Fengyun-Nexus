#!/usr/bin/env bash
# Fengyun Nexus — Linux / macOS / Termux boot
set -e
cd "$(dirname "$0")"

echo "[Fengyun Nexus] 启动中…"

is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || echo "${PREFIX:-}" | grep -q com.termux
}

# Android / Termux：禁止切到 @pnpm/exe（无 android-arm64 原生包）
if is_termux || [ "$(uname -s 2>/dev/null)" = "Android" ] || echo "$(uname -m 2>/dev/null)" | grep -qi 'aarch64\|arm64'; then
  if is_termux || [ -n "${PREFIX:-}" ]; then
    export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
    export NEXUS_ENV="${NEXUS_ENV:-termux}"
    export NEXUS_BOOT_MODE="${NEXUS_BOOT_MODE:-lite}"
    echo "[Nexus] Termux/Android → env=$NEXUS_ENV  （已关闭 pnpm 原生二进制切换）"
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。"
  if is_termux; then
    echo "请先装环境："
    echo "  bash ~/Fengyun-Nexus/termux-install.sh"
  else
    echo "服务器可一键装："
    echo "  bash ~/Fengyun-Nexus/server-install.sh"
    echo "或自行安装 Node.js 20+ 与 pnpm 后重试。"
  fi
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "未找到 pnpm，尝试安装 pnpm@9（兼容 Termux）…"
  npm config set allow-scripts=pnpm --location=user >/dev/null 2>&1 || true
  npm install -g pnpm@9.15.0
fi

# 再次确保：pnpm 12 读 packageManager 时不拉 exe
export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false

pnpm boot
