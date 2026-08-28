param(
    [string]$BackupRoot = "$env:USERPROFILE\Documents\AVTracker-backups",
    [switch]$SkipEnv
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot 'backend'
$EnvFile = Join-Path $BackendDir '.env'
$DbPath = Join-Path $BackendDir 'data\avtracker.db'

function Read-DatabasePath {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $null
    }

    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*DATABASE_PATH\s*=\s*(.+)\s*$') {
            $configured = $matches[1].Trim().Trim('"').Trim("'")
            if ([System.IO.Path]::IsPathRooted($configured)) {
                return [System.IO.Path]::GetFullPath($configured)
            }
            return [System.IO.Path]::GetFullPath((Join-Path $BackendDir $configured))
        }
    }

    return $null
}

$configuredDbPath = Read-DatabasePath -Path $EnvFile
if ($configuredDbPath) {
    $DbPath = $configuredDbPath
}

if (-not (Test-Path $DbPath)) {
    throw "Database not found at: $DbPath`nStart the backend once to create it, or check DATABASE_PATH in backend/.env."
}

$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$DestDir = Join-Path $BackupRoot $timestamp
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

$DbDir = Split-Path -Parent $DbPath
$DbFileName = Split-Path -Leaf $DbPath
$DestDbPath = Join-Path $DestDir $DbFileName
$Sqlite3 = Get-Command sqlite3 -ErrorAction SilentlyContinue

if ($Sqlite3) {
    $escapedDest = $DestDbPath.Replace("'", "''")
    & sqlite3 $DbPath ".backup '$escapedDest'"
    Write-Host "Backed up database via sqlite3: $DestDbPath"
} else {
    Get-ChildItem -Path $DbDir -Filter "$DbFileName*" -File | ForEach-Object {
        Copy-Item $_.FullName -Destination $DestDir
        Write-Host "Copied $($_.Name)"
    }
    Write-Host ""
    Write-Host "Note: For safest backups while the app is running, install sqlite3 (winget install SQLite.SQLite)"
    Write-Host "      or stop the backend before running this script."
}

if (-not $SkipEnv -and (Test-Path $EnvFile)) {
    Copy-Item $EnvFile -Destination (Join-Path $DestDir '.env')
    Write-Host "Copied backend/.env (contains ENCRYPTION_KEY)"
}

Write-Host ""
Write-Host "Backup saved to: $DestDir"
