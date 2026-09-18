#!/usr/bin/env bash
# Fengyun Nexus — 一键装环境 + 拉仓 + 启动（推荐远程管道执行，永远用最新）
#
# 国内（GitCode）：
#   curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
# 国外（GitHub）：
#   curl -fsSL "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.sh" | bash
#
# 按「部署机器所在地」选国内或国外源。也可：NEXUS_MIRROR=cn|global
# 网页 gitcode.com/.../raw/... 是 HTML；raw.gitcode.com 常 403；国内管道用 api.gitcode.com。
#
# 开关：
#   NEXUS_MIRROR=cn|global  国内 GitCode / 国外 GitHub（也可写 china|github|cn|intl）
#   NEXUS_REINSTALL=1       重装运行环境，并清空后重装框架目录
#   NEXUS_REINSTALL_ENV=1   只重装 Node/pnpm 等环境，不动项目目录
#   NEXUS_SKIP_BOOT=1       只装不启
#   NEXUS_ENV=desktop|server|termux
#   NEXUS_INSTALL_DIR=…     安装目录（默认 ~/Fengyun-Nexus）
#   NEXUS_BRANCH=main
#   NEXUS_REPO_URL=…        自定义仓地址时跳过镜像选择
#
set -euo pipefail

INSTALL_DIR="${NEXUS_INSTALL_DIR:-$HOME/Fengyun-Nexus}"
BRANCH="${NEXUS_BRANCH:-main}"
MIRROR=""
REPO_URL=""
RAW_BASE=""
GET_SH_URL=""
ZIP_URLS=()

log() { echo ">>> $*"; }
ok() { echo "OK  $*"; }
warn() { echo "!!  $*"; }

# Termux 的 /tmp 常不可写；优先 TMPDIR / PREFIX/tmp / HOME
nexus_tmpdir() {
  if [ -n "${TMPDIR:-}" ] && mkdir -p "$TMPDIR" 2>/dev/null && [ -w "$TMPDIR" ]; then
    echo "$TMPDIR"
    return 0
  fi
  if [ -n "${PREFIX:-}" ] && mkdir -p "$PREFIX/tmp" 2>/dev/null && [ -w "$PREFIX/tmp" ]; then
    echo "$PREFIX/tmp"
    return 0
  fi
  mkdir -p "$HOME/.nexus-tmp" 2>/dev/null || true
  echo "$HOME/.nexus-tmp"
}

normalize_mirror() {
  case "$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    cn|china|gitcode|国内|zh) echo "cn" ;;
    global|intl|international|github|gh|国外|en|us) echo "global" ;;
    *) echo "" ;;
  esac
}

apply_mirror() {
  MIRROR="$1"
  if [ "$MIRROR" = "global" ]; then
    REPO_URL="${NEXUS_REPO_URL:-https://github.com/fengyun0608/Fengyun-Nexus.git}"
    RAW_BASE="${NEXUS_RAW_BASE:-https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/${BRANCH}}"
    GET_SH_URL="${NEXUS_GET_SH_URL:-${RAW_BASE}/scripts/get.sh}"
    ZIP_URLS=(
      "https://github.com/fengyun0608/Fengyun-Nexus/archive/refs/heads/${BRANCH}.zip"
      "https://codeload.github.com/fengyun0608/Fengyun-Nexus/zip/refs/heads/${BRANCH}"
      "https://ghfast.top/https://github.com/fengyun0608/Fengyun-Nexus/archive/refs/heads/${BRANCH}.zip"
    )
  else
    MIRROR="cn"
    REPO_URL="${NEXUS_REPO_URL:-https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git}"
    RAW_BASE="${NEXUS_RAW_BASE:-https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw}"
    GET_SH_URL="${NEXUS_GET_SH_URL:-${RAW_BASE}/scripts/get.sh?ref=${BRANCH}}"
    ZIP_URLS=(
      "https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/repository/archive/${BRANCH}.zip"
      "https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/-/archive/${BRANCH}/Fengyun-Nexus-${BRANCH}.zip"
      # GitCode zip 偶发返回 HTML：再试 GitHub / 镜像
      "https://codeload.github.com/fengyun0608/Fengyun-Nexus/zip/refs/heads/${BRANCH}"
      "https://ghfast.top/https://github.com/fengyun0608/Fengyun-Nexus/archive/refs/heads/${BRANCH}.zip"
    )
  fi
}

