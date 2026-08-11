[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[BS](?:0[1-9]|[1-9][0-9])$')]
    [string]$Slot,

    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$InputPath,

    [ValidateRange(1, 100)]
    [int]$Quality = 90,

    [ValidateRange(320, 7680)]
    [int]$MaxWidth = 1920,

    [ValidateRange(180, 4320)]
    [int]$MaxHeight = 1080,

    [ValidateRange(0, 8192)]
    [int]$CropTop = 0,

    [ValidateRange(0, 8192)]
    [int]$CropRight = 0,

    [ValidateRange(0, 8192)]
    [int]$CropBottom = 0,

    [ValidateRange(0, 8192)]
    [int]$CropLeft = 0,

    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Container })]
    [string]$RepositoryRoot,

    [ValidatePattern('^backgrounds[\\/][^\\/]+\.jpg$')]
    [string]$TargetAsset,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}

Add-Type -AssemblyName System.Drawing

$resolvedRepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$group = if ($Slot[0] -eq 'B') { 'battle' } else { 'scenery' }
$number = [int]$Slot.Substring(1)
$themeDirectory = Join-Path $resolvedRepositoryRoot 'themes'
$targetDirectory = Join-Path $themeDirectory 'backgrounds'
$defaultFileName = '{0}-{1:D2}.jpg' -f $group, $number
$relativeTarget = if ($TargetAsset) {
    $TargetAsset -replace '/', '\'
} else {
    'backgrounds\{0}' -f $defaultFileName
}
$targetPath = [IO.Path]::GetFullPath((Join-Path $themeDirectory $relativeTarget))
$backgroundRoot = [IO.Path]::GetFullPath($targetDirectory).TrimEnd('\') + '\'
if (-not $targetPath.StartsWith($backgroundRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Background target must remain inside themes\backgrounds: $relativeTarget"
}
foreach ($directPath in @($resolvedRepositoryRoot, $themeDirectory, $targetDirectory, $targetPath)) {
    $item = Get-Item -LiteralPath $directPath -Force -ErrorAction SilentlyContinue
    if ($item -and (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
        throw "Background preparation refuses a symbolic link or junction: $directPath"
    }
}

if ((Test-Path -LiteralPath $targetPath) -and -not $Force) {
    throw "Background slot already exists: $targetPath. Pass -Force to replace it."
}

New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null

$source = $null
$bitmap = $null
$graphics = $null
$encoderParameters = $null
$temporaryPath = Join-Path $targetDirectory ('.{0}-{1:D2}.{2}.tmp.jpg' -f $group, $number, $PID)

try {
    $source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $InputPath).Path)
    $cropWidth = $source.Width - $CropLeft - $CropRight
    $cropHeight = $source.Height - $CropTop - $CropBottom
    if ($cropWidth -le 0 -or $cropHeight -le 0) {
        throw "Crop rectangle must remain inside the source image: $($source.Width)x$($source.Height)."
    }

    $scale = [Math]::Min(
        1.0,
        [Math]::Min($MaxWidth / [double]$cropWidth, $MaxHeight / [double]$cropHeight)
    )
    $width = [Math]::Max(1, [int][Math]::Round($cropWidth * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($cropHeight * $scale))

    $bitmap = New-Object System.Drawing.Bitmap(
        $width,
        $height,
        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    )
    $bitmap.SetResolution(96, 96)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Black)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage(
        $source,
        (New-Object System.Drawing.Rectangle(0, 0, $width, $height)),
        $CropLeft,
        $CropTop,
        $cropWidth,
        $cropHeight,
        [System.Drawing.GraphicsUnit]::Pixel
    )

    $jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq 'image/jpeg' } |
        Select-Object -First 1
    if (-not $jpegEncoder) { throw 'JPEG encoder is unavailable.' }

    $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality,
        [long]$Quality
    )
    $bitmap.Save($temporaryPath, $jpegEncoder, $encoderParameters)

    $graphics.Dispose()
    $graphics = $null
    $bitmap.Dispose()
    $bitmap = $null
    $source.Dispose()
    $source = $null

    Move-Item -LiteralPath $temporaryPath -Destination $targetPath -Force
    $result = Get-Item -LiteralPath $targetPath
    [pscustomobject]@{
        Slot = $Slot.ToUpperInvariant()
        Path = $result.FullName
        Width = $width
        Height = $height
        Bytes = $result.Length
        Quality = $Quality
        CropTop = $CropTop
        CropRight = $CropRight
        CropBottom = $CropBottom
        CropLeft = $CropLeft
    }
} finally {
    if ($graphics) { $graphics.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
    if ($source) { $source.Dispose() }
    if ($encoderParameters) { $encoderParameters.Dispose() }
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath -Force
    }
}
