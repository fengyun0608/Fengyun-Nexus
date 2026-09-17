#!/usr/bin/env bash
# Fengyun Nexus — Termux 一键：环境 + 克隆 + 启动
# 远程执行（推荐）：
#   curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/termux-setup.sh | bash
# 全自动（少提问）：
#   curl -fsSL .../termux-setup.sh | NEXUS_INSTALL_YES=1 bash
# 只装环境：
#   curl -fsSL .../termux-env.sh | bash
set -euo pipefail

YES="${NEXUS_INSTALL_YES:-0}"
for a in "$@"; do
  case "$a" in
    -y|--yes) YES=1 ;;
  esac
done

ask() {
  local tip="$1"
  local def="${2:-Y}"
  if [ "$YES" = "1" ]; then
    echo "$tip -> $def (auto)"
    REPLY="$def"
    return 0
  fi
  local prompt
  if [ "$def" = "Y" ] || [ "$def" = "y" ]; then
    prompt="$tip [Y/n] "
  else
    prompt="$tip [y/N] "
  fi
  read -r -p "$prompt" REPLY || true
  REPLY="${REPLY:-$def}"
}

REPO_URL="${NEXUS_REPO_URL:-https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git}"
RAW_BASE="${NEXUS_RAW_BASE:-https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main}"
INSTALL_DIR="${NEXUS_INSTALL_DIR:-$HOME/Fengyun-Nexus}"

echo ""
echo "=== Fengyun Nexus · Termux 安装向导 ==="
echo "仓库: $REPO_URL"
echo "目录: $INSTALL_DIR"
echo ""

# 1) 环境（可跳过）
ask "是否先安装/检查运行环境（Node / Git / pnpm）？" "Y"
case "$REPLY" in
  Y|y|yes|YES)
    if [ -f "$(dirname "$0")/termux-env.sh" ] 2>/dev/null; then
      # 本地仓库内执行
      NEXUS_INSTALL_YES="$YES" bash "$(dirname "$0")/termux-env.sh" ${YES:+--yes}
    else
      # 远程管道：内联拉 env 脚本
      curl -fsSL "$RAW_BASE/scripts/termux-env.sh" | NEXUS_INSTALL_YES="$YES" bash -s -- ${YES:+--yes}
    fi
    ;;
  *)
    echo "跳过环境安装（请确保已有 node / git / pnpm）"
    ;;
esac

export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
export NEXUS_ENV="${NEXUS_ENV:-termux}"
export NEXUS_BOOT_MODE="${NEXUS_BOOT_MODE:-lite}"

# 2) 克隆 / 更新
if [ -d "$INSTALL_DIR/.git" ]; then
  ask "目录已存在，是否 git pull 更新？" "Y"
  case "$REPLY" in
    Y|y|yes|YES)
      git -C "$INSTALL_DIR" pull --ff-only || git -C "$INSTALL_DIR" pull
      ;;
    *)
      echo "使用现有目录，不更新"
      ;;
  esac
else
  ask "是否克隆仓库到 $INSTALL_DIR ？" "Y"
  case "$REPLY" in
    Y|y|yes|YES)
      PARENT="$(dirname "$INSTALL_DIR")"
      mkdir -p "$PARENT"
      if [ -d "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR/.git" ]; then
        echo "目录存在但不是 git 仓库，请换 NEXUS_INSTALL_DIR 或删掉后重试"
        exit 1
      fi
      git clone "$REPO_URL" "$INSTALL_DIR"
      ;;
    *)
      echo "未克隆。请手动 git clone 后执行 ./boot.sh"
      exit 0
      ;;
  esac
fi

cd "$INSTALL_DIR"
chmod +x boot.sh scripts/termux-env.sh scripts/termux-setup.sh 2>/dev/null || true

# 确保仓库内 .npmrc 生效（已提交 manage-package-manager-versions=false）
if [ ! -f .npmrc ]; then
  printf 'manage-package-manager-versions=false\npackage-manager-strict=false\n' > .npmrc
fi

ask "是否现在启动 Fengyun Nexus（./boot.sh）？" "Y"
case "$REPLY" in
  Y|y|yes|YES)
    echo "启动中… 控制台稍后打开 http://127.0.0.1:8787/"
    exec ./boot.sh
    ;;
  *)
    echo "已跳过启动。之后执行："
    echo "  cd $INSTALL_DIR && ./boot.sh"
    ;;
esac
