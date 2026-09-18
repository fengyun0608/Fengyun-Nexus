# Fengyun Nexus — Windows 一键装环境 + 拉仓 + 启动（推荐管道执行，永远用最新）
#
# 国内（GitCode）：
#   irm "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.ps1?ref=main" | iex
# 国外（GitHub）：
#   irm "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.ps1" | iex
#
# 按「部署机器所在地」选国内或国外源。也可：$env:NEXUS_MIRROR = "cn" 或 "global"
# gitcode.com/.../raw/... 会返回网页，国内必须用 api.gitcode.com。
#
# 开关（环境变量）：
#   $env:NEXUS_MIRROR = "cn"|"global"  国内 GitCode / 国外 GitHub
#   $env:NEXUS_REINSTALL = "1"         重装环境并清空后重装框架目录
#   $env:NEXUS_REINSTALL_ENV = "1"     只重装 Node/pnpm
#   $env:NEXUS_SKIP_BOOT = "1"         只装不启
#   $env:NEXUS_ENV = "desktop"         desktop|server
#   $env:NEXUS_INSTALL_DIR             默认 $HOME\Fengyun-Nexus
#   $env:NEXUS_BRANCH = "main"
#
$ErrorActionPreference = "Stop"

$Branch = if ($env:NEXUS_BRANCH) { $env:NEXUS_BRANCH } else { "main" }
$InstallDir = if ($env:NEXUS_INSTALL_DIR) { $env:NEXUS_INSTALL_DIR } else { Join-Path $HOME "Fengyun-Nexus" }
$NexusEnv = if ($env:NEXUS_ENV) { $env:NEXUS_ENV } else { "desktop" }
$Reinstall = $env:NEXUS_REINSTALL -eq "1"
$ReinstallEnv = ($env:NEXUS_REINSTALL_ENV -eq "1") -or $Reinstall
$SkipBoot = $env:NEXUS_SKIP_BOOT -eq "1"

$script:Mirror = "cn"
$script:RepoUrl = ""
$script:RawBase = ""
$script:GetPs1Url = ""

function Write-Log($msg) { Write-Host ">>> $msg" }
function Write-Ok($msg) { Write-Host "OK  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "!!  $msg" -ForegroundColor Yellow }

function Normalize-Mirror([string]$v) {
  switch -Regex ($v.Trim().ToLower()) {
    '^(cn|china|gitcode|国内|zh)$' { return "cn" }
    '^(global|intl|international|github|gh|国外|en|us)$' { return "global" }
    default { return "" }
  }
}

function Apply-Mirror([string]$m) {
  $script:Mirror = $m
  if ($m -eq "global") {
    $script:RepoUrl = if ($env:NEXUS_REPO_URL) { $env:NEXUS_REPO_URL } else { "https://github.com/fengyun0608/Fengyun-Nexus.git" }
    $script:RawBase = if ($env:NEXUS_RAW_BASE) { $env:NEXUS_RAW_BASE } else { "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/$Branch" }
    $script:GetPs1Url = if ($env:NEXUS_GET_PS1_URL) { $env:NEXUS_GET_PS1_URL } else { "$($script:RawBase)/scripts/get.ps1" }
  } else {
    $script:Mirror = "cn"
    $script:RepoUrl = if ($env:NEXUS_REPO_URL) { $env:NEXUS_REPO_URL } else { "https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git" }
    $script:RawBase = if ($env:NEXUS_RAW_BASE) { $env:NEXUS_RAW_BASE } else { "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw" }
    $script:GetPs1Url = if ($env:NEXUS_GET_PS1_URL) { $env:NEXUS_GET_PS1_URL } else { "$($script:RawBase)/scripts/get.ps1?ref=$Branch" }
  }
}

function Choose-Mirror {
  if ($env:NEXUS_REPO_URL) {
    if ($env:NEXUS_REPO_URL -match "github\.com") { Apply-Mirror "global" } else { Apply-Mirror "cn" }
    return
  }
  $picked = Normalize-Mirror ($(if ($env:NEXUS_MIRROR) { $env:NEXUS_MIRROR } else { "" }))
  $stamp = Join-Path $InstallDir ".nexus-mirror"
  if (-not $picked -and (Test-Path $stamp)) {
    $picked = Normalize-Mirror ((Get-Content -LiteralPath $stamp -Raw -ErrorAction SilentlyContinue) + "")
  }
  if (-not $picked) {
    Write-Host ""
    Write-Host "请选择下载源（按「这台机器」所在地选，不是按你人在哪）："
    Write-Host "  1) 国内 — GitCode（国内服务器 / 手机推荐）"
    Write-Host "  2) 国外 — GitHub（海外机器推荐）"
    $ans = Read-Host "请输入 1 或 2 [默认 1]"
    if ($ans -match '^(2|g|global|github|国外)$') { $picked = "global" } else { $picked = "cn" }
  }
  Apply-Mirror $picked
}

function Persist-Mirror {
  if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  }
  Set-Content -LiteralPath (Join-Path $InstallDir ".nexus-mirror") -Value $script:Mirror -Encoding utf8
}

