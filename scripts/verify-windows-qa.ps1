#requires -Version 7.0
<#
.SYNOPSIS
  Exercise checked-in Scarp Studio Windows manual-QA source fixtures with an
  independently trusted official Scarp alpha.17, alpha.18, alpha.19 or alpha.20 compiler.
.DESCRIPTION
  Source-only and non-interactive. The test of input_boolean uses a supplied
  local stdin fixture and never reads personal data or launches Studio.
  This is compiler compatibility evidence, NOT a Windows GUI acceptance pass.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$CompilerPath,
  [ValidateSet('0.0.6-alpha.17', '0.0.6-alpha.18', '0.0.6-alpha.19', '0.0.6-alpha.20')]
  [string]$ExpectedVersion = '0.0.6-alpha.20'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# PowerShell's native-command error preference varies by release. Explicitly
# capture the CLI exit status so a deliberate expected Verify error can pass.
$PSNativeCommandUseErrorActionPreference = $false

if (-not (Test-Path -LiteralPath $CompilerPath -PathType Leaf)) {
  throw "Scarp compiler executable not found: $CompilerPath"
}

$actualVersion = (& $CompilerPath --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $actualVersion -ne "scarp $ExpectedVersion") {
  throw "Windows QA requires the separately validated official Scarp $ExpectedVersion CLI, got: $actualVersion"
}

function Assert-ScarpCommand {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string[]]$Arguments,
    [Parameter(Mandatory=$true)][int]$ExpectedExitCode,
    [string]$ExpectedMarker
  )
  Write-Host "SCARP QA: $Name"
  $captured = @(& $CompilerPath @Arguments 2>&1 | ForEach-Object { $_.ToString() })
  $exitCode = $LASTEXITCODE
  $output = ($captured -join [Environment]::NewLine).Trim()
  if ($exitCode -ne $ExpectedExitCode) {
    throw "Scarp QA ${Name}: expected exit $ExpectedExitCode, got $exitCode. Output: $output"
  }
  if ($ExpectedMarker -and $output -notmatch [regex]::Escape($ExpectedMarker)) {
    throw "Scarp QA ${Name}: expected output marker '$ExpectedMarker', got: $output"
  }
  Write-Host "SCARP QA PASS: $Name"
  return $output
}

foreach ($fixture in @(
  @{ Path = 'qa/windows/01-run-square.srp'; Marker = 'SCARP_STUDIO_GUI_RUN_OK' },
  @{ Path = 'qa/windows/02-fixed-array.srp'; Marker = 'SCARP_STUDIO_GUI_ARRAY_OK' },
  @{ Path = 'qa/windows/06-while-control.srp'; Marker = 'SCARP_STUDIO_GUI_WHILE_OK' },
  @{ Path = 'qa/windows/07-nested-loop.srp'; Marker = 'SCARP_STUDIO_GUI_NESTED_LOOP_OK' },
  @{ Path = 'qa/windows/08-declaration-outline.srp'; Marker = 'SCARP_STUDIO_GUI_DECLARATION_OK' }
)) {
  $source = $fixture.Path
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing QA fixture: $source" }
  [void](Assert-ScarpCommand -Name "Verify $source" -Arguments @(
    'verify', '--diagnostic-format=json', '--', $source
  ) -ExpectedExitCode 0)
  $ran = Assert-ScarpCommand -Name "Run $source" -Arguments @(
    'exec', '--diagnostic-format=json', '--', $source
  ) -ExpectedExitCode 0 -ExpectedMarker $fixture.Marker
  if ($ran -ne $fixture.Marker) {
    throw "Scarp QA Run $source produced additional unexpected output: $ran"
  }
}

if ($ExpectedVersion -in @('0.0.6-alpha.18', '0.0.6-alpha.19', '0.0.6-alpha.20')) {
  $source = 'qa/windows/05-array-update.srp'
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing QA fixture: $source" }
  [void](Assert-ScarpCommand -Name "Verify $source" -Arguments @(
    'verify', '--diagnostic-format=json', '--', $source
  ) -ExpectedExitCode 0)
  $ran = Assert-ScarpCommand -Name "Run $source" -Arguments @(
    'exec', '--diagnostic-format=json', '--', $source
  ) -ExpectedExitCode 0 -ExpectedMarker 'SCARP_STUDIO_GUI_ARRAY_UPDATE_OK'
  if ($ran -ne 'SCARP_STUDIO_GUI_ARRAY_UPDATE_OK') {
    throw "Scarp QA Run $source produced additional unexpected output: $ran"
  }
}

$booleanSource = 'qa/windows/03-boolean-input.srp'
$booleanInput = 'qa/windows/03-boolean-input.stdin'
if (-not (Test-Path -LiteralPath $booleanInput -PathType Leaf)) {
  throw "Missing preloaded boolean stdin fixture: $booleanInput"
}
[void](Assert-ScarpCommand -Name 'Verify boolean input' -Arguments @(
  'verify', '--diagnostic-format=json', '--', $booleanSource
) -ExpectedExitCode 0)
[void](Assert-ScarpCommand -Name 'Run preloaded boolean input' -Arguments @(
  'exec', '--interactive', '--input-file', $booleanInput, '--', $booleanSource
) -ExpectedExitCode 0 -ExpectedMarker 'SCARP_STUDIO_GUI_BOOLEAN_OK')

$invalid = 'qa/windows/04-invalid-diagnostic.srp'
Write-Host "SCARP QA: Expected Verify failure $invalid"
$diagnostics = @(& $CompilerPath verify --diagnostic-format=json -- $invalid 2>&1 |
  ForEach-Object { $_.ToString() })
$failureStatus = $LASTEXITCODE
if ($failureStatus -eq 0 -or $diagnostics.Count -eq 0) {
  throw "Expected a nonzero Verify exit and at least one JSON diagnostic from $invalid"
}
try {
  $parsedDiagnostic = $diagnostics[0] | ConvertFrom-Json -ErrorAction Stop
} catch {
  throw "Scarp QA invalid-source Verify did not return JSON. Exit=$failureStatus; Output=$($diagnostics -join '; ')"
}
if ($parsedDiagnostic.schema_version -ne 1 -or $parsedDiagnostic.severity -ne 'error') {
  throw "Scarp QA invalid-source diagnostic was not a JSON v1 error: $($diagnostics[0])"
}
Write-Host 'SCARP QA PASS: Expected JSON diagnostic on invalid source'
# GitHub Actions pwsh invokes this script inside a wrapper that exits with
# LASTEXITCODE. Our last native command is *intentionally* a failing Verify.
# Clear only that expected status after its JSON error has been validated;
# unexpected failure above still throws and fails the workflow.
$global:LASTEXITCODE = 0
Write-Host "All checked-in Scarp $ExpectedVersion CLI smoke fixtures passed. Windows GUI acceptance is still required."
