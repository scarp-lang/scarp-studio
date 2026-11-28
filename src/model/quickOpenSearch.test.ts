import { describe, expect, it } from 'vitest';
import type { StudioDocument } from './documents';
import { MAX_NAVIGATION_QUERY_UNITS } from './navigation';
import { buildQuickOpenEntries, type QuickOpenEntry } from './projectQuickOpen';
import {
  DEFAULT_QUICK_OPEN_OPTIONS, MAX_QUICK_OPEN_CANDIDATES, QUICK_OPEN_RESULT_LIMIT,
  QUICK_OPEN_SCOPES, quickOpenLabelParts, searchQuickOpen, type QuickOpenOptions,
} from './quickOpenSearch';

const root = 'C:/practice/';
function tab(id: string, name: string, path: string | null, modified = false): StudioDocument {
  return {
    id, name, path, content: modified ? 'changed' : 'saved',
    savedContent: 'saved', revision: 0,
  };
}
const listed = [
  'basic_tuple/src/main.srp',
  'basic_tuple/src/matrix_tools.srp',
  'basic_tuple/tests/check.srp',
  'basic_tuple_extra/main.srp',
  'loops/main.srp',
  'loops/src/loop_tools.srp',
  'examples/complex/compute_total.srp',
].map(name => ({ name, path: root + name }));
const documents = [
  tab('tuple-main', 'main.srp', 'c:\\PRACTICE\\basic_tuple\\src\\main.SRP', true),
  tab('loop-main', 'main.srp', root + 'loops/main.srp'),
  tab('untitled', 'Untitled-1.srp', null, true),
  tab('outside', 'outside.srp', 'D:/other/outside.srp'),
];
const entries = buildQuickOpenEntries(documents, listed);
function results(query: string, patch: Partial<QuickOpenOptions> = {}, candidates = entries) {
  return searchQuickOpen(candidates, query, { ...DEFAULT_QUICK_OPEN_OPTIONS, ...patch });
}
const ids = (result: ReturnType<typeof results>) => result.matches.map(match => match.entry.id);
const names = (result: ReturnType<typeof results>) => result.matches.map(match => match.entry.label);

