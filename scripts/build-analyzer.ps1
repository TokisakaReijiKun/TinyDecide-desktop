$ErrorActionPreference = 'Stop'
$env:GOPROXY = 'https://goproxy.cn'
Set-Location (Join-Path $PSScriptRoot '../.reference/analyzer/unflutter-iOS-main')
go build -o ../../unflutter.exe ./cmd/unflutter
exit $LASTEXITCODE