choose_mirror() {
  local picked="" saved=""
  if [ -n "${NEXUS_REPO_URL:-}" ]; then
    case "$NEXUS_REPO_URL" in
      *github.com*) picked="global" ;;
      *) picked="cn" ;;
    esac
    apply_mirror "$picked"
    return 0
  fi
  picked="$(normalize_mirror "${NEXUS_MIRROR:-}")"
  if [ -z "$picked" ] && [ -f "$INSTALL_DIR/.nexus-mirror" ]; then
    saved="$(tr -d '[:space:]' < "$INSTALL_DIR/.nexus-mirror" 2>/dev/null || true)"
    picked="$(normalize_mirror "$saved")"
  fi
  if [ -z "$picked" ] && [ -r /dev/tty ]; then
    echo ""
    echo "请选择下载源（按「这台机器」所在地选，不是按你人在哪）："
    echo "  1) 国内 — GitCode（国内服务器 / 手机推荐）"
    echo "  2) 国外 — GitHub（海外机器推荐）"
    printf "请输入 1 或 2 [默认 1]： "
    local ans=""
    read -r ans < /dev/tty || ans=""
    case "$ans" in
      2|g|G|global|github|国外) picked="global" ;;
      *) picked="cn" ;;
    esac
  fi
  if [ -z "$picked" ]; then
    picked="cn"
    warn "非交互环境，默认国内源 GitCode。海外机器请加：NEXUS_MIRROR=global"
  fi
  apply_mirror "$picked"
}

persist_mirror() {
  mkdir -p "$INSTALL_DIR" 2>/dev/null || true
  if [ -d "$INSTALL_DIR" ]; then
    printf '%s\n' "$MIRROR" > "$INSTALL_DIR/.nexus-mirror"
  fi
}

persist_env() {
  [ -n "${NEXUS_ENV:-}" ] || return 0
  mkdir -p "$INSTALL_DIR/configs" 2>/dev/null || return 0
  printf '{\n  "env": "%s"\n}\n' "$NEXUS_ENV" > "$INSTALL_DIR/configs/runtime.local.json"
}

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
    # 必须用 env 带变量。root 下直接写 DEBIAN_FRONTEND=... 会被当成命令名
    run_root env DEBIAN_FRONTEND=noninteractive apt-get update -y || true
    run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
      -o Dpkg::Options::=--force-confdef \
      -o Dpkg::Options::=--force-confold \
      "$@"
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
  log "对齐 Termux 包（非交互，不抢 motd 配置）"
  export DEBIAN_FRONTEND=noninteractive
  # 避免 dpkg 卡在 motd 等配置文件提问（stdin EOF 会把 apt 弄坏）
  local dpkg_opts='-o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold'
  pkg update -y 2>/dev/null || apt-get update -y $dpkg_opts 2>/dev/null || true
  # 默认不 full-upgrade（易半截升级导致 apt 缺库）；需要时再 NEXUS_TERMUX_UPGRADE=1
  if [ "${NEXUS_TERMUX_UPGRADE:-0}" = "1" ]; then
    warn "NEXUS_TERMUX_UPGRADE=1 → 执行 pkg upgrade"
    pkg upgrade -y $dpkg_opts 2>/dev/null \
      || apt-get upgrade -y $dpkg_opts 2>/dev/null \
      || true
  fi
  pkg install -y $dpkg_opts openssl ca-certificates libcurl libssh2 liblz4 git curl unzip \
    || apt-get install -y $dpkg_opts openssl ca-certificates libcurl libssh2 liblz4 git curl unzip \
    || true
  if [ "${NEXUS_REINSTALL:-0}" = "1" ] || [ "${NEXUS_REINSTALL_ENV:-0}" = "1" ]; then
    pkg reinstall -y $dpkg_opts openssl libcurl libssh2 ca-certificates git liblz4 || true
  fi
  local libdir="${PREFIX:-/data/data/com.termux/files/usr}/lib"
  termux_fix_lz4_symlink "$libdir" || true
  if [ -d "$libdir/openssl-1.1" ]; then
    ln -sf openssl-1.1/libssl.so.1.1 "$libdir/libssl.so.1.1" 2>/dev/null || true
    ln -sf openssl-1.1/libcrypto.so.1.1 "$libdir/libcrypto.so.1.1" 2>/dev/null || true
  fi
}

# Termux apt 已坏（缺 liblz4.so.1 等）时：补软链 / 拉 deb / 配置卡住的包
termux_fix_lz4_symlink() {
  local libdir="${1:-${PREFIX:-/data/data/com.termux/files/usr}/lib}"
  [ -d "$libdir" ] || return 1
  if [ -e "$libdir/liblz4.so.1" ] || [ -L "$libdir/liblz4.so.1" ]; then
    return 0
  fi
  local src=""
  if [ -e "$libdir/liblz4.so" ]; then
    src="liblz4.so"
  else
    src="$(ls -1 "$libdir"/liblz4.so.* 2>/dev/null | head -n1 | xargs -n1 basename 2>/dev/null || true)"
  fi
  if [ -n "$src" ] && [ -e "$libdir/$src" ]; then
    log "补软链 liblz4.so.1 → $src"
    ln -sfn "$src" "$libdir/liblz4.so.1"
    return 0
  fi
  return 1
}

