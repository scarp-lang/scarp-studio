import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS as defaults, SHORTCUT_COMMANDS, SHORTCUT_STORAGE_KEY, availableShortcutBindings,
  changeShortcut, matchStudioShortcut, normalizeShortcutEvent, parseShortcuts, serializeShortcuts,
  studioCommandDetail, createStudioShortcutStore, searchStudioShortcuts, type ShortcutEvent } from './studioShortcuts';
const key = (value: string, overrides: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key: value, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...overrides,
});
describe('Studio command shortcut policy', () => {
  it('has unique default bindings and matches every exact chord', () => {
    expect(new Set(Object.values(defaults)).size).toBe(SHORTCUT_COMMANDS.length);
    for (const item of SHORTCUT_COMMANDS) {
      const parts = item.default.split('+');
      expect(matchStudioShortcut(key(parts.at(-1)!, { ctrlKey: parts.includes('Ctrl'), altKey: parts.includes('Alt'),
        shiftKey: parts.includes('Shift') }), defaults), item.id).toBe(item.id);
    }
  });
  it('does not intercept composition, AltGraph, unsupported or extra modifiers', () => {
    expect(matchStudioShortcut(key('s', { ctrlKey: true }), defaults)).toBe('save');
    expect(matchStudioShortcut(key('s', { metaKey: true }), defaults)).toBe('save');
    expect(matchStudioShortcut(key('Tab', { metaKey: true }), defaults)).toBeNull();
    expect(matchStudioShortcut(key('F5', { altKey: true }), defaults)).toBeNull();
    expect(matchStudioShortcut(key('n', { ctrlKey: true, shiftKey: true }), defaults)).toBeNull();
    for (const event of [key('s', { ctrlKey: true, isComposing: true }), key('s', { ctrlKey: true, defaultPrevented: true }),
      key('s', { ctrlKey: true, metaKey: true }), key('s', { ctrlKey: true, getModifierState: () => true })]) {
      expect(normalizeShortcutEvent(event)).toBeNull();
    }
    expect(matchStudioShortcut(key('a', { ctrlKey: true }), defaults)).toBeNull();
    expect(matchStudioShortcut(key('Escape'), defaults)).toBeNull();
  });
  it('checks conflicts, fixed commands, disablement and release of previous chords', () => {
    expect(changeShortcut(defaults, 'settings', null).ok).toBe(false);
    expect(changeShortcut(defaults, 'stop-scarp', 'Ctrl+Alt+Shift+X').ok).toBe(false);
    expect(changeShortcut(defaults, 'save', 'Ctrl+A').ok).toBe(false);
    const result = changeShortcut(defaults, 'save', 'Ctrl+Alt+Shift+K');
    if (!result.ok) throw Error(result.error);
    expect(changeShortcut(result.bindings, 'open', 'Ctrl+Alt+Shift+K').ok).toBe(false);
    expect(matchStudioShortcut(key('s', { ctrlKey: true }), result.bindings)).toBeNull();
    expect(matchStudioShortcut(key('k', { ctrlKey: true, altKey: true, shiftKey: true }), result.bindings)).toBe('save');
    expect(changeShortcut(result.bindings, 'save', null).ok).toBe(true);
    expect(availableShortcutBindings('settings')).toEqual(['Ctrl+,']);
    expect(defaults.save).toBe('Ctrl+S');
  });
  it('renders updated command details without losing nonshortcut information', () => {
    expect(studioCommandDetail('run-scarp', 'F5 · saved .srp only', { ...defaults, 'run-scarp': null })).toBe('Unassigned · saved .srp only');
    expect(studioCommandDetail('folder', 'Explorer', defaults)).toBe('Explorer');
    expect(searchStudioShortcuts('CTRL+S', false, defaults).some(item => item.id === 'save')).toBe(true);
    expect(searchStudioShortcuts('', true, { ...defaults, save: null }).map(item => item.id)).toEqual(['save']);
  });
});
describe('strict shortcut persistence', () => {
  it('round trips complete allowlisted bindings and falls back on malformed/conflicting input', () => {
    const custom = { ...defaults, save: 'Ctrl+Alt+Shift+K', open: null };
    expect(parseShortcuts(serializeShortcuts(custom))).toEqual(custom);
    for (const raw of ['', '{', 'null', '{}', serializeShortcuts({ ...defaults, save: 'Ctrl+A' }),
      serializeShortcuts({ ...defaults, 'stop-scarp': null }),
      serializeShortcuts({ ...defaults, open: 'Ctrl+Alt+Shift+X', save: 'Ctrl+Alt+Shift+X' }),
      serializeShortcuts(defaults).replace('"version":1', '"version":1,"version":1'),
      ' '.repeat(9000)]) expect(parseShortcuts(raw)).toEqual(defaults);
  });
  it('stores changes synchronously, reports session fallback and resets', () => {
    let raw: string | null = null; let fail = false; let notifications = 0;
    const storage = { getItem: (key: string) => { expect(key).toBe(SHORTCUT_STORAGE_KEY); return raw; },
      setItem: (key: string, value: string) => { expect(key).toBe(SHORTCUT_STORAGE_KEY); if (fail) throw Error('quota'); raw = value; } };
    const store = createStudioShortcutStore(storage);
    const off = store.subscribe(() => notifications++);
    expect(store.setBinding('save', null).ok).toBe(true);
    expect(store.getSnapshot().bindings.save).toBeNull();
    expect(createStudioShortcutStore(storage).getSnapshot().bindings.save).toBeNull();
    fail = true;
    expect(store.setBinding('open', null).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe('session-only');
    expect(notifications).toBe(2); off();
    store.reset();
    expect(store.getSnapshot().bindings).toEqual(defaults);
    expect(notifications).toBe(2);
  });
});
