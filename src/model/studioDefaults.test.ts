import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTO_SAVE } from './autoSaveSettings';
import { DEFAULT_EDITOR_PREFERENCES } from './editorPreferences';
import { restoreStudioDefaults } from './studioDefaults';

describe('Scarp Studio full Settings reset', () => {
  it('restores editor appearance AND turns Auto Save off', () => {
    const restored = restoreStudioDefaults();
    expect(restored.editor).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(restored.autoSave).toEqual(DEFAULT_AUTO_SAVE);
    expect(restored.autoSave.enabled).toBe(false);
    expect(restored.autoSave.delay).toBe(3000);
  });

  it('returns fresh objects to prevent preferences from leaking into defaults', () => {
    const first = restoreStudioDefaults();
    first.autoSave.enabled = true;
    first.autoSave.delay = 1000;
    first.editor.fontSize = 24;
    first.editor.wordWrap = false;
    first.editor.minimap = true;
    first.editor.showWhitespace = true;
    const again = restoreStudioDefaults();
    expect(again.autoSave.enabled).toBe(false);
    expect(again.autoSave.delay).toBe(3000);
    expect(again.editor.fontSize).toBe(DEFAULT_EDITOR_PREFERENCES.fontSize);
    expect(again.editor.wordWrap).toBe(true);
    expect(again.editor.minimap).toBe(false);
    expect(again.editor.showWhitespace).toBe(false);
  });
});
