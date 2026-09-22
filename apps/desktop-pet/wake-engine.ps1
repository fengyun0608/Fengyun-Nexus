# Fengyun Nexus 桌宠：本机唤醒词引擎（System.Speech）
# 输出：READY|wake / WAKE|词 / TEXT|话 / MODE|wake|dictate / ERR|...
# 输入：WORDS|json / DICTATE / WAKE / STOP
param(
  [Parameter(Mandatory = $false)]
  [string]$WordsJson = '["喵璃","小璃","Nexus","风云"]',
  [Parameter(Mandatory = $false)]
  [string]$AliasesJson = '{}'
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try { [Console]::InputEncoding = [System.Text.Encoding]::UTF8 } catch { }

Add-Type -AssemblyName System.Speech

function Get-AliasMap([string]$json) {
  $map = @{}
  try {
    $obj = $json | ConvertFrom-Json
    if ($null -eq $obj) { return $map }
    foreach ($p in $obj.PSObject.Properties) {
      $arr = @()
      foreach ($x in @($p.Value)) { $arr += [string]$x }
      $map[$p.Name] = $arr
    }
  } catch { }
  return $map
}

function Expand-WakeList([object[]]$raw, $aliasMap) {
  $set = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($w in $raw) {
    $t = ([string]$w).Trim()
    if ($t) { [void]$set.Add($t) }
  }
  foreach ($key in @($set)) {
    if ($aliasMap.ContainsKey($key)) {
      foreach ($a in $aliasMap[$key]) {
        $t = ([string]$a).Trim()
        if ($t) { [void]$set.Add($t) }
      }
    }
  }
  return @($set)
}

function Out-Line([string]$s) {
  Write-Output $s
  [Console]::Out.Flush()
}

$shared = [hashtable]::Synchronized(@{
  Mode = "wake"
  Words = @("喵璃", "小璃", "Nexus", "风云")
  AliasMap = @{}
  Stop = $false
  ReloadWake = $false
  EnterDictate = $false
  EnterWake = $false
})

try {
  $parsed = $WordsJson | ConvertFrom-Json
  if ($parsed -is [System.Array]) { $shared.Words = @($parsed) }
  elseif ($parsed) { $shared.Words = @([string]$parsed) }
} catch { }

$shared.AliasMap = Get-AliasMap $AliasesJson

$stdinReader = {
  param($state)
  try {
    while (-not $state.Stop) {
      $line = [Console]::In.ReadLine()
      if ($null -eq $line) { Start-Sleep -Milliseconds 200; continue }
      $line = $line.Trim()
      if ($line -eq "STOP") { $state.Stop = $true; break }
      if ($line -eq "DICTATE") { $state.EnterDictate = $true; continue }
      if ($line -eq "WAKE") { $state.EnterWake = $true; continue }
      if ($line.StartsWith("WORDS|")) {
        try {
          $j = $line.Substring(6) | ConvertFrom-Json
          if ($j -is [System.Array]) { $state.Words = @($j) }
          elseif ($j) { $state.Words = @([string]$j) }
          $state.ReloadWake = $true
        } catch { }
      }
      if ($line.StartsWith("ALIASES|")) {
        try {
          $state.AliasMap = & {
            $map = @{}
            $obj = $line.Substring(8) | ConvertFrom-Json
            if ($null -eq $obj) { return $map }
            foreach ($p in $obj.PSObject.Properties) {
              $arr = @()
              foreach ($x in @($p.Value)) { $arr += [string]$x }
              $map[$p.Name] = $arr
            }
            $map
          }
          $state.ReloadWake = $true
        } catch { }
      }
    }
  } catch {
    $state.Stop = $true
  }
}

$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
try {
  $engine.SetInputToDefaultAudioDevice()
} catch {
  Out-Line ("ERR|打不开系统默认麦克风：" + $_.Exception.Message)
  exit 1
}

function Apply-Wake([System.Speech.Recognition.SpeechRecognitionEngine]$eng, $state) {
  $eng.UnloadAllGrammars()
  $list = Expand-WakeList $state.Words $state.AliasMap
  if ($list.Count -lt 1) { $list = @("喵璃", "小璃") }
  $choices = New-Object System.Speech.Recognition.Choices
  foreach ($w in $list) { [void]$choices.Add([string]$w) }
  $gb = New-Object System.Speech.Recognition.GrammarBuilder
  try { $gb.Culture = [System.Globalization.CultureInfo]::GetCultureInfo("zh-CN") } catch { }
  $gb.Append($choices)
  $g = New-Object System.Speech.Recognition.Grammar($gb)
  $g.Name = "wake"
  $eng.LoadGrammar($g)
  $state.Mode = "wake"
  Out-Line "MODE|wake"
}

function Apply-Dictate([System.Speech.Recognition.SpeechRecognitionEngine]$eng, $state) {
  $eng.UnloadAllGrammars()
  $g = New-Object System.Speech.Recognition.DictationGrammar
  $g.Name = "dictate"
  $eng.LoadGrammar($g)
  $state.Mode = "dictate"
  Out-Line "MODE|dictate"
}

Apply-Wake $engine $shared
Out-Line "READY|wake"

$stdinPs = [powershell]::Create()
[void]$stdinPs.AddScript($stdinReader).AddArgument($shared)
$stdinHandle = $stdinPs.BeginInvoke()

try {
  while (-not $shared.Stop) {
    if ($shared.EnterDictate) {
      $shared.EnterDictate = $false
      Apply-Dictate $engine $shared
    }
    if ($shared.EnterWake -or $shared.ReloadWake) {
      $shared.EnterWake = $false
      $shared.ReloadWake = $false
      Apply-Wake $engine $shared
    }

    $result = $null
    try {
      $result = $engine.Recognize([TimeSpan]::FromMilliseconds(800))
    } catch {
      Start-Sleep -Milliseconds 200
      continue
    }
    if ($null -eq $result -or [string]::IsNullOrWhiteSpace($result.Text)) { continue }
    $text = $result.Text.Trim()
    if ($shared.Mode -eq "wake") {
      Out-Line ("WAKE|" + $text)
    } else {
      Out-Line ("TEXT|" + $text)
    }
  }
} finally {
  try { $shared.Stop = $true } catch { }
  try { $engine.Dispose() } catch { }
  try {
    if ($stdinHandle) { $stdinPs.EndInvoke($stdinHandle) | Out-Null }
  } catch { }
  try { $stdinPs.Dispose() } catch { }
}
