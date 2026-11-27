import { describe, expect, it } from 'vitest';
import { createUntitled, type StudioDocument } from './documents';
import { editorReducer, initialEditorState, type EditorState } from './editorState';
import { AutoSaveReviewGate } from './autoSaveReviewGate';
import { createOpenFileReplaceUndo, canUndoOpenFileReplace } from './openFileReplaceUndo';
import { MAX_INSIGHT_SOURCE_UNITS } from '../language/sourceLex';
import { analyzeQualityFile, analyzeSourceQuality, DEFAULT_QUALITY_FILTER, filterQualityFindings,
  MAX_QUALITY_DOCUMENTS, MAX_QUALITY_FILE_FINDINGS, MAX_QUALITY_FINDINGS,
  planQualityCleanup, qualityPlanIsCurrent, qualityReportText, type QualityReport, type QualityRule } from './sourceQuality';

function doc(content: string, id = 'a', path: string | null = null): StudioDocument {
  return { ...createUntitled(1), id, name: id + '.srp', path, content, savedContent: content, revision: 1 };
}
function state(documents: StudioDocument[], activeId = documents[0]?.id ?? null): EditorState {
  return { ...initialEditorState, documents, activeId, sessionRevision: 1 };
}
const rules = (source: string) => analyzeQualityFile(doc(source)).findings.map(finding => finding.rule);
const byRule = (source: string, rule: QualityRule) => analyzeQualityFile(doc(source)).findings.filter(f => f.rule === rule);
function cleanup(report: QualityReport, ids = report.findings.filter(f => f.edit).map(f => f.id)) {
  const result = planQualityCleanup(report, ids);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
describe('source quality lexical observations', () => {
  it.each(['print("()[]{}"); // } ] (\n', 'funcra f() { print("a"); }\n', '', '\n'])(
    'does not treat quoted or commented delimiters as syntax: %j', source => {
      expect(rules(source)).not.toContain('unmatched-delimiter');
    });
  it.each([
    ['print([1, 2);', 1, 12],
    [')\n', 1, 1],
    ['{\r\n', 1, 1],
    ['print(\n', 1, 6],
    ['[{\n', 1, 1],
  ])('locates possible delimiter errors in %j', (source, line, column) => {
    const result = byRule(source, 'unmatched-delimiter');
    expect(result[0]).toMatchObject({ line, column, severity: 'review' });
    expect(result.every(f => !f.edit)).toBe(true);
  });
  it('does not manufacture cascading delimiter errors after a mismatch', () => {
    expect(byRule('([)]}})\n', 'unmatched-delimiter')).toHaveLength(1);
  });
  it('does not propose cleanup for incomplete string lines or any other line in that lexical snapshot', () => {
    const report = analyzeQualityFile(doc('print("abc  \nprint(1);  '));
    expect(report.findings.some(f => f.rule === 'unclosed-string')).toBe(true);
    expect(report.findings.some(f => f.edit)).toBe(false);
    expect(report.findings.some(f => f.rule === 'unmatched-delimiter')).toBe(false);
  });
  it('detects control codes without suggesting destructive removal', () => {
    const result = analyzeQualityFile(doc('print(1);\u0000  '));
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'unexpected-control', offset: 9 })]));
    expect(result.findings.some(f => f.edit)).toBe(false);
  });
  it.each(['\u061c','\u200e','\u200f','\u202a','\u202b','\u202c','\u202d','\u202e','\u2066','\u2067','\u2068','\u2069'])(
    'reports directional code in a string or comment without deleting it (%j)', code => {
      const source = 'print("a' + code + 'b"); // ' + code + '\n';
      const result = byRule(source, 'directional-control');
      expect(result).toHaveLength(2);
      expect(result[0].offset).toBe(8);
      expect(result[0].message).toContain(code.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));
      expect(result.every(f => !f.edit)).toBe(true);
    });
});
describe('source quality line rules', () => {
  it.each(['\n', '\r\n', '\r'])('retains original line endings %j', ending => {
    const source = 'print("ok");  ' + ending + ' \tprint(2);\t' + ending;
    const report = analyzeQualityFile(doc(source));
    const trailing = report.findings.filter(f => f.rule === 'trailing-whitespace');
    expect(trailing).toHaveLength(2);
    expect(trailing[0]).toMatchObject({ line: 1, column: 13, edit: { original: '  ', replacement: '' } });
    expect(trailing[1]).toMatchObject({ line: 2, column: 12, edit: { original: '\t', replacement: '' } });
    expect(report.findings.some(f => f.rule === 'mixed-indentation')).toBe(true);
    expect(report.findings.some(f => f.rule === 'mixed-newlines')).toBe(false);
    const plan = cleanup(analyzeSourceQuality([doc(source)], 'a', 'active'));
    expect(plan.changes[0].content).toBe('print("ok");' + ending + ' \tprint(2);' + ending);
  });
  it('reports the second line ending kind but never automatically normalizes it', () => {
    const report = analyzeQualityFile(doc('a\r\nb\nc'));
    expect(report.findings.find(f => f.rule === 'mixed-newlines')).toMatchObject({ line: 2, column: 2, offset: 4 });
    expect(report.findings.find(f => f.rule === 'missing-final-newline')?.edit).toBeUndefined();
  });
  it.each(['\n','\r\n','\r'])('inserts the existing EOL convention %j', eol => {
    const source = 'a' + eol + 'b';
    const result = cleanup(analyzeSourceQuality([doc(source)], 'a', 'active'));
    expect(result.changes[0].content).toBe(source + eol);
  });
  it('handles simultaneous trailing whitespace and EOF insertion', () => {
    const source = 'print("a  ");  ';
    const report = analyzeSourceQuality([doc(source)], 'a', 'active');
    expect(report.findings.filter(f => f.edit)).toHaveLength(2);
    expect(cleanup(report).changes[0].content).toBe('print("a  ");\n');
  });
  it('does not invent a newline for the empty buffer', () => {
    expect(rules('')).not.toContain('missing-final-newline');
  });
  it('does not split surrogate pairs when reporting long lines', () => {
    const finding = byRule('x'.repeat(119) + '😀' + '\n', 'long-line')[0];
    expect(finding.offset).toBe(119);
    expect(finding.column).toBe(120);
  });
  it('reports long lines but never wraps source', () => {
    const source = 'x'.repeat(121) + '\n';
    expect(byRule(source, 'long-line')).toMatchObject([{ severity: 'style', column: 121 }]);
    expect(byRule(source, 'long-line')[0].edit).toBeUndefined();
  });
});
describe('source quality bounded inventory', () => {
  it('supports active-only and all-open reports without reading disk', () => {
    const documents = [doc('a  ', 'one'), doc('b\t', 'two')];
    const active = analyzeSourceQuality(documents, 'two', 'active');
    expect(active.files.map(f => f.document.id)).toEqual(['two']);
    expect(active.snapshots.map(d => d.id)).toEqual(['one','two']);
    expect(analyzeSourceQuality(documents, 'two', 'open').files).toHaveLength(2);
    expect(analyzeSourceQuality(documents, null, 'active').findings).toEqual([]);
  });
  it('does not expose mutable source snapshot or edit records', () => {
    const input = doc('x  ');
    const report = analyzeSourceQuality([input], 'a', 'active');
    input.content = 'changed';
    expect(report.snapshots[0].content).toBe('x  ');
    expect(Object.isFrozen(report.snapshots)).toBe(true);
    expect(Object.isFrozen(report.snapshots[0])).toBe(true);
    expect(Object.isFrozen(report.findings[0])).toBe(true);
    expect(Object.isFrozen(report.findings[0].edit)).toBe(true);
  });
  it('omits oversize buffers without scanning or offering partial cleanup', () => {
    const report = analyzeSourceQuality([doc('x'.repeat(MAX_INSIGHT_SOURCE_UNITS + 1))], 'a', 'active');
    expect(report.complete).toBe(false);
    expect(report.files[0].findings).toEqual([]);
    expect(planQualityCleanup(report, ['anything']).ok).toBe(false);
  });
  it('caps findings per document and suppresses every edit', () => {
    const report = analyzeQualityFile(doc('a  \n'.repeat(MAX_QUALITY_FILE_FINDINGS + 10)));
    expect(report.complete).toBe(false);
    expect(report.findings).toHaveLength(MAX_QUALITY_FILE_FINDINGS);
    expect(report.findings.every(f => !f.edit)).toBe(true);
  });
  it('labels token-limited scans as incomplete', () => {
    const report = analyzeQualityFile(doc('a;'.repeat(13000)));
    expect(report.complete).toBe(false);
    expect(report.findings.every(f => !f.edit)).toBe(true);
  });
  it('caps open document count and refuses partial cleanup', () => {
    const docs = Array.from({ length: MAX_QUALITY_DOCUMENTS + 2 }, (_, i) => doc('x  ', String(i)));
    const report = analyzeSourceQuality(docs, '0', 'open');
    expect(report.files).toHaveLength(MAX_QUALITY_DOCUMENTS);
    expect(report.omittedDocuments).toBe(2);
    expect(report.complete).toBe(false);
    expect(planQualityCleanup(report, report.findings.filter(f => f.edit).map(f => f.id)).ok).toBe(false);
  });
  it('caps total findings across files without treating omitted files as clean', () => {
    const docs = Array.from({ length: 4 }, (_, i) => doc('a  \n'.repeat(200), String(i)));
    const report = analyzeSourceQuality(docs, '0', 'open');
    expect(report.findings).toHaveLength(MAX_QUALITY_FINDINGS);
    expect(report.omittedDocuments).toBe(1);
    expect(report.complete).toBe(false);
  });
  it('filters by filename, rule, severity and cleanup status', () => {
    const docs = [doc('a  ', 'alpha'), doc('b  ', 'beta'), doc(')', 'gamma')];
    const report = analyzeSourceQuality(docs, 'alpha', 'open');
    expect(filterQualityFindings(report.findings, { ...DEFAULT_QUALITY_FILTER, query: 'ALPHA trailing' })).toHaveLength(1);
    expect(filterQualityFindings(report.findings, { ...DEFAULT_QUALITY_FILTER, severity: 'review' })).toHaveLength(1);
    expect(filterQualityFindings(report.findings, { ...DEFAULT_QUALITY_FILTER, rule: 'trailing-whitespace', fixableOnly: true })).toHaveLength(2);
  });
});
describe('guarded reviewed quality cleanup', () => {
  it('can apply selected fields atomically while preserving unrelated findings', () => {
    const docs = [doc('a  \n', 'a'), doc('b\t\n', 'b')];
    const report = analyzeSourceQuality(docs, 'a', 'open');
    const plan = cleanup(report, [report.findings[1].id]);
    expect(plan.changes.map(c => c.id)).toEqual(['b']);
    const before = state(docs);
    expect(qualityPlanIsCurrent(plan, before)).toBe(true);
    const after = editorReducer(before, { type: 'replace-open-files', allSnapshots: plan.snapshots, changes: plan.changes });
    expect(after.documents.map(d => d.content)).toEqual(['a  \n', 'b\n']);
    expect(after.documents[0]).toBe(before.documents[0]);
    expect(after.documents[1].savedContent).toBe('b\t\n');
  });
  it('rejects empty, unknown, duplicated and non-fixable selections', () => {
    const report = analyzeSourceQuality([doc('x'.repeat(121) + '  ')], 'a', 'active');
    const fix = report.findings.find(f => f.edit)!;
    const nonFix = report.findings.find(f => !f.edit)!;
    for (const ids of [[], ['bad'], [fix.id, fix.id], [fix.id, nonFix.id]]) {
      expect(planQualityCleanup(report, ids).ok).toBe(false);
    }
  });
  it('does not trust a fabricated finding or modified replacement content', () => {
    const current = state([doc('a  ')]);
    const report = analyzeSourceQuality(current.documents, 'a', 'active');
    const plan = cleanup(report);
    const tampered = { ...plan, changes: [{ ...plan.changes[0], content: 'changed source' }] };
    expect(qualityPlanIsCurrent(tampered, current)).toBe(false);
    const fake = { ...report, findings: [{ ...report.findings[0], id: 'fake' }] };
    expect(planQualityCleanup(fake, ['fake']).ok).toBe(false);
  });
  it('invalidates review after any tab changes, including an unrelated buffer', () => {
    const current = state([doc('a  ', 'a'), doc('b\n', 'b')]);
    const plan = cleanup(analyzeSourceQuality(current.documents, 'a', 'active'));
    const changed = editorReducer(current, { type: 'edit', id: 'b', content: 'different' });
    expect(qualityPlanIsCurrent(plan, changed)).toBe(false);
    const switched = editorReducer(current, { type: 'activate', id: 'b' });
    expect(qualityPlanIsCurrent(plan, switched)).toBe(false);
    const created = editorReducer(current, { type: 'new' });
    expect(qualityPlanIsCurrent(plan, created)).toBe(false);
  });
  it('rejects byte-identical ABA edits because the source revision advanced', () => {
    const current = state([doc('a  ')]);
    const plan = cleanup(analyzeSourceQuality(current.documents, 'a', 'active'));
    const edited = editorReducer(current, { type: 'edit', id: 'a', content: 'other' });
    const restored = editorReducer(edited, { type: 'edit', id: 'a', content: 'a  ' });
    expect(qualityPlanIsCurrent(plan, restored)).toBe(false);
  });
  it('holds named changed snapshots from Auto Save and permits only current undo', () => {
    const current = state([doc('x  ', 'a', 'C:\\practice\\a.srp')]);
    const plan = cleanup(analyzeSourceQuality(current.documents, 'a', 'open'));
    const after = editorReducer(current, { type: 'replace-open-files', changes: plan.changes, allSnapshots: plan.snapshots });
    const gate = new AutoSaveReviewGate();
    gate.holdReplacements(after.documents, ['a']);
    expect(gate.canWrite(after.documents[0], after.documents[0], true)).toBe(false);
    const undo = createOpenFileReplaceUndo(current.documents, after.documents)!;
    expect(canUndoOpenFileReplace(undo, after)).toBe(true);
    const edited = editorReducer(after, { type: 'edit', id: 'a', content: 'new content' });
    expect(canUndoOpenFileReplace(undo, edited)).toBe(false);
    gate.reconcile(edited.documents);
    expect(gate.canWrite(edited.documents[0], edited.documents[0], true)).toBe(true);
  });
  it('report includes no source excerpts or absolute paths', () => {
    const report = analyzeSourceQuality([doc('print("private text");  ', 'a', 'C:\\private\\a.srp')], 'a', 'open');
    const text = qualityReportText(report, report.findings);
    expect(text).toContain('a.srp');
    expect(text).not.toContain('private text');
    expect(text).not.toContain('C:\\private');
    expect(text).toContain('not compiler verification');
  });
});
