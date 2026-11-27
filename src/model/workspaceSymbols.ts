import { scanScarpSource, scarpInsightIdentifier, MAX_INSIGHT_SOURCE_UNITS, type InsightToken } from '../language/sourceLex';
import { functionHeaderOpenIndex,functionCallOpenIndex } from '../language/genericSyntax';
import { scarpTokenHelp } from '../language/assist';
import { blocksLocalFunctionName } from '../language/localCallContext';
import type { StudioDocument } from './documents';
import { unicodeSafePreviewBounds } from './utf8Text';

export const MAX_SYMBOL_FILES = 40;
export const MAX_SYMBOL_TOTAL_UNITS = 2 * 1024 * 1024;
export const MAX_SYMBOLS_PER_FILE = 400;
export const MAX_WORKSPACE_SYMBOLS = 1500;
export const MAX_SYMBOL_CALLS_PER_FILE = 1200;
export const MAX_WORKSPACE_CALLS = 4000;
export const MAX_SYMBOL_NESTING = 128;
export const MAX_SYMBOL_QUERY = 120;
export const SYMBOL_KINDS = ['function', 'record', 'variant', 'binding', 'variable', 'import-alias'] as const;
export type SymbolKind = typeof SYMBOL_KINDS[number];
export type SymbolVisibility = 'public' | 'local';
export type SymbolScope = 'top-level' | 'nested';
export type SymbolSearchScope = 'active' | 'open';
export const SYMBOL_KIND_LABELS: Readonly<Record<SymbolKind, string>> = Object.freeze({
  function: 'Function', record: 'Record', variant: 'Variant', binding: 'Immutable binding',
  variable: 'Mutable variable', 'import-alias': 'Import alias',
});
const keywords = new Set([
  'funcra', 'record', 'variant', 'bind', 'var', 'import', 'as', 'pub', 'pure', 'if', 'elif',
  'else', 'while', 'repeat', 'return', 'break', 'continue', 'and', 'or', 'not', 'needs',
  'ensures', 'assert', 'match', 'on', 'case', 'new', 'true', 'false', 'let', 'mut',
]);
const declarationKinds: Readonly<Record<string, SymbolKind>> = Object.freeze({
  funcra: 'function', record: 'record', variant: 'variant', bind: 'binding', var: 'variable',
});
const openClose = new Map([['(', ')'], ['[', ']'], ['{', '}']]);
const closes = new Set(openClose.values());
export interface SymbolLocation {
  readonly documentId: string;
  readonly documentName: string;
  readonly revision: number;
  readonly offset: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
  readonly name: string;
}
export interface WorkspaceSymbol extends SymbolLocation {
  readonly id: string;
  readonly kind: SymbolKind;
  readonly scope: SymbolScope;
  readonly visibility: SymbolVisibility;
  readonly pure: boolean;
  readonly depth: number;
  readonly header: string;
}
export interface WorkspaceCall extends SymbolLocation {
  readonly id: string;
  /** The closest recognized function body, not a resolved call graph edge. */
  readonly enclosingSymbolId: string | null;
}
export type SymbolCoverageReason =
  'source-limit' | 'lexical-limit' | 'lexical-issue' | 'nesting-limit' |
  'delimiter-mismatch' | 'unfinished-delimiter' | 'symbol-limit' | 'call-limit' |
  'workspace-symbol-limit' | 'workspace-call-limit';
export interface SymbolFileIndex {
  readonly document: StudioDocument;
  readonly symbols: readonly WorkspaceSymbol[];
  readonly calls: readonly WorkspaceCall[];
  readonly complete: boolean;
  readonly reasons: readonly SymbolCoverageReason[];
}
export interface WorkspaceSymbolIndex {
  readonly scope: SymbolSearchScope;
  readonly activeId: string | null;
  readonly files: readonly SymbolFileIndex[];
  readonly symbols: readonly WorkspaceSymbol[];
  readonly calls: readonly WorkspaceCall[];
  readonly complete: boolean;
  readonly omittedDocuments: number;
  readonly analyzedUnits: number;
  readonly selectedDocuments: number;
}
const qualified = (token: InsightToken | undefined): boolean =>
  !!token && token.kind === 'operator' && (token.text === '.' || token.text === '::' || token.text === '->');
