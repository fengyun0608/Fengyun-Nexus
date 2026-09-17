#!/usr/bin/env bash
# Fengyun Nexus — Termux / 手机端 唯一安装脚本
#
# 首次 / 残缺目录：不问，自动修环境 + 拉齐框架 + 启动
# 完整已装：只问 1 重装环境 / 2 重装框架
#
# 推荐：
#   pkg install git -y
#   git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
#   cd ~/Fengyun-Nexus && bash scripts/termux-setup.sh
#
# 目录已在但缺脚本（旧残缺仓）先拉齐再跑：
#   cd ~
#   git -C ~/Fengyun-Nexus fetch --depth 1 origin main
#   git -C ~/Fengyun-Nexus reset --hard origin/main
#   bash ~/Fengyun-Nexus/scripts/termux-setup.sh
#
# 不要 curl GitCode /raw/… | bash
set -euo pipefail

# 兼容旧命令里的 NEXUS_INSTALL_YES=1，不再多问
: "${NEXUS_INSTALL_YES:=0}"

REPO_URL="${NEXUS_REPO_URL:-https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git}"
INSTALL_DIR="${NEXUS_INSTALL_DIR:-$HOME/Fengyun-Nexus}"
BRANCH="${NEXUS_BRANCH:-main}"

# 删掉安装目录前必须离开该目录，否则 cwd 失效，git clone 会报
# fatal: Unable to read current working directory: No such file or directory
safe_cd_home() {
  cd "$HOME" 2>/dev/null || cd / 2>/dev/null || true
}

is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || echo "${PREFIX:-}" | grep -q com.termux
}

ensure_git() {
  if command -v git >/dev/null 2>&1; then
    return 0
  fi
  if command -v pkg >/dev/null 2>&1; then
    pkg update -y || true
    pkg install -y git
  else
    echo "未找到 git"
    exit 1
  fi
}

framework_ok() {
  [ -f "$INSTALL_DIR/boot.sh" ] &&
    [ -f "$INSTALL_DIR/package.json" ] &&
    [ -f "$INSTALL_DIR/scripts/termux-setup.sh" ]
}

# 装 / 重装运行环境（无提问）
install_env() {
  echo ">>> 安装运行环境"
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
  # 去掉会刷警告的旧 npm 配置
  npm config delete manage-package-manager-versions --location=user >/dev/null 2>&1 || true
  npm config delete package-manager-strict --location=user >/dev/null 2>&1 || true
  npm install -g pnpm@9.15.0
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "未找到 pnpm"
    exit 1
  fi
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  if [ -f "$HOME/.npmrc" ]; then
    # 清理已废弃键，避免 npm warn
    sed -i '/^manage-package-manager-versions=/d;/^package-manager-strict=/d' "$HOME/.npmrc" 2>/dev/null || true
  fi
  echo "环境就绪  node=$(node -v)  pnpm=$(pnpm -v)"
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
  git -C "$INSTALL_DIR" clean -fd
}

remove_install_dir() {
  safe_cd_home
  if [ -d "$INSTALL_DIR" ]; then
    echo "移除旧框架目录…"
    rm -rf "$INSTALL_DIR"
  fi
  # 确认 cwd 仍可用
  safe_cd_home
  pwd >/dev/null
}

clone_fresh() {
  safe_cd_home
  mkdir -p "$(dirname "$INSTALL_DIR")"
  echo "克隆 $REPO_URL → $INSTALL_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" || \
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
}

# 克隆 / 拉齐 / 强制重装框架（无提问）
# force=1：删目录重装；force=0：尽量拉齐，残缺再重装
install_framework() {
  local force="${1:-0}"
  echo ">>> 安装框架 → $INSTALL_DIR"
  ensure_git
  mkdir -p "$(dirname "$INSTALL_DIR")"
  safe_cd_home

  if [ "$force" = "1" ]; then
    remove_install_dir
    clone_fresh
  elif [ -d "$INSTALL_DIR/.git" ]; then
    echo "拉齐远程 $BRANCH…"
    sync_git_tree
  else
    if [ -d "$INSTALL_DIR" ]; then
      echo "目录存在但不是完整 git 仓，已改名备份"
      safe_cd_home
      mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)"
    fi
    clone_fresh
  fi

  if ! framework_ok; then
    echo "框架文件仍不完整，强制重装…"
    remove_install_dir
    clone_fresh
  fi

  if ! framework_ok; then
    echo "克隆后仍缺少 boot.sh，请检查网络后重试："
    echo "  cd ~ && rm -rf \"$INSTALL_DIR\" && git clone --depth 1 $REPO_URL \"$INSTALL_DIR\""
    exit 1
  fi

  cd "$INSTALL_DIR"
  chmod +x boot.sh restart.sh scripts/termux-setup.sh termux-install.sh 2>/dev/null || true
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  export NEXUS_ENV="${NEXUS_ENV:-termux}"
  export NEXUS_BOOT_MODE="${NEXUS_BOOT_MODE:-lite}"
  if [ ! -f .npmrc ]; then
    printf 'package-manager-strict=false\n' > .npmrc
  fi
  date -u +%Y-%m-%dT%H:%M:%SZ > "$INSTALL_DIR/.nexus-installed"
  echo "框架就绪  $INSTALL_DIR"
  git -C "$INSTALL_DIR" log -1 --oneline 2>/dev/null || true
}

boot_now() {
  cd "$INSTALL_DIR"
  echo ">>> 启动"
  echo "控制台 http://127.0.0.1:8787/"
  exec ./boot.sh
}

echo ""
echo "=== Fengyun Nexus · 手机端安装 ==="
echo "目录: $INSTALL_DIR"
echo ""

# 残缺仓：有目录但缺关键文件 → 不问，直接修
if [ -d "$INSTALL_DIR" ] && ! framework_ok; then
  echo "检测到残缺安装，自动修复…"
  install_env
  install_framework 0
  boot_now
fi

# 完整已装：只问一次
if framework_ok && { [ -d "$INSTALL_DIR/.git" ] || [ -f "$INSTALL_DIR/.nexus-installed" ]; }; then
  echo "检测到已安装。"
  echo "1) 重装环境"
  echo "2) 重装框架"
  echo "其它键退出"
  printf "请选择 [1/2]: "
  read -r CHOICE || true
  case "$CHOICE" in
    1)
      install_env
      echo "环境已重装。启动：cd $INSTALL_DIR && ./boot.sh"
      ;;
    2)
      install_env
      install_framework 1
      boot_now
      ;;
    *)
      echo "已取消"
      exit 0
      ;;
  esac
  exit 0
fi

# 首次：全程不问
install_env
install_framework 0
boot_now
