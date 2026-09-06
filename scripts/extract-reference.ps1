param([Parameter(Mandatory=$true)][string]$Apk)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$assetRoot = Join-Path $PSScriptRoot '../public/reference'
[IO.Directory]::CreateDirectory($assetRoot) | Out-Null
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Apk).Path)
try {
  foreach ($entry in $archive.Entries) {
    $relative = $null
    if ($entry.FullName -match '^assets/flutter_assets/assets/(sounds/(tick|win|pop)\.wav)$') { $relative = $Matches[1] }
    if ($entry.FullName -match '^assets/flutter_assets/assets/images/3\.0x/(coin_[a-z]+_(heads|tails)\.png|onboarding_number\.png)$') { $relative = 'images/' + $Matches[1] }
    if ($entry.FullName -match '^assets/flutter_assets/assets/(videos/coins/[a-z]+/[a-z_]+_light\.mp4)$') { $relative = $Matches[1] }
    if ($relative) {
      $destination = Join-Path $assetRoot $relative
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
      if (!(Test-Path -LiteralPath $destination)) { [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination) }
    }
  }
  $appEntry = $archive.GetEntry('lib/arm64-v8a/libapp.so')
  $appPath = Join-Path $PSScriptRoot '../.reference/libapp.so'
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($appPath)) | Out-Null
  if (!(Test-Path -LiteralPath $appPath)) { [IO.Compression.ZipFileExtensions]::ExtractToFile($appEntry, $appPath) }
} finally { $archive.Dispose() }
Get-ChildItem -LiteralPath $assetRoot -Recurse -File | Measure-Object -Property Length -Sum