termux_repair_apt() {
  is_termux || return 1
  local prefix="${PREFIX:-/data/data/com.termux/files/usr}"
  export DEBIAN_FRONTEND=noninteractive
  # 先补软链：很多机器 liblz4 已装，只缺 .so.1 名字
  termux_fix_lz4_symlink "$prefix/lib" || true
  if command -v apt >/dev/null 2>&1 && apt --version >/dev/null 2>&1; then
    echo N | dpkg --configure -a -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold 2>/dev/null || true
    return 0
  fi
  warn "apt 无法启动，尝试修复 liblz4 / 卡住的配置…"
  echo N | dpkg --configure -a -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold 2>/dev/null || true
  termux_fix_lz4_symlink "$prefix/lib" || true
  if command -v apt >/dev/null 2>&1 && apt --version >/dev/null 2>&1; then
    log "apt 已靠软链恢复"
    return 0
  fi
  local arch
  arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
  case "$arch" in
    aarch64|arm64) arch=aarch64 ;;
    arm|armhf) arch=arm ;;
    x86_64|amd64) arch=x86_64 ;;
    i686|x86) arch=i686 ;;
  esac
  local tmp="${TMPDIR:-/data/data/com.termux/files/usr/tmp}/nexus-apt-fix"
  mkdir -p "$tmp" && cd "$tmp" || return 1
  local mirrors=(
    "https://packages-cf.termux.dev/apt/termux-main"
    "https://packages.termux.dev/apt/termux-main"
    "https://mirrors.tuna.tsinghua.edu.cn/termux/apt/termux-main"
    "https://mirrors.ustc.edu.cn/termux/apt/termux-main"
  )
  local ok=0
  for base in "${mirrors[@]}"; do
    if curl -fsSL "$base/dists/stable/main/binary-${arch}/Packages" -o Packages 2>/dev/null; then
      local path
      path="$(awk '
        $1=="Package:" && $2=="liblz4" {hit=1}
        hit && $1=="Filename:" {print $2; exit}
      ' Packages)"
      if [ -n "$path" ]; then
        log "下载 $base/$path"
        if curl -fsSL "$base/$path" -o liblz4.deb; then
          dpkg -i liblz4.deb 2>/dev/null || dpkg -i --force-depends liblz4.deb || true
          ok=1
          break
        fi
      fi
    fi
  done
  termux_fix_lz4_symlink "$prefix/lib" || true
  echo N | dpkg --configure -a -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold 2>/dev/null || true
  if command -v apt >/dev/null 2>&1 && apt --version >/dev/null 2>&1; then
    log "apt 已恢复"
    return 0
  fi
  if [ "$ok" != "1" ]; then
    warn "自动修复失败。请手动：ln -sfn liblz4.so \$PREFIX/lib/liblz4.so.1"
    warn "或重装 Termux 应用后重跑安装。"
    return 1
  fi
  warn "liblz4 已装但仍缺软链？请执行：ln -sfn liblz4.so \$PREFIX/lib/liblz4.so.1"
  return 1
}

