import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS as defaults, SHORTCUT_GROUPS, SHORTCUT_STORAGE_KEY, SHORTCUT_TRANSFER_FORMAT,
  validateShortcutBindings, exportShortcutBindings, parseShortcutTransfer, reviewShortcutTransfer,
  createStudioShortcutStore, serializeShortcuts, matchStudioShortcut } from './studioShortcuts';

describe('strict shortcut backup transfer', () => {
  it('round-trips complete bindings without using startup fallback', () => {
    const bindings = { ...defaults, save: null, open: 'Ctrl+Alt+Shift+X' };
    const raw = exportShortcutBindings(bindings);
    expect(JSON.parse(raw).format).toBe(SHORTCUT_TRANSFER_FORMAT);
    expect(parseShortcutTransfer(raw)).toEqual({ ok: true, value: bindings });
    const validated = validateShortcutBindings(bindings);
    expect(validated.ok && Object.isFrozen(validated.value)).toBe(true);
  });
  it('rejects malformed, extra, missing and duplicate command data', () => {
    const valid = exportShortcutBindings(defaults);
    const missing = Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== 'save'));
    for (const raw of ['', '{', 'null', serializeShortcuts(defaults),
      valid.replace('"version": 1', '"version": 1, "version": 1'),
      valid.replace('"version": 1', '"version": 2'),
      valid.replace('"save": "Ctrl+S"', '"save": "Ctrl+S", "save": null'),
      JSON.stringify({ format: SHORTCUT_TRANSFER_FORMAT, version: 1, bindings: missing }),
      JSON.stringify({ format: SHORTCUT_TRANSFER_FORMAT, version: 1, bindings: { ...defaults, extra: 'Ctrl+A' } }),
      ' '.repeat(9000)]) expect(parseShortcutTransfer(raw).ok).toBe(false);
  });
  it('rejects unsupported chords, fixed changes and conflicts', () => {
    for (const bindings of [{ ...defaults, 'stop-scarp': null }, { ...defaults, settings: 'Ctrl+Alt+Shift+K' },
      { ...defaults, save: 'Ctrl+X' }, { ...defaults, save: 'Ctrl+Alt+Shift+Q', open: 'Ctrl+Alt+Shift+Q' }]) {
      expect(validateShortcutBindings(bindings).ok).toBe(false);
      expect(parseShortcutTransfer(exportShortcutBindings(bindings)).ok).toBe(false);
    }
  });
  it('preserves unselected groups and reports exact selected changes', () => {
    const incoming = { ...defaults, save: null, explorer: null, 'go-to-line': 'Ctrl+Alt+Shift+L' };
    const result = reviewShortcutTransfer(defaults, incoming, ['Files', 'Navigation'], 2);
    if (!result.ok) throw Error(result.error);
    expect(result.value.revision).toBe(2);
    expect(result.value.target.explorer).toBe(defaults.explorer);
    expect(result.value.changes.map(change => [change.id, change.before, change.after])).toEqual([
      ['save', 'Ctrl+S', null], ['go-to-line', 'Ctrl+G', 'Ctrl+Alt+Shift+L'],
    ]);
    expect(reviewShortcutTransfer(defaults, incoming, [], 0).ok).toBe(false);
  });
  it('rejects cross-group conflicts after selective merge', () => {
    const current = { ...defaults, explorer: 'Ctrl+Alt+Shift+K' };
    const incoming = { ...defaults, save: 'Ctrl+Alt+Shift+K' };
    expect(validateShortcutBindings(current).ok).toBe(true);
    expect(validateShortcutBindings(incoming).ok).toBe(true);
    expect(reviewShortcutTransfer(current, incoming, ['Files'], 0).ok).toBe(false);
    expect(reviewShortcutTransfer(current, incoming, SHORTCUT_GROUPS, 0).ok).toBe(true);
  });
});
describe('atomic reviewed keybinding application', () => {
  it('applies a complete reassignment in one publication and one write', () => {
    let raw: string | null = null;
    let writes = 0, notifications = 0;
    const store = createStudioShortcutStore({ getItem: () => raw, setItem: (key, value) => {
      expect(key).toBe(SHORTCUT_STORAGE_KEY); writes++; raw = value;
    } });
    store.subscribe(() => notifications++);
    store.setBinding('save', 'Ctrl+Alt+Shift+X');
    store.setBinding('open', 'Ctrl+Alt+Shift+Y');
    const before = store.getSnapshot();
    const target = { ...before.bindings, save: 'Ctrl+Alt+Shift+Y', open: 'Ctrl+Alt+Shift+X' };
    const result = reviewShortcutTransfer(before.bindings, target, ['Files'], before.revision);
    if (!result.ok) throw Error(result.error);
    expect(store.applyTransfer(result.value)).toEqual({ ok: true, value: true });
    expect(writes).toBe(3);
    expect(notifications).toBe(3);
    expect(store.getSnapshot().revision).toBe(before.revision + 1);
    expect(matchStudioShortcut({ key: 'y', ctrlKey: true, altKey: true, shiftKey: true, metaKey: false }, store.getSnapshot().bindings)).toBe('save');
    expect(createStudioShortcutStore({ getItem: () => raw, setItem: () => {} }).getSnapshot().bindings).toEqual(target);
  });
  it('rejects ABA revisions, changed target groups, and empty reviews', () => {
    const store = createStudioShortcutStore(null);
    const result = reviewShortcutTransfer(defaults, { ...defaults, save: null }, ['Files'], 0);
    if (!result.ok) throw Error(result.error);
    expect(store.applyTransfer({ ...result.value, target: { ...result.value.target, explorer: null } }).ok).toBe(false);
    store.setBinding('open', null); store.setBinding('open', defaults.open);
    expect(store.getSnapshot().bindings).toEqual(defaults);
    expect(store.applyTransfer(result.value).ok).toBe(false);
    const empty = reviewShortcutTransfer(defaults, defaults, SHORTCUT_GROUPS, store.getSnapshot().revision);
    if (!empty.ok) throw Error(empty.error);
    expect(store.applyTransfer(empty.value).ok).toBe(false);
  });
  it('supports an explicitly reviewed rollback with session-only persistence', () => {
    const store = createStudioShortcutStore(null);
    const plan = reviewShortcutTransfer(defaults, { ...defaults, save: null }, SHORTCUT_GROUPS, 0);
    if (!plan.ok) throw Error(plan.error);
    expect(store.applyTransfer(plan.value).ok).toBe(true);
    const next = store.getSnapshot();
    expect(next.persistence).toBe('session-only');
    const undo = reviewShortcutTransfer(next.bindings, defaults, SHORTCUT_GROUPS, next.revision);
    if (!undo.ok) throw Error(undo.error);
    expect(store.applyTransfer(undo.value).ok).toBe(true);
    expect(store.getSnapshot().bindings).toEqual(defaults);
  });
});
