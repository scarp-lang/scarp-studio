import { scanScarpSource, tokenAtOffset } from '../language/sourceLex';
import type { InsightToken } from '../language/sourceLex';
import type { StudioDocument } from './documents';
import { unicodeSafePreviewBounds } from './utf8Text';

/** Literal identifier-reference navigation across ALREADY-OPEN Scarp tabs.
 * This is not language-server resolution: overloaded symbols, module aliases,
 * scopes, declaration shadowing and compiler semantics are not inferred.
 *
 * Strings and line comments are never reference sites. All reads use the
 * supplied editor snapshots only; no filesystem, network or subprocess API.
 */
export const MAX_REFERENCE_FILES = 32;
export const MAX_REFERENCE_TOTAL_UNITS = 2 * 1024 * 1024;
export const MAX_REFERENCE_HITS = 320;
export const MAX_REFERENCE_PREVIEW_UNITS = 200;
export const MAX_REFERENCE_LINE_INDEX = 20000;
export const MAX_REFERENCE_IDENTIFIER_UNITS = 128;
export type ReferenceRole = 'declaration-like' | 'usage';
export interface ScarpReferenceHit {
  id: string;
  documentId: string;
  documentName: string;
  documentRevision: number;
  token: string;
  role: ReferenceRole;
  line: number;
  column: number;
  offset: number;
  end: number;
  preview: string;
  previewStartColumn: number;
}
export interface OpenCodeReferenceResult {
  hits: ScarpReferenceHit[];
  matches: number;
  complete: boolean;
  searchedDocuments: number;
  skippedDocuments: number;
  totalOpenDocuments: number;
  error: string | null;
  message: string | null;
}
export interface ReferenceSearchOptions {
  caseSensitive: boolean;
  scope: 'all' | 'active';
  activeId: string | null;
}
const declarationKeywords = new Set([
  'funcra', 'record', 'variant', 'bind', 'var', 'as',
]);
const validIdentifier = (text: string): boolean =>
  !!text && text.length <= MAX_REFERENCE_IDENTIFIER_UNITS &&
  /^[A-Za-z_][A-Za-z_0-9]*$/.test(text);

function lineStarts(source: string): number[] | null {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 13) {
      if (source.charCodeAt(i+1) === 10) i++;
      starts.push(i+1);
    } else if (source.charCodeAt(i) === 10) {
      starts.push(i+1);
    }
    if (starts.length > MAX_REFERENCE_LINE_INDEX) return null;
  }
  return starts;
}
function lineAt(
  source: string, starts: readonly number[], line: number,
): string | null {
  if (line < 1 || line > starts.length) return null;
  const start = starts[line-1];
  let end = line < starts.length ? starts[line] : source.length;
  if (end > start && source.charCodeAt(end-1) === 10) end--;
  if (end > start && source.charCodeAt(end-1) === 13) end--;
  return source.slice(start,end);
}

function makePreview(
  source: string, starts: readonly number[],
  line: number, column: number, tokenLength: number,
): { preview: string; previewStartColumn: number } {
  const text = lineAt(source,starts,line);
  if (text === null) return { preview:'', previewStartColumn:1 };
  const from = Math.max(0,column-1-70);
  const to = Math.min(text.length,column-1+tokenLength+90);
  const safe = unicodeSafePreviewBounds(text,from,to);
  const boundedTo = Math.min(safe.end,safe.start+MAX_REFERENCE_PREVIEW_UNITS);
  return {
    preview: text.slice(safe.start,boundedTo),
    previewStartColumn: safe.start+1,
  };
}

function lexicalRole(tokens: readonly InsightToken[], index: number): ReferenceRole {
  // Only call this a declaration-LIKE site. The actual Scarp compiler may
  // reject or reinterpret the syntax, especially in incomplete buffers.
  const before = tokens[index-1];
  if (!before || before.kind !== 'identifier') return 'usage';
  return declarationKeywords.has(before.text) ? 'declaration-like' : 'usage';
}

/** Return an identifier beneath the Monaco caret, also accepting the caret
 * immediately after a token. Validate line/column before computing offsets
 * so a malformed cursor cannot extract unrelated source text.
 */
export function scarpIdentifierAtCursor(
  source: string, line: number, column: number,
): string | null {
  if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) ||
      line < 1 || column < 1 || source.length > 512*1024) return null;
  const starts = lineStarts(source);
  if (!starts) return null;
  const row = lineAt(source,starts,line);
  if (row === null || column > row.length+1) return null;
  const offset = starts[line-1]+column-1;
  const lex = scanScarpSource(source);
  if (!lex.complete) return null;
  let token = tokenAtOffset(lex.tokens,offset);
  if (!token && column > 1) {
    const preceding = tokenAtOffset(lex.tokens,offset-1);
    if (preceding?.end === offset) token = preceding;
  }
  if (!token || token.kind !== 'identifier' ||
      !validIdentifier(token.text) || token.line !== line) return null;
  return token.text;
}