function identifier(source: string, token: InsightToken | undefined): token is InsightToken {
  if (!token || token.kind !== 'identifier' || token.previewTruncated ||
      !scarpInsightIdentifier(token.text) || keywords.has(token.text)) return false;
  // This is an ASCII editor index. Do not claim a suffix/prefix of adjacent
  // non-ASCII code is a complete standalone name.
  return !(token.start > 0 && /[^\x00-\x7f]/.test(source[token.start - 1])) &&
    !(token.end < source.length && /[^\x00-\x7f]/.test(source[token.end]));
}
function location(document: StudioDocument, token: InsightToken): SymbolLocation {
  return { documentId: document.id, documentName: document.name, revision: document.revision,
    offset: token.start, end: token.end, line: token.line, column: token.column, name: token.text };
}
function shortHeader(source: string, start: number, end: number): string {
  const bounds = unicodeSafePreviewBounds(source, start, Math.min(end, start + 180));
  return source.slice(bounds.start, bounds.end).replace(/[\r\n\t ]+/g, ' ').trim();
}
interface Frame {
  readonly close: string;
  readonly functionId: string | null;
}
/** A declaration inventory deliberately accepts only recognizable lexical
 * headers. It never infers overloads, lexical binding resolution, imports,
 * types, visibility enforcement, or compiler validity.
 * Comments are trivia, strings remain atomic tokens.
 */
