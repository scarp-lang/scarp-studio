#requires -Version 5.1
<#
.SYNOPSIS
  Verify a Windows Scarp Studio development candidate without running it.
.DESCRIPTION
  Reads SHA256SUMS.txt from a small, dedicated folder containing artifacts
  extracted from ONE exact GitHub Actions workflow run. Requires exactly
  three files in total: one unbundled scarp-studio.exe, one *-setup.exe and
  one checksum manifest; rejects all unverified extra files. Does not
  download, install or execute any binary.

  SourceCommit and RunUrl label the evidence; they cannot independently prove
  GitHub provenance. Confirm they match the successful exact-head run in the
  repository UI, then download both artifacts from that single run.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ArtifactDirectory,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{40}$')]
  [string]$SourceCommit,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://github\.com/scarp-lang/scarp-studio/actions/runs/[0-9]+$')]
  [string]$RunUrl,

  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ArtifactDirectory -PathType Container)) {
  throw 'ArtifactDirectory must be an existing, dedicated folder.'
}
$root = (Resolve-Path -LiteralPath $ArtifactDirectory).ProviderPath
$allFiles = @(Get-ChildItem -LiteralPath $root -File -Recurse -ErrorAction Stop)
if ($allFiles.Count -gt 5000) {
  throw 'Artifact folder contains too many files. Use a dedicated, empty extraction folder.'
}
# The trial folder must not contain an unverified third executable, DLL,
# stale installer, or any other file from a different build. Hashing only
# known names while ignoring extras gives misleading "verified" output.
# Both GitHub Actions artifact ZIPs together yield exactly these three files.
if ($allFiles.Count -ne 3) {
  throw 'Expected exactly three candidate files (scarp-studio.exe, one NSIS *-setup.exe and SHA256SUMS.txt). Remove unexpected or mixed-run files.'
}
$manifests = @($allFiles | Where-Object { $_.Name -ceq 'SHA256SUMS.txt' })
if ($manifests.Count -ne 1) {
  throw 'Expected exactly one SHA256SUMS.txt from the exact Windows CI run.'
}

$lines = @(Get-Content -LiteralPath $manifests[0].FullName | Where-Object { $_.Trim().Length -gt 0 })
if ($lines.Count -ne 2) {
  throw 'Expected exactly two checksum manifest entries (exe and NSIS installer).'
}

$expected = @{}
$pattern = '^(?<hash>[0-9A-Fa-f]{64}) \*(?<filename>[^\\/:*?"<>|]+\.exe)$'
foreach ($line in $lines) {
  $match = [regex]::Match($line, $pattern)
  if (-not $match.Success) {
    throw 'Invalid SHA256SUMS entry. Only 64-digit SHA-256 hashes and bare .exe names are allowed.'
  }
  $name = $match.Groups['filename'].Value
  if ($expected.ContainsKey($name)) {
    throw 'The checksum manifest contains duplicate filenames.'
  }
  $expected[$name] = $match.Groups['hash'].Value.ToLowerInvariant()
}

if (-not $expected.ContainsKey('scarp-studio.exe')) {
  throw 'Unbundled scarp-studio.exe checksum is missing.'
}
$installerNames = @($expected.Keys | Where-Object { $_ -imatch '-setup\.exe$' })
if ($installerNames.Count -ne 1) {
  throw 'Expected exactly one NSIS *-setup.exe checksum.'
}

$verified = @()
foreach ($name in @('scarp-studio.exe', $installerNames[0])) {
  $candidates = @($allFiles | Where-Object { $_.Name -ieq $name })
  if ($candidates.Count -ne 1) {
    throw "Expected exactly one extracted artifact named $name; found $($candidates.Count)."
  }
  $file = $candidates[0]
  $actual = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -cne $expected[$name]) {
    throw "SHA-256 mismatch for $name. Do not run or install the candidate."
  }
  $verified += [pscustomobject]@{
    file = $name
    sha256 = $actual
    full_path = $file.FullName
    size_bytes = $file.Length
  }
}

$report = [pscustomobject]@{
  verified = $true
  source_commit = $SourceCommit.ToLowerInvariant()
  ci_run = $RunUrl
  checked_at_utc = [DateTime]::UtcNow.ToString('o')
  files = $verified
  note = 'Checksums match the supplied manifest; verify the manifest and commit came from the same trusted CI run. No binaries executed.'
}

if ($AsJson) {
  $report | ConvertTo-Json -Depth 6
} else {
  Write-Output "Verified $($verified.Count) Windows candidate files against SHA256SUMS.txt."
  foreach ($file in $verified) { Write-Output "$($file.sha256)  $($file.file)" }
  Write-Output "Source commit (user-supplied): $($report.source_commit)"
  Write-Output "CI run (user-supplied): $($report.ci_run)"
  Write-Output $report.note
}
