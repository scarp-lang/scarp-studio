// Offline, read-only candidate gate. No network calls, Git tags or releases.
// Run from any directory: node scripts/check-release-candidate.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const descriptor = '.github/release-candidates/v0.0.2-alpha.1.json';

function readJson(root, path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function versionFromPackageToml(source) {
  let inPackage = false;
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) {
      inPackage = line.trim() === '[package]';
      continue;
    }
    if (inPackage) {
      const match = /^\s*version\s*=\s*"([^"]+)"\s*(?:#.*)?$/.exec(line);
      if (match) return match[1];
    }
  }
  return null;
}

function versionFromCargoLock(source) {
  const sections = source.split(/(?=^\[\[package\]\][ \t]*$)/m);
  const block = sections.find((section) => /^\[\[package\]\]/.test(section) &&
    /^\s*name\s*=\s*"scarp-studio"\s*$/m.test(section));
  return block?.match(/^\s*version\s*=\s*"([^"]+)"\s*$/m)?.[1] ?? null;
}

/** Fail closed if ANY of the six application/native version values disagrees.
 * This checks a proposed source checkout only; it never authorizes release.
 */
export function checkReleaseCandidate(root = defaultRoot) {
  const candidate = readJson(root, descriptor);
  const version = candidate?.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+-alpha\.\d+$/.test(version) ||
      candidate.tag !== 'v' + version ||
      candidate.channel !== 'prerelease' ||
      candidate.target !== 'windows-x64' ||
      candidate.manualWindowsAcceptanceRequired !== true ||
      candidate.publicationAuthorized !== false ||
      candidate.compilerCompatibilityVersion !== '0.0.6-alpha.18' ||
      candidate.compilerWindowsZipSha256 !== '1dbd8e9f6dbb3e727fb765b5a1bf184f8574c8b139289269b65a7d889d60e6b0') {
    throw new Error('Invalid or publication-enabled alpha.1 release-candidate descriptor.');
  }

  const pkg = readJson(root, 'package.json');
  const npmLock = readJson(root, 'package-lock.json');
  const tauri = readJson(root, 'src-tauri/tauri.conf.json');
  const cargo = readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8');
  const cargoLock = readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8');

  const actual = {
    'package.json': pkg.version,
    'package-lock.json': npmLock.version,
    'package-lock.json root package': npmLock.packages?.['']?.version,
    'Tauri config': tauri.version,
    'Cargo.toml [package]': versionFromPackageToml(cargo),
    'Cargo.lock scarp-studio': versionFromCargoLock(cargoLock),
  };
  const mismatches = Object.entries(actual)
    .filter(([, observed]) => observed !== version)
    .map(([label, observed]) => label + ': ' + String(observed));
  if (mismatches.length) {
    throw new Error('Expected ' + version +
      ' in all six version locations; mismatches:\n' + mismatches.join('\n'));
  }
  return { version, tag: candidate.tag, compilerVersion: candidate.compilerCompatibilityVersion };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const candidate = checkReleaseCandidate();
    process.stdout.write('PASS (unreleased candidate only): ' + candidate.tag +
      ', Windows x64, Scarp ' + candidate.compilerVersion + '\n');
    process.stdout.write('Manual GUI acceptance and owner authorization still required.\n');
  } catch (error) {
    process.stderr.write('Release candidate check FAILED: ' +
      (error instanceof Error ? error.message : String(error)) + '\n');
    process.exitCode = 1;
  }
}