export function indexSymbolFile(input: StudioDocument): SymbolFileIndex {
  const document = Object.freeze({ ...input });
  const source = document.content;
  const reasons = new Set<SymbolCoverageReason>();
  const symbols: WorkspaceSymbol[] = [];
  const calls: WorkspaceCall[] = [];
  function finish(): SymbolFileIndex {
    return Object.freeze({ document, symbols: Object.freeze(symbols), calls: Object.freeze(calls),
      complete: reasons.size === 0, reasons: Object.freeze([...reasons]) });
  }
  if (source.length > MAX_INSIGHT_SOURCE_UNITS) { reasons.add('source-limit'); return finish(); }
  const lexical = scanScarpSource(source);
  if (!lexical.complete) reasons.add('lexical-limit');
  if (lexical.issues.some(issue => issue.kind === 'unterminated-string' || issue.kind === 'invalid-control')) {
    reasons.add('lexical-issue');
    // Malformed strings and controls may change token interpretation.
    return finish();
  }
  const tokens = lexical.tokens.filter(token => token.kind !== 'comment');
  const frames: Frame[] = [];
  const declarationOffsets = new Set<number>();
  // A pending function header is consumed only at a same-depth body brace.
  // Track it through parameter and contract parentheses, never across a
  // terminating semicolon or an enclosing-frame exit.
  const pendingFunctions = new Map<number, string>();
  let braceDepth = 0;
  let nearestFunction: string | null = null;
  const enclosingFunctions: (string | null)[] = [];
  function addSymbol(kind: SymbolKind, keywordIndex: number, nameIndex: number, headerEnd: number): WorkspaceSymbol | null {
    const token = tokens[nameIndex];
    if (!identifier(source, token)) return null;
    declarationOffsets.add(token.start);
    if (symbols.length >= MAX_SYMBOLS_PER_FILE) { reasons.add('symbol-limit'); return null; }
    let start = keywordIndex;
    let pure = false;
    let publiclyMarked = false;
    // Only adjacent recognized modifiers are relevant. Do not scan arbitrary
    // preceding source or assume a public symbol's accessibility.
    for (let i = keywordIndex - 1; i >= Math.max(0, keywordIndex - 2); i--) {
      if (tokens[i].kind !== 'identifier') break;
      if (tokens[i].text === 'pure' && kind === 'function') pure = true;
      else if (tokens[i].text === 'pub') publiclyMarked = true;
      else break;
      start = i;
    }
    const item = Object.freeze({
      ...location(document, token), id: JSON.stringify([document.id, 'symbol', token.start]),
      kind, scope: braceDepth === 0 ? 'top-level' as const : 'nested' as const,
      visibility: publiclyMarked ? 'public' as const : 'local' as const, pure, depth: braceDepth,
      header: shortHeader(source, tokens[start].start, headerEnd),
    });
    symbols.push(item);
    return item;
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const previous = tokens[i - 1];
    const next = tokens[i + 1];
    const after = tokens[i + 2];
    const frameDepth = frames.length;
    // Headers inside parentheses/brackets are not indexed as declarations.
    const statementContext = !frames.length || frames.at(-1)?.close === '}';
    if (statementContext && token.kind === 'identifier' && !qualified(previous)) {
      const kind = Object.hasOwn(declarationKinds, token.text) ? declarationKinds[token.text] : undefined;
      if (kind && identifier(source, next)) {
        const functionOpen = kind === 'function' ? functionHeaderOpenIndex(tokens,i+1) : null;
        const validTail = kind === 'function' ? functionOpen !== null
          : kind === 'record' || kind === 'variant' ? after?.kind === 'delimiter' && after.text === '{'
          : after?.kind === 'operator' && (after.text === ':' || after.text === '=');
        if (validTail) {
          const item = addSymbol(kind, i, i + 1, functionOpen !== null ? tokens[functionOpen].end : after.end);
          if (kind === 'function' && item) pendingFunctions.set(frameDepth, item.id);
        }
      }
      if (token.text === 'import' && next?.kind === 'string' && !next.previewTruncated &&
          after?.kind === 'identifier' && after.text === 'as' && identifier(source, tokens[i + 3]) &&
          tokens[i + 4]?.text === ';') {
        addSymbol('import-alias', i, i + 3, tokens[i + 4].end);
      }
    }
    if (identifier(source, token) && functionCallOpenIndex(tokens,i) !== null &&
        !declarationOffsets.has(token.start) && !qualified(previous) &&
        !(previous && blocksLocalFunctionName(previous.text))) {
      if (calls.length >= MAX_SYMBOL_CALLS_PER_FILE) reasons.add('call-limit');
      else calls.push(Object.freeze({
        ...location(document, token), id: JSON.stringify([document.id, 'call', token.start]),
        enclosingSymbolId: nearestFunction,
      }));
    }
    if (token.kind !== 'delimiter') continue;
    if (openClose.has(token.text)) {
      const isBrace = token.text === '{';
      const functionId = isBrace ? pendingFunctions.get(frameDepth) ?? null : null;
      if (isBrace) {
        pendingFunctions.delete(frameDepth);
        braceDepth++;
        enclosingFunctions.push(nearestFunction);
        if (functionId) nearestFunction = functionId;
      }
      frames.push({ close: openClose.get(token.text)!, functionId });
      if (frames.length > MAX_SYMBOL_NESTING) { reasons.add('nesting-limit'); break; }
    } else if (closes.has(token.text)) {
      const frame = frames.pop();
      if (!frame || frame.close !== token.text) { reasons.add('delimiter-mismatch'); break; }
      pendingFunctions.delete(frameDepth);
      if (token.text === '}') { braceDepth--; nearestFunction = enclosingFunctions.pop() ?? null; }
    } else if (token.text === ';') pendingFunctions.delete(frameDepth);
  }
  if (frames.length && !reasons.has('delimiter-mismatch') && !reasons.has('nesting-limit')) reasons.add('unfinished-delimiter');
  return finish();
}
export function buildWorkspaceSymbolIndex(documents: readonly StudioDocument[], activeId: string | null,
  scope: SymbolSearchScope): WorkspaceSymbolIndex {
  const selected = scope === 'active' ? documents.filter(doc => doc.id === activeId) : documents;
  const files: SymbolFileIndex[] = [];
  const symbols: WorkspaceSymbol[] = [];
  const calls: WorkspaceCall[] = [];
  let analyzedUnits = 0;
  let omittedDocuments = 0;
  for (const document of selected) {
    if (files.length >= MAX_SYMBOL_FILES || analyzedUnits + document.content.length > MAX_SYMBOL_TOTAL_UNITS ||
        symbols.length >= MAX_WORKSPACE_SYMBOLS || calls.length >= MAX_WORKSPACE_CALLS) {
      omittedDocuments++;
      continue;
    }
    const file = indexSymbolFile(document);
    analyzedUnits += document.content.length;
    const fileSymbols = Object.freeze(file.symbols.slice(0, MAX_WORKSPACE_SYMBOLS - symbols.length));
    const validSymbolIds = new Set(fileSymbols.map(symbol => symbol.id));
    const fileCalls = Object.freeze(file.calls.slice(0, MAX_WORKSPACE_CALLS - calls.length).map(call =>
      call.enclosingSymbolId && !validSymbolIds.has(call.enclosingSymbolId) ?
        Object.freeze({ ...call, enclosingSymbolId: null }) : call));
    const reasons = [...file.reasons];
    if (fileSymbols.length !== file.symbols.length) reasons.push('workspace-symbol-limit');
    if (fileCalls.length !== file.calls.length) reasons.push('workspace-call-limit');
    files.push(Object.freeze({ ...file, symbols: fileSymbols, calls: fileCalls, reasons: Object.freeze(reasons),
      complete: reasons.length === 0 }));
    symbols.push(...fileSymbols);
    calls.push(...fileCalls);
  }
  return Object.freeze({ scope, activeId, files: Object.freeze(files), symbols: Object.freeze(symbols),
    calls: Object.freeze(calls), complete: omittedDocuments === 0 && files.every(file => file.complete),
    omittedDocuments, analyzedUnits, selectedDocuments: selected.length });
}
export const SYMBOL_COVERAGE_LABELS: Readonly<Record<SymbolCoverageReason, string>> = Object.freeze({
  'source-limit': 'Per-file source limit', 'lexical-limit': 'Lexical token limit',
  'lexical-issue': 'Malformed lexical input', 'nesting-limit': 'Nesting limit',
  'delimiter-mismatch': 'Possible mismatched delimiter', 'unfinished-delimiter': 'Unfinished delimiter',
  'symbol-limit': 'Per-file declaration limit', 'call-limit': 'Per-file call limit',
  'workspace-symbol-limit': 'Workspace declaration limit', 'workspace-call-limit': 'Workspace call limit',
});
export interface SymbolFilter {
  readonly query: string;
  readonly kind: SymbolKind | 'all';
  readonly scope: SymbolScope | 'all';
  readonly publicOnly: boolean;
  readonly pureOnly: boolean;
}
export const DEFAULT_SYMBOL_FILTER: SymbolFilter = Object.freeze({
  query: '', kind: 'all', scope: 'all', publicOnly: false, pureOnly: false,
});
export type SymbolOrder = 'source' | 'name' | 'kind';
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function searchWorkspaceSymbols(index: WorkspaceSymbolIndex, filter: SymbolFilter,
  order: SymbolOrder = 'source'): WorkspaceSymbol[] {
  const terms = filter.query.slice(0, MAX_SYMBOL_QUERY).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = index.symbols.filter(item => {
    if (filter.kind !== 'all' && item.kind !== filter.kind) return false;
    if (filter.scope !== 'all' && item.scope !== filter.scope) return false;
    if (filter.publicOnly && item.visibility !== 'public') return false;
    if (filter.pureOnly && !item.pure) return false;
    const haystack = [item.name, item.documentName, SYMBOL_KIND_LABELS[item.kind], item.scope,
      item.visibility, item.pure ? 'pure' : ''].join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
  if (order === 'name') matches.sort((a, b) => compareText(a.name.toLowerCase(), b.name.toLowerCase()) ||
    compareText(a.name, b.name) || compareText(a.documentName, b.documentName) || a.offset - b.offset);
  if (order === 'kind') matches.sort((a, b) => compareText(a.kind, b.kind) ||
    compareText(a.name, b.name) || compareText(a.documentName, b.documentName) || a.offset - b.offset);
  return matches;
}
export interface SymbolNameGroup {
  readonly name: string;
  readonly symbols: readonly WorkspaceSymbol[];
  readonly callCount: number;
}
/** Repeated names are observations, not duplicate declaration diagnostics.
 * Different files and nested scopes may legally reuse the same spelling. */
export function repeatedWorkspaceSymbolNames(index: WorkspaceSymbolIndex): readonly SymbolNameGroup[] {
  const groups = new Map<string, WorkspaceSymbol[]>();
  const counts = new Map<string, number>();
  for (const symbol of index.symbols) {
    const group = groups.get(symbol.name);
    if (group) group.push(symbol);
    else groups.set(symbol.name, [symbol]);
  }
  for (const call of index.calls) counts.set(call.name, (counts.get(call.name) ?? 0) + 1);
  return Object.freeze([...groups].filter(([, symbols]) => symbols.length > 1).map(([name, symbols]) =>
    Object.freeze({ name, symbols: Object.freeze(symbols), callCount: counts.get(name) ?? 0 }))
    .sort((a, b) => b.symbols.length - a.symbols.length || compareText(a.name, b.name)));
}
export type CallCandidateStatus = 'one-observed-function' | 'multiple-observed-functions' |
  'possible-shadow' | 'catalog-name' | 'unmatched' | 'incomplete-index';
export interface CallCandidateGroup {
  readonly name: string;
  readonly status: CallCandidateStatus;
  readonly calls: readonly WorkspaceCall[];
  readonly declarations: readonly WorkspaceSymbol[];
}
export const CALL_STATUS_LABELS: Readonly<Record<CallCandidateStatus, string>> = Object.freeze({
  'one-observed-function': 'One matching function name', 'multiple-observed-functions': 'Multiple matching function names',
  'possible-shadow': 'Other declarations share this name', 'catalog-name': 'Editor catalog name',
  unmatched: 'No indexed function name', 'incomplete-index': 'Index incomplete',
});
/** A name-based call inventory, NOT call resolution. Even one matching
 * function may be in a different module, out of scope or shadowed by a
 * parameter. Never use these candidates to implement semantic rename. */
export function workspaceCallCandidates(index: WorkspaceSymbolIndex): readonly CallCandidateGroup[] {
  const declarations = new Map<string, WorkspaceSymbol[]>();
  const groups = new Map<string, WorkspaceCall[]>();
  for (const item of index.symbols) {
    const list = declarations.get(item.name);
    if (list) list.push(item); else declarations.set(item.name, [item]);
  }
  for (const call of index.calls) {
    const list = groups.get(call.name);
    if (list) list.push(call); else groups.set(call.name, [call]);
  }
  return Object.freeze([...groups].map(([name, calls]) => {
    const observed = declarations.get(name) ?? [];
    const count = observed.filter(symbol => symbol.kind === 'function').length;
    const status: CallCandidateStatus = !index.complete ? 'incomplete-index'
      : observed.some(item => item.kind !== 'function') ? 'possible-shadow'
      : count > 1 ? 'multiple-observed-functions' : count === 1 ? 'one-observed-function'
      : scarpTokenHelp(name)?.kind === 'function' ? 'catalog-name' : 'unmatched';
    return Object.freeze({ name, status, calls: Object.freeze(calls), declarations: Object.freeze(observed) });
  }).sort((a, b) => b.calls.length - a.calls.length || compareText(a.name, b.name)));
}
export function currentSymbolLocation(index: WorkspaceSymbolIndex, item: SymbolLocation,
  documents: readonly StudioDocument[]): { documentId: string; revision: number; source: string; line: number; column: number } | null {
  const file = index.files.find(entry => entry.document.id === item.documentId);
  const document = documents.find(doc => doc.id === item.documentId);
  if (!file || !document || document.revision !== item.revision || document.revision !== file.document.revision ||
      document.content !== file.document.content || document.path !== file.document.path ||
      document.content.slice(item.offset, item.end) !== item.name) return null;
  const known = [...file.symbols, ...file.calls].some(candidate => candidate.offset === item.offset &&
    candidate.end === item.end && candidate.name === item.name && candidate.line === item.line && candidate.column === item.column);
  if (!known) return null;
  return { documentId: document.id, revision: document.revision, source: document.content, line: item.line, column: item.column };
}
function reportName(name: string): string {
  return JSON.stringify(name).replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}
export function workspaceSymbolReport(index: WorkspaceSymbolIndex, symbols: readonly WorkspaceSymbol[]): string {
  return ['Scarp Studio workspace symbol inventory (lexical observations only)',
    'Scope: ' + index.scope + '; coverage: ' + (index.complete ? 'within editor rules' : 'limited'),
    'Buffers indexed: ' + index.files.length + '/' + index.selectedDocuments,
    'Declarations listed: ' + symbols.length,
    ...index.files.filter(file => !file.complete).map(file => reportName(file.document.name) + ': ' +
      file.reasons.map(reason => SYMBOL_COVERAGE_LABELS[reason]).join(', ')),
    ...symbols.map(item => reportName(item.documentName) + ':' + item.line + ':' + item.column +
      ' ' + SYMBOL_KIND_LABELS[item.kind] + ' ' + item.name + ' [' + item.scope +
      (item.visibility === 'public' ? ', pub' : '') + (item.pure ? ', pure' : '') + ']'),
  ].join('\n');
}
