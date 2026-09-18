#!/usr/bin/env bash
# Termux apt 半截升级修复：缺 liblz4.so.1 / motd 配置卡住
# 用法：bash scripts/termux-repair-apt.sh
# 根因：新版 liblz4 只装 liblz4.so，旧 apt 要 liblz4.so.1 → 做个软链即可
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
LIB="$PREFIX/lib"
TMP="${TMPDIR:-$PREFIX/tmp}/nexus-apt-fix"
mkdir -p "$TMP"
cd "$TMP"

fix_lz4_symlink() {
  local libdir="${1:-$LIB}"
  [ -d "$libdir" ] || return 1
  # 已有 .so.1 就不用动
  if [ -e "$libdir/liblz4.so.1" ] || [ -L "$libdir/liblz4.so.1" ]; then
    return 0
  fi
  local src=""
  if [ -e "$libdir/liblz4.so" ]; then
    src="liblz4.so"
  else
    # 常见真实文件名 liblz4.so.1.10.0
    src="$(ls -1 "$libdir"/liblz4.so.* 2>/dev/null | head -n1 | xargs -n1 basename 2>/dev/null || true)"
  fi
  if [ -n "$src" ] && [ -e "$libdir/$src" ]; then
    echo "==> 补软链 $libdir/liblz4.so.1 → $src"
    ln -sfn "$src" "$libdir/liblz4.so.1"
    return 0
  fi
  echo "!! 找不到任何 liblz4.so*"
  ls -la "$libdir"/liblz4* 2>/dev/null || true
  return 1
}

echo "==> 配置卡住的包（保留现有 motd）"
echo N | dpkg --configure -a \
  -o Dpkg::Options::=--force-confdef \
  -o Dpkg::Options::=--force-confold \
  2>/dev/null || true

fix_lz4_symlink "$LIB" || true

if apt --version >/dev/null 2>&1; then
  echo "apt 已可用"
  pkg install -y liblz4 2>/dev/null || true
  fix_lz4_symlink "$LIB" || true
  echo N | dpkg --configure -a \
    -o Dpkg::Options::=--force-confdef \
    -o Dpkg::Options::=--force-confold \
    2>/dev/null || true
  exit 0
fi

echo "==> apt 仍不可用，尝试下载 liblz4.deb 并补软链"
arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
case "$arch" in
  aarch64|arm64) arch=aarch64 ;;
  arm|armhf) arch=arm ;;
  x86_64|amd64) arch=x86_64 ;;
  i686|x86) arch=i686 ;;
esac

mirrors=(
  "https://packages-cf.termux.dev/apt/termux-main"
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
  fix_lz4_symlink "$LIB" || true
  echo N | dpkg --configure -a \
    -o Dpkg::Options::=--force-confdef \
    -o Dpkg::Options::=--force-confold \
    || true
  if apt --version >/dev/null 2>&1; then
    echo "修复成功"
    pkg install -y liblz4 openssl ca-certificates curl git unzip nodejs || true
    fix_lz4_symlink "$LIB" || true
    exit 0
  fi
done

# 最后再试一次仅软链（deb 已装过的情况）
fix_lz4_symlink "$LIB" || true
if apt --version >/dev/null 2>&1; then
  echo "仅靠软链已恢复 apt"
  exit 0
fi

echo "自动修复失败。请先手动执行："
echo "  ls \$PREFIX/lib/liblz4*"
echo "  ln -sfn liblz4.so \$PREFIX/lib/liblz4.so.1"
echo "  apt --version"
echo "仍不行再重装 Termux 应用（主目录文件一般还在）。"
exit 1
