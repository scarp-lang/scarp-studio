import { describe, expect, it } from 'vitest';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults, INTELLISENSE_PRESETS } from './intelliSensePreferences';
import {
  MAX_PROFILE_TRANSFER_UNITS, exportIntelliSenseProfile, importIntelliSenseProfile,
  strictIntelliSensePreferences, diffIntelliSensePreferences, reviewIntelliSenseProfile, isCurrentProfileReview,
} from './intelliSenseProfileTransfer';

describe('portable IntelliSense configuration', () => {
  it('round-trips every preset and only allowlisted fields', () => {
    for (const preset of Object.values(INTELLISENSE_PRESETS)) {
      const raw = exportIntelliSenseProfile({ ...preset, compilerPath: 'C:/secret.exe' } as typeof defaults);
      expect(raw).not.toContain('secret');
      expect(importIntelliSenseProfile(raw)).toEqual({ ok: true, value: preset });
      expect(Object.keys(JSON.parse(raw))).toEqual(['format', 'version', 'preferences']);
    }
  });
  it('rejects unsupported envelopes and versions', () => {
    const valid = JSON.parse(exportIntelliSenseProfile(defaults));
    for (const data of [null, [], 1, {}, { ...valid, version: 4 }, { ...valid, version: '1' },
      { ...valid, format: 'other' }, { ...valid, source: 'private' }, { ...valid, preferences: [] }]) {
      expect(importIntelliSenseProfile(JSON.stringify(data)).ok).toBe(false);
    }
    for (const raw of ['', ' ', '{', ' '.repeat(MAX_PROFILE_TRANSFER_UNITS) + '{}']) {
      expect(importIntelliSenseProfile(raw).ok).toBe(false);
    }
  });
  it('fails closed for missing, extra and wrongly typed preferences', () => {
    const { hover: _hover, ...missing } = defaults;
    for (const data of [missing, { ...defaults, unknown: 1 }, { ...defaults, hover: 'false' },
      { ...defaults, localAnalysisKiB: 1024 }, { ...defaults, completionMode: 'bogus' },
      { ...defaults, suggestionDelay: null }, JSON.parse(JSON.stringify(defaults).replace(/}$/, ',"__proto__":{}}'))]) {
      expect(strictIntelliSensePreferences(data).ok).toBe(false);
    }
    expect(strictIntelliSensePreferences({ ...defaults, hover: false }).ok).toBe(true);
  });
  it('generates deterministic, human-readable differences', () => {
    const changes = diffIntelliSensePreferences(defaults, { ...defaults, hover: false, suggestionDelay: 500, localAnalysisKiB: 64 });
    expect(changes).toEqual([
      { key: 'suggestionDelay', label: 'Automatic delay', before: '100 ms', after: '500 ms' },
      { key: 'hover', label: 'Hover documentation', before: 'On', after: 'Off' },
      { key: 'localAnalysisKiB', label: 'Local analysis budget', before: '512 Ki UTF-16 units', after: '64 Ki UTF-16 units' },
    ]);
    expect(diffIntelliSensePreferences(defaults, defaults)).toEqual([]);
  });
  it('captures immutable reviews and detects changed active preferences', () => {
    const target = { ...defaults, hover: false };
    const review = reviewIntelliSenseProfile(defaults, target);
    target.hover = true;
    expect(review.target.hover).toBe(false);
    expect(Object.isFrozen(review.target)).toBe(true);
    expect(Object.isFrozen(review.changes[0])).toBe(true);
    expect(isCurrentProfileReview(review, defaults)).toBe(true);
    expect(isCurrentProfileReview(review, { ...defaults, templates: false })).toBe(false);
  });
});


describe('ambiguous configuration rejection', () => {
  it('rejects duplicate literal and escaped keys, even when values agree', () => {
    const raw = exportIntelliSenseProfile(defaults);
    expect(importIntelliSenseProfile(raw.replace('"version": 3', '"version": 3, "version": 3')).ok).toBe(false);
    expect(importIntelliSenseProfile(raw.replace('"hover": true', '"hover": false, "\\u0068over": true')).ok).toBe(false);
    expect(importIntelliSenseProfile(raw.replace('"hover": true', '"hover": true, "hover": true')).ok).toBe(false);
  });
  it('rejects excessively nested input without recursive parser failure', () => {
    expect(importIntelliSenseProfile('['.repeat(100) + '0' + ']'.repeat(100)).ok).toBe(false);
  });
});


describe('v1 portable profile migration', () => {
  it('preserves every old field and supplies only the new defaults', () => {
    const { matchingMode: _matching, conservativeCatalog: _context, builtinSignatureHelp: _builtin, inlayHintMode: _mode, inlayBuiltins: _inlay, ...legacy } = { ...defaults, hover: false };
    const raw = JSON.stringify({ format: 'scarp-studio.intellisense', version: 1, preferences: legacy });
    expect(importIntelliSenseProfile(raw)).toEqual({ ok: true, value: { ...defaults, hover: false } });
    expect(importIntelliSenseProfile(JSON.stringify({ format: 'scarp-studio.intellisense', version: 2, preferences: legacy })).ok).toBe(false);
    expect(importIntelliSenseProfile(JSON.stringify({ format: 'scarp-studio.intellisense', version: 1, preferences: { ...legacy, matchingMode: 'prefix' } })).ok).toBe(false);
  });
});


describe('v2 profile migration for inline hints', () => {
  it('preserves old choices with opt-in inline hints disabled', () => {
    const { inlayHintMode: _mode, inlayBuiltins: _builtin, ...legacy } = { ...defaults, matchingMode: 'subsequence' as const };
    const record = { format: 'scarp-studio.intellisense', version: 2, preferences: legacy };
    expect(importIntelliSenseProfile(JSON.stringify(record))).toEqual({
      ok: true, value: { ...defaults, matchingMode: 'subsequence' },
    });
    expect(importIntelliSenseProfile(JSON.stringify({ ...record, version: 3 })).ok).toBe(false);
    expect(importIntelliSenseProfile(exportIntelliSenseProfile({ ...defaults, inlayHintMode: 'literals', inlayBuiltins: false }))).toEqual({
      ok: true, value: { ...defaults, inlayHintMode: 'literals', inlayBuiltins: false },
    });
  });
});
