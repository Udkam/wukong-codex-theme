[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('list', 'add', 'replace', 'move', 'remove')]
    [string]$Command,

    [ValidateSet('battle', 'scenery')]
    [string]$Mode,

    [ValidatePattern('^[a-z0-9][a-z0-9-]{2,63}$')]
    [string]$Id,

    [string]$InputPath,

    [string]$Target,

    [ValidateRange(1, 99)]
    [int]$Position,

    [ValidateSet(
        'celestial-ink',
        'staff-gold',
        'mountain-jade',
        'yaksha-lacquer',
        'storm-cyan',
        'midnight-blue',
        'sage-sepia',
        'forest-moss',
        'ridge-umber',
        'stone-ash',
        'sunset-copper'
    )]
    [string]$Tone,

    [ValidateSet('battle-primary', 'battle-secondary', 'scenery')]
    [string]$SceneMode,

    [ValidatePattern('^(?:(?:left|center|right)|(?:0|[1-9]\d?|100)%)(?:\s+(?:(?:top|center|bottom)|(?:0|[1-9]\d?|100)%))$')]
    [string]$BackgroundPosition,

    [Nullable[double]]$Veil,

    [Nullable[double]]$ThreadVeil,

    [ValidateSet('dark', 'light')]
    [string]$Mark,

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

    [switch]$Force,

    [switch]$AsJson
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:positionSpecified = $PSBoundParameters.ContainsKey('Position')
$script:veilSpecified = $PSBoundParameters.ContainsKey('Veil')
$script:threadVeilSpecified = $PSBoundParameters.ContainsKey('ThreadVeil')
if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}

function Get-SceneGroup {
    param([Parameter(Mandatory = $true)]$Scene)
    if ([string]$Scene.mode -eq 'scenery') { return 'scenery' }
    if ([string]$Scene.mode -like 'battle-*') { return 'battle' }
    throw "Unsupported scene mode '$($Scene.mode)' on scene '$($Scene.id)'."
}

function Get-GroupPrefix {
    param([Parameter(Mandatory = $true)][string]$Group)
    if ($Group -eq 'battle') { return 'B' }
    return 'S'
}

