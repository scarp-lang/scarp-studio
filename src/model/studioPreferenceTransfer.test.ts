import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDIO_PORTABLE as defaults, PORTABLE_GROUPS, MAX_STUDIO_TRANSFER_UNITS,
  captureStudioPreferences, exportStudioPreferences, importStudioPreferences, diffStudioPreferences,
  reviewStudioPreferences, studioReviewIsCurrent, reviewStudioUndo, sameStudioPreferences } from './studioPreferenceTransfer';

const custom = captureStudioPreferences('light', { ...defaults.editor, fontSize: 20, minimap: true },
  { ...defaults.intelliSense, inlayHintMode: 'all', completionMode: 'manual' },
  { explorerWidth: 300, outputHeight: 400 }, 5000);
describe('Studio-wide portable preferences', () => {
  it('round trips all portable groups and never exports local-action authorization or private fields', () => {
    const raw = exportStudioPreferences({ ...custom, compilerPath: 'secret.exe',
      files: { ...custom.files, enabled: true }, editor: { ...custom.editor, source: 'secret' } } as typeof custom);
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('"enabled"');
    expect(raw).not.toContain('scanOnStartup');
    expect(importStudioPreferences(raw)).toEqual({ ok: true, value: custom });
    expect(Object.keys(JSON.parse(raw).preferences)).toEqual(PORTABLE_GROUPS);
  });
  it('rejects wrong versions, duplicate keys and unsupported envelopes', () => {
    const raw = exportStudioPreferences(defaults);
    const valid = JSON.parse(raw);
    for (const input of ['', '{', 'null', '[]', '{}', ' '.repeat(MAX_STUDIO_TRANSFER_UNITS + 1),
      raw.replace('"version": 3', '"version": 3, "version": 3'),
      JSON.stringify({ ...valid, version: 99 }), JSON.stringify({ ...valid, intelliSenseVersion: 99 }),
      JSON.stringify({ ...valid, compilerPath: 'x' }), JSON.stringify({ ...valid, preferences: [] })]) {
      expect(importStudioPreferences(input).ok, input.slice(0, 80)).toBe(false);
    }
  });
  it('rejects missing, unexpected and invalid group values rather than silently fixing them', () => {
    const root = JSON.parse(exportStudioPreferences(defaults));
    const badGroups = [
      { appearance: { theme: 'system' } }, { appearance: { theme: 'dark', path: 'x' } },
      { editor: { ...defaults.editor, fontSize: 100 } }, { editor: { ...defaults.editor, font: 'arbitrary CSS' } },
      { editor: { ...defaults.editor, wordWrap: 'true' } }, { editor: { fontSize: 14 } },
      { layout: { ...defaults.layout, explorerWidth: 481 } }, { layout: { ...defaults.layout, outputHeight: 180.5 } },
      { files: { autoSaveDelay: 5000, enabled: true } }, { files: { autoSaveDelay: '3000' } },
      { intelliSense: { ...defaults.intelliSense, localAnalysisKiB: 999 } },
      { compiler: { scanOnStartup: true } }, { recovery: {} },
    ];
    for (const patch of badGroups) {
      expect(importStudioPreferences(JSON.stringify({ ...root, preferences: { ...root.preferences, ...patch } })).ok).toBe(false);
    }
  });
  it('migrates earlier strict IntelliSense schemas inside the Studio envelope', () => {
    const root = JSON.parse(exportStudioPreferences(defaults));
    const { inlayHintMode: _mode, inlayBuiltins: _builtins, ...v2 } = defaults.intelliSense;
    root.intelliSenseVersion = 2;
    root.preferences.intelliSense = v2;
    expect(importStudioPreferences(JSON.stringify(root))).toEqual({ ok: true, value: defaults });
    root.intelliSenseVersion = 3;
    expect(importStudioPreferences(JSON.stringify(root)).ok).toBe(false);
  });
});
describe('reviewed category restore and undo', () => {
  it('returns exact field differences in deterministic group order', () => {
    const diff = diffStudioPreferences(defaults, custom);
    expect(diff.map(change => change.key)).toEqual([
      'theme', 'fontSize', 'minimap', 'completionMode', 'inlayHintMode', 'explorerWidth', 'outputHeight', 'autoSaveDelay',
    ]);
    expect(diff.find(change => change.key === 'fontSize')).toMatchObject({ before: '14 px', after: '20 px' });
    expect(diff.find(change => change.key === 'autoSaveDelay')).toMatchObject({ before: '3000 ms', after: '5000 ms' });
  });
  it('selectively merges selected groups and preserves unselected values', () => {
    const review = reviewStudioPreferences(defaults, custom, ['editor', 'appearance', 'editor']);
    expect(review.groups).toEqual(['appearance', 'editor']);
    expect(review.target).toEqual({ ...defaults, appearance: custom.appearance, editor: custom.editor });
    expect(review.changes.map(change => change.group)).toEqual(['appearance', 'editor', 'editor']);
    expect(reviewStudioPreferences(defaults, custom, []).changes).toEqual([]);
    expect(Object.isFrozen(review.target.editor)).toBe(true);
    expect(Object.isFrozen(review.changes[0])).toBe(true);
  });
  it('rejects stale imports and undo rather than overwriting newer choices', () => {
    const review = reviewStudioPreferences(defaults, custom, PORTABLE_GROUPS);
    expect(studioReviewIsCurrent(review, defaults)).toBe(true);
    expect(studioReviewIsCurrent(review, custom)).toBe(false);
    expect(reviewStudioUndo(review, defaults).ok).toBe(false);
    const undo = reviewStudioUndo(review, custom);
    if (!undo.ok) throw Error(undo.error);
    expect(undo.value.target).toEqual(defaults);
    expect(undo.value.changes).toHaveLength(review.changes.length);
    expect(studioReviewIsCurrent(undo.value, custom)).toBe(true);
    expect(sameStudioPreferences(defaults, review.baseline)).toBe(true);
  });
  it('isolates snapshots from later caller mutations', () => {
    const mutable = { ...custom, editor: { ...custom.editor } };
    const review = reviewStudioPreferences(defaults, mutable, ['editor']);
    mutable.editor.fontSize = 12;
    expect(review.target.editor.fontSize).toBe(20);
    expect(review.baseline.editor.fontSize).toBe(14);
  });
});


