# Envoie l'APK caisse sur le SUNMI (USB ou Wi‑Fi boutique) — PC sur le même réseau que le SUNMI
# Prérequis : platform-tools Android (adb) — inclus avec Android Studio
# Usage :
#   .\deploy\scripts\push-apk-to-sunmi.ps1 -SunmiIp 192.168.1.42
#   .\deploy\scripts\push-apk-to-sunmi.ps1 -SunmiIp 192.168.1.42 -InstallDirect

param(
  [Parameter(Mandatory = $true)]
  [string]$SunmiIp,
  [switch]$InstallDirect,
  [string]$ApkPath = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if (-not $ApkPath) {
  $ApkPath = Join-Path $Root "app.pizzeria.fr\public\downloads\pos-sunmi.apk"
}

if (-not (Test-Path $ApkPath)) {
  Write-Error "APK introuvable : $ApkPath — lancez d'abord .\deploy\scripts\build-sunmi-lab.ps1"
}

$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
  $studioAdb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
  if (Test-Path $studioAdb) { $adb = $studioAdb } else {
    Write-Error "adb introuvable. Installez Android Studio ou platform-tools."
  }
} else {
  $adb = $adb.Source
}

Write-Host ">>> SUNMI $SunmiIp — adb: $adb"
Write-Host ">>> APK: $ApkPath"

# USB branché ?
$usb = & $adb devices | Select-String "device$"
if ($usb) {
  Write-Host ">>> Appareil USB détecté"
} else {
  Write-Host ">>> Connexion Wi‑Fi adb connect ${SunmiIp}:5555"
  Write-Host "    (SUNMI : Options développeur > Débogage sans fil, ou adb tcpip 5555 via USB une fois)"
  & $adb connect "${SunmiIp}:5555" | Out-Host
  Start-Sleep -Seconds 2
}

$remote = "/sdcard/Download/pos-sunmi.apk"

if ($InstallDirect) {
  Write-Host ">>> Installation directe…"
  & $adb install -r $ApkPath
} else {
  Write-Host ">>> Copie vers Download du SUNMI…"
  & $adb push $ApkPath $remote
  Write-Host ">>> OK — sur le SUNMI : Fichiers > Download > pos-sunmi.apk > Installer"
}
