import { scanScarpSource, tokenAtOffset, MAX_INSIGHT_SOURCE_UNITS, type InsightToken } from '../language/sourceLex';
import type { StudioDocument } from './documents';
import { canApplyReplacementSnapshots, sameOpenDocumentSnapshots, type BufferReplacement, type EditorState } from './editorState';
import { assertScarpSourceText } from './sourceLimits';

export const MAX_QUALITY_DOCUMENTS = 40;
export const MAX_QUALITY_WORKSPACE_UNITS = 2 * 1024 * 1024;
export const MAX_QUALITY_FINDINGS = 600;
export const MAX_QUALITY_FILE_FINDINGS = 240;
export const MAX_QUALITY_LINE_LENGTH = 120;
export const QUALITY_RULES = [
  'trailing-whitespace', 'mixed-indentation', 'long-line', 'missing-final-newline',
  'mixed-newlines', 'unclosed-string', 'unexpected-control', 'directional-control',
  'unmatched-delimiter',
] as const;
export type QualityRule = typeof QUALITY_RULES[number];
export type QualitySeverity = 'review' | 'style';
export type QualityScope = 'active' | 'open';
export const QUALITY_LABELS: Readonly<Record<QualityRule, string>> = Object.freeze({
  'trailing-whitespace': 'Trailing whitespace',
  'mixed-indentation': 'Mixed indentation',
  'long-line': 'Long line',
  'missing-final-newline': 'Missing final newline',
  'mixed-newlines': 'Mixed line endings',
  'unclosed-string': 'Possible unclosed string',
  'unexpected-control': 'Unexpected control code',
  'directional-control': 'Invisible directional control',
  'unmatched-delimiter': 'Possible unmatched delimiter',
});
export interface QualityEdit {
  readonly start: number;
  readonly end: number;
  readonly original: string;
  readonly replacement: string;
}
export interface QualityFinding {
  readonly id: string;
  readonly rule: QualityRule;
  readonly severity: QualitySeverity;
  readonly documentId: string;
  readonly documentName: string;
  readonly revision: number;
  readonly line: number;
  readonly column: number;
  readonly offset: number;
  readonly message: string;
  readonly edit?: QualityEdit;
}
export interface QualityFileReport {
  readonly document: StudioDocument;
  readonly complete: boolean;
  readonly findings: readonly QualityFinding[];
  readonly reason?: string;
}
export interface QualityReport {
  readonly scope: QualityScope;
  readonly activeId: string | null;
  readonly snapshots: readonly StudioDocument[];
  readonly files: readonly QualityFileReport[];
  readonly findings: readonly QualityFinding[];
  readonly complete: boolean;
  readonly omittedDocuments: number;
  readonly analyzedUnits: number;
}
const opening = new Map([['(', ')'], ['[', ']'], ['{', '}']]);
const closing = new Set(opening.values());
const bidi = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const safeWhitespace = /^[ \t]+$/;
type RawFinding = Omit<QualityFinding, 'id' | 'documentId' | 'documentName' | 'revision'>;

function immutableDocument(document: StudioDocument): StudioDocument {
  return Object.freeze({ ...document });
}

