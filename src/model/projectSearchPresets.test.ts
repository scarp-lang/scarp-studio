import { describe, expect, it } from 'vitest';
import {
  createSearchPresetLibrary, normalizeSearchPresetName, validateProjectSearchSettings,
  sameProjectSearchSettings, addSearchPreset, renameSearchPreset, replaceSearchPresetSettings,
  prepareSearchPresetReplace, confirmSearchPresetReplace, removeSearchPreset, clearSearchPresets,
  prepareSearchPresetApply, confirmSearchPresetApply, exportSearchPresetBackup, parseSearchPresetBackup,
  reviewSearchPresetImport, applySearchPresetImport, MAX_SEARCH_PRESETS, MAX_SEARCH_PRESET_BACKUP,
  SEARCH_PRESET_FORMAT, type ProjectSearchSettings, type SearchPresetLibrary, type PresetResult,
} from './projectSearchPresets';
import {
  buildProjectScopeInventory, DEFAULT_PROJECT_SEARCH_SCOPE, PROJECT_SEARCH_BATCH_SIZE,
} from './projectSearchScope';

const base: ProjectSearchSettings = {
  query: 'private-needle',
  options: { caseSensitive: true, wholeWord: false },
  scope: DEFAULT_PROJECT_SEARCH_SCOPE,
};
const newer: ProjectSearchSettings = {
  ...base, query: 'other', options: { caseSensitive: false, wholeWord: true },
};
function unwrap<T>(result: PresetResult<T>): T {
  if (!result.ok) throw Error(result.error);
  return result.value;
}
function add(library: SearchPresetLibrary, name: string, settings = base) {
  return unwrap(addSearchPreset(library, name, settings));
}
function library(...names: string[]) {
  return names.reduce((state, name) => add(state, name), createSearchPresetLibrary());
}
function entry(name: string) { return { name, path: 'C:/native/private/' + name }; }
function inventory(...names: string[]) { return buildProjectScopeInventory(names.map(entry)); }
function backup(presets: readonly unknown[], patch: Record<string, unknown> = {}) {
  return JSON.stringify({ format: SEARCH_PRESET_FORMAT, version: 1, presets, ...patch });
}

describe('named search preset validation', () => {
  it('normalizes names without silently truncating or dropping controls', () => {
    expect(normalizeSearchPresetName('  Practice searches  ')).toEqual({ ok: true, value: 'Practice searches' });
    for (const name of ['', '   ', 'a\nb', 'a\tb', 'x'.repeat(65), '\ud800', '\u202eabc', 4, null]) {
      expect(normalizeSearchPresetName(name).ok).toBe(false);
    }
  });

  it('preserves literal query whitespace and exact matching flags', () => {
    const settings = { ...base, query: '  a\tb  ', options: { caseSensitive: false, wholeWord: true } };
    const accepted = unwrap(validateProjectSearchSettings(settings));
    expect(accepted).toEqual(settings);
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(accepted.options)).toBe(true);
    expect(Object.isFrozen(accepted.scope)).toBe(true);
  });

  it('rejects unsupported or nonliteral query inputs', () => {
    for (const query of ['', 'a\r\nb', 'a\nb', '\u0000', '\u202eabc', '\ud800', 'x'.repeat(121), 4]) {
      expect(validateProjectSearchSettings({ ...base, query }).ok).toBe(false);
    }
    expect(validateProjectSearchSettings({ ...base, query: '.*[x]' }).ok).toBe(true);
  });

  it('rejects extra settings fields and nonboolean options', () => {
    for (const value of [
      { ...base, replacement: 'danger' },
      { ...base, source: 'private source' },
      { ...base, compiler: 'C:/path' },
      { ...base, options: { ...base.options, regex: true } },
      { ...base, options: { ...base.options, caseSensitive: 'true' } },
      { ...base, options: { wholeWord: false } },
      { ...base, scope: { ...base.scope, path: 'C:/native' } },
      null, [],
    ]) expect(validateProjectSearchSettings(value).ok).toBe(false);
  });

  it('accepts observed-style relative directories and bounded batch choices', () => {
    const settings = { ...base, scope: {
      directory: 'practice/tuples', descendants: false, filename: 'example-', batch: 2,
    } };
    expect(unwrap(validateProjectSearchSettings(settings))).toEqual(settings);
    const conventional = unwrap(validateProjectSearchSettings({ ...base, scope: { ...base.scope, batch: undefined } }));
    expect(conventional.scope).toEqual(DEFAULT_PROJECT_SEARCH_SCOPE);
  });

  it('rejects path-like filters, unsafe directories and excessive batch numbers', () => {
    for (const directory of ['../outside', '.git', 'target', '/root', 'C:/private', 'src\\nested', 'src//nested', '\u202e']) {
      expect(validateProjectSearchSettings({ ...base, scope: { ...base.scope, directory } }).ok).toBe(false);
    }
    for (const filename of ['src/file', 'src\\file', 'x\n', 'x'.repeat(121), '\ud800', '\u2066']) {
      expect(validateProjectSearchSettings({ ...base, scope: { ...base.scope, filename } }).ok).toBe(false);
    }
    for (const batch of [0, -1, 1.5, 51, Infinity, NaN, null, '1']) {
      expect(validateProjectSearchSettings({ ...base, scope: { ...base.scope, batch } }).ok).toBe(false);
    }
  });

  it('compares exact settings including case, whitespace and batch number', () => {
    expect(sameProjectSearchSettings(base, { ...base })).toBe(true);
    expect(sameProjectSearchSettings(base, { ...base, query: base.query + ' ' })).toBe(false);
    expect(sameProjectSearchSettings(base, { ...base, options: { ...base.options, wholeWord: true } })).toBe(false);
    expect(sameProjectSearchSettings(base, { ...base, scope: { ...base.scope, batch: 1 } })).toBe(false);
    expect(sameProjectSearchSettings(base, { ...base, scope: { ...base.scope, batch: undefined } })).toBe(true);
  });
});

