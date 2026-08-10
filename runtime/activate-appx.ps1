[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [Alias('ArgumentLineBase64')]
    [AllowEmptyString()]
    [string]$ArgumentsBase64
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = [Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

try {
    $strictUtf8 = [Text.UTF8Encoding]::new($false, $true)
    try {
        $argumentBytes = [Convert]::FromBase64String($ArgumentsBase64)
        $argumentLine = $strictUtf8.GetString($argumentBytes)
    }
    catch {
        throw 'ArgumentsBase64 must contain a valid UTF-8 Base64-encoded argument line.'
    }

    if ($argumentLine.IndexOf([char]0) -ge 0 -or
        $argumentLine.IndexOf([char]13) -ge 0 -or
        $argumentLine.IndexOf([char]10) -ge 0) {
        throw 'The decoded argument line must not contain NUL, CR, or LF characters.'
    }

    $packages = @(
        Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction Stop |
            Where-Object { $_.InstallLocation } |
            Sort-Object -Property Version -Descending
    )
    if ($packages.Count -eq 0) {
        throw 'The official OpenAI.Codex AppX package is not registered for the current user.'
    }

    $selected = $null
    foreach ($candidate in $packages) {
        $manifestPath = Join-Path ([string]$candidate.InstallLocation) 'AppxManifest.xml'
        if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { continue }

        [xml]$manifest = [IO.File]::ReadAllText($manifestPath, [Text.Encoding]::UTF8)
        $applicationNodes = @($manifest.SelectNodes(
            "/*[local-name()='Package']/*[local-name()='Applications']/*[local-name()='Application']"
        ))
        foreach ($applicationNode in $applicationNodes) {
            $relativeExecutable = [string]$applicationNode.GetAttribute('Executable')
            $normalizedExecutable = $relativeExecutable.Replace('/', '\').TrimStart([char]92)
            if (-not [string]::Equals(
                $normalizedExecutable,
                'app\ChatGPT.exe',
                [StringComparison]::OrdinalIgnoreCase
            )) { continue }

            $applicationId = [string]$applicationNode.GetAttribute('Id')
            if ([string]::IsNullOrWhiteSpace($applicationId)) {
                throw "The matching AppX Application element has no Id: $manifestPath"
            }

            $selected = [pscustomobject]@{
                Package = $candidate
                ApplicationId = $applicationId
                RelativeExecutable = $normalizedExecutable
            }
            break
        }
        if ($null -ne $selected) { break }
    }

    if ($null -eq $selected) {
        throw 'No OpenAI.Codex AppX manifest application declares executable app\ChatGPT.exe.'
    }

    $package = $selected.Package
    $packageFamilyName = [string]$package.PackageFamilyName
    if ([string]::IsNullOrWhiteSpace($packageFamilyName)) {
        throw 'The selected OpenAI.Codex package has no package family name.'
    }

    $aumid = $packageFamilyName + '!' + $selected.ApplicationId
    $executable = [IO.Path]::GetFullPath((
        Join-Path ([string]$package.InstallLocation) $selected.RelativeExecutable
    ))
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
        throw "The manifest executable does not exist: $executable"
    }

    if (-not ('WukongCodexForge.AppxActivation' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace WukongCodexForge {
    [Flags]
    internal enum ActivateOptions {
        None = 0x00000000,
        DesignMode = 0x00000001,
        NoErrorUI = 0x00000002,
        NoSplashScreen = 0x00000004
    }

    [ComImport]
    [Guid("2E941141-7F97-4756-BA1D-9DECDE894A3D")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IApplicationActivationManager {
        [PreserveSig]
        int ActivateApplication(
            [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
            [MarshalAs(UnmanagedType.LPWStr)] string arguments,
            ActivateOptions options,
            out uint processId
        );
    }

    [ComImport]
    [Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
    internal class ApplicationActivationManager {
    }

    public static class AppxActivation {
        public static int Activate(string appUserModelId, string arguments) {
            IApplicationActivationManager manager = null;
            try {
                manager = (IApplicationActivationManager)new ApplicationActivationManager();
                uint processId;
                int result = manager.ActivateApplication(
                    appUserModelId,
                    arguments,
                    ActivateOptions.None,
                    out processId
                );
                if (result < 0) Marshal.ThrowExceptionForHR(result);
                if (processId == 0) throw new InvalidOperationException(
                    "AppX activation returned an invalid process identifier."
                );
                return checked((int)processId);
            }
            finally {
                if (manager != null && Marshal.IsComObject(manager)) {
                    Marshal.FinalReleaseComObject(manager);
                }
            }
        }
    }
}
'@
    }

    $processId = [WukongCodexForge.AppxActivation]::Activate($aumid, $argumentLine)
    $result = [ordered]@{
        pid = $processId
        aumid = $aumid
        package = [string]$package.PackageFullName
        version = ([version]$package.Version).ToString()
        executable = $executable
    }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Compress))
    exit 0
}
catch {
    [Console]::Error.WriteLine(('activate-appx: ' + $_.Exception.Message))
    exit 1
}
