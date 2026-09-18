#!/usr/bin/env bash
# Fengyun Nexus — Linux 服务器一键装+启（自动检测，不问选择题）
#
#   git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
#   bash ~/Fengyun-Nexus/server-install.sh
#
# 仓已在：bash ~/Fengyun-Nexus/server-install.sh
# 强制重装：NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/server-install.sh
# 只装不启：NEXUS_SKIP_BOOT=1 bash ~/Fengyun-Nexus/server-install.sh
set -euo pipefail

REPO_URL="${NEXUS_REPO_URL:-https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git}"
INSTALL_DIR="${NEXUS_INSTALL_DIR:-$HOME/Fengyun-Nexus}"
BRANCH="${NEXUS_BRANCH:-main}"

log() { echo ">>> $*"; }
ok() { echo "OK  $*"; }
warn() { echo "!!  $*"; }

safe_cd_home() {
  cd "$HOME" 2>/dev/null || cd / 2>/dev/null || true
}

is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || echo "${PREFIX:-}" | grep -q com.termux
}

have_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    return 0
  fi
  command -v sudo >/dev/null 2>&1
}

run_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

pkg_install() {
  # $@ = package names
  if command -v apt-get >/dev/null 2>&1; then
    run_root apt-get update -y || true
    run_root DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
    return $?
  fi
  if command -v dnf >/dev/null 2>&1; then
    run_root dnf install -y "$@"
    return $?
  fi
  if command -v yum >/dev/null 2>&1; then
    run_root yum install -y "$@"
    return $?
  fi
  if command -v pacman >/dev/null 2>&1; then
    run_root pacman -Sy --noconfirm "$@"
    return $?
  fi
  if command -v apk >/dev/null 2>&1; then
    run_root apk add --no-cache "$@"
    return $?
  fi
  return 1
}

ensure_base_pkgs() {
  log "检查 git / curl / ca-certificates"
  local need=()
  command -v git >/dev/null 2>&1 || need+=(git)
  command -v curl >/dev/null 2>&1 || need+=(curl)
  if [ "${#need[@]}" -gt 0 ]; then
    if ! have_sudo && [ "$(id -u)" -ne 0 ]; then
      warn "缺 ${need[*]}，且无 root/sudo，请先自行安装"
    else
      # 包名在各发行版基本通用
      pkg_install ca-certificates curl git || pkg_install git curl || true
    fi
  fi
  if ! command -v git >/dev/null 2>&1; then
    echo "未找到 git"
    exit 1
  fi
}

node_major() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local maj
    maj="$(node_major)"
    if [ "$maj" -ge 20 ] 2>/dev/null; then
      return 0
    fi
    warn "当前 Node $(node -v)，建议 ≥ 20"
  fi

  log "安装 / 升级 Node.js 20+"
  if command -v apt-get >/dev/null 2>&1 && have_sudo; then
    # NodeSource 20.x（Debian/Ubuntu）
    if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 20 ] 2>/dev/null; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | run_root bash - || true
      pkg_install nodejs || true
    fi
  elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
    pkg_install nodejs npm || true
  elif command -v pacman >/dev/null 2>&1; then
    pkg_install nodejs npm || true
  elif command -v apk >/dev/null 2>&1; then
    pkg_install nodejs npm || true
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "未找到 Node.js 20+。请先安装后再跑本脚本。"
    exit 1
  fi
}

ensure_pnpm() {
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  npm config set allow-scripts=pnpm --location=user >/dev/null 2>&1 || true
  npm config delete manage-package-manager-versions --location=user >/dev/null 2>&1 || true
  if ! command -v pnpm >/dev/null 2>&1 || ! pnpm -v 2>/dev/null | grep -qE '^[89]\.'; then
    log "安装 pnpm@9"
    npm install -g pnpm@9.15.0
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "未找到 pnpm"
    exit 1
  fi
  if [ -f "$HOME/.npmrc" ]; then
    sed -i '/^manage-package-manager-versions=/d;/^package-manager-strict=/d' "$HOME/.npmrc" 2>/dev/null || true
  fi
}

install_env() {
  if is_termux; then
    echo "检测到 Termux，请改用：bash ~/Fengyun-Nexus/termux-install.sh"
    exit 1
  fi
  ensure_base_pkgs
  ensure_node
  ensure_pnpm
  ok "环境  node=$(node -v)  pnpm=$(pnpm -v)"
}

framework_ok() {
  [ -f "$INSTALL_DIR/boot.sh" ] &&
    [ -f "$INSTALL_DIR/package.json" ] &&
    { [ -f "$INSTALL_DIR/server-install.sh" ] || [ -f "$INSTALL_DIR/termux-install.sh" ]; }
}

