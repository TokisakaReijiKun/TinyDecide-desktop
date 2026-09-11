$log = Join-Path $PSScriptRoot '../.qa/countdown-regressions.log'
Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
$pathValue = $env:Path
$process = Start-Process -FilePath 'D:\NodeJS\node.exe' -ArgumentList 'tests/countdown-regressions.cjs' -WorkingDirectory (Resolve-Path (Join-Path $PSScriptRoot '..')).Path -Environment @{ CONDA_DEFAULT_ENV = 'JK'; Path = $pathValue } -RedirectStandardOutput $log -RedirectStandardError $log -WindowStyle Hidden -PassThru
$process | Select-Object Id, StartTime | Format-List
