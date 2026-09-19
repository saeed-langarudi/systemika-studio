$ErrorActionPreference = "Stop"

Write-Host "Systemika Windows Installer Builder" -ForegroundColor Cyan
Write-Host ""

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dist = Join-Path $Root "distribute"

function Refresh-NodePath {
    $candidatePaths = @(
        (Join-Path $env:ProgramFiles "nodejs"),
        (Join-Path ${env:ProgramFiles(x86)} "nodejs"),
        (Join-Path $env:LOCALAPPDATA "Programs\nodejs")
    ) | Where-Object { $_ -and (Test-Path $_) }

    foreach ($p in $candidatePaths) {
        if ($env:Path -notlike "*$p*") {
            $env:Path = "$p;$env:Path"
        }
    }
}

function Get-NpmCommand {
    $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $cmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    return $null
}

# Node.js is only a build prerequisite. The generated Systemika installer
# contains Electron and does not require Node.js on end-user machines.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js LTS is not installed." -ForegroundColor Yellow
    Write-Host "Installing Node.js LTS automatically with Windows Package Manager..." -ForegroundColor Yellow
    Write-Host "Windows may show an administrator/UAC prompt for the Node.js installer." -ForegroundColor Yellow
    Write-Host ""

    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Error @"
Node.js is required to build Systemika, and Windows Package Manager (winget) was not found.

Install Node.js LTS manually from https://nodejs.org/ and then run BUILD_WINDOWS_INSTALLER.bat again.
On current Windows 10/11 systems, winget is normally provided by Microsoft's 'App Installer'.
"@
    }

    & winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "Automatic Node.js installation failed (winget exit code $LASTEXITCODE). Install Node.js LTS manually, then run this builder again."
    }

    # The MSI updates the machine PATH, but the current PowerShell process does
    # not automatically inherit that update. Add the standard Node locations now.
    Refresh-NodePath
}

Refresh-NodePath

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd = Get-NpmCommand
if (-not $nodeCmd) {
    throw "Node.js installation completed, but node.exe is still not available. Reopen Windows and run BUILD_WINDOWS_INSTALLER.bat again."
}
if (-not $npmCmd) {
    throw "Node.js is installed, but npm was not found. Reinstall Node.js LTS with npm enabled."
}

$nodeVersionText = (& node -p "process.versions.node").Trim()
$nodeVersion = [version]$nodeVersionText
if ($nodeVersion -lt [version]"22.12.0") {
    throw "Systemika installer builds require Node.js 22.12 or newer. Install a current Node.js LTS release and try again."
}

Write-Host "Using Node.js: v$nodeVersionText" -ForegroundColor Green
Write-Host "Using npm:     $(& $npmCmd --version)" -ForegroundColor Green
Write-Host ""

Push-Location $Dist
try {
    Write-Host "Installing packaging dependencies..." -ForegroundColor Yellow
    & $npmCmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }

    Write-Host "Building Systemika Setup.exe..." -ForegroundColor Yellow
    & $npmCmd run dist:win-installer
    if ($LASTEXITCODE -ne 0) { throw "Installer build failed." }

    $Out = Join-Path $Dist "output\dist-electron"
    $Installer = Get-ChildItem $Out -Filter "Systemika-Studio-Setup-*.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $Installer) { throw "Build completed but no Systemika installer was found." }

    Write-Host ""
    Write-Host "Installer created successfully:" -ForegroundColor Green
    Write-Host $Installer.FullName -ForegroundColor Green
    Write-Host ""
    Write-Host "This .exe can be copied to another Windows computer; Node.js is not required there." -ForegroundColor Cyan
    Start-Process explorer.exe $Out
}
finally {
    Pop-Location
}
