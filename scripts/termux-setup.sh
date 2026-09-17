#!/usr/bin/env bash
# Fengyun Nexus — Termux / 手机端 唯一安装脚本
#
# 首次：不提问，直接装环境 + 克隆 + 启动
# 已装：只问「重装环境」还是「重装框架」
#
#   pkg install git -y
#   git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
#   cd ~/Fengyun-Nexus && bash scripts/termux-setup.sh
#
# 不要 curl GitCode /raw/… | bash
set -euo pipefail

REPO_URL="${NEXUS_REPO_URL:-https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git}"
INSTALL_DIR="${NEXUS_INSTALL_DIR:-$HOME/Fengyun-Nexus}"

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
  npm install -g pnpm@9.15.0
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "未找到 pnpm"
    exit 1
  fi
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  if [ -f "$HOME/.npmrc" ]; then
    if ! grep -q 'manage-package-manager-versions=false' "$HOME/.npmrc" 2>/dev/null; then
      printf '\nmanage-package-manager-versions=false\npackage-manager-strict=false\n' >> "$HOME/.npmrc"
    fi
  else
    printf 'manage-package-manager-versions=false\npackage-manager-strict=false\n' > "$HOME/.npmrc"
  fi
  echo "环境就绪  node=$(node -v)  pnpm=$(pnpm -v)"
}

# 克隆或强制重装框架（无提问）
install_framework() {
  local force="${1:-0}"
  echo ">>> 安装框架 → $INSTALL_DIR"
  ensure_git
  PARENT="$(dirname "$INSTALL_DIR")"
  mkdir -p "$PARENT"

  if [ "$force" = "1" ] && [ -d "$INSTALL_DIR" ]; then
    echo "移除旧框架目录…"
    rm -rf "$INSTALL_DIR"
  fi

  if [ -d "$INSTALL_DIR/.git" ]; then
    git -C "$INSTALL_DIR" fetch --all --prune || true
    git -C "$INSTALL_DIR" pull --ff-only || git -C "$INSTALL_DIR" pull || true
  else
    if [ -d "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR/.git" ]; then
      echo "目录存在但不是 git 仓库，已改名为备份"
      mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)"
    fi
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"
  chmod +x boot.sh restart.sh scripts/termux-setup.sh 2>/dev/null || true
  export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
  export NEXUS_ENV="${NEXUS_ENV:-termux}"
  export NEXUS_BOOT_MODE="${NEXUS_BOOT_MODE:-lite}"
  if [ ! -f .npmrc ]; then
    printf 'manage-package-manager-versions=false\npackage-manager-strict=false\n' > .npmrc
  fi
  # 标记已安装
  date -u +%Y-%m-%dT%H:%M:%SZ > "$INSTALL_DIR/.nexus-installed"
  echo "框架就绪  $INSTALL_DIR"
}

boot_now() {
  cd "$INSTALL_DIR"
  echo ">>> 启动"
  echo "控制台 http://127.0.0.1:8787/"
  exec ./boot.sh
}

already_installed() {
  [ -d "$INSTALL_DIR/.git" ] || [ -f "$INSTALL_DIR/.nexus-installed" ]
}

echo ""
echo "=== Fengyun Nexus · 手机端安装 ==="
echo "目录: $INSTALL_DIR"
echo ""

if already_installed; then
  echo "检测到已安装。"
  echo "1) 重装环境"
  echo "2) 重装框架"
  echo "其它键退出"
  printf "请选择 [1/2]: "
  read -r CHOICE || true
  case "$CHOICE" in
    1)
      install_env
      echo "环境已重装。启动请执行：cd $INSTALL_DIR && ./boot.sh"
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
else
  # 首次：全程不问
  install_env
  install_framework 0
  boot_now
fi