function Get-RepositoryContext {
    param([Parameter(Mandatory = $true)][string]$Root)

    $resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
    $themeRoot = Join-Path $resolvedRoot 'themes'
    $backgroundRoot = Join-Path $themeRoot 'backgrounds'
    $manifestPath = Join-Path $themeRoot 'active.json'
    $preparePath = Join-Path $PSScriptRoot 'prepare-background.ps1'
    $runtimeRoot = Join-Path $resolvedRoot '.wukong-runtime'
    $backupRoot = Join-Path $runtimeRoot 'background-backups'
    foreach ($required in @($themeRoot, $backgroundRoot, $manifestPath, $preparePath)) {
        if (-not (Test-Path -LiteralPath $required)) {
            throw "Required background-management path is missing: $required"
        }
    }
    foreach ($directPath in @($resolvedRoot, $themeRoot, $backgroundRoot, $manifestPath, $runtimeRoot, $backupRoot)) {
        $item = Get-Item -LiteralPath $directPath -Force -ErrorAction SilentlyContinue
        if ($item -and (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
            throw "Background management refuses a symbolic link or junction: $directPath"
        }
    }

    [pscustomobject]@{
        Root = $resolvedRoot
        ThemeRoot = $themeRoot
        BackgroundRoot = $backgroundRoot
        ManifestPath = $manifestPath
        PreparePath = $preparePath
        BackupRoot = $backupRoot
    }
}

function Read-ThemeManifest {
    param([Parameter(Mandatory = $true)]$Context)
    $text = [IO.File]::ReadAllText($Context.ManifestPath, [Text.Encoding]::UTF8)
    try {
        $theme = $text | ConvertFrom-Json
    } catch {
        throw "Invalid UTF-8 JSON in $($Context.ManifestPath): $($_.Exception.Message)"
    }
    if (-not $theme.background -or -not ($theme.background.gallery -is [Array])) {
        throw 'themes/active.json must contain background.gallery as an array.'
    }
    return $theme
}

function Get-AssetPath {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)][string]$RelativeAsset
    )
    $normalized = $RelativeAsset -replace '/', '\'
    if ($normalized -notmatch '^backgrounds\\[^\\]+\.jpg$') {
        throw "Managed background assets must be JPEG files directly inside themes\backgrounds: $RelativeAsset"
    }
    $candidate = [IO.Path]::GetFullPath((Join-Path $Context.ThemeRoot $normalized))
    $allowedRoot = [IO.Path]::GetFullPath($Context.BackgroundRoot).TrimEnd('\') + '\'
    if (-not $candidate.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Background asset escapes themes\backgrounds: $RelativeAsset"
    }
    $assetItem = Get-Item -LiteralPath $candidate -Force -ErrorAction SilentlyContinue
    if ($assetItem -and (($assetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
        throw "Background asset must not be a symbolic link: $RelativeAsset"
    }
    return $candidate
}

function Get-OrderedGroup {
    param(
        [Parameter(Mandatory = $true)]$Theme,
        [Parameter(Mandatory = $true)][string]$Group
    )
    return @(
        $Theme.background.gallery |
            Where-Object { (Get-SceneGroup $_) -eq $Group } |
            Sort-Object @{ Expression = { [int]$_.order } }, @{ Expression = { [string]$_.slot } }
    )
}

function Set-GroupPlaybackOrder {
    param(
        [Parameter(Mandatory = $true)][object[]]$Scenes,
        [Parameter(Mandatory = $true)][string]$Group
    )
    for ($index = 0; $index -lt $Scenes.Count; $index += 1) {
        $Scenes[$index].order = $index + 1
    }
    return @($Scenes)
}

function Set-OrderedGallery {
    param(
        [Parameter(Mandatory = $true)]$Theme,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Battle,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Scenery
    )
    if ($Battle.Count -lt 1 -or $Scenery.Count -lt 1) {
        throw 'Battle and scenery rotations must each retain at least one scene.'
    }
    $Theme.background.gallery = @(
        @(Set-GroupPlaybackOrder -Scenes $Battle -Group 'battle') +
        @(Set-GroupPlaybackOrder -Scenes $Scenery -Group 'scenery')
    )
    $Theme.background.asset = [string]$Battle[0].asset
    $Theme.background.position = [string]$Battle[0].position
    $Theme.background.landingPosition = [string]$Battle[0].position
}

function Find-Scene {
    param(
        [Parameter(Mandatory = $true)]$Theme,
        [Parameter(Mandatory = $true)][string]$Value
    )
    $matches = @(
        $Theme.background.gallery | Where-Object {
            ([string]$_.slot).Equals($Value, [StringComparison]::OrdinalIgnoreCase) -or
            ([string]$_.id).Equals($Value, [StringComparison]::OrdinalIgnoreCase)
        }
    )
    if ($matches.Count -eq 0) { throw "Background target was not found: $Value" }
    if ($matches.Count -gt 1) { throw "Background target is ambiguous: $Value" }
    return $matches[0]
}

function Insert-Scene {
    param(
        [Parameter(Mandatory = $true)][object[]]$Scenes,
        [Parameter(Mandatory = $true)]$Scene,
        [Parameter(Mandatory = $true)][int]$OneBasedPosition
    )
    if ($OneBasedPosition -lt 1 -or $OneBasedPosition -gt ($Scenes.Count + 1)) {
        throw "Position must be between 1 and $($Scenes.Count + 1)."
    }
    $result = New-Object 'System.Collections.Generic.List[object]'
    foreach ($item in $Scenes) { $result.Add($item) }
    $result.Insert($OneBasedPosition - 1, $Scene)
    return @($result.ToArray())
}

function Test-ThemeManifest {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$Theme
    )
    $gallery = @($Theme.background.gallery)
    if ($gallery.Count -lt 1 -or $gallery.Count -gt 24) {
        throw 'The managed gallery must contain between 1 and 24 scenes.'
    }
    $ids = @{}
    $slots = @{}
    $assets = @{}
    $knownTones = @(
        'celestial-ink', 'staff-gold', 'mountain-jade', 'yaksha-lacquer',
        'storm-cyan', 'midnight-blue', 'sage-sepia', 'forest-moss',
        'ridge-umber', 'stone-ash', 'sunset-copper'
    )
    $positionPattern = '^(?:(?:left|center|right)|(?:0|[1-9]\d?|100)%)(?:\s+(?:(?:top|center|bottom)|(?:0|[1-9]\d?|100)%))$'
    foreach ($group in @('battle', 'scenery')) {
        $scenes = @(Get-OrderedGroup -Theme $Theme -Group $group)
        $prefix = Get-GroupPrefix $group
        for ($index = 0; $index -lt $scenes.Count; $index += 1) {
            $scene = $scenes[$index]
            if ([string]$scene.slot -notmatch "^$prefix[0-9]{2}$") {
                throw "Invalid stable background slot for ${group}: $($scene.slot)"
            }
            $slotKey = ([string]$scene.slot).ToUpperInvariant()
            if ($slots.ContainsKey($slotKey)) { throw "Duplicate stable background slot: $($scene.slot)" }
            $slots[$slotKey] = $true
            if ([int]$scene.order -ne ($index + 1)) {
                throw "Background playback order is not contiguous for $group at position $($index + 1)."
            }
            if ([string]::IsNullOrWhiteSpace([string]$scene.id) -or [string]$scene.id -notmatch '^[a-z0-9][a-z0-9-]{2,63}$') {
                throw "Invalid background id: $($scene.id)"
            }
            if ([string]$scene.position -notmatch $positionPattern) {
                throw "Invalid background position on $($scene.id): $($scene.position)"
            }
            if ($knownTones -notcontains [string]$scene.tone) {
                throw "Invalid background tone on $($scene.id): $($scene.tone)"
            }
            $sceneVeil = [double]$scene.veil
            if ($sceneVeil -lt 0 -or $sceneVeil -gt 1) {
                throw "Invalid background veil on $($scene.id): $($scene.veil)"
            }
            if ($scene.PSObject.Properties['threadVeil']) {
                $sceneThreadVeil = [double]$scene.threadVeil
                if ($sceneThreadVeil -lt 0 -or $sceneThreadVeil -gt 1) {
                    throw "Invalid project/thread veil on $($scene.id): $($scene.threadVeil)"
                }
            }
            if ($scene.PSObject.Properties['mark'] -and $scene.mark -notin @('dark', 'light')) {
                throw "Invalid background mark on $($scene.id): $($scene.mark)"
            }
            $idKey = ([string]$scene.id).ToLowerInvariant()
            if ($ids.ContainsKey($idKey)) { throw "Duplicate background id: $($scene.id)" }
            $ids[$idKey] = $true

            $assetPath = Get-AssetPath -Context $Context -RelativeAsset ([string]$scene.asset)
            if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
                throw "Referenced background asset is missing: $($scene.asset)"
            }
            $assetKey = $assetPath.ToLowerInvariant()
            if ($assets.ContainsKey($assetKey)) { throw "Duplicate background asset: $($scene.asset)" }
            $assets[$assetKey] = $true
        }
    }
}