describe('immutable preset library', () => {
  it('assigns monotonic identities and copies only validated settings', () => {
    const initial = createSearchPresetLibrary();
    const mutable = { ...base, options: { ...base.options }, scope: { ...base.scope } };
    const first = add(initial, 'One', mutable);
    mutable.options.caseSensitive = false;
    mutable.scope.filename = 'changed';
    expect(first.presets[0].settings).toEqual(base);
    expect(first.presets[0].id).toBe(1);
    expect(first.nextId).toBe(2);
    expect(first.revision).toBe(1);
    expect(initial.presets).toEqual([]);
    expect(Object.isFrozen(first.presets)).toBe(true);
    const removed = unwrap(removeSearchPreset(first, 1));
    const second = add(removed, 'One');
    expect(second.presets[0].id).toBe(2);
    expect(second.revision).toBe(3);
  });

  it('rejects duplicate names case-insensitively and permits explicit rename', () => {
    const first = library('Alpha', 'Beta');
    expect(addSearchPreset(first, ' alpha ', base).ok).toBe(false);
    expect(renameSearchPreset(first, 2, 'ALPHA').ok).toBe(false);
    const changed = unwrap(renameSearchPreset(first, 1, 'ALPHA'));
    expect(changed.presets[0].name).toBe('ALPHA');
    expect(changed.presets[0].id).toBe(1);
    expect(unwrap(renameSearchPreset(changed, 1, 'ALPHA'))).toBe(changed);
    expect(renameSearchPreset(changed, 42, 'Unknown').ok).toBe(false);
  });

  it('enforces bounded capacity and retains monotonic IDs after clear', () => {
    const full = library(...Array.from({ length: MAX_SEARCH_PRESETS }, (_, index) => 'Preset ' + index));
    expect(addSearchPreset(full, 'Excess', base).ok).toBe(false);
    const cleared = clearSearchPresets(full);
    expect(cleared.presets).toEqual([]);
    expect(cleared.nextId).toBe(MAX_SEARCH_PRESETS + 1);
    expect(clearSearchPresets(cleared)).toBe(cleared);
    expect(add(cleared, 'New').presets[0].id).toBe(MAX_SEARCH_PRESETS + 1);
  });

  it('replaces only the selected settings without changing identity or other presets', () => {
    const initial = library('Alpha', 'Beta');
    const next = unwrap(replaceSearchPresetSettings(initial, 1, newer));
    expect(next.presets[0]).toMatchObject({ id: 1, name: 'Alpha', settings: newer });
    expect(next.presets[1]).toBe(initial.presets[1]);
    expect(unwrap(replaceSearchPresetSettings(next, 1, newer))).toBe(next);
    expect(replaceSearchPresetSettings(next, 999, newer).ok).toBe(false);
    expect(removeSearchPreset(next, 999).ok).toBe(false);
  });

  it('pins replacement review to exact proposed settings and library revision', () => {
    const initial = library('Alpha');
    const review = unwrap(prepareSearchPresetReplace(initial, 1, newer));
    expect(review.proposed).toEqual(newer);
    expect(confirmSearchPresetReplace(initial, review, base).ok).toBe(false);
    expect(confirmSearchPresetReplace(add(initial, 'Beta'), review, newer).ok).toBe(false);
    expect(unwrap(confirmSearchPresetReplace(initial, review, newer)).presets[0].settings).toEqual(newer);
  });
});

