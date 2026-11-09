# Build the Chrome Web Store zip on Windows.
# Usage: powershell -ExecutionPolicy Bypass -File .\package.ps1
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'manifest.json') | ConvertFrom-Json
$version = $manifest.version
$dist = Join-Path $Root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$zip = Join-Path $dist "tabvale_v$version.zip"

if (Test-Path $zip) { Remove-Item $zip -Force }

$items = @(
    'manifest.json',
    'background.js',
    'newtab',
    '_locales',
    'assets/icons/icon16.png',
    'assets/icons/icon48.png',
    'assets/icons/icon128.png'
)

$tar = Join-Path $env:SystemRoot 'System32/tar.exe'
if (Test-Path $tar) {
    & $tar -a -c -f $zip $items
} else {
    Compress-Archive -Path $items -DestinationPath $zip -CompressionLevel Optimal
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
    $names = @($archive.Entries | ForEach-Object { $_.FullName })
    $forbidden = @($names | Where-Object {
        $_ -match '^(tests/|tools/||dist/)' -or $_ -eq '.gitignore'
    })
    if ($forbidden.Count) {
        throw "Forbidden entries in zip: $($forbidden -join ', ')"
    }
    foreach ($required in @(
        'manifest.json',
        'background.js',
        'newtab/index.html',
        '_locales/ru/messages.json',
        '_locales/en/messages.json',
        '_locales/de/messages.json',
        '_locales/zh_CN/messages.json',
        'assets/icons/icon128.png'
    )) {
        if ($names -notcontains $required) {
            throw "Missing required entry: $required"
        }
    }
    Write-Output "Created $zip"
    $names | Sort-Object | ForEach-Object { Write-Output "  $_" }
} finally {
    $archive.Dispose()
}
