param([string]$AgnesProject = (Join-Path $PSScriptRoot '..\..\AgnesPrinterPlugin'))
$ErrorActionPreference = 'Stop'
& (Join-Path $AgnesProject 'test.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Pruebas de Agnes fallidas.' }