ensure_base_pkgs() {
  if is_termux; then
    termux_repair_apt || true
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
    termux_repair_apt || true
    export DEBIAN_FRONTEND=noninteractive
    local dpkg_opts='-o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold'
    if [ "$force" = "1" ]; then
      pkg reinstall -y $dpkg_opts nodejs || pkg install -y $dpkg_opts nodejs
    else
      pkg install -y $dpkg_opts nodejs
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
  local zip_urls=("${ZIP_URLS[@]}")
  local tmp
  tmp="$(nexus_tmpdir)/nexus-dl-$$"
  mkdir -p "$tmp"
  local z="$tmp/nexus.zip"
  local ok_dl=0
  local u
  for u in "${zip_urls[@]}"; do
    log "尝试 zip：$u"
    rm -f "$z"
    if command -v curl >/dev/null 2>&1 && curl -fsSL --connect-timeout 25 -L -o "$z" "$u"; then
      :
    elif command -v wget >/dev/null 2>&1 && wget -q -O "$z" "$u"; then
      :
    else
      continue
    fi
    # 必须是真实 zip（PK…），GitCode 常下到登录 HTML
    if [ ! -s "$z" ]; then
      continue
    fi
    magic="$(head -c 2 "$z" 2>/dev/null || true)"
    if [ "$magic" != "PK" ]; then
      warn "不是 zip（多半是网页），跳过"
      continue
    fi
    command -v unzip >/dev/null 2>&1 || pkg_install unzip || (is_termux && pkg install -y unzip) || true
    rm -rf "$tmp/out"
    mkdir -p "$tmp/out"
    if unzip -q "$z" -d "$tmp/out"; then
      ok_dl=1
      break
    fi
    warn "unzip 失败，试下一个源"
  done
  if [ "$ok_dl" != "1" ]; then
    rm -rf "$tmp"
    return 1
  fi
  local src=""
  while IFS= read -r f; do
    src="$(dirname "$f")"
    break
  done < <(find "$tmp/out" -maxdepth 4 -type f \( -name package.json -o -name boot.sh \) 2>/dev/null)
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
  local err
  err="$(nexus_tmpdir)/nexus-git-err.$$"
  : > "$err" || err="$HOME/.nexus-git-err.$$"
  log "克隆 $REPO_URL"
  # 不要写 /tmp：Termux 上常 Permission denied，连重定向都会让 clone「假失败」
  if git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" 2>"$err" || \
     git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>>"$err"; then
    rm -f "$err"
    return 0
  fi
  warn "git clone 失败，尝试 zip 回退"
  cat "$err" 2>/dev/null || true
  rm -f "$err"
  remove_install_dir
  if clone_via_zip; then
    return 0
  fi
  echo "克隆失败。请检查网络后重试："
  echo "  curl -fsSL \"$GET_SH_URL\" | bash"
  echo "  或：NEXUS_MIRROR=global curl -fsSL \"https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.sh\" | bash"
  exit 1
}

finalize_tree() {
  cd "$INSTALL_DIR"
  chmod +x boot.sh restart.sh scripts/get.sh server-install.sh termux-install.sh scripts/termux-setup.sh scripts/termux-repair-apt.sh 2>/dev/null || true
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  export NEXUS_ENV
  if [ "$NEXUS_ENV" = "termux" ]; then
    export NEXUS_BOOT_MODE="${NEXUS_BOOT_MODE:-lite}"
  fi
  if [ ! -f .npmrc ]; then
    printf 'package-manager-strict=false\n' > .npmrc
  fi
  date -u +%Y-%m-%dT%H:%M:%SZ > "$INSTALL_DIR/.nexus-installed"
  persist_mirror
  persist_env
  ok "框架已就绪  env=$NEXUS_ENV  mirror=$MIRROR  $(git -C "$INSTALL_DIR" log -1 --oneline 2>/dev/null || echo ready)"
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
  log "启动  姿态=$NEXUS_ENV"
  if [ "$NEXUS_ENV" = "server" ] || [ "$NEXUS_ENV" = "termux" ] || [ "$NEXUS_ENV" = "mobile" ]; then
    log "控制台监听 0.0.0.0:8787。本机用 http://127.0.0.1:8787/ ，外网用本机公网 IP:8787"
    log "云服务器请在安全组放行 TCP 8787，只开别的端口连不上"
  else
    log "控制台 http://127.0.0.1:8787/"
  fi
  exec ./boot.sh
}

# —— 主流程 ——
safe_cd_home
choose_mirror
NEXUS_ENV="$(detect_env)"
export NEXUS_ENV

echo ""
echo "=== Fengyun Nexus · 一键安装 ==="
echo "目录: $INSTALL_DIR"
echo "姿态: $NEXUS_ENV"
echo "分支: $BRANCH"
if [ "$MIRROR" = "global" ]; then
  echo "镜像: 国外 · GitHub"
else
  echo "镜像: 国内 · GitCode"
fi
echo "仓库: $REPO_URL"
echo ""

install_env
ensure_framework

if ! framework_ok; then
  echo "安装失败。可强制重装："
  if [ "$MIRROR" = "global" ]; then
    echo "  NEXUS_REINSTALL=1 NEXUS_MIRROR=global curl -fsSL \"$GET_SH_URL\" | bash"
  else
    echo "  NEXUS_REINSTALL=1 curl -fsSL \"$GET_SH_URL\" | bash"
  fi
  exit 1
fi

if [ "${NEXUS_SKIP_BOOT:-0}" = "1" ]; then
  ok "已跳过启动（NEXUS_SKIP_BOOT=1）"
  echo "启动：cd $INSTALL_DIR && NEXUS_ENV=$NEXUS_ENV ./boot.sh"
  exit 0
fi

boot_now
