import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_PREFERENCES, FONT_SIZES, parseEditorPreferences, TAB_SIZES,
} from './editorPreferences';

describe('local-only Scarp editor preferences', () => {
  it('uses safe defaults when no settings are stored', () => {
    expect(parseEditorPreferences(null)).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(parseEditorPreferences('')).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it('restores valid persisted preferences', () => {
    expect(parseEditorPreferences(JSON.stringify({
      fontSize: 18, tabSize: 2, wordWrap: false,
    }))).toEqual({ fontSize: 18, tabSize: 2, wordWrap: false });
  });

  it('rejects unsupported sizes and non-boolean wrapping', () => {
    expect(parseEditorPreferences(JSON.stringify({
      fontSize: 1000000, tabSize: -1, wordWrap: 'false',
    }))).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(parseEditorPreferences(JSON.stringify({
      fontSize: '18', tabSize: 2.5, wordWrap: 0,
    }))).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it('preserves valid fields when another field is invalid or missing', () => {
    expect(parseEditorPreferences(JSON.stringify({ fontSize: 16, tabSize: '4' })))
      .toEqual({ fontSize: 16, tabSize: 4, wordWrap: true });
    expect(parseEditorPreferences(JSON.stringify({ wordWrap: false })))
      .toEqual({ fontSize: 14, tabSize: 4, wordWrap: false });
  });

  it('accepts only supported finite choices', () => {
    expect(FONT_SIZES).toEqual([12, 14, 16, 18, 20, 22, 24]);
    expect(TAB_SIZES).toEqual([2, 4, 8]);
    for (const size of FONT_SIZES) {
      expect(parseEditorPreferences(JSON.stringify({ fontSize: size })).fontSize).toBe(size);
    }
    for (const size of TAB_SIZES) {
      expect(parseEditorPreferences(JSON.stringify({ tabSize: size })).tabSize).toBe(size);
    }
  });

  it('rejects malformed JSON and primitive values', () => {
    for (const value of ['{bad json', 'null', '"text"', '5', 'true', '[]']) {
      expect(parseEditorPreferences(value)).toEqual(DEFAULT_EDITOR_PREFERENCES);
    }
  });

  it('ignores unrelated or sensitive values from storage', () => {
    const parsed = parseEditorPreferences(JSON.stringify({
      fontSize: 14, tabSize: 4, wordWrap: true,
      compilerPath: 'C:/unknown/scarp.exe',
    }));
    expect(parsed).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect('compilerPath' in parsed).toBe(false);
  });
});
