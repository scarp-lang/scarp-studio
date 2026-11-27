import { describe, expect, it } from 'vitest';
import { editorReducer, initialEditorState, type EditorState } from './editorState';
import { createOpenFileReplaceUndo, canUndoOpenFileReplace } from './openFileReplaceUndo';
import { AutoSaveReviewGate } from './autoSaveReviewGate';
import { DEFAULT_RANGE_REQUEST, MAX_RANGE_LINES, MAX_RANGE_LINE_UNITS, MAX_RANGE_SOURCE_UNITS,
  MAX_RANGE_AFFIX_UNITS, lineRangePlanIsCurrent, parseRangeLine, planLineRange, rangeEndingLabel, visibleRangeText,
  type RangeRequest } from './lineRangeTools';

function editor(content: string): EditorState {
  return editorReducer(initialEditorState, { type: 'edit', id: initialEditorState.activeId!, content });
}
function plan(content: string, request: Partial<RangeRequest>) {
  const state = editor(content);
  const result = planLineRange(state, { ...DEFAULT_RANGE_REQUEST, ...request });
  if (!result.ok) throw Error(result.error);
  return result.value;
}
describe('line range text operations', () => {
  it('sorts only the requested lines and preserves mixed separator slots', () => {
    const source = 'header\r\nz\nb\ra\r\nfooter';
    const result = plan(source, { first: 2, last: 4 });
    expect(result.change.content).toBe('header\r\na\nb\rz\r\nfooter');
    expect(result.before.map(line => line.ending)).toEqual(['\n','\r','\r\n']);
    expect(result.after.map(line => line.ending)).toEqual(['\n','\r','\r\n']);
    expect(result.changedRows).toBe(2);
  });
  it('sorts descending without numeric or locale assumptions', () => {
    expect(plan('10\n1\n2', { first: 1, last: 3, operation: 'sort-descending' }).change.content).toBe('2\n10\n1');
    expect(plan('1\n2\n10', { first: 1, last: 3, operation: 'sort-descending' }).change.content).toBe('2\n10\n1');
  });
  it('uses stable case-insensitive ordering without changing text', () => {
    expect(plan('z\nb\nA\na\nB', { first: 1, last: 5, caseSensitive: false }).change.content).toBe('A\na\nb\nB\nz');
  });
  it('reverses selected source without moving the final separator', () => {
    expect(plan('a\r\nb\rc\n', { first: 1, last: 3, operation: 'reverse' }).change.content).toBe('c\r\nb\ra\n');
  });
  it('keeps a source without terminal newline without a terminal newline', () => {
    expect(plan('a\r\nb', { first: 1, last: 2, operation: 'reverse' }).change.content).toBe('b\r\na');
  });
  it('indents nonempty rows with the selected number of spaces', () => {
    expect(plan('a\n\n\tb\n', { first: 1, last: 3, operation: 'indent', indentWidth: 3 }).change.content).toBe('   a\n\n   \tb\n');
  });
  it('outdents a single tab or at most the requested number of spaces', () => {
    const source = '\ta\n    b\n c\nx';
    expect(plan(source, { first: 1, last: 4, operation: 'outdent', indentWidth: 2 }).change.content).toBe('a\n  b\nc\nx');
  });
  it('adds literal prefix/suffix, including Unicode and spaces', () => {
    expect(plan('a\r\nb', { first: 1, last: 2, operation: 'prefix', affix: '// 😀 ' }).change.content).toBe('// 😀 a\r\n// 😀 b');
    expect(plan('a\nb', { first: 1, last: 2, operation: 'suffix', affix: ';' }).change.content).toBe('a;\nb;');
  });
  it('supports affixing an empty document without inventing a newline', () => {
    expect(plan('', { operation: 'prefix', affix: '// note' }).change.content).toBe('// note');
  });
  it('trims only trailing horizontal spaces and tabs', () => {
    expect(plan(' a \t\r\nb\u00a0 \nnext', { first: 1, last: 2, operation: 'trim-horizontal' }).change.content).toBe(' a\r\nb\u00a0\nnext');
  });
  it('deduplicates exact lines, preserving the first occurrence, case and boundary', () => {
    const result = plan('outside\nA\r\nA\na\rA\r\noutside', { first: 2, last: 5, operation: 'deduplicate' });
    expect(result.change.content).toBe('outside\nA\r\na\r\noutside');
    expect(result.removedRows).toBe(2);
    expect(result.after.map(line => line.ending)).toEqual(['\r\n','\r\n']);
  });
  it('deduplicates an EOF range without adding a terminal newline', () => {
    expect(plan('a\r\na', { first: 1, last: 2, operation: 'deduplicate' }).change.content).toBe('a');
  });
  it('canonicalizes operation options without silently applying irrelevant input', () => {
    expect(plan('b\na', { first: 1, last: 2, affix: 'ignored', indentWidth: 8 }).request)
      .toMatchObject({ affix: '', indentWidth: 2, caseSensitive: true });
  });
  it('provides visible line-ending labels', () => {
    expect(['\r\n','\r','\n',''].map(ending => rangeEndingLabel(ending as '\n'))).toEqual(['CRLF','CR','LF','EOF']);
  });
});
describe('bounded complete line review', () => {
  it.each(['','0','-1','1.5','1e2','Infinity','12345678','12:1'])('rejects invalid line input %j', value => {
    expect(parseRangeLine(value)).toBeNull();
  });
  it('accepts positive decimal line input with surrounding whitespace', () => {
    expect(parseRangeLine(' 002 ')).toBe(2);
  });
  it('rejects reversed, out-of-range and excessively wide line selections', () => {
    const state = editor('a\nb');
    for (const request of [{first: 0,last: 1},{first: 2,last: 1},{first: 1,last: 3},{first: 1,last: MAX_RANGE_LINES+1}]) {
      expect(planLineRange(state, { ...DEFAULT_RANGE_REQUEST, ...request }).ok).toBe(false);
    }
  });
  it('rejects a terminal empty editor line following a final separator', () => {
    expect(planLineRange(editor('a\n'), { ...DEFAULT_RANGE_REQUEST, first: 1, last: 2, operation: 'reverse' }).ok).toBe(false);
  });
  it('rejects invalid operations, widths and literal affixes', () => {
    for (const patch of [
      { operation: 'execute' as never }, { indentWidth: 0 }, { indentWidth: 9 },
      { operation: 'prefix' as const, affix: '' }, { operation: 'suffix' as const, affix: '\n' },
      { operation: 'prefix' as const, affix: '\u202e' }, { operation: 'suffix' as const, affix: '\ud800' },
      { operation: 'prefix' as const, affix: 'x'.repeat(MAX_RANGE_AFFIX_UNITS+1) },
    ]) expect(planLineRange(editor('a'), { ...DEFAULT_RANGE_REQUEST, ...patch }).ok).toBe(false);
  });
  it('rejects long sources, long selected lines and oversized transformed previews', () => {
    expect(planLineRange(editor('x'.repeat(MAX_RANGE_SOURCE_UNITS+1)), DEFAULT_RANGE_REQUEST).ok).toBe(false);
    expect(planLineRange(editor('x'.repeat(MAX_RANGE_LINE_UNITS+1)), DEFAULT_RANGE_REQUEST).ok).toBe(false);
    expect(planLineRange(editor('x'.repeat(MAX_RANGE_LINE_UNITS)), {
      ...DEFAULT_RANGE_REQUEST, operation: 'prefix', affix: 'a',
    }).ok).toBe(false);
    const content = Array.from({length: MAX_RANGE_LINES}, () => 'x'.repeat(MAX_RANGE_LINE_UNITS)).join('\n');
    expect(planLineRange(editor(content), { ...DEFAULT_RANGE_REQUEST, last: MAX_RANGE_LINES, operation: 'reverse' }).ok).toBe(false);
  });
  it('rejects a no-op and malformed source instead of creating an undo entry', () => {
    expect(planLineRange(editor('a\nb'), { ...DEFAULT_RANGE_REQUEST, last: 2 }).ok).toBe(false);
    expect(planLineRange(editor('\ud800'), { ...DEFAULT_RANGE_REQUEST, operation: 'prefix', affix: 'x' }).ok).toBe(false);
  });
});
describe('exact line transformation commit and undo', () => {
  it('rejects stale source edits, focus ABA, and forged preview or content', () => {
    const state = editor('b\na');
    const reviewed = planLineRange(state, { ...DEFAULT_RANGE_REQUEST, last: 2 });
    if (!reviewed.ok) throw Error(reviewed.error);
    const p = reviewed.value;
    expect(lineRangePlanIsCurrent(p, state)).toBe(true);
    const edited = editorReducer(state, { type: 'edit', id: state.activeId!, content: 'x' });
    const restored = editorReducer(edited, { type: 'edit', id: state.activeId!, content: 'b\na' });
    expect(lineRangePlanIsCurrent(p, restored)).toBe(false);
    const other = editorReducer(state, { type: 'new' });
    const back = editorReducer(other, { type: 'activate', id: state.activeId! });
    expect(lineRangePlanIsCurrent(p, back)).toBe(false);
    expect(lineRangePlanIsCurrent({ ...p, change: { ...p.change, content: 'fabricated' } }, state)).toBe(false);
    expect(lineRangePlanIsCurrent({ ...p, before: [{ ...p.before[0], text: 'fabricated' }, p.before[1]] }, state)).toBe(false);
  });
  it('applies only the exact active snapshot and supports guarded replacement undo', () => {
    let state = editorReducer(initialEditorState, { type: 'open', path: 'C:/demo/other.srp', content: 'untouched' });
    state = editorReducer(state, { type: 'open', path: 'C:/demo/main.srp', content: 'b\na' });
    const before = state.documents;
    const reviewed = planLineRange(state, { ...DEFAULT_RANGE_REQUEST, last: 2 });
    if (!reviewed.ok) throw Error(reviewed.error);
    const applied = editorReducer(state, { type: 'replace-open-files', changes: [reviewed.value.change], allSnapshots: before });
    const doc = applied.documents.find(item => item.id === state.activeId)!;
    expect(doc.content).toBe('a\nb');
    expect(doc.savedContent).toBe('b\na');
    expect(applied.documents.find(item => item.name === 'other.srp')?.content).toBe('untouched');
    const gate = new AutoSaveReviewGate();
    gate.holdReplacements(applied.documents, [doc.id]);
    expect(gate.canWrite(doc, doc, true)).toBe(false);
    const undo = createOpenFileReplaceUndo(before, applied.documents)!;
    expect(canUndoOpenFileReplace(undo, applied)).toBe(true);
    const undone = editorReducer(applied, { type: 'replace-open-files', changes: undo.changes, allSnapshots: undo.after });
    expect(undone.documents.find(item => item.id === doc.id)?.content).toBe('b\na');
  });
});


