#!/usr/bin/env bash
# Fengyun Nexus — Termux / Android 环境安装（可单独跑）
# 用法：
#   curl -fsSL <raw-url>/scripts/termux-env.sh | bash
#   或：bash scripts/termux-env.sh
set -euo pipefail

YES="${NEXUS_INSTALL_YES:-0}"
for a in "$@"; do
  case "$a" in
    -y|--yes) YES=1 ;;
  esac
done

ask() {
  # ask "提示" 默认Y|N
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

is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || echo "${PREFIX:-}" | grep -q com.termux
}

echo ""
echo "=== Fengyun Nexus · Termux 环境安装 ==="
echo "本脚本只装运行环境（Node / Git / pnpm），不启动网关。"
echo ""

if ! is_termux; then
  echo "未检测到 Termux。若仍要继续，请设 NEXUS_FORCE_TERMUX=1"
  if [ "${NEXUS_FORCE_TERMUX:-}" != "1" ]; then
    exit 1
  fi
fi

ask "是否执行 pkg update？" "Y"
case "$REPLY" in
  Y|y|yes|YES)
    pkg update -y
    ;;
  *)
    echo "跳过 pkg update"
    ;;
esac

ask "是否安装 nodejs 与 git？（首次必选）" "Y"
case "$REPLY" in
  Y|y|yes|YES)
    pkg install -y nodejs git
    ;;
  *)
    echo "跳过 pkg install"
    ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "错误：未找到 node。请先安装：pkg install nodejs"
  exit 1
fi

NODE_V="$(node -v 2>/dev/null || echo unknown)"
echo "Node: $NODE_V"

ask "是否用 npm 安装/修复 pnpm（Android 专用，避开原生二进制）？" "Y"
case "$REPLY" in
  Y|y|yes|YES)
    # npm 12 可能提示 allow-scripts；Termux 用纯 JS 的 pnpm@9 更稳
    npm config set allow-scripts=pnpm --location=user >/dev/null 2>&1 || true
    npm install -g pnpm@9.15.0
    ;;
  *)
    echo "跳过 pnpm 安装"
    ;;
esac

if ! command -v pnpm >/dev/null 2>&1; then
  echo "错误：未找到 pnpm。请执行：npm install -g pnpm@9.15.0"
  exit 1
fi

# 禁止按 packageManager 去拉 @pnpm/exe（android-arm64 无包）
export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
mkdir -p "$HOME/.npm-global" 2>/dev/null || true
echo "manage-package-manager-versions=false" > "$HOME/.npmrc.nexus-termux" 2>/dev/null || true
if [ -f "$HOME/.npmrc" ]; then
  if ! grep -q 'manage-package-manager-versions=false' "$HOME/.npmrc" 2>/dev/null; then
    ask "是否写入 ~/.npmrc 关闭 pnpm 原生二进制切换？（推荐）" "Y"
    case "$REPLY" in
      Y|y|yes|YES)
        echo "manage-package-manager-versions=false" >> "$HOME/.npmrc"
        echo "package-manager-strict=false" >> "$HOME/.npmrc"
        ;;
    esac
  fi
else
  ask "是否创建 ~/.npmrc 关闭 pnpm 原生二进制切换？（推荐）" "Y"
  case "$REPLY" in
    Y|y|yes|YES)
      printf 'manage-package-manager-versions=false\npackage-manager-strict=false\n' > "$HOME/.npmrc"
      ;;
  esac
fi

echo ""
echo "环境就绪："
echo "  node  $(node -v)"
echo "  npm   $(npm -v)"
echo "  pnpm  $(pnpm -v)"
echo ""
echo "下一步（装项目）："
echo "  curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/termux-setup.sh | bash"
echo "或已有仓库时：cd Fengyun-Nexus && ./boot.sh"
echo ""
