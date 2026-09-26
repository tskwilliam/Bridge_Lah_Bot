# Make small display copies, preserving the user's original PNG artwork.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'public/cards'
$outputRoot = Join-Path $projectRoot 'public/card-previews'
Get-ChildItem -LiteralPath $sourceRoot -Recurse -Filter '*.png' | ForEach-Object {
  $relative = $_.FullName.Substring($sourceRoot.Length + 1)
  $target = Join-Path $outputRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  $original = [System.Drawing.Image]::FromFile($_.FullName)
  $width = 360
  $height = [int][Math]::Round($original.Height * $width / $original.Width)
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.DrawImage($original, 0, 0, $width, $height)
    $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose(); $bitmap.Dispose(); $original.Dispose() }
}
Write-Output 'Prepared card artwork for mobile display. Originals unchanged.'