sync_git_tree() {
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
  safe_cd_home
  if [ -d "$INSTALL_DIR" ]; then
    log "移除旧目录 $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
  fi
}

clone_via_zip() {
  local zip_urls=(
    "https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/repository/archive/${BRANCH}.zip"
    "https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/-/archive/${BRANCH}/Fengyun-Nexus-${BRANCH}.zip"
  )
  local tmp="$HOME/.nexus-dl-$$"
  mkdir -p "$tmp"
  local z="$tmp/nexus.zip"
  local ok_dl=0
  local u
  for u in "${zip_urls[@]}"; do
    log "尝试 zip 下载"
    if command -v curl >/dev/null 2>&1 && curl -fsSL --connect-timeout 20 -o "$z" "$u"; then
      ok_dl=1
      break
    fi
    if command -v wget >/dev/null 2>&1 && wget -q -O "$z" "$u"; then
      ok_dl=1
      break
    fi
  done
  if [ "$ok_dl" != "1" ] || [ ! -s "$z" ]; then
    rm -rf "$tmp"
    return 1
  fi
  command -v unzip >/dev/null 2>&1 || pkg_install unzip || true
  unzip -q "$z" -d "$tmp/out" || {
    rm -rf "$tmp"
    return 1
  }
  local src=""
  while IFS= read -r f; do
    src="$(dirname "$f")"
    break
  done < <(find "$tmp/out" -maxdepth 3 -type f \( -name package.json -o -name boot.sh \) 2>/dev/null)
  if [ -z "$src" ] || [ ! -f "$src/boot.sh" ]; then
    rm -rf "$tmp"
    return 1
  fi
  rm -rf "$INSTALL_DIR"
  mv "$src" "$INSTALL_DIR"
  rm -rf "$tmp"
  ok "已用 zip 安装到 $INSTALL_DIR"
  return 0
}

clone_fresh() {
  safe_cd_home
  mkdir -p "$(dirname "$INSTALL_DIR")"
  log "克隆 $REPO_URL"
  if git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" 2>/tmp/nexus-git-err.$$ || \
     git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>>/tmp/nexus-git-err.$$; then
    rm -f /tmp/nexus-git-err.$$
    return 0
  fi
  warn "git clone 失败，尝试 zip 回退"
  cat /tmp/nexus-git-err.$$ 2>/dev/null || true
  rm -f /tmp/nexus-git-err.$$
  remove_install_dir
  if clone_via_zip; then
    return 0
  fi
  echo "克隆失败。请检查网络后重试："
  echo "  git clone --depth 1 $REPO_URL \"$INSTALL_DIR\""
  echo "  bash \"$INSTALL_DIR/server-install.sh\""
  exit 1
}

finalize_tree() {
  cd "$INSTALL_DIR"
  chmod +x boot.sh restart.sh server-install.sh termux-install.sh 2>/dev/null || true
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  export NEXUS_ENV="${NEXUS_ENV:-server}"
  if [ ! -f .npmrc ]; then
    printf 'package-manager-strict=false\n' > .npmrc
  fi
  date -u +%Y-%m-%dT%H:%M:%SZ > "$INSTALL_DIR/.nexus-installed"
  ok "框架 $(git -C "$INSTALL_DIR" log -1 --oneline 2>/dev/null || echo ready)  env=$NEXUS_ENV"
}

ensure_framework() {
  safe_cd_home
  mkdir -p "$(dirname "$INSTALL_DIR")"

  if [ "${NEXUS_REINSTALL:-0}" = "1" ]; then
    log "强制重装"
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
      warn "拉齐后仍残缺，备份后重装"
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
  export NEXUS_ENV="${NEXUS_ENV:-server}"
  log "启动  控制台 http://127.0.0.1:8787/"
  exec ./boot.sh
}

# —— 主流程 ——
safe_cd_home

echo ""
echo "=== Fengyun Nexus · 服务器（自动检测）==="
echo "目录: $INSTALL_DIR"
echo ""

install_env
ensure_framework

if ! framework_ok; then
  echo "安装失败。可强制重装："
  echo "  NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/server-install.sh"
  exit 1
fi

if [ "${NEXUS_SKIP_BOOT:-0}" = "1" ]; then
  ok "已跳过启动（NEXUS_SKIP_BOOT=1）"
  echo "启动：cd $INSTALL_DIR && NEXUS_ENV=server ./boot.sh"
  exit 0
fi

boot_now
