# 录制若干秒 16kHz 单声道 wav（MCI）
param(
  [Parameter(Mandatory = $true)][string]$OutPath,
  [Parameter(Mandatory = $false)][int]$Seconds = 6
)

$ErrorActionPreference = "Stop"
if ($Seconds -lt 2) { $Seconds = 2 }
if ($Seconds -gt 12) { $Seconds = 12 }

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class NexusMci {
  [DllImport("winmm.dll", CharSet = CharSet.Ansi)]
  public static extern int mciSendString(string command, StringBuilder returnValue, int returnLength, IntPtr winHandle);
}
"@

$dir = Split-Path -Parent $OutPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
if (Test-Path $OutPath) { Remove-Item -Force $OutPath }

$alias = "nexusrec"
$sb = New-Object System.Text.StringBuilder 256
function Mci([string]$cmd) {
  $code = [NexusMci]::mciSendString($cmd, $sb, $sb.Capacity, [IntPtr]::Zero)
  if ($code -ne 0) { throw "MCI 失败 code=$code cmd=$cmd" }
}

try {
  Mci "open new type waveaudio alias $alias"
  Mci "set $alias time format ms bitspersample 16 channels 1 samplespersec 16000 alignment 2 bytespersec 32000"
  Mci "record $alias"
  Start-Sleep -Seconds $Seconds
  Mci "stop $alias"
  $esc = $OutPath.Replace("\", "\\")
  Mci "save $alias `"$OutPath`""
} finally {
  try { Mci "close $alias" } catch { }
}

if (-not (Test-Path $OutPath)) { throw "录音文件未生成" }
Write-Output "OK|$OutPath"
