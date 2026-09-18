#!/usr/bin/env bash
# Fengyun Nexus — 一键装环境 + 拉仓 + 启动（推荐远程管道执行，永远用最新）
#
#   curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
#
# 地址规律（同手机端）：raw 后面跟仓内路径 → 本文件即 scripts/get.sh
# 网页 gitcode.com/.../raw/... 是 HTML；raw.gitcode.com/.../raw/main/... 常 403；管道用上面 api。
#
# 开关：
#   NEXUS_REINSTALL=1     重装运行环境，并清空后重装框架目录
#   NEXUS_REINSTALL_ENV=1 只重装 Node/pnpm 等环境，不动项目目录
#   NEXUS_SKIP_BOOT=1     只装不启
#   NEXUS_ENV=desktop|server|termux
#   NEXUS_INSTALL_DIR=…   安装目录（默认 ~/Fengyun-Nexus）
#   NEXUS_BRANCH=main
#   NEXUS_REPO_URL=…
#
set -euo pipefail

REPO_URL="${NEXUS_REPO_URL:-https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git}"
INSTALL_DIR="${NEXUS_INSTALL_DIR:-$HOME/Fengyun-Nexus}"
BRANCH="${NEXUS_BRANCH:-main}"
RAW_BASE="${NEXUS_RAW_BASE:-https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw}"
GET_SH_URL="${NEXUS_GET_SH_URL:-${RAW_BASE}/scripts/get.sh?ref=${BRANCH}}"

log() { echo ">>> $*"; }
ok() { echo "OK  $*"; }
warn() { echo "!!  $*"; }

safe_cd_home() {
  cd "$HOME" 2>/dev/null || cd / 2>/dev/null || true
}

is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || echo "${PREFIX:-}" | grep -q com.termux
}

detect_env() {
  if [ -n "${NEXUS_ENV:-}" ]; then
    echo "$NEXUS_ENV"
    return
  fi
  if is_termux; then
    echo "termux"
    return
  fi
  # 无显示器 / SSH 常见姿态当 server
  if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ] && [ "$(uname -s)" = "Linux" ]; then
    echo "server"
    return
  fi
  echo "desktop"
}

have_sudo() {
  [ "$(id -u)" -eq 0 ] || command -v sudo >/dev/null 2>&1
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
  if command -v brew >/dev/null 2>&1; then
    brew install "$@"
    return $?
  fi
  return 1
}

pkg_fix_termux_base() {
  command -v pkg >/dev/null 2>&1 || return 1
  log "对齐 Termux 包"
  yes | apt update 2>/dev/null || pkg update -y || true
  yes | apt full-upgrade -y 2>/dev/null || pkg upgrade -y || true
  pkg install -y openssl ca-certificates libcurl libssh2 git curl unzip || true
  if [ "${NEXUS_REINSTALL:-0}" = "1" ] || [ "${NEXUS_REINSTALL_ENV:-0}" = "1" ]; then
    pkg reinstall -y openssl libcurl libssh2 ca-certificates git || true
  fi
  local libdir="${PREFIX:-/data/data/com.termux/files/usr}/lib"
  if [ -d "$libdir/openssl-1.1" ]; then
    ln -sf openssl-1.1/libssl.so.1.1 "$libdir/libssl.so.1.1" 2>/dev/null || true
    ln -sf openssl-1.1/libcrypto.so.1.1 "$libdir/libcrypto.so.1.1" 2>/dev/null || true
  fi
}