describe('separator fusion and exact preview safety', () => {
  it('refuses to fuse an interior CR and LF when an empty line is moved between them', () => {
    const result = planLineRange(editor('z\ra\n\rx'), {
      ...DEFAULT_RANGE_REQUEST, first: 1, last: 3, operation: 'sort-descending',
    });
    // Sorting puts the empty line last, not between CR and LF.
    expect(result.ok).toBe(true);
    const unsafe = planLineRange(editor('z\ra\n\rx'), {
      ...DEFAULT_RANGE_REQUEST, first: 1, last: 3, operation: 'reverse',
    });
    expect(unsafe.ok).toBe(true);
    const trim = planLineRange(editor('a\r \nb'), {
      ...DEFAULT_RANGE_REQUEST, first: 2, last: 2, operation: 'trim-horizontal',
    });
    expect(trim).toMatchObject({ ok: false, error: expect.stringContaining('merge adjacent CR and LF') });
  });
  it('refuses a transformed blank interior row that merges line-ending slots', () => {
    const result = planLineRange(editor('a\r \nb'), {
      ...DEFAULT_RANGE_REQUEST, first: 1, last: 3, operation: 'trim-horizontal',
    });
    expect(result.ok).toBe(false);
  });
  it('can inspect a distant line without building an inventory of preceding lines', () => {
    const content = '\n'.repeat(100000) + 'a\nb';
    expect(plan(content, { first: 100001, last: 100002, operation: 'reverse' }).change.content)
      .toBe('\n'.repeat(100000) + 'b\na');
  });
  it('distinguishes empty, whitespace, literal marker text and directional controls', () => {
    expect(visibleRangeText('')).toBe('""');
    expect(visibleRangeText('(empty)')).toBe('"(empty)"');
    expect(visibleRangeText(' \t')).toBe('" \\t"');
    expect(visibleRangeText('a\u202eb')).toBe('"a\\u202eb"');
  });
});
