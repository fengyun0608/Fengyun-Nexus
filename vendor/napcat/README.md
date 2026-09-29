# 预置 NapCat / LinuxQQ 安装包

国内直连 `qqdl.gtimg.cn` 经常 404/超时。装 NapCat 时优先用本目录下的本地包，再才尝试联网下载。

## packages/

| 文件 | 作用 |
|------|------|
| `NapCat.Shell.zip` | NapCat 本体（官方脚本同目录有则跳过下载） |
| `QQ.deb.part.00` + `QQ.deb.part.01` | LinuxQQ 分卷（各 &lt;100MB，方便进仓） |
| `QQ.deb` | 可选完整包；有则直接用，不必合并分卷 |

安装时会自动：

```bash
cat QQ.deb.part.* > QQ.deb
```

然后 `apt-get install ./QQ.deb`。

## 更新 QQ 版本

在能下到完整 deb 的机器上：

```bash
curl -fL -A "Mozilla/5.0" -o QQ.deb "你的新版 deb 地址"
split -b 90M QQ.deb QQ.deb.part.
# 删掉旧 part，提交新 part
```

Shell：

```bash
curl -fL -o NapCat.Shell.zip \
  "https://ghfast.top/https://github.com/NapNeko/NapCatQQ/releases/latest/download/NapCat.Shell.zip"
```
