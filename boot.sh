#!/usr/bin/env bash
# Fengyun Nexus — Linux / macOS / Termux boot
# 默认 PM2 后台；前台调试：NEXUS_FOREGROUND=1 ./boot.sh
set -e
cd "$(dirname "$0")"

echo "[Fengyun Nexus] 启动中…"

is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || echo "${PREFIX:-}" | grep -q com.termux
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

# 前台调试
if [ "${NEXUS_FOREGROUND:-0}" = "1" ]; then
  echo "[Nexus] 前台模式（NEXUS_FOREGROUND=1）"
  exec pnpm boot
fi

# 默认：PM2 后台
if ! command -v pm2 >/dev/null 2>&1; then
  echo "[Nexus] 安装 PM2…"
  node scripts/ensure-runtime.mjs --pm2-only || npm install -g pm2 || true
fi

if command -v pm2 >/dev/null 2>&1; then
  echo "[Nexus] PM2 后台启动"
  pnpm --filter @fengyun/nexus-cli exec tsx src/index.ts start
  # 交互终端且未跳过启动台 → 进 desk
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
exec pnpm boot