function Test-Cmd($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Ensure-Git {
  if (Test-Cmd "git") { return }
  Write-Log "未找到 git，尝试 winget 安装"
  if (Test-Cmd "winget") {
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements | Out-Null
  }
  if (-not (Test-Cmd "git")) {
    throw "未找到 git。请安装 https://git-scm.com/ 后重试。"
  }
}

function Ensure-Node {
  $need = $ReinstallEnv
  if (-not $need -and (Test-Cmd "node")) {
    $maj = 0
    try { $maj = [int]((node -p "process.versions.node.split('.')[0]")) } catch { $maj = 0 }
    if ($maj -ge 20) { return }
    Write-Warn "当前 Node 版本偏低，需要 ≥ 20"
    $need = $true
  }
  if (-not $need -and (Test-Cmd "node")) { return }

  Write-Log "安装 / 升级 Node.js 20+"
  if (Test-Cmd "winget") {
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements | Out-Null
  }
  # 刷新 PATH
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")
  if (-not (Test-Cmd "node")) {
    throw "未找到 Node.js 20+。请安装 https://nodejs.org/ 后重试。"
  }
}

function Ensure-Pnpm {
  $env:NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS = "false"
  $need = $ReinstallEnv
  if (-not $need -and (Test-Cmd "pnpm")) {
    $v = ""
    try { $v = (pnpm -v) } catch { $v = "" }
    if ($v -match "^[89]\.") { return }
    $need = $true
  }
  if ($need -or -not (Test-Cmd "pnpm")) {
    Write-Log "安装 pnpm@9"
    npm install -g pnpm@9.15.0
  }
  if (-not (Test-Cmd "pnpm")) {
    throw "未找到 pnpm"
  }
}

function Test-Framework {
  return (Test-Path (Join-Path $InstallDir "package.json")) -and (Test-Path (Join-Path $InstallDir "start.bat"))
}

function Remove-InstallDir {
  if (Test-Path $InstallDir) {
    Write-Log "移除旧目录 $InstallDir"
    Remove-Item -LiteralPath $InstallDir -Recurse -Force
  }
}

function Sync-GitTree {
  Push-Location $InstallDir
  try {
    git remote set-url origin $script:RepoUrl 2>$null
    if ($LASTEXITCODE -ne 0) { git remote add origin $script:RepoUrl 2>$null }
    git fetch --depth 1 origin $Branch
    if (git rev-parse --verify "origin/$Branch" 2>$null) {
      git reset --hard "origin/$Branch"
    } else {
      git reset --hard FETCH_HEAD
    }
    git clean -fd 2>$null | Out-Null
  } finally {
    Pop-Location
  }
}

function Clone-Fresh {
  $parent = Split-Path -Parent $InstallDir
  if ($parent -and -not (Test-Path $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  Write-Log "克隆 $($script:RepoUrl)"
  git clone --depth 1 --branch $Branch $script:RepoUrl $InstallDir
  if (-not (Test-Framework)) {
    throw "克隆后目录不完整"
  }
}

function Ensure-Framework {
  if ($Reinstall) {
    Write-Log "强制重装框架目录"
    Remove-InstallDir
    Clone-Fresh
    return
  }
  if (-not (Test-Path $InstallDir)) {
    Write-Log "未检测到安装，首次克隆"
    Clone-Fresh
    return
  }
  if (-not (Test-Framework)) {
    Write-Log "检测到残缺安装，自动修复"
    if (Test-Path (Join-Path $InstallDir ".git")) {
      try { Sync-GitTree } catch { Write-Warn $_.Exception.Message }
    }
    if (-not (Test-Framework)) {
      $bak = "$InstallDir.bak.$((Get-Date).ToString('yyyyMMddHHmmss'))"
      Write-Warn "拉齐后仍残缺，备份到 $bak 后重装"
      Rename-Item -LiteralPath $InstallDir -NewName (Split-Path $bak -Leaf) -ErrorAction SilentlyContinue
      if (Test-Path $InstallDir) { Remove-InstallDir }
      Clone-Fresh
    }
    return
  }
  Write-Log "已安装，拉齐最新 $Branch"
  if (Test-Path (Join-Path $InstallDir ".git")) {
    try { Sync-GitTree } catch { Write-Warn "拉齐失败，继续用本地版本" }
  }
}

Choose-Mirror

Write-Host ""
Write-Host "=== Fengyun Nexus · 一键安装（Windows）==="
Write-Host "目录: $InstallDir"
Write-Host "姿态: $NexusEnv"
Write-Host "分支: $Branch"
if ($script:Mirror -eq "global") {
  Write-Host "镜像: 国外 · GitHub"
} else {
  Write-Host "镜像: 国内 · GitCode"
}
Write-Host "仓库: $($script:RepoUrl)"
Write-Host ""

Ensure-Git
Ensure-Node
Ensure-Pnpm
Write-Ok "环境  node=$(node -v)  pnpm=$(pnpm -v)  姿态=$NexusEnv"

Ensure-Framework
if (-not (Test-Framework)) {
  Write-Host "安装失败。可强制重装："
  if ($script:Mirror -eq "global") {
    Write-Host "  `$env:NEXUS_REINSTALL='1'; `$env:NEXUS_MIRROR='global'; irm `"$($script:GetPs1Url)`" | iex"
  } else {
    Write-Host "  `$env:NEXUS_REINSTALL='1'; irm `"$($script:GetPs1Url)`" | iex"
  }
  exit 1
}

$stamp = Join-Path $InstallDir ".nexus-installed"
(Get-Date).ToUniversalTime().ToString("o") | Set-Content -Path $stamp -Encoding utf8
Persist-Mirror
$env:NEXUS_ENV = $NexusEnv
$env:NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS = "false"

if ($SkipBoot) {
  Write-Ok "已跳过启动（NEXUS_SKIP_BOOT=1）"
  Write-Host "启动：cd `"$InstallDir`"; .\start.bat"
  exit 0
}

Write-Log "启动  控制台 http://127.0.0.1:8787/"
Set-Location $InstallDir
& .\start.bat
exit $LASTEXITCODE