/** Lexical code-use search, not a compiler cross-reference database.
 * Excludes strings and comments, bounds source, work and total results,
 * and never exposes incomplete results as exhaustive.
 */
export function findOpenCodeReferences(
  documents: readonly StudioDocument[],
  identifier: string,
  options: ReferenceSearchOptions,
): OpenCodeReferenceResult {
  const empty: OpenCodeReferenceResult = {
    hits: [], matches:0, complete:true, searchedDocuments:0,
    skippedDocuments:0, totalOpenDocuments:documents.length,
    error:null, message:null,
  };
  if (!validIdentifier(identifier)) {
    return { ...empty, error:'Enter a Scarp identifier (ASCII, up to 128 characters).' };
  }
  const selected = options.scope === 'active'
    ? documents.filter(document => document.id === options.activeId)
    : documents;
  const bounded = selected.slice(0,MAX_REFERENCE_FILES);
  const hits: ScarpReferenceHit[] = [];
  let totalUnits = 0, searched = 0, skipped = selected.length-bounded.length;
  let complete = skipped === 0;
  const normalizedQuery = options.caseSensitive ? identifier : identifier.toLowerCase();
  for (const document of bounded) {
    if (hits.length >= MAX_REFERENCE_HITS) {
      complete = false;
      skipped += bounded.length-searched;
      break;
    }
    if (document.content.length > 512*1024 ||
        totalUnits+document.content.length > MAX_REFERENCE_TOTAL_UNITS) {
      skipped++;
      complete = false;
      continue;
    }
    totalUnits += document.content.length;
    searched++;
    const lexical = scanScarpSource(document.content);
    const starts = lineStarts(document.content);
    if (!lexical.complete || !starts) {
      skipped++;
      complete = false;
      continue;
    }
    const tokens = lexical.tokens;
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (token.kind !== 'identifier') continue;
      const candidate = options.caseSensitive ? token.text : token.text.toLowerCase();
      if (candidate !== normalizedQuery) continue;
      if (hits.length >= MAX_REFERENCE_HITS) {
        complete = false;
        break;
      }
      const excerpt = makePreview(document.content,starts,token.line,token.column,
        token.end-token.start);
      hits.push({
        id:document.id+':reference:'+token.start,
        documentId:document.id, documentName:document.name,
        documentRevision:document.revision, token:token.text,
        role:lexicalRole(tokens,index),
        line:token.line, column:token.column,
        offset:token.start, end:token.end,
        preview:excerpt.preview,previewStartColumn:excerpt.previewStartColumn,
      });
    }
  }
  if (!complete) empty.message =
    'Reference results are incomplete due to the fixed source/token/result budgets.';
  return {
    ...empty, hits, matches:hits.length, complete,
    searchedDocuments:searched, skippedDocuments:skipped,
    message:complete?null:empty.message,
  };
}

/** Resolve a hit to the EXACT current open buffer version. In particular,
 * close/reopen or edit-away/edit-back cannot resurrect an old navigation.
 */
export function currentReferenceNavigationTarget(
  hit: ScarpReferenceHit,
  documents: readonly StudioDocument[],
): { documentId:string; revision:number; source:string; line:number; column:number } | null {
  const document = documents.find(doc => doc.id === hit.documentId);
  if (!document || document.revision !== hit.documentRevision ||
      document.content.slice(hit.offset,hit.end) !== hit.token) return null;
  if (!Number.isSafeInteger(hit.line) || !Number.isSafeInteger(hit.column) ||
      hit.line < 1 || hit.column < 1) return null;
  return {
    documentId:document.id,revision:document.revision,
    source:document.content,line:hit.line,column:hit.column,
  };
}

export function countReferenceRoles(hits: readonly ScarpReferenceHit[]) {
  let declarationLike = 0, usages = 0;
  for (const hit of hits) {
    if (hit.role === 'declaration-like') declarationLike++;
    else usages++;
  }
  return { declarationLike, usages };
}

/** Group code references by their currently-open tab identity; caller order
 * remains stable and is not mutated by presentation.
 */
export function groupOpenCodeReferences(
  hits: readonly ScarpReferenceHit[],
): { documentId:string; documentName:string; hits:ScarpReferenceHit[] }[] {
  const groups = new Map<string,{documentId:string;documentName:string;hits:ScarpReferenceHit[]}>();
  for (const hit of hits) {
    let group = groups.get(hit.documentId);
    if (!group) {
      group = {documentId:hit.documentId,documentName:hit.documentName,hits:[]};
      groups.set(hit.documentId,group);
    }
    group.hits.push(hit);
  }
  return [...groups.values()];
}
