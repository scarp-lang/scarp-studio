import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import { MAX_INSIGHT_SOURCE_UNITS } from '../language/sourceLex';
import { buildWorkspaceSymbolIndex, indexSymbolFile, searchWorkspaceSymbols, repeatedWorkspaceSymbolNames,
  workspaceCallCandidates, currentSymbolLocation, workspaceSymbolReport, DEFAULT_SYMBOL_FILTER,
  MAX_SYMBOL_FILES, MAX_SYMBOLS_PER_FILE, MAX_WORKSPACE_SYMBOLS, MAX_SYMBOL_CALLS_PER_FILE,
  MAX_WORKSPACE_CALLS, MAX_SYMBOL_NESTING, MAX_SYMBOL_TOTAL_UNITS } from './workspaceSymbols';

const doc = (content: string, id = 'a', path: string | null = null): StudioDocument => ({
  ...createUntitled(1), id, name: id + '.srp', path, content, savedContent: content, revision: 1,
});
const single = (source: string) => indexSymbolFile(doc(source));
const names = (source: string) => single(source).symbols.map(item => item.name);
const callNames = (source: string) => single(source).calls.map(item => item.name);
describe('workspace declaration inventory', () => {
  it('indexes recognized declarations and explicit modifiers in source order', () => {
    const source = [
      'import "math.srp" as math;',
      'pub pure funcra sum(x: integer) -> integer {',
      '  bind answer: integer = x;',
      '  var running = answer;',
      '  return running;',
      '}',
      'record Item { value: integer }',
      'variant Choice { None, Some(integer) }',
      'bind total = 0;',
    ].join('\n');
    const result = single(source);
    expect(result.complete).toBe(true);
    expect(result.symbols.map(({ name, kind, scope, visibility, pure }) => ({ name, kind, scope, visibility, pure }))).toEqual([
      { name: 'math', kind: 'import-alias', scope: 'top-level', visibility: 'local', pure: false },
      { name: 'sum', kind: 'function', scope: 'top-level', visibility: 'public', pure: true },
      { name: 'answer', kind: 'binding', scope: 'nested', visibility: 'local', pure: false },
      { name: 'running', kind: 'variable', scope: 'nested', visibility: 'local', pure: false },
      { name: 'Item', kind: 'record', scope: 'top-level', visibility: 'local', pure: false },
      { name: 'Choice', kind: 'variant', scope: 'top-level', visibility: 'local', pure: false },
      { name: 'total', kind: 'binding', scope: 'top-level', visibility: 'local', pure: false },
    ]);
    expect(result.symbols[1].header).toBe('pub pure funcra sum(');
  });
  it('recognizes multiline and comment-separated headers without guessing parameter bindings', () => {
    const source = 'pub // public\npure funcra\n// header\ncompute\n(\n value: integer\n) -> integer {\n bind\nx\n= value;\nreturn x;\n}';
    const result = single(source);
    expect(result.symbols.map(item => [item.name, item.line, item.column])).toEqual([['compute', 4, 1], ['x', 9, 1]]);
    expect(result.symbols[0]).toMatchObject({ visibility: 'public', pure: true, depth: 0 });
    expect(result.symbols[1]).toMatchObject({ kind: 'binding', depth: 1 });
  });
  it('supports several declarations on the same line', () => {
    expect(names('bind a = 1; var b = 2; funcra f() {} record X {} variant Y {}')).toEqual(['a','b','f','X','Y']);
  });
  it('does not treat strings or comments as declarations', () => {
    expect(names('print("funcra ghost() { var hidden = 2; }"); // bind nope = 1;\nbind real = 3;')).toEqual(['real']);
  });
  it('ignores incomplete names, unsupported headers and qualified declaration keywords', () => {
    expect(names('funcra broken; record Empty; variant V; bind absent; var if = 1; x.funcra fake();')).toEqual([]);
    expect(names('bind abcé = 1; var éabc = 2; bind valid = 3;')).toEqual(['valid']);
  });
  it('requires a complete literal import alias header', () => {
    expect(names('import "a.srp" as good; import "b.srp" as incomplete\nimport name as wrong;')).toEqual(['good']);
  });
  it('does not confuse parentheses or array expressions with block declarations', () => {
    expect(names('f(bind fake = 1); [var other = 2]; { bind real = 3; }')).toEqual(['real']);
  });
  it('keeps original mixed newline offsets and columns', () => {
    const source = '//😀\r\nbind first = 1;\rvar second = 2;\nfuncra third() {}';
    const result = single(source);
    expect(result.symbols.map(item => [item.name, item.line, item.column])).toEqual([
      ['first',2,6],['second',3,5],['third',4,8],
    ]);
    for (const item of result.symbols) expect(source.slice(item.offset, item.end)).toBe(item.name);
  });
  it('does not inherit a public modifier across intervening syntax', () => {
    const result = single('pub funcra first() {} funcra second() {} pure funcra third() {}');
    expect(result.symbols.map(s => [s.name, s.visibility, s.pure])).toEqual([
      ['first','public',false], ['second','local',false], ['third','local',true],
    ]);
  });
  it('captures immutable document and inventory snapshots', () => {
    const input = doc('bind a = 1;');
    const result = indexSymbolFile(input);
    input.content = 'bind b = 2;';
    expect(result.document.content).toBe('bind a = 1;');
    expect(Object.isFrozen(result.document)).toBe(true);
    expect(Object.isFrozen(result.symbols)).toBe(true);
    expect(Object.isFrozen(result.symbols[0])).toBe(true);
  });
});
describe('workspace call-like inventory', () => {
  it('ignores declaration names, qualified calls and construction syntax', () => {
    const source = 'funcra work() { math.work(); x->work(); new Choice::Found(1); work(); input("x"); }';
    expect(callNames(source)).toEqual(['work','input']);
  });
  it('does not index call-like text in comments or strings', () => {
    expect(callNames('print("ghost()"); // hidden()\nwork();')).toEqual(['print','work']);
  });
  it('recognizes multiline trivia between a name and opening parenthesis', () => {
    expect(callNames('work // note\n(1); obj // comment\n. work(2);')).toEqual(['work']);
  });
  it('tracks nearest recognized function body through nested blocks and nested functions', () => {
    const source = [
      'top();',
      'funcra outer() {',
      '  first();',
      '  if true { second(); }',
      '  funcra inner() { third(); }',
      '  fourth();',
      '}',
      'last();',
    ].join('\n');
    const result = single(source);
    const byId = new Map(result.symbols.map(symbol => [symbol.id, symbol.name]));
    expect(result.calls.map(call => [call.name, byId.get(call.enclosingSymbolId ?? '') ?? null])).toEqual([
      ['top',null],['first','outer'],['second','outer'],['third','inner'],['fourth','outer'],['last',null],
    ]);
  });
  it('does not attach a subsequent block to a terminated function header', () => {
    const result = single('funcra pending(); { outside(); }');
    expect(result.calls[0].enclosingSymbolId).toBeNull();
  });
  it('retains source offsets and distinguishes declaration and call sites with unique IDs', () => {
    const result = single('funcra f() { f(); f(); }');
    expect(new Set([...result.symbols, ...result.calls].map(item => item.id)).size).toBe(3);
    expect(result.calls.map(item => item.offset)).toEqual([13,18]);
  });
});
describe('workspace coverage and budgets', () => {
  it('does not claim reliable inventory for malformed lexical input', () => {
    const result = single('funcra f() {} print("unterminated\n');
    expect(result.complete).toBe(false);
    expect(result.reasons).toContain('lexical-issue');
    expect(result.symbols).toEqual([]);
    expect(result.calls).toEqual([]);
  });
  it.each(['funcra f() {', 'funcra f() { ]'])('labels incomplete structure: %s', source => {
    const result = single(source);
    expect(result.complete).toBe(false);
    expect(result.symbols[0].name).toBe('f');
    expect(result.reasons).toContain(source.endsWith(']') ? 'delimiter-mismatch' : 'unfinished-delimiter');
  });
  it('rejects oversized buffers before tokenizing', () => {
    const result = single('x'.repeat(MAX_INSIGHT_SOURCE_UNITS + 1));
    expect(result.reasons).toEqual(['source-limit']);
    expect(result.symbols).toEqual([]);
  });
  it('enforces lexical and nesting limits', () => {
    const tokens = single('x;'.repeat(13000));
    expect(tokens.reasons).toContain('lexical-limit');
    const nested = single('{'.repeat(MAX_SYMBOL_NESTING + 1));
    expect(nested.reasons).toContain('nesting-limit');
  });
  it('caps symbols per file and labels the result incomplete', () => {
    const source = Array.from({ length: MAX_SYMBOLS_PER_FILE + 2 }, (_, i) => 'bind n' + i + ' = 0;').join('\n');
    const result = single(source);
    expect(result.symbols).toHaveLength(MAX_SYMBOLS_PER_FILE);
    expect(result.reasons).toContain('symbol-limit');
  });
  it('caps calls per file independently', () => {
    const result = single('f();'.repeat(MAX_SYMBOL_CALLS_PER_FILE + 3));
    expect(result.calls).toHaveLength(MAX_SYMBOL_CALLS_PER_FILE);
    expect(result.reasons).toContain('call-limit');
  });
  it('selects only active buffer when requested', () => {
    const documents = [doc('bind a = 1;', 'a'), doc('bind b = 2;', 'b')];
    expect(buildWorkspaceSymbolIndex(documents, 'b', 'active').symbols.map(item => item.name)).toEqual(['b']);
    expect(buildWorkspaceSymbolIndex(documents, null, 'active').symbols).toEqual([]);
    expect(buildWorkspaceSymbolIndex(documents, null, 'open').symbols.map(item => item.name)).toEqual(['a','b']);
  });
  it('does not scan more than the maximum number of open buffers', () => {
    const documents = Array.from({ length: MAX_SYMBOL_FILES + 2 }, (_, i) => doc('bind item = 0;', String(i)));
    const result = buildWorkspaceSymbolIndex(documents, '0', 'open');
    expect(result.files).toHaveLength(MAX_SYMBOL_FILES);
    expect(result.omittedDocuments).toBe(2);
    expect(result.complete).toBe(false);
  });
  it('respects the combined source-unit budget', () => {
    const documents = Array.from({ length: 6 }, (_, i) => doc(' '.repeat(MAX_INSIGHT_SOURCE_UNITS), String(i)));
    const result = buildWorkspaceSymbolIndex(documents, '0', 'open');
    expect(result.analyzedUnits).toBe(MAX_SYMBOL_TOTAL_UNITS);
    expect(result.omittedDocuments).toBe(2);
    expect(result.complete).toBe(false);
  });
  it('truncates global declarations and call sites, recording the exact reason', () => {
    const source = Array.from({ length: 390 }, (_, i) => 'bind n' + i + ' = 0;').join('\n');
    const documents = Array.from({ length: 5 }, (_, i) => doc(source, String(i)));
    const result = buildWorkspaceSymbolIndex(documents, '0', 'open');
    expect(result.symbols).toHaveLength(MAX_WORKSPACE_SYMBOLS);
    expect(result.files.at(-1)?.reasons).toContain('workspace-symbol-limit');
    expect(result.omittedDocuments).toBe(1);
    const callDocs = Array.from({ length: 5 }, (_, i) => doc('f();'.repeat(1100), String(i)));
    const calls = buildWorkspaceSymbolIndex(callDocs, '0', 'open');
    expect(calls.calls).toHaveLength(MAX_WORKSPACE_CALLS);
    expect(calls.files.at(-1)?.reasons).toContain('workspace-call-limit');
    expect(calls.complete).toBe(false);
  });
});
describe('workspace symbol discovery', () => {
  const documents = [
    doc('pub pure funcra alpha() { bind local = 1; } record Box {}', 'one'),
    doc('funcra Zeta() {} funcra alpha() {} var count = 0; alpha();', 'two'),
  ];
  const index = buildWorkspaceSymbolIndex(documents, 'one', 'open');
  it('filters by all query terms, declaration type, nesting and modifiers', () => {
    const find = (patch: Partial<typeof DEFAULT_SYMBOL_FILTER>) =>
      searchWorkspaceSymbols(index, { ...DEFAULT_SYMBOL_FILTER, ...patch }).map(symbol => symbol.name);
    expect(find({ query: 'ONE alpha' })).toEqual(['alpha']);
    expect(find({ kind: 'record' })).toEqual(['Box']);
    expect(find({ scope: 'nested' })).toEqual(['local']);
    expect(find({ publicOnly: true, pureOnly: true })).toEqual(['alpha']);
    expect(find({ kind: 'record', pureOnly: true })).toEqual([]);
  });
  it('sorts by name and kind without mutating the source-order snapshot', () => {
    const sourceOrder = index.symbols.map(symbol => symbol.name);
    const named = searchWorkspaceSymbols(index, DEFAULT_SYMBOL_FILTER, 'name').map(symbol => symbol.name);
    expect(named).toEqual(['alpha','alpha','Box','count','local','Zeta']);
    const byKind = searchWorkspaceSymbols(index, DEFAULT_SYMBOL_FILTER, 'kind').map(symbol => symbol.kind);
    expect(byKind).toEqual([...byKind].sort());
    expect(index.symbols.map(symbol => symbol.name)).toEqual(sourceOrder);
  });
  it('groups repeated spellings across files without marking errors', () => {
    const groups = repeatedWorkspaceSymbolNames(index);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: 'alpha', callCount: 1 });
    expect(groups[0].symbols.map(item => item.documentId)).toEqual(['one','two']);
  });
  it('does not fold identifier case when grouping declarations', () => {
    const result = buildWorkspaceSymbolIndex([doc('bind Name = 1; bind name = 2;')], 'a', 'open');
    expect(repeatedWorkspaceSymbolNames(result)).toEqual([]);
  });
  it('classifies candidate names without claiming semantic resolution', () => {
    const result = buildWorkspaceSymbolIndex([
      doc('funcra one() {} funcra many() {} bind shadow = 0; funcra shadow() {} one(); many(); shadow(); input("x"); unknown();', 'a'),
      doc('funcra many() {}', 'b'),
    ], 'a', 'open');
    const groups = Object.fromEntries(workspaceCallCandidates(result).map(group => [group.name, group.status]));
    expect(groups).toMatchObject({
      one: 'one-observed-function',
      many: 'multiple-observed-functions',
      shadow: 'possible-shadow',
      input: 'catalog-name',
      unknown: 'unmatched',
    });
  });
  it('does not infer missing declarations or unique candidates from partial coverage', () => {
    const result = buildWorkspaceSymbolIndex([doc('funcra one() { one(); unknown();')], 'a', 'open');
    expect(workspaceCallCandidates(result).map(group => group.status)).toEqual(['incomplete-index','incomplete-index']);
  });
});
describe('workspace symbol navigation and reports', () => {
  it('navigates to the exact declaration and call snapshots', () => {
    const document = doc('funcra f() { f(); }');
    const index = buildWorkspaceSymbolIndex([document], 'a', 'open');
    const symbol = index.symbols[0];
    const call = index.calls[0];
    expect(currentSymbolLocation(index, symbol, [document])).toEqual({
      documentId: 'a', revision: 1, source: document.content, line: 1, column: 8,
    });
    expect(currentSymbolLocation(index, call, [document])?.column).toBe(14);
  });
  it('rejects changed revisions, same-length changed text, changed paths and fabricated positions', () => {
    const document = doc('bind a = 1;');
    const index = buildWorkspaceSymbolIndex([document], 'a', 'open');
    const symbol = index.symbols[0];
    for (const current of [
      { ...document, revision: 2 },
      { ...document, content: 'bind a = 2;' },
      { ...document, path: 'C:\\temp\\other.srp' },
    ]) expect(currentSymbolLocation(index, symbol, [current])).toBeNull();
    expect(currentSymbolLocation(index, { ...symbol, column: 999 }, [document])).toBeNull();
    expect(currentSymbolLocation(index, symbol, [])).toBeNull();
  });
  it('rejects ABA edit and close/reopen even when the declaration text is identical', () => {
    const document = doc('bind a = 1;', 'a', 'C:\\temp\\a.srp');
    const state = { ...initialEditorState, documents: [document], activeId: 'a', sessionRevision: 5 };
    const index = buildWorkspaceSymbolIndex(state.documents, 'a', 'open');
    const edited = editorReducer(state, { type: 'edit', id: 'a', content: 'bind b = 2;' });
    const restored = editorReducer(edited, { type: 'edit', id: 'a', content: document.content });
    expect(currentSymbolLocation(index, index.symbols[0], restored.documents)).toBeNull();
    const closed = editorReducer(state, { type: 'close', id: 'a', snapshot: document });
    const reopened = editorReducer(closed, { type: 'open', path: document.path!, content: document.content });
    expect(currentSymbolLocation(index, index.symbols[0], reopened.documents)).toBeNull();
  });
  it('reports lexical scope, names, and modifiers without paths or private source excerpts', () => {
    const document = { ...doc('pub funcra f() { print("private string"); }', 'a', 'C:\\secret\\a.srp'), name: 'a\u202e.srp' };
    const index = buildWorkspaceSymbolIndex([document], 'a', 'open');
    const report = workspaceSymbolReport(index, index.symbols);
    expect(report).toContain('Function f [top-level, pub]');
    expect(report).not.toContain('private string');
    expect(report).not.toContain('C:\\secret');
    expect(report).not.toContain('\u202e');
    expect(report).toContain('\\u202e');
  });
});