function New-BackupName {
    param([Parameter(Mandatory = $true)][string]$Suffix)
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')
    $nonce = [Guid]::NewGuid().ToString('N').Substring(0, 8)
    return "$stamp-$nonce-$Suffix"
}

function Copy-BackupFile {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$Suffix
    )
    [IO.Directory]::CreateDirectory($Context.BackupRoot) | Out-Null
    $backupPath = Join-Path $Context.BackupRoot (New-BackupName $Suffix)
    [IO.File]::Copy($SourcePath, $backupPath, $false)
    return $backupPath
}

function Save-ThemeManifest {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$Theme
    )
    Test-ThemeManifest -Context $Context -Theme $Theme
    [IO.Directory]::CreateDirectory($Context.BackupRoot) | Out-Null
    $backupPath = Join-Path $Context.BackupRoot (New-BackupName 'active.json')
    $temporaryPath = Join-Path $Context.ThemeRoot ('.active.{0}.tmp.json' -f ([Guid]::NewGuid().ToString('N')))
    $json = ($Theme | ConvertTo-Json -Depth 100) + "`n"
    try {
        [IO.File]::WriteAllText($temporaryPath, $json, $utf8NoBom)
        [IO.File]::Replace($temporaryPath, $Context.ManifestPath, $backupPath)
    } finally {
        if ([IO.File]::Exists($temporaryPath)) { [IO.File]::Delete($temporaryPath) }
    }
    return $backupPath
}

