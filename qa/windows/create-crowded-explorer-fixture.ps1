#requires -Version 5.1
<#
 Create a disposable Scarp Studio Windows Explorer stress fixture for P34.
 The destination MUST NOT EXIST and its parent must already exist.
 This script never deletes, overwrites or executes a Scarp compiler.
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
  throw 'P34 fixture destination already exists. Choose a new disposable path.'
}
$parent = Split-Path -Path $root -Parent
if (-not $parent -or -not (Test-Path -LiteralPath $parent -PathType Container)) {
  throw 'P34 fixture parent must be an existing directory.'
}
if (-not $PSCmdlet.ShouldProcess($root, 'Create disposable Scarp Studio P34 project')) {
  return
}
[void](New-Item -ItemType Directory -Path $root -ErrorAction Stop)
foreach ($name in @('src', 'tests', 'examples')) {
  [void](New-Item -ItemType Directory -Path (Join-Path $root $name) -ErrorAction Stop)
}
$utf8 = [Text.UTF8Encoding]::new($false)
$content = 'print("SCARP_STUDIO_P34_FIXTURE");' + [Environment]::NewLine
for ($i = 0; $i -lt 200; $i++) {
  [IO.File]::WriteAllText(
    (Join-Path $root ('root-{0:D3}.srp' -f $i)), $content, $utf8)
}
$src = Join-Path $root 'src'
for ($i = 0; $i -lt 225; $i++) {
  [IO.File]::WriteAllText(
    (Join-Path $src ('a-{0:D3}.srp' -f $i)), $content, $utf8)
}
[IO.File]::WriteAllText(
  (Join-Path $src 'main.srp'),
  ('print("SCARP_STUDIO_P34_MAIN");' + [Environment]::NewLine), $utf8)
[IO.File]::WriteAllText(
  (Join-Path (Join-Path $root 'tests') 'smoke.srp'), $content, $utf8)
[IO.File]::WriteAllText(
  (Join-Path (Join-Path $root 'examples') 'demo.srp'), $content, $utf8)
Write-Output ('Created P34 test project: ' + $root +
  ' (200 root, 226 src, 1 tests and 1 examples files)')
