#!/usr/bin/env bash
# Fengyun Nexus — Linux / macOS / Termux 一键启动
set -e
cd "$(dirname "$0")"

echo "[Fengyun Nexus] 启动中…"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。"
  if [ -n "$TERMUX_VERSION" ] || echo "${PREFIX:-}" | grep -q com.termux; then
    echo "Termux 可执行: pkg update && pkg install nodejs git"
    echo "然后: npm install -g pnpm && ./boot.sh"
  else
    echo "请安装 Node.js 20+，再安装 pnpm 后重试。"
  fi
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "未找到 pnpm，尝试: npm install -g pnpm"
  npm install -g pnpm
fi

# Termux 默认手机姿态
if [ -n "$TERMUX_VERSION" ] || echo "${PREFIX:-}" | grep -q com.termux; then
  export NEXUS_ENV="${NEXUS_ENV:-termux}"
  export NEXUS_BOOT_MODE="${NEXUS_BOOT_MODE:-lite}"
  echo "[Nexus] 检测到 Termux → env=$NEXUS_ENV mode=$NEXUS_BOOT_MODE"
fi

pnpm boot
