#!/usr/bin/env bash
# Fengyun Nexus — 手机端 / Termux 唯一安装入口（自动检测，不问选择题）
#
# 用法（推荐始终在家目录执行，避免删仓时 cwd 失效）：
#   pkg install git -y
#   bash -c 'git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus 2>/dev/null; bash ~/Fengyun-Nexus/termux-install.sh'
#
# 或仓已在：
#   bash ~/Fengyun-Nexus/termux-install.sh
#
# 可选环境变量：
#   NEXUS_REINSTALL=1   强制删目录重装框架
#   NEXUS_SKIP_BOOT=1   只装不启动
# 不要 curl GitCode /raw/… | bash
set -euo pipefail

REPO_URL="${NEXUS_REPO_URL:-https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git}"
INSTALL_DIR="${NEXUS_INSTALL_DIR:-$HOME/Fengyun-Nexus}"
BRANCH="${NEXUS_BRANCH:-main}"

safe_cd_home() {
  cd "$HOME" 2>/dev/null || cd / 2>/dev/null || true
}

is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || echo "${PREFIX:-}" | grep -q com.termux
}

log() { echo ">>> $*"; }
ok() { echo "OK  $*"; }
warn() { echo "!!  $*"; }

ensure_git() {
  if command -v git >/dev/null 2>&1; then
    return 0
  fi
  if command -v pkg >/dev/null 2>&1; then
    pkg update -y || true
    pkg install -y git
  else
    echo "未找到 git，请先安装"
    exit 1
  fi
}

framework_ok() {
  [ -f "$INSTALL_DIR/boot.sh" ] &&
    [ -f "$INSTALL_DIR/package.json" ] &&
    { [ -f "$INSTALL_DIR/termux-install.sh" ] || [ -f "$INSTALL_DIR/scripts/termux-setup.sh" ]; }
}

cwd_broken() {
  ! pwd >/dev/null 2>&1
}

heal_cwd() {
  if cwd_broken; then
    warn "当前目录已失效，切回家目录"
    safe_cd_home
  fi
}

install_env() {
  log "检测 / 安装运行环境"
  if is_termux || [ "${NEXUS_FORCE_TERMUX:-}" = "1" ]; then
    if command -v pkg >/dev/null 2>&1; then
      pkg update -y || true
      pkg install -y nodejs git
    fi
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "未找到 node"
    exit 1
  fi
  npm config set allow-scripts=pnpm --location=user >/dev/null 2>&1 || true
  npm config delete manage-package-manager-versions --location=user >/dev/null 2>&1 || true
  npm config delete package-manager-strict --location=user >/dev/null 2>&1 || true
  if ! command -v pnpm >/dev/null 2>&1 || ! pnpm -v 2>/dev/null | grep -q '^9\.'; then
    npm install -g pnpm@9.15.0
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "未找到 pnpm"
    exit 1
  fi
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  if [ -f "$HOME/.npmrc" ]; then
    sed -i '/^manage-package-manager-versions=/d;/^package-manager-strict=/d' "$HOME/.npmrc" 2>/dev/null || true
  fi
  ok "环境  node=$(node -v)  pnpm=$(pnpm -v)"
}

sync_git_tree() {
  ensure_git
  git -C "$INSTALL_DIR" remote set-url origin "$REPO_URL" 2>/dev/null || \
    git -C "$INSTALL_DIR" remote add origin "$REPO_URL" 2>/dev/null || true
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH" || git -C "$INSTALL_DIR" fetch --depth 1 origin
  if git -C "$INSTALL_DIR" rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1; then
    git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH"
  else
    git -C "$INSTALL_DIR" reset --hard FETCH_HEAD
  fi
  git -C "$INSTALL_DIR" clean -fd || true
}

remove_install_dir() {
  heal_cwd
  safe_cd_home
  if [ -d "$INSTALL_DIR" ]; then
    log "移除旧目录 $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
  fi
  safe_cd_home
}

clone_fresh() {
  heal_cwd
  safe_cd_home
  mkdir -p "$(dirname "$INSTALL_DIR")"
  log "克隆 $REPO_URL"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" || \
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
}

finalize_tree() {
  cd "$INSTALL_DIR"
  chmod +x boot.sh restart.sh termux-install.sh scripts/termux-setup.sh 2>/dev/null || true
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  export NEXUS_ENV="${NEXUS_ENV:-termux}"
  export NEXUS_BOOT_MODE="${NEXUS_BOOT_MODE:-lite}"
  if [ ! -f .npmrc ]; then
    printf 'package-manager-strict=false\n' > .npmrc
  fi
  date -u +%Y-%m-%dT%H:%M:%SZ > "$INSTALL_DIR/.nexus-installed"
  ok "框架 $(git -C "$INSTALL_DIR" log -1 --oneline 2>/dev/null || echo ready)"
}

# 自动决定：无目录 / 残缺 / 强制重装 / 已装拉齐
ensure_framework() {
  heal_cwd
  safe_cd_home
  ensure_git
  mkdir -p "$(dirname "$INSTALL_DIR")"

  if [ "${NEXUS_REINSTALL:-0}" = "1" ]; then
    log "强制重装框架"
    remove_install_dir
    clone_fresh
    finalize_tree
    return 0
  fi

  if [ ! -d "$INSTALL_DIR" ]; then
    log "未检测到安装，首次克隆"
    clone_fresh
    finalize_tree
    return 0
  fi

  if ! framework_ok; then
    log "检测到残缺安装，自动修复"
    if [ -d "$INSTALL_DIR/.git" ]; then
      sync_git_tree || true
    fi
    if ! framework_ok; then
      warn "拉齐后仍残缺，改名备份后重装"
      safe_cd_home
      mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)" 2>/dev/null || remove_install_dir
      clone_fresh
    fi
    finalize_tree
    return 0
  fi

  log "已安装，拉齐最新 $BRANCH"
  if [ -d "$INSTALL_DIR/.git" ]; then
    sync_git_tree || warn "拉齐失败，继续用本地版本启动"
  fi
  finalize_tree
}

boot_now() {
  cd "$INSTALL_DIR"
  log "启动  控制台 http://127.0.0.1:8787/"
  exec ./boot.sh
}

# —— 主流程：全程自动 ——
heal_cwd
safe_cd_home

echo ""
echo "=== Fengyun Nexus · 手机端（自动检测）==="
echo "目录: $INSTALL_DIR"
echo ""

# 若脚本自身在残缺仓里跑，先尽量把 git 修好再继续
if [ -d "$INSTALL_DIR/.git" ] && ! framework_ok; then
  log "仓内文件不齐，优先修复"
fi

install_env
ensure_framework

if ! framework_ok; then
  echo "安装失败：仍缺少关键文件。可强制重装："
  echo "  cd ~ && NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/termux-install.sh"
  echo "或："
  echo "  cd ~ && rm -rf \"$INSTALL_DIR\" && git clone --depth 1 $REPO_URL \"$INSTALL_DIR\" && bash \"$INSTALL_DIR/termux-install.sh\""
  exit 1
fi

if [ "${NEXUS_SKIP_BOOT:-0}" = "1" ]; then
  ok "已跳过启动（NEXUS_SKIP_BOOT=1）"
  echo "启动：cd $INSTALL_DIR && ./boot.sh"
  exit 0
fi

boot_now
