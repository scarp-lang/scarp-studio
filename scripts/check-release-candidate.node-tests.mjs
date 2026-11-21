import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkReleaseCandidate } from './check-release-candidate.mjs';

const roots = [];
const candidatePath = '.github/release-candidates/v0.0.2-alpha.1.json';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scarp-release-gate-'));
  roots.push(root);
  const write = (path, contents) => {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  };
  const json = (path, value) => write(path, JSON.stringify(value));
  const candidate = {
    version: '0.0.2-alpha.1', tag: 'v0.0.2-alpha.1', channel: 'prerelease',
    target: 'windows-x64', compilerCompatibilityVersion: '0.0.6-alpha.17',
    compilerWindowsZipSha256: 'fa05e57675799d881ebe33ccd54f6eb769825632904adf99cd08c940383134b5',
    manualWindowsAcceptanceRequired: true, publicationAuthorized: false,
  };
  json(candidatePath, candidate);
  json('package.json', { version: candidate.version });
  json('package-lock.json', {
    version: candidate.version, packages: { '': { version: candidate.version } },
  });
  json('src-tauri/tauri.conf.json', { version: candidate.version });
  write('src-tauri/Cargo.toml', '[package]\nname = "scarp-studio"\nversion = "0.0.2-alpha.1"\n[dependencies]\nversion = "9.9.9"\n');
  write('src-tauri/Cargo.lock',
    '[[package]]\nname = "other"\nversion = "9.9.9"\n\n[[package]]\nname = "scarp-studio"\nversion = "0.0.2-alpha.1"\n\n[[package]]\nname = "next"\nversion = "1.0.0"\n');
  return { root, write, json, candidate };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('read-only Scarp Studio prerelease gate', () => {
  it('accepts six consistent version fields without publishing', () => {
    const { root } = fixture();
    assert.deepEqual(checkReleaseCandidate(root), {
      version: '0.0.2-alpha.1',
      tag: 'v0.0.2-alpha.1',
      compilerVersion: '0.0.6-alpha.17',
    });
  });

  it('rejects each independently mismatched version field', () => {
    const fields = [
      (f) => f.json('package.json', { version: '0.0.1-alpha.2' }),
      (f) => f.json('package-lock.json', {
        version: '0.0.1-alpha.2', packages: { '': { version: '0.0.2-alpha.1' } },
      }),
      (f) => f.json('package-lock.json', {
        version: '0.0.2-alpha.1', packages: { '': { version: '0.0.1-alpha.2' } },
      }),
      (f) => f.json('src-tauri/tauri.conf.json', { version: '0.0.1-alpha.2' }),
      (f) => f.write('src-tauri/Cargo.toml', '[package]\nversion = "0.0.1-alpha.2"\n'),
      (f) => f.write('src-tauri/Cargo.lock',
        '[[package]]\nname = "scarp-studio"\nversion = "0.0.1-alpha.2"\n'),
    ];
    for (const mutate of fields) {
      const f = fixture();
      mutate(f);
      assert.throws(() => checkReleaseCandidate(f.root), /version locations; mismatches/);
    }
  });

  it('requires the review-only manifest to keep publication authorization false', () => {
    const f = fixture();
    f.json(candidatePath, { ...f.candidate, publicationAuthorized: true });
    assert.throws(() => checkReleaseCandidate(f.root), /publication-enabled/);
  });

  it('rejects an unsafe tag, missing GUI acceptance gate or invalid compiler digest', () => {
    for (const patch of [
      { tag: 'v0.0.2-alpha.2' },
      { manualWindowsAcceptanceRequired: false },
      { compilerWindowsZipSha256: 'not-a-sha256' },
      { compilerWindowsZipSha256: 'b'.repeat(64) },
      { compilerCompatibilityVersion: '0.0.6-alpha.15' },
    ]) {
      const f = fixture();
      f.json(candidatePath, { ...f.candidate, ...patch });
      assert.throws(() => checkReleaseCandidate(f.root), /Invalid or publication-enabled/);
    }
  });

  it('reads Cargo sections precisely, not a similarly named dependency', () => {
    const f = fixture();
    const old = readFileSync(join(f.root, 'src-tauri/Cargo.lock'), 'utf8');
    f.write('src-tauri/Cargo.lock', old.replace(
      'name = "scarp-studio"\nversion = "0.0.2-alpha.1"',
      'name = "scarp-studio"\nversion = "0.0.1-alpha.2"',
    ));
    assert.throws(() => checkReleaseCandidate(f.root), /Cargo.lock scarp-studio/);
  });
});