describe('reviewed preset application', () => {
  it('reviews current listing scope and never returns native paths', () => {
    const chosen: ProjectSearchSettings = { ...base, scope: { directory: 'src', descendants: true, filename: 'main' } };
    const stored = add(createSearchPresetLibrary(), 'Source', chosen);
    const listed = inventory('src/main.srp', 'src/nested/main.srp', 'src/other.srp', 'tests/main.srp');
    const review = unwrap(prepareSearchPresetApply(stored, 1, newer, listed));
    expect(review.preview).toEqual({
      labels: ['src/main.srp', 'src/nested/main.srp'], listed: 4, eligible: 2, excluded: 2, withheld: 0, deferred: 0,
    });
    expect(JSON.stringify(review)).not.toContain('C:/native');
    expect(unwrap(confirmSearchPresetApply(stored, review, newer, listed))).toEqual(chosen);
  });

  it('blocks unavailable directories, empty scopes, stale batches and unsafe labels', () => {
    const listed = inventory('src/main.srp');
    for (const scope of [
      { ...base.scope, directory: 'unknown' }, { ...base.scope, filename: 'not-found' }, { ...base.scope, batch: 2 },
    ]) {
      const stored = add(createSearchPresetLibrary(), 'Unavailable', { ...base, scope });
      expect(prepareSearchPresetApply(stored, 1, newer, listed).ok).toBe(false);
    }
    expect(prepareSearchPresetApply(library('Base'), 1, newer, inventory('C:/native/a.srp')).ok).toBe(false);
  });

  it('requires unchanged reviewed controls, library and eligible label membership', () => {
    const stored = library('Base');
    const listed = inventory('src/a.srp', 'src/b.srp');
    const review = unwrap(prepareSearchPresetApply(stored, 1, newer, listed));
    expect(confirmSearchPresetApply(stored, review, base, listed).ok).toBe(false);
    expect(confirmSearchPresetApply(add(stored, 'New'), review, newer, listed).ok).toBe(false);
    expect(confirmSearchPresetApply(stored, review, newer, inventory('src/a.srp', 'src/c.srp')).ok).toBe(false);
    expect(confirmSearchPresetApply(stored, review, newer, inventory('src/b.srp', 'src/a.srp')).ok).toBe(true);
  });

  it('reviews actual membership of a saved numbered batch', () => {
    const labels = Array.from({ length: PROJECT_SEARCH_BATCH_SIZE + 1 }, (_, index) => 'src/file-' + index + '.srp');
    const stored = add(createSearchPresetLibrary(), 'Later', { ...base, scope: { ...base.scope, batch: 2 } });
    const review = unwrap(prepareSearchPresetApply(stored, 1, newer, inventory(...labels)));
    expect(review.preview.labels).toEqual(labels.slice(PROJECT_SEARCH_BATCH_SIZE));
    expect(review.preview.deferred).toBe(PROJECT_SEARCH_BATCH_SIZE);
    expect(confirmSearchPresetApply(stored, review, newer, inventory(...labels.slice(0, -1))).ok).toBe(false);
  });
});

