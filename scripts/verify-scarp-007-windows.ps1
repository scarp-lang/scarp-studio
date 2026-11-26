#requires -Version 7.0
<#
.SYNOPSIS
  Qualify the exact published Scarp 0.0.7 Windows interpreter releases.
.DESCRIPTION
  Only known SHA-256-pinned official archives are used. This script is
  intended for a disposable Windows CI checkout, not an installation
  workflow. It does not execute native objects or publish Studio.
#>
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$pins = @(
  @{ Version = '0.0.7-alpha.1'; Sha256 = '371eeabd1b35e9e3530ce44f13d90f376972b0650df9d41ce79a41c814875924' },
  @{ Version = '0.0.7-alpha.2'; Sha256 = '5cddf9d831d6eb487b2142755b36b48f1cc598d8f6cfbca39332219fd2567849' }
)
$repo = Split-Path -Parent $PSScriptRoot
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('scarp-studio-007-' + [Guid]::NewGuid().ToString('N'))
$previousBin = [Environment]::GetEnvironmentVariable('SCARP_TEST_BIN', 'Process')
$previousVersion = [Environment]::GetEnvironmentVariable('SCARP_TEST_EXPECTED_VERSION', 'Process')
New-Item -ItemType Directory -Path $stage | Out-Null
Push-Location -LiteralPath $repo
try {
  foreach ($pin in $pins) {
    $version = $pin.Version
    $asset = "scarp-$version-x86_64-pc-windows-msvc.zip"
    $archive = Join-Path $stage $asset
    $destination = Join-Path $stage $version
    $url = "https://github.com/scarp-lang/scarp/releases/download/v$version/$asset"
    Write-Host "Qualifying Scarp $version using pinned official archive"
    Invoke-WebRequest -Uri $url -OutFile $archive -TimeoutSec 120
    $digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($digest -cne $pin.Sha256) { throw "Scarp $version archive SHA-256 mismatch" }
    Expand-Archive -LiteralPath $archive -DestinationPath $destination
    $binaries = @(Get-ChildItem -LiteralPath $destination -File -Recurse -Filter 'scarp.exe')
    if ($binaries.Count -ne 1) { throw "Expected exactly one Scarp $version executable" }
    $binary = $binaries[0].FullName
    $observed = (& $binary --version | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $observed -cne "scarp $version") { throw "Unexpected compiler version: $observed" }
    foreach ($command in @('exec', 'verify')) {
      $guide = (& $binary guide $command | Out-String).Trim()
      if ($LASTEXITCODE -ne 0 -or -not $guide.StartsWith("Usage: scarp $command", [StringComparison]::Ordinal)) {
        throw "Scarp $version changed the $command guide contract"
      }
    }
    & ./scripts/verify-windows-qa.ps1 -CompilerPath $binary -ExpectedVersion $version
    if ($LASTEXITCODE -ne 0) { throw "Scarp $version QA fixture checks failed" }

    $env:SCARP_TEST_BIN = $binary
    $env:SCARP_TEST_EXPECTED_VERSION = $version
    foreach ($test in @(
      'compiler::tests::official_compiler_runs_through_native_service',
      'compiler_discovery::tests::discovers_pinned_official_compiler_from_extracted_archive'
    )) {
      cargo test --locked --manifest-path src-tauri/Cargo.toml --lib -- --ignored --exact $test --nocapture
      if ($LASTEXITCODE -ne 0) { throw "Scarp $version failed $test" }
    }
    Write-Host "PASS: Scarp $version interpreter and native Studio compatibility"
  }
} finally {
  [Environment]::SetEnvironmentVariable('SCARP_TEST_BIN', $previousBin, 'Process')
  [Environment]::SetEnvironmentVariable('SCARP_TEST_EXPECTED_VERSION', $previousVersion, 'Process')
  Pop-Location
  Remove-Item -LiteralPath $stage -Recurse -Force
}
$global:LASTEXITCODE = 0
