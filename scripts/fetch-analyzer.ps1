$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.reference'))
Invoke-WebRequest -UseBasicParsing 'https://codeload.github.com/turingH/unflutter-iOS/zip/refs/heads/main' -OutFile (Join-Path $root 'unflutter.zip') -TimeoutSec 90
Expand-Archive -LiteralPath (Join-Path $root 'unflutter.zip') -DestinationPath (Join-Path $root 'analyzer')
Get-Content (Join-Path $root 'analyzer/unflutter-iOS-main/README.md') -First 220