describe('ranked workspace Quick Open', () => {
  it('retains relative labels on matching open buffers and deduplicates their listed paths', () => {
    expect(entries[0]).toMatchObject({
      kind: 'tab', relativeLabel: 'basic_tuple/src/main.srp', modified: true,
    });
    expect(entries[1]).toMatchObject({ relativeLabel: 'loops/main.srp', modified: false });
    expect(entries).toHaveLength(9);
    expect(entries.filter(entry => entry.kind === 'project')).toHaveLength(5);
  });

  it('puts the active tab first only for an empty or tied query', () => {
    expect(ids(results('', { activeId: 'loop-main' })).slice(0, 4))
      .toEqual(['tab:loop-main', 'tab:tuple-main', 'tab:untitled', 'tab:outside']);
    expect(ids(results('outside.srp', { activeId: 'loop-main' }))[0]).toBe('tab:outside');
  });

  it('does not search editor state strings as file names', () => {
    expect(results('modified', { mode: 'literal' }).matched).toBe(0);
    expect(results('selected project', { mode: 'literal' }).matched).toBe(0);
  });

  it('ranks an exact basename above a prefix, substring and fuzzy match', () => {
    const candidates = buildQuickOpenEntries([], [
      'src/map_other.srp', 'src/a_map.srp', 'src/m_a_p.srp', 'src/map.srp',
    ].map(name => ({ name, path: root + name })));
    const result = results('map', {}, candidates);
    expect(names(result)).toEqual([
      'src/map.srp', 'src/map_other.srp', 'src/a_map.srp', 'src/m_a_p.srp',
    ]);
    expect(result.matches[0].match).toBe('prefix');
    expect(result.matches.at(-1)?.match).toBe('fuzzy');
  });

  it('prioritizes exact filename matches over longer prefixes regardless of active status', () => {
    const candidates = buildQuickOpenEntries(
      [tab('longer', 'main.srp.backup.srp', 'C:/x/main.srp.backup.srp')],
      [{ name: 'src/main.srp', path: 'C:/x/src/main.srp' }],
    );
    const result = results('main.srp', { activeId: 'longer' }, candidates);
    expect(result.matches[0].entry.kind).toBe('project');
    expect(result.matches[0].match).toBe('exact');
  });

  it('matches case-insensitive abbreviations with noncontiguous highlight positions', () => {
    const result = results('MTT');
    expect(names(result)).toContain('basic_tuple/src/matrix_tools.srp');
    const match = result.matches.find(item => item.entry.label.includes('matrix_tools'))!;
    expect(match.match).toBe('fuzzy');
    expect(match.labelPositions.map(index => match.entry.label[index]).join('').toLowerCase()).toBe('mtt');
  });

  it('does not return a fuzzy-only match in literal mode', () => {
    expect(names(results('mtt', { mode: 'literal' }))).not.toContain('basic_tuple/src/matrix_tools.srp');
    expect(results('matrix', { mode: 'literal' }).matched).toBe(1);
  });

  it('supports multiple tokens matched across filenames and relative paths', () => {
    expect(ids(results('basic_tuple src main', { mode: 'literal' }))).toEqual(['tab:tuple-main']);
    expect(ids(results('loops main', { mode: 'literal' }))).toEqual(['tab:loop-main']);
    expect(results('loops missing', { mode: 'literal' }).matched).toBe(0);
  });

  it('normalizes Windows separators and case in exact path search terms', () => {
    expect(ids(results('BASIC_TUPLE\\SRC\\MAIN.SRP', { mode: 'literal' }))).toEqual(['tab:tuple-main']);
    expect(ids(results('c:\\practice\\loops\\main.srp'))).toEqual(['tab:loop-main']);
    expect(results('basic_tuple/xxx/main.srp').matched).toBe(0);
  });

  it('keeps path-only matches separate from visible filename highlights', () => {
    const result = results('D:/other/', { mode: 'literal' });
    expect(ids(result)).toEqual(['tab:outside']);
    expect(result.matches[0].match).toBe('path');
    expect(result.matches[0].labelPositions).toEqual([]);
  });

  it('includes only live entries for each explicit source scope', () => {
    const expected = {
      all: 9, open: 4, recent: 0, modified: 2, untitled: 1, listed: 7, closed: 5,
    };
    for (const scope of QUICK_OPEN_SCOPES) {
      const result = results('', { scope });
      expect(result.eligible).toBe(expected[scope]);
      expect(result.matched).toBe(expected[scope]);
    }
    expect(ids(results('', { scope: 'modified' }))).toEqual(['tab:tuple-main', 'tab:untitled']);
    expect(ids(results('', { scope: 'untitled' }))).toEqual(['tab:untitled']);
    expect(ids(results('', { scope: 'listed' }))).not.toContain('tab:outside');
    expect(ids(results('', { scope: 'listed' }))).not.toContain('tab:untitled');
    expect(results('', { scope: 'closed' }).matches.every(match => match.entry.kind === 'project')).toBe(true);
  });

  it('limits recent search to live activated tabs and uses recency for tied matches', () => {
    const recency = { ids: ['loop-main', 'tuple-main', 'closed-tab'] };
    expect(ids(results('', { scope: 'recent', recency }))).toEqual(['tab:loop-main', 'tab:tuple-main']);
    expect(ids(results('main.srp', { recency })).slice(0, 2)).toEqual(['tab:loop-main', 'tab:tuple-main']);
    expect(ids(results('outside.srp', { recency }))[0]).toBe('tab:outside');
    expect(results('outside.srp', { scope: 'recent', recency }).matched).toBe(0);
  });

  it('does not widen a restricted search when it has no matches', () => {
    expect(results('matrix', { scope: 'open' }).matches).toEqual([]);
    expect(results('Untitled', { scope: 'closed' }).matches).toEqual([]);
    expect(results('outside', { scope: 'listed' }).matches).toEqual([]);
  });

  it('uses deterministic ordering for duplicate basenames and score ties', () => {
    const result = results('main.srp', { activeId: 'loop-main' });
    expect(ids(result).slice(0, 2)).toEqual(['tab:loop-main', 'tab:tuple-main']);
    expect(ids(results('main.srp', { activeId: 'loop-main' }))).toEqual(ids(result));
  });

  it('handles exact punctuation literally without constructing regular expressions', () => {
    const candidates = buildQuickOpenEntries([], [
      { name: 'src/[a]+.srp', path: root + 'src/[a]+.srp' },
      { name: 'src/aaa.srp', path: root + 'src/aaa.srp' },
    ]);
    expect(names(results('[a]+', { mode: 'literal' }, candidates))).toEqual(['src/[a]+.srp']);
    expect(results('.*', { mode: 'literal' }, candidates).matched).toBe(0);
  });

  it('rejects control characters and oversized queries rather than truncating into another query', () => {
    for (const query of ['a\0b', 'a\nb', 'a\tb', 'x'.repeat(MAX_NAVIGATION_QUERY_UNITS + 1)]) {
      const result = results(query);
      expect(result.invalidQuery).toBe(true);
      expect(result.matches).toEqual([]);
    }
  });

  it('rejects invalid scope, matching mode and result limits', () => {
    for (const options of [
      { ...DEFAULT_QUICK_OPEN_OPTIONS, scope: 'unknown' },
      { ...DEFAULT_QUICK_OPEN_OPTIONS, mode: 'unknown' },
    ]) {
      expect(searchQuickOpen(entries, '', options as QuickOpenOptions).invalidQuery).toBe(true);
    }
    for (const limit of [0, -1, NaN, 2.5, QUICK_OPEN_RESULT_LIMIT + 1]) {
      expect(searchQuickOpen(entries, '', DEFAULT_QUICK_OPEN_OPTIONS, limit).invalidQuery).toBe(true);
    }
  });

  it('reports candidate and result truncation independently of result counts', () => {
    const candidates: QuickOpenEntry[] = Array.from({ length: MAX_QUICK_OPEN_CANDIDATES + 1 }, (_, index) => ({
      kind: 'tab', documentId: String(index), id: 'tab:' + index, label: 'file' + index + '.srp',
    }));
    const result = results('file', {}, candidates);
    expect(result.inputLimited).toBe(true);
    expect(result.resultLimited).toBe(true);
    expect(result.eligible).toBe(MAX_QUICK_OPEN_CANDIDATES);
    expect(result.matched).toBe(MAX_QUICK_OPEN_CANDIDATES);
    expect(result.matches).toHaveLength(QUICK_OPEN_RESULT_LIMIT);
    const limited = searchQuickOpen(entries, '', DEFAULT_QUICK_OPEN_OPTIONS, 2);
    expect(limited.matched).toBe(9);
    expect(limited.inputLimited).toBe(false);
    expect(limited.resultLimited).toBe(true);
    expect(limited.matches).toHaveLength(2);
  });

  it('preserves original entries and labels across independent searches', () => {
    const snapshot = JSON.stringify(entries);
    results('matrix');
    results('main', { scope: 'closed' });
    results('', { activeId: 'loop-main' });
    expect(JSON.stringify(entries)).toBe(snapshot);
  });

  it('deduplicates highlight indices across multiple search terms', () => {
    const match = results('matrix mat').matches.find(item => item.entry.label.includes('matrix_tools'))!;
    expect(match.labelPositions).toEqual([...new Set(match.labelPositions)]);
    expect(match.labelPositions.map(index => match.entry.label[index]).join('')).toBe('matrix');
  });

  it('preserves original label text and does not highlight expanded case folds', () => {
    const candidates = buildQuickOpenEntries([], [
      { name: 'İtem.srp', path: root + 'İtem.srp' },
      { name: '🌟star.srp', path: root + '🌟star.srp' },
    ]);
    const expanded = results('i', {}, candidates).matches.find(match => match.entry.label === 'İtem.srp')!;
    expect(expanded.labelPositions).toEqual([]);
    const emoji = results('🌟', {}, candidates).matches[0];
    expect(emoji.labelPositions).toEqual([0, 1]);
    expect(quickOpenLabelParts(emoji.entry.label, emoji.labelPositions)).toEqual([
      { text: '🌟', matched: true }, { text: 'star.srp', matched: false },
    ]);
  });

  it('splits labels into plain text runs without interpreting markup', () => {
    const label = '<script>.srp';
    const parts = quickOpenLabelParts(label, [1, 2, 3, 4, 5, 6]);
    expect(parts).toEqual([
      { text: '<', matched: false },
      { text: 'script', matched: true },
      { text: '>.srp', matched: false },
    ]);
    expect(parts.map(part => part.text).join('')).toBe(label);
    expect(quickOpenLabelParts('', [0])).toEqual([]);
    expect(quickOpenLabelParts('main.srp', [])).toEqual([{ text: 'main.srp', matched: false }]);
  });

  it('returns explicit empty results for an empty workspace', () => {
    expect(results('', {}, [])).toEqual({
      matches: [], eligible: 0, matched: 0,
      inputLimited: false, resultLimited: false, invalidQuery: false,
    });
  });
});