describe('portable search preset backup and merge-only import', () => {
  it('round-trips only portable settings with no internal IDs, paths or revisions', () => {
    const stored = add(library('Base'), 'Batch', { ...newer, scope: { ...base.scope, batch: 1 } });
    const text = unwrap(exportSearchPresetBackup(stored));
    const parsed = unwrap(parseSearchPresetBackup(text));
    expect(parsed).toEqual(stored.presets.map(item => ({ name: item.name, settings: item.settings })));
    expect(text).toContain(base.query);
    expect(text).not.toContain('"id"');
    expect(text).not.toContain('"revision"');
    expect(text).not.toContain('C:/native');
    expect(text).not.toContain('"replacement"');
  });

  it('rejects unknown versions, keys, malformed JSON and excessive record counts', () => {
    for (const text of [
      'not JSON', 'null', '[]', '{}', backup([], { version: 2 }), backup([], { format: 'other' }),
      backup([], { nativePath: 'C:/private' }),
      backup([{ name: 'A', settings: base, id: 1 }]),
      backup([{ name: 'A', settings: { ...base, source: 'private' } }]),
      backup(Array.from({ length: MAX_SEARCH_PRESETS + 1 }, (_, index) => ({ name: 'Preset ' + index, settings: base }))),
      ' '.repeat(MAX_SEARCH_PRESET_BACKUP + 1),
    ]) expect(parseSearchPresetBackup(text).ok).toBe(false);
  });

  it('rejects duplicate names in a single portable backup', () => {
    expect(parseSearchPresetBackup(backup([
      { name: 'Alpha', settings: base }, { name: ' alpha ', settings: newer },
    ])).ok).toBe(false);
  });

  it('classifies identical, conflicting and new records without modifying existing presets', () => {
    const initial = library('Identical', 'Conflict');
    const text = backup([
      { name: 'identical', settings: base }, { name: 'Conflict', settings: newer },
      { name: 'New A', settings: base }, { name: 'New B', settings: newer },
    ]);
    const review = unwrap(reviewSearchPresetImport(initial, text));
    expect(review.rows.map(row => row.status)).toEqual(['identical', 'conflict', 'new', 'new']);
    expect(review.rows[1].settings).toEqual(newer);
    expect(initial.presets).toHaveLength(2);
    expect(applySearchPresetImport(initial, review, [0]).ok).toBe(false);
    expect(applySearchPresetImport(initial, review, [1]).ok).toBe(false);
    const next = unwrap(applySearchPresetImport(initial, review, [3]));
    expect(next.presets.map(item => item.name)).toEqual(['Identical', 'Conflict', 'New B']);
    expect(next.presets[0]).toBe(initial.presets[0]);
    expect(next.presets[1]).toBe(initial.presets[1]);
    expect(next.presets[2].settings).toEqual(newer);
    expect(next.presets[2].id).toBe(3);
  });

  it('rejects stale review, tampered evidence and invalid index selections', () => {
    const initial = library('Existing');
    const review = unwrap(reviewSearchPresetImport(initial, backup([
      { name: 'New A', settings: base }, { name: 'New B', settings: newer },
    ])));
    expect(applySearchPresetImport(add(initial, 'Another'), review, [0]).ok).toBe(false);
    for (const indices of [[], [0, 0], [-1], [1.5], [5], [NaN]]) {
      expect(applySearchPresetImport(initial, review, indices).ok).toBe(false);
    }
    expect(applySearchPresetImport(initial, { ...review, source: backup([{ name: 'Other', settings: base }]) }, [0]).ok).toBe(false);
    expect(applySearchPresetImport(initial, { ...review, rows: [{ ...review.rows[0], settings: newer }, review.rows[1]] }, [0]).ok).toBe(false);
    expect(initial.presets).toHaveLength(1);
  });

  it('enforces remaining capacity atomically and assigns IDs in reviewed order', () => {
    const initial = library(...Array.from({ length: MAX_SEARCH_PRESETS - 1 }, (_, index) => 'Old ' + index));
    const review = unwrap(reviewSearchPresetImport(initial, backup([
      { name: 'New A', settings: base }, { name: 'New B', settings: newer },
    ])));
    expect(review.remainingCapacity).toBe(1);
    expect(applySearchPresetImport(initial, review, [0, 1]).ok).toBe(false);
    const next = unwrap(applySearchPresetImport(initial, review, [1]));
    expect(next.presets).toHaveLength(MAX_SEARCH_PRESETS);
    expect(next.presets.at(-1)?.name).toBe('New B');
  });

  it('exports and imports an empty library without inventing records', () => {
    const initial = createSearchPresetLibrary();
    const text = unwrap(exportSearchPresetBackup(initial));
    expect(unwrap(parseSearchPresetBackup(text))).toEqual([]);
    const review = unwrap(reviewSearchPresetImport(initial, text));
    expect(review.rows).toEqual([]);
    expect(applySearchPresetImport(initial, review, []).ok).toBe(false);
  });
});
