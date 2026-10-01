#!/usr/bin/env bash
# Fengyun Nexus — Linux / macOS / Termux
# 本机桌面：前台跑（关终端即停）
# 服务器 / 容器：默认 PM2 后台（NEXUS_ENV=server 或 Docker）
# 强制：NEXUS_USE_PM2=1 后台 · NEXUS_FOREGROUND=1 前台
set -e
cd "$(dirname "$0")"

echo "[Fengyun Nexus] 启动中…"

is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || echo "${PREFIX:-}" | grep -q com.termux
}

in_container() {
  [ -f /.dockerenv ] && return 0
  [ -n "${KUBERNETES_SERVICE_HOST:-}" ] && return 0
  grep -qaE 'docker|containerd|kubepods|podman' /proc/1/cgroup 2>/dev/null && return 0
  return 1
}

if is_termux || [ "$(uname -s 2>/dev/null)" = "Android" ] || echo "$(uname -m 2>/dev/null)" | grep -qi 'aarch64\|arm64'; then
  if is_termux || [ -n "${PREFIX:-}" ]; then
    export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
    export NEXUS_ENV="${NEXUS_ENV:-termux}"
    export NEXUS_BOOT_MODE="${NEXUS_BOOT_MODE:-lite}"
    echo "[Nexus] Termux/Android → env=$NEXUS_ENV"
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。"
  if is_termux; then
    echo "请先：bash ~/Fengyun-Nexus/termux-install.sh"
  else
    echo "请先：bash ~/Fengyun-Nexus/server-install.sh"
  fi
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "未找到 pnpm，尝试安装 pnpm@9…"
  npm config set allow-scripts=pnpm --location=user >/dev/null 2>&1 || true
  npm install -g pnpm@9.15.0
fi

export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false

use_pm2=0
if [ "${NEXUS_FOREGROUND:-0}" = "1" ]; then
  use_pm2=0
elif [ "${NEXUS_USE_PM2:-0}" = "1" ]; then
  use_pm2=1
elif [ "${NEXUS_ENV:-}" = "server" ] || in_container; then
  use_pm2=1
  export NEXUS_ENV="${NEXUS_ENV:-server}"
fi

if [ "$use_pm2" = "1" ]; then
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "[Nexus] 服务器/容器模式：安装 PM2…"
    node scripts/ensure-runtime.mjs --pm2-only || npm install -g pm2 || true
  fi
  if command -v pm2 >/dev/null 2>&1; then
    echo "[Nexus] PM2 后台启动（仅服务器/容器）"
    pnpm --filter @fengyun/nexus-cli exec tsx src/index.ts start
    if [ -t 0 ] && [ "${NEXUS_SKIP_DESK:-0}" != "1" ]; then
      pnpm --filter @fengyun/nexus-cli exec tsx src/index.ts desk || true
    else
      PORT_SHOW="${PORT:-8787}"
      echo "已后台运行。控制台 http://127.0.0.1:${PORT_SHOW}/"
      echo "日志：./nexus.sh logs -f   启动台：./nexus.sh desk"
    fi
    exit 0
  fi
  echo "[Nexus] 无 PM2，回退前台启动"
fi

echo "[Nexus] 前台启动（电脑/桌面默认；关终端即停）"
exec pnpm boot