export function analyzeQualityFile(document: StudioDocument): QualityFileReport {
  const snapshot = immutableDocument(document);
  const source = snapshot.content;
  if (source.length > MAX_INSIGHT_SOURCE_UNITS) {
    return Object.freeze({ document: snapshot, complete: false, findings: Object.freeze([]),
      reason: 'Source exceeds the per-file analysis budget.' });
  }
  const scan = scanScarpSource(source);
  const findings: QualityFinding[] = [];
  let capped = false;
  function add(raw: RawFinding): void {
    if (findings.length >= MAX_QUALITY_FILE_FINDINGS) { capped = true; return; }
    findings.push(Object.freeze({
      ...raw, id: JSON.stringify([snapshot.id, raw.rule, raw.offset]),
      documentId: snapshot.id, documentName: snapshot.name, revision: snapshot.revision,
      ...(raw.edit ? { edit: Object.freeze({ ...raw.edit }) } : {}),
    }));
  }
  const review = (rule: QualityRule, offset: number, line: number, column: number, message: string) =>
    add({ rule, severity: 'review', offset, line, column, message });
  const lexicalIssues = scan.issues.filter(issue => issue.kind === 'unterminated-string' || issue.kind === 'invalid-control');
  const lexicalSafe = scan.complete && lexicalIssues.length === 0;
  for (const issue of lexicalIssues) {
    review(issue.kind === 'unterminated-string' ? 'unclosed-string' : 'unexpected-control',
      issue.offset, issue.line, issue.column, issue.message);
  }

  // Mismatched nesting is a conservative editor observation. Stop at the
  // first mismatch instead of inventing cascades of parser errors.
  if (lexicalSafe) {
    const stack: InsightToken[] = [];
    let mismatch = false;
    for (const token of scan.tokens) {
      if (token.kind !== 'delimiter') continue;
      if (opening.has(token.text)) stack.push(token);
      else if (closing.has(token.text)) {
        const previous = stack.pop();
        if (!previous || opening.get(previous.text) !== token.text) {
          review('unmatched-delimiter', token.start, token.line, token.column,
            previous ? 'Closing delimiter does not match the last opening delimiter.' : 'Closing delimiter has no preceding opener.');
          mismatch = true;
          break;
        }
      }
    }
    if (!mismatch) {
      for (const token of stack) review('unmatched-delimiter', token.start, token.line, token.column,
        'Opening delimiter has no matching closer in this buffer.');
    }
  }

  // A single pass over original UTF-16 offsets handles LF, CRLF and CR
  // without normalizing source or changing Monaco-compatible coordinates.
  let start = 0;
  let line = 1;
  const lineEndings = new Set<string>();
  function inspectLine(end: number): void {
    const text = source.slice(start, end);
    const trailing = /[ \t]+$/.exec(text);
    if (trailing) {
      const offset = start + trailing.index;
      const insideString = tokenAtOffset(scan.tokens, offset)?.kind === 'string';
      const editable = lexicalSafe && !insideString;
      add({ rule: 'trailing-whitespace', severity: 'style', offset, line, column: trailing.index + 1,
        message: trailing[0].length + ' trailing space/tab unit(s).',
        ...(editable ? { edit: { start: offset, end, original: trailing[0], replacement: '' } } : {}),
      });
    }
    const indent = /^[ \t]+/.exec(text)?.[0];
    if (indent?.includes(' ') && indent.includes('\t')) {
      add({ rule: 'mixed-indentation', severity: 'style', offset: start, line, column: 1,
        message: 'Indentation contains both tabs and spaces; review alignment manually.' });
    }
    if (text.length > MAX_QUALITY_LINE_LENGTH) {
      const offset = start + MAX_QUALITY_LINE_LENGTH;
      // Avoid jumping into the second code unit of a surrogate pair.
      const unit = source.charCodeAt(offset);
      const safeOffset = unit >= 0xdc00 && unit <= 0xdfff ? offset - 1 : offset;
      add({ rule: 'long-line', severity: 'style', offset: safeOffset, line, column: safeOffset - start + 1,
        message: 'Line contains ' + text.length + ' UTF-16 units (review threshold ' + MAX_QUALITY_LINE_LENGTH + ').' });
    }
    for (let i = 0; i < text.length; i++) {
      if (bidi.test(text[i])) review('directional-control', start + i, line, i + 1,
        'Invisible directional control U+' + text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0') +
        '; review manually, including inside comments and strings.');
    }
  }
  let firstMixed: { offset: number; line: number; column: number } | null = null;
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== '\n' && source[i] !== '\r') continue;
    inspectLine(i);
    const kind = source[i] === '\r' && source[i + 1] === '\n' ? 'crlf' : source[i] === '\r' ? 'cr' : 'lf';
    lineEndings.add(kind);
    if (lineEndings.size > 1 && !firstMixed) firstMixed = { offset: i, line, column: i - start + 1 };
    if (kind === 'crlf') i++;
    start = i + 1;
    line++;
  }
  inspectLine(source.length);
  if (firstMixed) add({ rule: 'mixed-newlines', severity: 'style', ...firstMixed,
    message: 'Buffer contains more than one newline convention. No automatic normalization.' });
  if (source.length && !/[\r\n]$/.test(source)) {
    const last = source.length;
    // Do not create a newline for lexically incomplete source or mixed EOLs.
    const eol = lineEndings.has('crlf') ? '\r\n' : lineEndings.has('cr') ? '\r' : '\n';
    add({ rule: 'missing-final-newline', severity: 'style', offset: last, line, column: last - start + 1,
      message: 'Nonempty buffer does not end with a newline.',
      ...(lexicalSafe && lineEndings.size <= 1 ? { edit: { start: last, end: last, original: '', replacement: eol } } : {}),
    });
  }
  findings.sort((a, b) => a.offset - b.offset || a.rule.localeCompare(b.rule));
  // No automatic cleanup on incomplete reports. The report may contain
  // navigable observations, but does not claim comprehensive coverage.
  const complete = scan.complete && !capped;
  const result = complete ? findings : findings.map(({ edit: _edit, ...finding }) => Object.freeze(finding));
  return Object.freeze({ document: snapshot, complete, findings: Object.freeze(result),
    ...(!complete ? { reason: 'Lexical or finding budget reached; cleanup disabled for this source.' } : {}) });
}