function Get-NextAssetSlot {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$Theme,
        [Parameter(Mandatory = $true)][string]$Group
    )
    $prefix = Get-GroupPrefix $Group
    $usedSlots = @{}
    foreach ($scene in @($Theme.background.gallery)) {
        $usedSlots[([string]$scene.slot).ToUpperInvariant()] = $true
    }
    for ($number = 1; $number -le 99; $number += 1) {
        $fileName = '{0}-{1:D2}.jpg' -f $Group, $number
        $candidateSlot = '{0}{1:D2}' -f $prefix, $number
        if (-not $usedSlots.ContainsKey($candidateSlot) -and
            -not (Test-Path -LiteralPath (Join-Path $Context.BackgroundRoot $fileName))) {
            return $candidateSlot
        }
    }
    throw "No unused physical $group background slot remains between 01 and 99."
}

function Invoke-PrepareBackground {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)][string]$PhysicalSlot,
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [string]$TargetAsset,
        [switch]$Overwrite
    )
    if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
        throw "Input image was not found: $SourcePath"
    }
    $arguments = @{
        Slot = $PhysicalSlot
        InputPath = (Resolve-Path -LiteralPath $SourcePath).Path
        Quality = $Quality
        MaxWidth = $MaxWidth
        MaxHeight = $MaxHeight
        CropTop = $CropTop
        CropRight = $CropRight
        CropBottom = $CropBottom
        CropLeft = $CropLeft
        RepositoryRoot = $Context.Root
        Force = $Overwrite
    }
    if ($TargetAsset) { $arguments.TargetAsset = $TargetAsset }
    return & $Context.PreparePath @arguments
}

function Write-ListResult {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$Theme
    )
    $scenes = @(
        foreach ($group in @('battle', 'scenery')) {
            foreach ($scene in @(Get-OrderedGroup -Theme $Theme -Group $group)) {
                [pscustomobject][ordered]@{
                    slot = [string]$scene.slot
                    order = [int]$scene.order
                    group = $group
                    id = [string]$scene.id
                    asset = [string]$scene.asset
                    tone = [string]$scene.tone
                    veil = $scene.veil
                    threadVeil = $(if ($scene.PSObject.Properties['threadVeil']) { $scene.threadVeil } else { 0.25 })
                }
            }
        }
    )
    $linked = @{}
    foreach ($scene in $scenes) {
        $linked[(Get-AssetPath -Context $Context -RelativeAsset $scene.asset).ToLowerInvariant()] = $true
    }
    $unlinked = @(
        Get-ChildItem -LiteralPath $Context.BackgroundRoot -File -Filter '*.jpg' |
            Where-Object { -not $linked.ContainsKey($_.FullName.ToLowerInvariant()) } |
            Sort-Object Name |
            ForEach-Object { 'backgrounds/{0}' -f $_.Name }
    )
    $result = [pscustomobject][ordered]@{
        manifest = $Context.ManifestPath
        count = $scenes.Count
        scenes = $scenes
        unlinkedAssets = $unlinked
    }
    if ($AsJson) {
        $result | ConvertTo-Json -Depth 20
        return
    }
    'ORD SLOT GROUP    ID                               ASSET'
    foreach ($scene in $scenes) {
        '{0,3} {1,-4} {2,-8} {3,-32} {4}' -f $scene.order, $scene.slot, $scene.group, $scene.id, $scene.asset
    }
    if ($unlinked.Count -gt 0) {
        ''
        'Unlinked assets (kept on disk):'
        foreach ($asset in $unlinked) { "  $asset" }
    }
}