ensure_base_pkgs() {
  if is_termux; then
    pkg_fix_termux_base || true
    return 0
  fi
  log "检查 git / curl"
  local need=()
  command -v git >/dev/null 2>&1 || need+=(git)
  command -v curl >/dev/null 2>&1 || need+=(curl)
  if [ "${#need[@]}" -gt 0 ]; then
    if ! have_sudo && [ "$(id -u)" -ne 0 ]; then
      warn "缺 ${need[*]}，且无 root/sudo，请先自行安装"
    else
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
  local force=0
  [ "${NEXUS_REINSTALL:-0}" = "1" ] && force=1
  [ "${NEXUS_REINSTALL_ENV:-0}" = "1" ] && force=1

  if [ "$force" != "1" ] && command -v node >/dev/null 2>&1; then
    local maj
    maj="$(node_major)"
    if [ "$maj" -ge 20 ] 2>/dev/null; then
      return 0
    fi
    warn "当前 Node $(node -v)，需要 ≥ 20"
  fi

  log "安装 / 升级 Node.js 20+"
  if is_termux && command -v pkg >/dev/null 2>&1; then
    if [ "$force" = "1" ]; then
      pkg reinstall -y nodejs || pkg install -y nodejs
    else
      pkg install -y nodejs
    fi
  elif command -v apt-get >/dev/null 2>&1 && have_sudo; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | run_root bash - || true
    pkg_install nodejs || true
  elif command -v brew >/dev/null 2>&1; then
    brew install node@20 || brew install node || true
  else
    pkg_install nodejs npm || true
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "未找到 Node.js 20+。请先安装后再跑本脚本。"
    exit 1
  fi
  if [ "$(node_major)" -lt 20 ] 2>/dev/null; then
    warn "Node $(node -v) 仍低于 20，启动可能失败"
  fi
}

ensure_pnpm() {
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  npm config set allow-scripts=pnpm --location=user >/dev/null 2>&1 || true
  npm config delete manage-package-manager-versions --location=user >/dev/null 2>&1 || true
  local force=0
  [ "${NEXUS_REINSTALL:-0}" = "1" ] && force=1
  [ "${NEXUS_REINSTALL_ENV:-0}" = "1" ] && force=1
  if [ "$force" = "1" ] || ! command -v pnpm >/dev/null 2>&1 || ! pnpm -v 2>/dev/null | grep -qE '^[89]\.'; then
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
  ensure_base_pkgs
  ensure_node
  ensure_pnpm
  ok "环境  node=$(node -v)  pnpm=$(pnpm -v)  姿态=$NEXUS_ENV"
}

framework_ok() {
  [ -f "$INSTALL_DIR/boot.sh" ] && [ -f "$INSTALL_DIR/package.json" ]
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
  command -v unzip >/dev/null 2>&1 || pkg_install unzip || (is_termux && pkg install -y unzip) || true
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
  echo "  curl -fsSL \"$GET_SH_URL\" | bash"
  exit 1
}

finalize_tree() {
  cd "$INSTALL_DIR"
  chmod +x boot.sh restart.sh scripts/get.sh server-install.sh termux-install.sh scripts/termux-setup.sh 2>/dev/null || true
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  export NEXUS_ENV
  if [ "$NEXUS_ENV" = "termux" ]; then
    export NEXUS_BOOT_MODE="${NEXUS_BOOT_MODE:-lite}"
  fi
  if [ ! -f .npmrc ]; then
    printf 'package-manager-strict=false\n' > .npmrc
  fi
  date -u +%Y-%m-%dT%H:%M:%SZ > "$INSTALL_DIR/.nexus-installed"
  ok "框架已就绪  env=$NEXUS_ENV  $(git -C "$INSTALL_DIR" log -1 --oneline 2>/dev/null || echo ready)"
}

ensure_framework() {
  safe_cd_home
  mkdir -p "$(dirname "$INSTALL_DIR")"

  if [ "${NEXUS_REINSTALL:-0}" = "1" ]; then
    log "强制重装框架目录"
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
  else
    warn "非 git 目录，跳过拉齐（可用 NEXUS_REINSTALL=1 重装）"
  fi
  finalize_tree
}

boot_now() {
  cd "$INSTALL_DIR"
  export NEXUS_ENV
  log "启动  控制台 http://127.0.0.1:8787/"
  exec ./boot.sh
}

# —— 主流程 ——
safe_cd_home
NEXUS_ENV="$(detect_env)"
export NEXUS_ENV

echo ""
echo "=== Fengyun Nexus · 一键安装 ==="
echo "目录: $INSTALL_DIR"
echo "姿态: $NEXUS_ENV"
echo "分支: $BRANCH"
echo ""

install_env
ensure_framework

if ! framework_ok; then
  echo "安装失败。可强制重装："
  echo "  NEXUS_REINSTALL=1 curl -fsSL \"$GET_SH_URL\" | bash"
  exit 1
fi

if [ "${NEXUS_SKIP_BOOT:-0}" = "1" ]; then
  ok "已跳过启动（NEXUS_SKIP_BOOT=1）"
  echo "启动：cd $INSTALL_DIR && NEXUS_ENV=$NEXUS_ENV ./boot.sh"
  exit 0
fi

boot_now
