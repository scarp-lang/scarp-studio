import { describe, expect, it, vi, afterEach } from 'vitest';
import { createUntitled, markSaved, updateContent } from './documents';
import {
  canAutoSave, defaultStudioSettings, normalizeStudioSettings,
  loadStudioSettings, storeStudioSettings, SETTINGS_STORAGE_KEY,
} from './studioSettings';

describe('Studio settings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses conservative defaults for invalid or missing settings', () => {
    expect(normalizeStudioSettings(null)).toEqual(defaultStudioSettings);
    expect(normalizeStudioSettings('wrong')).toEqual(defaultStudioSettings);
    expect(normalizeStudioSettings({ autoSave: 'yes', autoSaveDelay: -5000,
      theme: 'blue', fontSize: 400, minimap: 'true', wordWrap: null }))
      .toEqual(defaultStudioSettings);
  });

  it('retains valid choices and rejects unsafe timing values', () => {
    expect(normalizeStudioSettings({
      theme: 'light', autoSave: true, autoSaveDelay: 1000,
      fontSize: 18, wordWrap: false, minimap: true,
    })).toEqual({
      theme: 'light', autoSave: true, autoSaveDelay: 1000,
      fontSize: 18, wordWrap: false, minimap: true,
    });
    expect(normalizeStudioSettings({ autoSave: true, autoSaveDelay: 0 }).autoSaveDelay)
      .toBe(3000);
  });

  it('migrates the editor-only theme without enabling Auto Save', () => {
    const getItem = vi.fn((key: string) => key === 'studio.theme' ? 'light' : null);
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });
    expect(loadStudioSettings()).toMatchObject({ theme: 'light', autoSave: false });
  });

  it('handles corrupt saved preferences and blocked browser storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{invalid', setItem: () => { throw Error('denied'); } });
    expect(loadStudioSettings()).toEqual(defaultStudioSettings);
    expect(() => storeStudioSettings(defaultStudioSettings)).not.toThrow();
  });

  it('loads and persists current preferences', () => {
    const current = { ...defaultStudioSettings, autoSave: true, fontSize: 16 as const };
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === SETTINGS_STORAGE_KEY ? JSON.stringify(current) : null,
      setItem,
    });
    expect(loadStudioSettings()).toEqual(current);
    storeStudioSettings(current);
    expect(setItem).toHaveBeenCalledWith(SETTINGS_STORAGE_KEY, JSON.stringify(current));
  });
});

describe('safe Auto Save eligibility', () => {
  it('never opens a Save As dialog for an untitled file', () => {
    const document = updateContent([createUntitled(1)], 'untitled-1', 'print(1);')[0];
    expect(canAutoSave(document)).toBe(false);
  });

  it('only saves dirty, already-named Scarp source files', () => {
    const source = createUntitled(1);
    const named = markSaved([source], source.id, 'C:\\code\\main.srp', '')[0];
    expect(canAutoSave(named)).toBe(false);
    const changed = updateContent([named], named.id, 'print(1);')[0];
    expect(canAutoSave(changed)).toBe(true);
    expect(canAutoSave({ ...changed, path: 'C:\\code\\main.rs' })).toBe(false);
    expect(canAutoSave({ ...changed, path: null })).toBe(false);
  });
});
