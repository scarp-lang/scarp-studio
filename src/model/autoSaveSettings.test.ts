import { describe, expect, it } from 'vitest';
import { canAutoSave, DEFAULT_AUTO_SAVE, parseAutoSavePreferences } from './autoSaveSettings';
import type { StudioDocument } from './documents';

const source: StudioDocument = {
  id: 'file-main', name: 'main.srp', path: 'C:/examples/main.srp',
  content: 'print("latest");', savedContent: 'print("old");', revision: 2,
};

describe('full IDE Auto Save preference safety', () => {
  it('keeps Auto Save off until the user enables it', () => {
    expect(parseAutoSavePreferences(null)).toEqual(DEFAULT_AUTO_SAVE);
    for (const invalid of ['{', 'null', '[]', '"true"', '{"enabled":"true","delay":0}']) {
      expect(parseAutoSavePreferences(invalid).enabled).toBe(false);
    }
  });

  it('permits only supported idle delays', () => {
    for (const delay of [1000, 3000, 5000] as const) {
      expect(parseAutoSavePreferences(JSON.stringify({ enabled: true, delay })))
        .toEqual({ enabled: true, delay });
    }
    expect(parseAutoSavePreferences('{"enabled":true,"delay":1}'))
      .toEqual({ enabled: true, delay: 3000 });
    expect(parseAutoSavePreferences('{"enabled":true,"delay":-1}').delay).toBe(3000);
  });

  it('only attempts named, dirty, Scarp source files', () => {
    expect(canAutoSave(source)).toBe(true);
    expect(canAutoSave({ ...source, path: null })).toBe(false);
    expect(canAutoSave({ ...source, path: 'C:/examples/data.txt' })).toBe(false);
    expect(canAutoSave({ ...source, savedContent: source.content })).toBe(false);
    expect(canAutoSave({ ...source, path: 'C:/EXAMPLES/MAIN.SRP' })).toBe(true);
  });
});
