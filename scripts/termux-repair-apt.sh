#!/usr/bin/env bash
# Termux apt 半截升级修复：缺 liblz4.so.1 / motd 配置卡住
# 用法：bash scripts/termux-repair-apt.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
TMP="${TMPDIR:-$PREFIX/tmp}/nexus-apt-fix"
mkdir -p "$TMP"
cd "$TMP"

echo "==> 配置卡住的包（保留现有 motd）"
dpkg --configure -a \
  -o Dpkg::Options::=--force-confdef \
  -o Dpkg::Options::=--force-confold \
  2>/dev/null || true

if apt --version >/dev/null 2>&1; then
  echo "apt 已可用"
  pkg install -y liblz4 2>/dev/null || true
  exit 0
fi

echo "==> apt 仍不可用，尝试下载 liblz4.deb"
arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
case "$arch" in
  aarch64|arm64) arch=aarch64 ;;
  arm|armhf) arch=arm ;;
  x86_64|amd64) arch=x86_64 ;;
  i686|x86) arch=i686 ;;
esac

mirrors=(
  "https://packages.termux.dev/apt/termux-main"
  "https://mirrors.tuna.tsinghua.edu.cn/termux/apt/termux-main"
  "https://mirrors.ustc.edu.cn/termux/apt/termux-main"
)

for base in "${mirrors[@]}"; do
  echo "试镜像 $base"
  if ! curl -fsSL "$base/dists/stable/main/binary-${arch}/Packages" -o Packages; then
    continue
  fi
  path="$(awk '
    $1=="Package:" && $2=="liblz4" {hit=1}
    hit && $1=="Filename:" {print $2; exit}
  ' Packages)"
  [ -n "$path" ] || continue
  echo "下载 $path"
  curl -fsSL "$base/$path" -o liblz4.deb
  dpkg -i liblz4.deb || dpkg -i --force-depends liblz4.deb
  dpkg --configure -a \
    -o Dpkg::Options::=--force-confdef \
    -o Dpkg::Options::=--force-confold \
    || true
  if apt --version >/dev/null 2>&1; then
    echo "修复成功"
    pkg install -y liblz4 openssl ca-certificates curl git unzip nodejs || true
    exit 0
  fi
done

echo "自动修复失败。可："
echo "  1) 卸载重装 Termux 应用后重跑安装脚本"
echo "  2) termux-change-repo 换镜像后再试"
exit 1
