#requires -Version 5.1
<#
  Creates a safe disposable nested Scarp Studio workspace for P40.
  The parent folder MUST exist and the destination MUST NOT exist.
  No files are deleted, overwritten or executed.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Destination
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $root) {
  throw 'P40 destination already exists. Choose a fresh disposable path.'
}
$parent = Split-Path -Path $root -Parent
if (-not $parent -or -not (Test-Path -LiteralPath $parent -PathType Container)) {
  throw 'P40 destination parent must exist before generating the fixture.'
}
if (-not $PSCmdlet.ShouldProcess($root, 'Create disposable nested Scarp practice workspace')) {
  return
}
[void](New-Item -ItemType Directory -Path $root -ErrorAction Stop)
$folders = @(
  'basic_tuple', 'basic_tuple\examples', 'basic_tuple\src',
  'conditions', 'loops', 'empty_project'
)
foreach ($folder in $folders) {
  [void](New-Item -ItemType Directory -Path (Join-Path $root $folder) -Force -ErrorAction Stop)
}
$utf8 = [Text.UTF8Encoding]::new($false)
$sources = [ordered]@{
  'basic_tuple\main.srp' = 'print("STUDIO_P40_TUPLE_EDIT_ME");'
  'basic_tuple\examples\tuple.srp' = 'print("STUDIO_P40_NESTED_EXAMPLE");'
  'basic_tuple\src\helper.srp' = 'print("STUDIO_P40_NESTED_HELPER");'
  'conditions\if.srp' = 'print("STUDIO_P40_CONDITIONS");'
  'loops\main.srp' = 'print("STUDIO_P40_LOOPS");'
}
foreach ($relative in $sources.Keys) {
  [IO.File]::WriteAllText(
    (Join-Path $root $relative),
    ($sources[$relative] + [Environment]::NewLine), $utf8)
}
Write-Output ('Created Scarp Studio P40 workspace at: ' + $root)
Write-Output ('Open this parent folder in Scarp Studio, not just basic_tuple.')
Write-Output ('Expected: 6 directories, 5 .srp files, and 2 distinct main.srp tabs.')
Write-Output ('Try editing basic_tuple\main.srp, saving via Ctrl+S and confirming the disk text changed.')