export function analyzeSourceQuality(documents: readonly StudioDocument[], activeId: string | null, scope: QualityScope): QualityReport {
  const selected = scope === 'active' ? documents.filter(doc => doc.id === activeId) : documents;
  const snapshots = Object.freeze(documents.map(immutableDocument));
  const files: QualityFileReport[] = [];
  const findings: QualityFinding[] = [];
  let analyzedUnits = 0;
  let omittedDocuments = 0;
  for (const document of selected) {
    if (files.length >= MAX_QUALITY_DOCUMENTS ||
        analyzedUnits + document.content.length > MAX_QUALITY_WORKSPACE_UNITS ||
        findings.length >= MAX_QUALITY_FINDINGS) {
      omittedDocuments++;
      continue;
    }
    const report = analyzeQualityFile(document);
    analyzedUnits += document.content.length;
    const remaining = MAX_QUALITY_FINDINGS - findings.length;
    if (report.findings.length > remaining) {
      const limited = Object.freeze(report.findings.slice(0, remaining).map(({ edit: _edit, ...finding }) => Object.freeze(finding)));
      files.push(Object.freeze({ ...report, complete: false, findings: limited, reason: 'Workspace finding budget reached.' }));
      findings.push(...limited);
    } else {
      files.push(report);
      findings.push(...report.findings);
    }
  }
  return Object.freeze({ scope, activeId, snapshots, files: Object.freeze(files),
    findings: Object.freeze(findings), complete: omittedDocuments === 0 && files.every(file => file.complete),
    omittedDocuments, analyzedUnits });
}

export interface QualityFilter {
  readonly query: string;
  readonly rule: QualityRule | 'all';
  readonly severity: QualitySeverity | 'all';
  readonly fixableOnly: boolean;
}
export const DEFAULT_QUALITY_FILTER: QualityFilter = Object.freeze({ query: '', rule: 'all', severity: 'all', fixableOnly: false });

export function filterQualityFindings(findings: readonly QualityFinding[], filter: QualityFilter): QualityFinding[] {
  const terms = filter.query.slice(0, 120).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return findings.filter(finding => {
    if (filter.rule !== 'all' && finding.rule !== filter.rule) return false;
    if (filter.severity !== 'all' && finding.severity !== filter.severity) return false;
    if (filter.fixableOnly && !finding.edit) return false;
    const search = [finding.documentName, QUALITY_LABELS[finding.rule], finding.message].join(' ').toLowerCase();
    return terms.every(term => search.includes(term));
  });
}

