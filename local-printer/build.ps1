param([string]$AgnesProject = (Join-Path $PSScriptRoot '..\..\AgnesPrinterPlugin'))
$ErrorActionPreference = 'Stop'
$buildScript = Join-Path $AgnesProject 'build.ps1'
if (!(Test-Path -LiteralPath $buildScript)) { throw "No se encuentra el proyecto independiente de Agnes: $AgnesProject" }
& $buildScript
$downloadDir = Join-Path $PSScriptRoot '..\public\printing'
New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $AgnesProject 'dist\AgnesPrinterPlugin-1.2.zip') -Destination (Join-Path $downloadDir 'AgnesPrinterPlugin-1.2.zip') -Force
Write-Host 'Agnes 1.2 copiado a las descargas de DespachoApp.'
