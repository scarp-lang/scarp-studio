import { describe, expect, it } from 'vitest';
import { DEFAULT_COMPILER_PREFERENCES, MAX_COMPILER_PREFERENCES_UNITS,
  parseCompilerPreferences, serializeCompilerPreferences } from './compilerPreferences';

describe('compiler discovery preferences', () => {
  it('defaults to startup discovery and preserves an opt-out', () => {
    expect(parseCompilerPreferences(null)).toEqual(DEFAULT_COMPILER_PREFERENCES);
    expect(parseCompilerPreferences('{"scanOnStartup":false}')).toEqual({ scanOnStartup: false });
    expect(parseCompilerPreferences('{"scanOnStartup":true}')).toEqual({ scanOnStartup: true });
  });
  it('rejects malformed, oversized and incorrectly typed records', () => {
    for (const raw of ['[]', 'null', 'true', '{', '{"scanOnStartup":"false"}', '{"scanOnStartup":0}',
      ' '.repeat(MAX_COMPILER_PREFERENCES_UNITS) + '{"scanOnStartup":false}']) {
      expect(parseCompilerPreferences(raw)).toEqual(DEFAULT_COMPILER_PREFERENCES);
    }
  });
  it('never loads or serializes executable paths or trust', () => {
    const input = { scanOnStartup: false, compilerPath: 'C:/unknown/scarp.exe', approved: true };
    expect(parseCompilerPreferences(JSON.stringify(input))).toEqual({ scanOnStartup: false });
    expect(serializeCompilerPreferences(input)).toBe('{"scanOnStartup":false}');
    expect(parseCompilerPreferences(serializeCompilerPreferences(input))).toEqual({ scanOnStartup: false });
  });
  it('returns fresh defaults', () => {
    const settings = parseCompilerPreferences(null);
    settings.scanOnStartup = false;
    expect(parseCompilerPreferences(null).scanOnStartup).toBe(true);
  });
});