it('migrates original Studio transfer editor fields without changing old choices', () => {
  const root = JSON.parse(exportStudioPreferences(defaults));
  const { editor } = root.preferences;
  root.version = 1;
  root.preferences.appearance = { theme: 'dark' };
  root.preferences.editor = Object.fromEntries(['fontSize', 'tabSize', 'wordWrap', 'minimap', 'showWhitespace', 'font',
    'lineNumbers', 'highlightActiveLine', 'indentationGuides', 'bracketColors', 'smoothScrolling'].map(key => [key, editor[key]]));
  root.preferences.editor.fontSize = 18;
  expect(importStudioPreferences(JSON.stringify(root))).toEqual({ ok: true, value: { ...defaults, editor: { ...defaults.editor, fontSize: 18 } } });
  root.version = 2;
  expect(importStudioPreferences(JSON.stringify(root)).ok).toBe(false);
});


it('migrates v2 appearance and round-trips system contrast and reduced motion in v3', () => {
  const root = JSON.parse(exportStudioPreferences(defaults));
  root.version = 2; root.preferences.appearance = { theme: 'light' };
  expect(importStudioPreferences(JSON.stringify(root))).toEqual({ ok: true, value: { ...defaults, appearance: { ...defaults.appearance, theme: 'light' } } });
  const configured = captureStudioPreferences('system', defaults.editor, defaults.intelliSense, defaults.layout, 3000, 'high', 'reduced');
  expect(importStudioPreferences(exportStudioPreferences(configured))).toEqual({ ok: true, value: configured });
});
