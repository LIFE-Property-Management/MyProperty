<#
.SYNOPSIS
    Render every PlantUML diagram in docs/architecture/diagrams/ to SVG.

.DESCRIPTION
    Downloads plantuml.jar on first run if missing (it is gitignored at
    tools/plantuml.jar). Requires Java on PATH (java -version).

.EXAMPLE
    pwsh scripts/render-architecture-diagrams.ps1
    pwsh scripts/render-architecture-diagrams.ps1 -DiagramsDir docs/architecture/diagrams
#>
param(
    [string]$DiagramsDir = 'docs/architecture/diagrams',
    [string]$JarPath     = 'tools/plantuml.jar'
)

$ErrorActionPreference = 'Stop'

# ----- Locate / download plantuml.jar -----
if (-not (Test-Path $JarPath)) {
    $toolsDir = Split-Path $JarPath -Parent
    if ($toolsDir -and -not (Test-Path $toolsDir)) {
        New-Item -ItemType Directory -Path $toolsDir | Out-Null
    }
    Write-Host "plantuml.jar not found at $JarPath - downloading latest release..." -ForegroundColor Yellow
    $release = Invoke-RestMethod 'https://api.github.com/repos/plantuml/plantuml/releases/latest' `
        -Headers @{ 'User-Agent' = 'render-architecture-diagrams' }
    $asset = $release.assets |
        Where-Object { $_.name -match '^plantuml-\d+\.\d+\.\d+\.jar$' } |
        Select-Object -First 1
    if (-not $asset) {
        throw "Could not find a plantuml-<version>.jar asset in release $($release.tag_name)"
    }
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $JarPath -UseBasicParsing
    $sizeMb = [Math]::Round((Get-Item $JarPath).Length / 1MB, 2)
    Write-Host "Downloaded $($asset.name) ($sizeMb MB) to $JarPath" -ForegroundColor Green
}

# ----- Verify Java is available -----
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw "Java is not on PATH - install Java (>= 11) and retry."
}

# ----- Render every .puml -----
if (-not (Test-Path $DiagramsDir)) {
    Write-Host "Diagrams directory '$DiagramsDir' does not exist yet - nothing to render." -ForegroundColor Yellow
    exit 0
}

$pumlFiles = Get-ChildItem -Path $DiagramsDir -Filter *.puml -File
if (-not $pumlFiles) {
    Write-Host "No .puml files found in $DiagramsDir - nothing to render." -ForegroundColor Yellow
    exit 0
}

Write-Host "Rendering $($pumlFiles.Count) diagram(s) from $DiagramsDir ..." -ForegroundColor Cyan
$start = Get-Date

& java -jar $JarPath -tsvg -o (Resolve-Path $DiagramsDir).Path ($pumlFiles | ForEach-Object FullName)
if ($LASTEXITCODE -ne 0) {
    throw "PlantUML render failed with exit code $LASTEXITCODE"
}

$elapsed = ((Get-Date) - $start).TotalSeconds
Write-Host ("Render complete in {0:n2}s" -f $elapsed) -ForegroundColor Green

# ----- Summary -----
$rendered = 0
$missing  = 0
foreach ($f in $pumlFiles) {
    $svgPath = Join-Path $f.DirectoryName ($f.BaseName + '.svg')
    if (Test-Path $svgPath) {
        $kb = [Math]::Round((Get-Item $svgPath).Length / 1KB, 1)
        Write-Host ("  OK   {0,-40} -> {1,-40} ({2,6} KB)" -f $f.Name, ($f.BaseName + '.svg'), $kb)
        $rendered++
    } else {
        Write-Host ("  FAIL {0,-40} (no SVG produced)" -f $f.Name) -ForegroundColor Red
        $missing++
    }
}

Write-Host ""
Write-Host "Summary: $rendered rendered, $missing missing" -ForegroundColor $(if ($missing -eq 0) { 'Green' } else { 'Red' })

if ($missing -gt 0) { exit 1 }