export interface QualityCleanupChange extends BufferReplacement {
  readonly findingCount: number;
}
export interface QualityCleanupPlan {
  readonly scope: QualityScope;
  readonly activeId: string | null;
  readonly snapshots: readonly StudioDocument[];
  readonly selectedIds: readonly string[];
  readonly changes: readonly QualityCleanupChange[];
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const failure = (error: string): Result<never> => ({ ok: false, error });

/** Only two explicitly supported edits exist. Recompute findings from exact
 * snapshots instead of trusting offsets supplied by a UI or stale preview. */
export function planQualityCleanup(report: QualityReport, selectedIds: readonly string[]): Result<QualityCleanupPlan> {
  if (!report.complete) return failure('Analysis is incomplete. Narrow the scope before cleanup.');
  if (!selectedIds.length || selectedIds.length > MAX_QUALITY_FINDINGS || new Set(selectedIds).size !== selectedIds.length) {
    return failure('Select one or more distinct cleanup findings.');
  }
  const verified = analyzeSourceQuality(report.snapshots, report.activeId, report.scope);
  if (!verified.complete) return failure('Source analysis is incomplete.');
  const selected = new Set(selectedIds);
  const findings = verified.findings.filter(finding => selected.has(finding.id));
  if (findings.length !== selectedIds.length || findings.some(finding => !finding.edit)) return failure('Selection contains stale or non-fixable findings.');
  const changes: QualityCleanupChange[] = [];
  try {
    for (const document of verified.snapshots) {
      const items = findings.filter(finding => finding.documentId === document.id);
      if (!items.length) continue;
      const edits = items.map(item => item.edit!).sort((a, b) => a.start - b.start || a.end - b.end);
      const parts: string[] = [];
      let offset = 0;
      for (const edit of edits) {
        if (edit.start < offset || edit.end < edit.start || edit.end > document.content.length ||
            document.content.slice(edit.start, edit.end) !== edit.original) return failure('Cleanup ranges overlap or are stale.');
        if (!(edit.replacement === '' && safeWhitespace.test(edit.original) ||
            edit.original === '' && ['\n', '\r\n', '\r'].includes(edit.replacement) && edit.start === document.content.length)) {
          return failure('Unsupported cleanup edit.');
        }
        parts.push(document.content.slice(offset, edit.start), edit.replacement);
        offset = edit.end;
      }
      parts.push(document.content.slice(offset));
      const content = parts.join('');
      assertScarpSourceText(content);
      if (content !== document.content) changes.push(Object.freeze({
        id: document.id, snapshot: document, content, findingCount: items.length,
      }));
    }
  } catch { return failure('Cleanup would exceed the supported source limits or produce invalid UTF-16.'); }
  if (!changes.length) return failure('No source would change.');
  return { ok: true, value: Object.freeze({ scope: report.scope, activeId: report.activeId, snapshots: verified.snapshots,
    selectedIds: Object.freeze([...selectedIds]), changes: Object.freeze(changes) }) };
}

export function qualityPlanIsCurrent(plan: QualityCleanupPlan, state: EditorState): boolean {
  if (plan.scope !== 'open' && plan.scope !== 'active') return false;
  if (plan.scope === 'active' && plan.activeId !== state.activeId) return false;
  if (!sameOpenDocumentSnapshots(plan.snapshots, state.documents) || !canApplyReplacementSnapshots(state, plan.changes)) return false;
  const checked = planQualityCleanup(analyzeSourceQuality(state.documents, plan.activeId, plan.scope), plan.selectedIds);
  return checked.ok && checked.value.changes.length === plan.changes.length &&
    checked.value.changes.every((change, index) => {
      const candidate = plan.changes[index];
      return change.id === candidate.id && change.content === candidate.content && change.findingCount === candidate.findingCount;
    });
}

/** Report is deliberately local and read-only; does not contain paths, source
 * excerpts, or raw invisible controls. Document names are still user data. */
export function qualityReportText(report: QualityReport, findings: readonly QualityFinding[]): string {
  return [
    'Scarp Studio source quality (editor-only, not compiler verification)',
    'Scope: ' + report.scope + '; coverage: ' + (report.complete ? 'complete within editor rules' : 'limited'),
    'Files analyzed: ' + report.files.length + '; omitted: ' + report.omittedDocuments,
    'Findings shown: ' + findings.length,
    ...findings.map(item => JSON.stringify(item.documentName) + ':' + item.line + ':' + item.column +
      ' [' + item.severity + '] ' + QUALITY_LABELS[item.rule] + ' — ' + item.message),
  ].join('\n');
}
