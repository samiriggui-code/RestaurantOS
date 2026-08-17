# Build APK SUNMI + tablette caisse + KDS (Gradle) -> public/downloads pour deploy VPS
# Usage :
#   .\deploy\scripts\build-sunmi-lab.ps1
#   .\deploy\scripts\pack-for-vps.ps1

param(
  [string]$OpsHost = "https://pizza-app.gsms-security.com",
  [string]$PublicHost = "https://pizza.gsms-security.com"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Android = Join-Path $Root "android"
$Downloads = Join-Path $Root "app.pizzeria.fr\public\downloads"

Write-Host ">>> Build APK labo (SUNMI portrait + tablette/KDS paysage)"
Write-Host "    OPS_HOST=$OpsHost"
Write-Host "    PUBLIC_HOST=$PublicHost"

$jbrCandidates = @(
  "C:\Program Files\Android\Android Studio\jbr",
  "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
)
foreach ($jbr in $jbrCandidates) {
  if (Test-Path "$jbr\bin\java.exe") {
    $env:JAVA_HOME = $jbr
    $env:PATH = "$jbr\bin;$env:PATH"
    Write-Host ">>> JAVA_HOME=$jbr"
    break
  }
}

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (Test-Path $sdk) {
  $env:ANDROID_HOME = $sdk
  $env:ANDROID_SDK_ROOT = $sdk
  @("sdk.dir=$($sdk -replace '\\', '\\\\')") | Set-Content -Path (Join-Path $Android "local.properties") -Encoding ASCII
  Write-Host ">>> ANDROID_SDK=$sdk"
} else {
  Write-Error "SDK Android introuvable - ouvrez Android Studio une fois pour installer le SDK"
}

Push-Location $Android
try {
  if (-not (Test-Path ".\gradlew.bat")) {
    Write-Error "gradlew.bat absent - ouvrez android\ dans Android Studio une fois"
  }
  .\gradlew.bat assemblePosSunmiRelease assemblePosTabletRelease assembleKdsRelease assembleLivreurRelease `
    "-POPS_HOST=$OpsHost" `
    "-PPUBLIC_HOST=$PublicHost"
  if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$posSunmi = Get-ChildItem (Join-Path $Android "app\build\outputs\apk\posSunmi\release\*.apk") -ErrorAction SilentlyContinue | Select-Object -First 1
$posTablet = Get-ChildItem (Join-Path $Android "app\build\outputs\apk\posTablet\release\*.apk") -ErrorAction SilentlyContinue | Select-Object -First 1
$kds = Get-ChildItem (Join-Path $Android "app\build\outputs\apk\kds\release\*.apk") -ErrorAction SilentlyContinue | Select-Object -First 1
$livreur = Get-ChildItem (Join-Path $Android "app\build\outputs\apk\livreur\release\*.apk") -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $posSunmi) { Write-Error "Build POS SUNMI echoue" }
if (-not $posTablet) { Write-Error "Build POS tablette echoue" }
if (-not $kds) { Write-Error "Build KDS echoue" }
if (-not $livreur) { Write-Error "Build livreur echoue" }

New-Item -ItemType Directory -Force -Path $Downloads | Out-Null
Copy-Item $posSunmi.FullName (Join-Path $Downloads "pos-sunmi.apk") -Force
Copy-Item $posTablet.FullName (Join-Path $Downloads "pos-tablet.apk") -Force
Copy-Item $kds.FullName (Join-Path $Downloads "kds.apk") -Force
Copy-Item $livreur.FullName (Join-Path $Downloads "livreur.apk") -Force

# Manifest OTA — comparé au build natif au démarrage POS/KDS
$gradleFile = Join-Path $Android "app\build.gradle.kts"
$gradleText = Get-Content $gradleFile -Raw
$versionCode = if ($gradleText -match 'versionCode\s*=\s*(\d+)') { [int]$Matches[1] } else { 0 }
$versionName = if ($gradleText -match 'versionName\s*=\s*"([^"]+)"') { $Matches[1] } else { "0.0.0" }

$manifest = @{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  apps = @{
    "pos-sunmi" = @{
      versionCode = $versionCode
      versionName = $versionName
      file = "pos-sunmi.apk"
      url = "/downloads/pos-sunmi.apk"
      sizeBytes = (Get-Item (Join-Path $Downloads "pos-sunmi.apk")).Length
    }
    "pos-tablet" = @{
      versionCode = $versionCode
      versionName = $versionName
      file = "pos-tablet.apk"
      url = "/downloads/pos-tablet.apk"
      sizeBytes = (Get-Item (Join-Path $Downloads "pos-tablet.apk")).Length
    }
    kds = @{
      versionCode = $versionCode
      versionName = $versionName
      file = "kds.apk"
      url = "/downloads/kds.apk"
      sizeBytes = (Get-Item (Join-Path $Downloads "kds.apk")).Length
    }
    livreur = @{
      versionCode = $versionCode
      versionName = $versionName
      file = "livreur.apk"
      url = "/downloads/livreur.apk"
      sizeBytes = (Get-Item (Join-Path $Downloads "livreur.apk")).Length
    }
  }
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Downloads "apk-manifest.json") -Encoding UTF8

Write-Host ""
Write-Host ">>> APK prets :"
Write-Host "    $Downloads\pos-sunmi.apk   (portrait)"
Write-Host "    $Downloads\pos-tablet.apk  (paysage)"
Write-Host "    $Downloads\kds.apk         (paysage)"
Write-Host "    $Downloads\livreur.apk     (portrait livreur)"
Write-Host "    $Downloads\apk-manifest.json (OTA auto)"
Write-Host ""
Write-Host ">>> Prochaine etape : .\deploy\scripts\pack-for-vps.ps1"
