import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_EXPERIENCE as defaults, EDITOR_EXPERIENCE_CHOICES, EDITOR_EXPERIENCE_LABELS, EXPERIENCE_INFO,
  parseEditorExperience, editorExperienceOptions, editorExperiencePatch, experienceValueLabel,
  matchEditorExperience, accessibilityExperiencePatch, type EditorExperienceKey } from './editorExperience';
import { DEFAULT_EDITOR_PREFERENCES, parseEditorPreferences, editorDisplayOptions } from './editorPreferences';
const keys = Object.keys(EDITOR_EXPERIENCE_CHOICES) as EditorExperienceKey[];
describe('advanced editor preferences', () => {
  it('validates every finite choice and includes metadata for all controls', () => {
    expect(keys).toHaveLength(23);
    expect(Object.keys(defaults).sort()).toEqual([...keys].sort());
    expect(Object.keys(EDITOR_EXPERIENCE_LABELS).sort()).toEqual([...keys].sort());
    expect(Object.keys(EXPERIENCE_INFO).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      const choices: readonly unknown[] = EDITOR_EXPERIENCE_CHOICES[key];
      expect(choices.includes(defaults[key])).toBe(true);
      for (const value of choices) {
        expect(parseEditorExperience({ [key]: value })[key]).toBe(value);
        expect(editorExperiencePatch(key, value)).toEqual({ [key]: value });
      }
      expect(editorExperiencePatch(key, {})).toBeNull();
    }
  });
  it('rejects inherited and unsupported values without dropping valid fields', () => {
    expect(parseEditorExperience(Object.create({ cursorStyle: 'block' }))).toEqual(defaults);
    expect(parseEditorExperience({ cursorStyle: 'bad', lineHeight: 99999, accessibilitySupport: 'off',
      fontLigatures: 'true', letterSpacing: NaN, insertSpaces: false })).toEqual({ ...defaults, insertSpaces: false });
    expect(parseEditorPreferences('{"fontSize":20}')).toEqual({ ...DEFAULT_EDITOR_PREFERENCES, fontSize: 20 });
  });
  it('maps Monaco options, merging minimap state and preserving the existing buffer', () => {
    const p = parseEditorPreferences(JSON.stringify({ minimap: true, minimapSide: 'left', minimapCharacters: false,
      rulerColumn: 100, cursorStyle: 'block', lineHeight: 28, insertSpaces: false, autoClosingBrackets: 'never' }));
    expect(editorDisplayOptions(p)).toMatchObject({ minimap: { enabled: true, side: 'left', renderCharacters: false },
      rulers: [100], cursorStyle: 'block', lineHeight: 28, insertSpaces: false, autoClosingBrackets: 'never' });
    expect(editorExperienceOptions(defaults).rulers).toEqual([]);
  });
  it('labels units and filters by modified values', () => {
    expect(experienceValueLabel('lineHeight', 0)).toBe('Auto');
    expect(experienceValueLabel('lineHeight', 24)).toBe('24 px');
    expect(experienceValueLabel('rulerColumn', 120)).toBe('Column 120');
    expect(matchEditorExperience(defaults, '', true)).toEqual([]);
    expect(matchEditorExperience(defaults, 'SCREEN READER', false)).toContain('accessibilitySupport');
    const changed = { ...defaults, cursorStyle: 'block' as const, lineHeight: 28 as const };
    expect(matchEditorExperience(changed, '', true)).toEqual(['lineHeight', 'cursorStyle']);
    expect(matchEditorExperience(changed, 'caret', true)).toEqual(['lineHeight', 'cursorStyle']);
  });
  it('accessibility preset does not modify editing behavior or defaults', () => {
    const patch = accessibilityExperiencePatch();
    expect(patch).toMatchObject({ cursorBlinking: 'solid', cursorSmoothCaretAnimation: 'off', accessibilitySupport: 'on' });
    expect(patch).not.toHaveProperty('insertSpaces');
    expect(patch).not.toHaveProperty('autoIndent');
    expect(parseEditorExperience(patch)).toEqual({ ...defaults, ...patch });
  });
});
