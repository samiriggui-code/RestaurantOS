# Archive RestaurantOS -> scp VPS (sans git remote)
# Usage: .\deploy\scripts\pack-for-vps.ps1
#        .\deploy\scripts\pack-for-vps.ps1 -VpsHost root@187.77.166.124

param(
  [string]$VpsHost = "root@187.77.166.124",
  [string]$RemotePath = "/tmp/pizzeria-deploy.tar.gz",
  [switch]$FiscalReset
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Tar = Join-Path $env:TEMP "pizzeria-deploy.tar.gz"

if (Test-Path $Tar) { Remove-Item $Tar -Force }

Write-Host ">>> Archive depuis $Root"
Push-Location $Root
try {
  # tar Windows 10+ - exclusions pour taille / secrets locaux
  tar -czf $Tar `
    --exclude=".git" `
    --exclude="node_modules" `
    --exclude="client" `
    --exclude=".cursor" `
    --exclude=".firecrawl" `
    --exclude="android/app/build" `
    --exclude="android/.gradle" `
    --exclude="android/.gradle-user-home" `
    --exclude="app.pizzeria.fr/.next" `
    --exclude="app.pizzeria.fr/public/pizzas" `
    --exclude="server/dist" `
    --exclude="server/uploads" `
    --exclude="server/backups" `
    --exclude="**/.env" `
    --exclude="**/.env.local" `
    --exclude="app.pizzeria.fr/.data" `
    --format=ustar `
    .
} finally {
  Pop-Location
}

$sizeMb = [math]::Round((Get-Item $Tar).Length / 1MB, 1)
Write-Host ">>> Tar : $Tar ($sizeMb Mo)"

$apkDir = Join-Path $Root "app.pizzeria.fr\public\downloads"
if (Test-Path (Join-Path $apkDir "pos-sunmi.apk")) {
  Write-Host ">>> APK inclus dans le deploy (pos-sunmi, pos-tablet, kds, livreur)"
} else {
  Write-Host ">>> Pas d'APK dans public/downloads - optionnel : .\deploy\scripts\build-sunmi-lab.ps1"
}

Write-Host ">>> scp vers ${VpsHost}:${RemotePath}"
scp $Tar "${VpsHost}:${RemotePath}"

Write-Host ">>> Extraction + install sur le VPS..."
$remoteScript = @'
set -e
mkdir -p /opt/pizzeria
FISCAL_RESET_PREFIX
tar -xzf REMOTE_TAR -C /opt/pizzeria
sed -i 's/\r$//' /opt/pizzeria/deploy/scripts/vps-install.sh
sed -i 's/\r$//' /opt/pizzeria/deploy/scripts/vps-docker-clean.sh
chmod +x /opt/pizzeria/deploy/scripts/vps-install.sh
chmod +x /opt/pizzeria/deploy/scripts/vps-docker-clean.sh
/opt/pizzeria/deploy/scripts/vps-install.sh
'@ -replace 'REMOTE_TAR', $RemotePath -replace 'FISCAL_RESET_PREFIX', $(if ($FiscalReset) { "export FORCE_FISCAL_LAB_RESET=1" } else { "" })
$localSh = Join-Path $env:TEMP "pizzeria-vps-remote.sh"
[System.IO.File]::WriteAllText($localSh, $remoteScript.Replace("`r`n", "`n"))
scp $localSh "${VpsHost}:/tmp/pizzeria-remote.sh"
ssh $VpsHost "sed -i 's/\r$//' /tmp/pizzeria-remote.sh; bash /tmp/pizzeria-remote.sh"

Write-Host ">>> Termine. Si premiere passe : nano /opt/pizzeria/.env (SMTP + SumUp) puis relancer vps-install.sh"