function Invoke-Add {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$Theme
    )
    if (-not $Mode) { throw 'add requires -Mode battle|scenery.' }
    if (-not $Id) { throw 'add requires -Id.' }
    if (-not $InputPath) { throw 'add requires -InputPath.' }
    if (@($Theme.background.gallery).Count -ge 24) { throw 'The gallery already contains the maximum of 24 scenes.' }
    if (@($Theme.background.gallery | Where-Object { ([string]$_.id).Equals($Id, [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0) {
        throw "Background id already exists: $Id"
    }
    if ($script:veilSpecified -and ([double]$Veil -lt 0 -or [double]$Veil -gt 1)) {
        throw '-Veil must be between 0 and 1.'
    }
    if ($script:threadVeilSpecified -and ([double]$ThreadVeil -lt 0 -or [double]$ThreadVeil -gt 1)) {
        throw '-ThreadVeil must be between 0 and 1.'
    }
    $effectiveSceneMode = if ($SceneMode) { $SceneMode } elseif ($Mode -eq 'battle') { 'battle-secondary' } else { 'scenery' }
    if (($Mode -eq 'battle' -and $effectiveSceneMode -notlike 'battle-*') -or
        ($Mode -eq 'scenery' -and $effectiveSceneMode -ne 'scenery')) {
        throw "Scene mode '$effectiveSceneMode' does not belong to group '$Mode'."
    }
    $effectiveTone = if ($Tone) { $Tone } elseif ($Mode -eq 'battle') { 'celestial-ink' } else { 'forest-moss' }
    $effectiveVeil = if ($script:veilSpecified) { [double]$Veil } elseif ($Mode -eq 'battle') { 0.78 } else { 0.75 }
    $effectiveThreadVeil = if ($script:threadVeilSpecified) { [double]$ThreadVeil } else { 0.25 }
    $physicalSlot = Get-NextAssetSlot -Context $Context -Theme $Theme -Group $Mode
    $prepared = Invoke-PrepareBackground -Context $Context -PhysicalSlot $physicalSlot -SourcePath $InputPath
    $asset = 'backgrounds/{0}' -f (Split-Path -Leaf $prepared.Path)
    $sceneData = [ordered]@{
        id = $Id
        slot = $physicalSlot
        order = 0
        asset = $asset
        position = $(if ($BackgroundPosition) { $BackgroundPosition } else { 'center center' })
        mode = $effectiveSceneMode
        tone = $effectiveTone
        veil = $effectiveVeil
        threadVeil = $effectiveThreadVeil
    }
    if ($Mark) { $sceneData['mark'] = $Mark }
    $newScene = [pscustomobject]$sceneData

    $battle = @(Get-OrderedGroup -Theme $Theme -Group 'battle')
    $scenery = @(Get-OrderedGroup -Theme $Theme -Group 'scenery')
    if ($Mode -eq 'battle') {
        $destination = if ($script:positionSpecified) { $Position } else { $battle.Count + 1 }
        $battle = @(Insert-Scene -Scenes $battle -Scene $newScene -OneBasedPosition $destination)
    } else {
        $destination = if ($script:positionSpecified) { $Position } else { $scenery.Count + 1 }
        $scenery = @(Insert-Scene -Scenes $scenery -Scene $newScene -OneBasedPosition $destination)
    }
    Set-OrderedGallery -Theme $Theme -Battle $battle -Scenery $scenery
    $backup = Save-ThemeManifest -Context $Context -Theme $Theme
    [pscustomobject][ordered]@{
        action = 'add'
        id = $Id
        slot = $newScene.slot
        asset = $asset
        manifestBackup = $backup
    }
}

function Invoke-Replace {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$Theme
    )
    if (-not $Target) { throw 'replace requires -Target SLOT|ID.' }
    if (-not $InputPath) { throw 'replace requires -InputPath.' }
    if (-not $Force) { throw 'replace overwrites one referenced image; pass -Force after checking the target.' }
    if ($script:veilSpecified -and ([double]$Veil -lt 0 -or [double]$Veil -gt 1)) {
        throw '-Veil must be between 0 and 1.'
    }
    if ($script:threadVeilSpecified -and ([double]$ThreadVeil -lt 0 -or [double]$ThreadVeil -gt 1)) {
        throw '-ThreadVeil must be between 0 and 1.'
    }
    $scene = Find-Scene -Theme $Theme -Value $Target
    if ($Id -and @($Theme.background.gallery | Where-Object {
        $_ -ne $scene -and ([string]$_.id).Equals($Id, [StringComparison]::OrdinalIgnoreCase)
    }).Count -gt 0) {
        throw "Background id already exists: $Id"
    }
    $group = Get-SceneGroup $scene
    if ($SceneMode -and (($group -eq 'battle' -and $SceneMode -notlike 'battle-*') -or
        ($group -eq 'scenery' -and $SceneMode -ne 'scenery'))) {
        throw "Scene mode '$SceneMode' does not belong to group '$group'."
    }
    $assetPath = Get-AssetPath -Context $Context -RelativeAsset ([string]$scene.asset)
    $assetBackup = if (Test-Path -LiteralPath $assetPath -PathType Leaf) {
        Copy-BackupFile -Context $Context -SourcePath $assetPath -Suffix (Split-Path -Leaf $assetPath)
    } else {
        $null
    }
    $physicalSlot = if ([string]$scene.asset -match '^(?:backgrounds[\\/])?(battle|scenery)-([0-9]{2})\.jpg$') {
        '{0}{1}' -f (Get-GroupPrefix $Matches[1]), $Matches[2]
    } else {
        '{0}{1:D2}' -f (Get-GroupPrefix $group), ([int]$scene.order)
    }
    $prepared = Invoke-PrepareBackground `
        -Context $Context `
        -PhysicalSlot $physicalSlot `
        -SourcePath $InputPath `
        -TargetAsset ([string]$scene.asset) `
        -Overwrite
    if ($Id) { $scene.id = $Id }
    if ($Tone) { $scene.tone = $Tone }
    if ($SceneMode) {
        $scene.mode = $SceneMode
    }
    if ($BackgroundPosition) { $scene.position = $BackgroundPosition }
    if ($script:veilSpecified) { $scene.veil = [double]$Veil }
    if ($script:threadVeilSpecified) {
        if ($scene.PSObject.Properties['threadVeil']) { $scene.threadVeil = [double]$ThreadVeil }
        else { $scene | Add-Member -NotePropertyName threadVeil -NotePropertyValue ([double]$ThreadVeil) }
    }
    if ($Mark) {
        if ($scene.PSObject.Properties['mark']) { $scene.mark = $Mark }
        else { $scene | Add-Member -NotePropertyName mark -NotePropertyValue $Mark }
    }
    $backup = Save-ThemeManifest -Context $Context -Theme $Theme
    [pscustomobject][ordered]@{
        action = 'replace'
        id = [string]$scene.id
        slot = [string]$scene.slot
        asset = [string]$scene.asset
        bytes = $prepared.Bytes
        manifestBackup = $backup
        assetBackup = $assetBackup
    }
}

function Invoke-Move {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$Theme
    )
    if (-not $Target) { throw 'move requires -Target SLOT|ID.' }
    if (-not $script:positionSpecified) { throw 'move requires -Position.' }
    $scene = Find-Scene -Theme $Theme -Value $Target
    $group = Get-SceneGroup $scene
    $scenes = @(Get-OrderedGroup -Theme $Theme -Group $group | Where-Object { $_ -ne $scene })
    if ($Position -gt ($scenes.Count + 1)) { throw "Position must be between 1 and $($scenes.Count + 1)." }
    $scenes = @(Insert-Scene -Scenes $scenes -Scene $scene -OneBasedPosition $Position)
    $battle = @(Get-OrderedGroup -Theme $Theme -Group 'battle')
    $scenery = @(Get-OrderedGroup -Theme $Theme -Group 'scenery')
    if ($group -eq 'battle') { $battle = $scenes } else { $scenery = $scenes }
    Set-OrderedGallery -Theme $Theme -Battle $battle -Scenery $scenery
    $backup = Save-ThemeManifest -Context $Context -Theme $Theme
    [pscustomobject][ordered]@{
        action = 'move'
        id = [string]$scene.id
        slot = [string]$scene.slot
        position = [int]$scene.order
        manifestBackup = $backup
    }
}

function Invoke-Remove {
    param(
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)]$Theme
    )
    if (-not $Target) { throw 'remove requires -Target SLOT|ID.' }
    if (-not $Force) { throw 'remove changes the rotation; pass -Force after checking the target.' }
    $scene = Find-Scene -Theme $Theme -Value $Target
    if (@($Theme.background.gallery).Count -le 1) { throw 'The last gallery scene cannot be removed.' }
    $assetPath = Get-AssetPath -Context $Context -RelativeAsset ([string]$scene.asset)
    $battle = @(Get-OrderedGroup -Theme $Theme -Group 'battle' | Where-Object { $_ -ne $scene })
    $scenery = @(Get-OrderedGroup -Theme $Theme -Group 'scenery' | Where-Object { $_ -ne $scene })
    Set-OrderedGallery -Theme $Theme -Battle $battle -Scenery $scenery
    $backup = Save-ThemeManifest -Context $Context -Theme $Theme
    [pscustomobject][ordered]@{
        action = 'remove'
        id = [string]$scene.id
        formerSlot = [string]$scene.slot
        asset = [string]$scene.asset
        assetRetained = (Test-Path -LiteralPath $assetPath -PathType Leaf)
        manifestBackup = $backup
    }
}

function Start-InteractiveManager {
    param([Parameter(Mandatory = $true)]$Context)
    while ($true) {
        ''
        'Wukong background manager'
        '[L] List  [A] Add  [R] Replace  [M] Move  [D] Remove  [Q] Quit'
        $choice = (Read-Host 'Choose').Trim().ToLowerInvariant()
        if ($choice -eq 'q') { return }
        try {
            switch ($choice) {
                'l' { & $PSCommandPath list -RepositoryRoot $Context.Root }
                'a' {
                    $interactiveMode = (Read-Host 'Group (battle/scenery)').Trim()
                    $interactiveId = (Read-Host 'Scene id (lowercase words with hyphens)').Trim()
                    $interactiveInput = (Read-Host 'Source image path').Trim('"')
                    $interactivePosition = (Read-Host 'Position (blank = end)').Trim()
                    $args = @{
                        Command = 'add'; RepositoryRoot = $Context.Root; Mode = $interactiveMode
                        Id = $interactiveId; InputPath = $interactiveInput
                    }
                    if ($interactivePosition) { $args.Position = [int]$interactivePosition }
                    & $PSCommandPath @args
                }
                'r' {
                    $interactiveTarget = (Read-Host 'Target slot or id').Trim()
                    $interactiveInput = (Read-Host 'Replacement image path').Trim('"')
                    $confirmation = (Read-Host "Type REPLACE to overwrite $interactiveTarget").Trim()
                    if ($confirmation -ne 'REPLACE') { 'Cancelled.'; continue }
                    & $PSCommandPath replace -RepositoryRoot $Context.Root -Target $interactiveTarget -InputPath $interactiveInput -Force
                }
                'm' {
                    $interactiveTarget = (Read-Host 'Target slot or id').Trim()
                    $interactivePosition = [int](Read-Host 'New position within its group')
                    & $PSCommandPath move -RepositoryRoot $Context.Root -Target $interactiveTarget -Position $interactivePosition
                }
                'd' {
                    $interactiveTarget = (Read-Host 'Target slot or id').Trim()
                    $confirmation = (Read-Host "Type REMOVE to remove $interactiveTarget from rotation (the image file is kept)").Trim()
                    if ($confirmation -ne 'REMOVE') { 'Cancelled.'; continue }
                    & $PSCommandPath remove -RepositoryRoot $Context.Root -Target $interactiveTarget -Force
                }
                default { 'Unknown choice.' }
            }
        } catch {
            Write-Warning $_.Exception.Message
        }
    }
}

$context = Get-RepositoryContext -Root $RepositoryRoot
if (-not $Command) {
    Start-InteractiveManager -Context $context
    return
}

$theme = Read-ThemeManifest -Context $context
switch ($Command) {
    'list' { Write-ListResult -Context $context -Theme $theme }
    'add' { Invoke-Add -Context $context -Theme $theme }
    'replace' { Invoke-Replace -Context $context -Theme $theme }
    'move' { Invoke-Move -Context $context -Theme $theme }
    'remove' { Invoke-Remove -Context $context -Theme $theme }
}
