import { scanScarpSource, scarpInsightIdentifier, MAX_INSIGHT_SOURCE_UNITS, type InsightToken } from '../language/sourceLex';
import { scarpTokenHelp } from '../language/assist';
import { currentActiveDocument, sameOpenDocumentSnapshots, type EditorState, type BufferReplacement } from './editorState';
import type { StudioDocument } from './documents';
import { assertScarpSourceText } from './sourceLimits';
import { unicodeSafePreviewBounds } from './utf8Text';

export const MAX_IDENTIFIER_EDIT_FILES = 24;
export const MAX_IDENTIFIER_EDIT_UNITS = 1024 * 1024;
export const MAX_IDENTIFIER_EDIT_SITES = 160;
export const MAX_IDENTIFIER_EDIT_PREVIEW = 240;
export type IdentifierEditScope = 'active' | 'open';
export interface IdentifierEditRequest {
  readonly from: string;
  readonly to: string;
  readonly scope: IdentifierEditScope;
}
export interface IdentifierEditSite {
  readonly id: string;
  readonly documentId: string;
  readonly documentName: string;
  readonly revision: number;
  readonly offset: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
  readonly role: 'declaration-like' | 'qualified' | 'other';
  readonly before: string;
  readonly after: string;
  readonly omittedPrefix: boolean;
  readonly omittedSuffix: boolean;
}
export interface IdentifierCollision {
  readonly documentId: string;
  readonly documentName: string;
  readonly count: number;
}
export interface IdentifierEditInventory {
  readonly request: IdentifierEditRequest;
  readonly sessionRevision: number;
  readonly activeId: string | null;
  readonly snapshots: readonly StudioDocument[];
  readonly sites: readonly IdentifierEditSite[];
  readonly collisions: readonly IdentifierCollision[];
  readonly scannedFiles: number;
}
export interface IdentifierEditPlan {
  readonly inventory: IdentifierEditInventory;
  readonly selectedIds: readonly string[];
  readonly changes: readonly BufferReplacement[];
}
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });
const declaration = new Set(['funcra', 'record', 'variant', 'bind', 'var', 'as']);
const reserved = new Set([
  'funcra','record','variant','bind','var','import','as','pub','pure','if','elif','else','while',
  'repeat','return','break','continue','and','or','not','needs','ensures','assert','match','on',
  'case','new','true','false','let','mut','for','in','self','super','const','type','enum','struct',
]);
export function validEditIdentifier(text: string): boolean {
  return scarpInsightIdentifier(text) && !reserved.has(text) && !scarpTokenHelp(text);
}
function standalone(source: string, token: InsightToken): boolean {
  return token.kind === 'identifier' && !token.previewTruncated &&
    !(token.start > 0 && /[^\x00-\x7f]/.test(source[token.start - 1])) &&
    !(token.end < source.length && /[^\x00-\x7f]/.test(source[token.end]));
}
function canonical(request: IdentifierEditRequest): IdentifierEditRequest | null {
  if (!validEditIdentifier(request.from) || !validEditIdentifier(request.to) ||
      request.from === request.to || (request.scope !== 'active' && request.scope !== 'open')) return null;
  return Object.freeze({ from: request.from, to: request.to, scope: request.scope });
}
function excerpt(source: string, token: InsightToken, to: string) {
  let start = token.start, end = token.end;
  while (start > 0 && token.start - start < 48 && !/[\r\n]/.test(source[start - 1])) start--;
  while (end < source.length && end - token.end < 48 && !/[\r\n]/.test(source[end])) end++;
  const bounds = unicodeSafePreviewBounds(source, start, end);
  const prefix = source.slice(bounds.start, token.start);
  const suffix = source.slice(token.end, bounds.end);
  return {
    before: prefix + token.text + suffix, after: prefix + to + suffix,
    omittedPrefix: bounds.start > 0 && !/[\r\n]/.test(source[bounds.start - 1]),
    omittedSuffix: bounds.end < source.length && !/[\r\n]/.test(source[bounds.end]),
  };
}
/** All-or-nothing bounded scan. A partial scan, malformed lexical source
 * or ambiguous adjacent non-ASCII spelling cannot be a replacement review.
 * No scope resolution is claimed; users select individual literal sites.
 * No disk reads, writes or compiler invocation. */
export function scanIdentifierEdit(editor: EditorState, request: IdentifierEditRequest): Result<IdentifierEditInventory> {
  const normalized = canonical(request);
  if (!normalized) return fail('Choose two different non-keyword ASCII identifiers (up to 128 characters).');
  const selected = normalized.scope === 'active' ? editor.documents.filter(doc => doc.id === editor.activeId) : editor.documents;
  if (!selected.length) return fail('Open a source buffer first.');
  if (selected.length > MAX_IDENTIFIER_EDIT_FILES) return fail('Too many open buffers for a complete identifier review.');
  let units = 0;
  const sites: IdentifierEditSite[] = [], collisions: IdentifierCollision[] = [];
  for (const doc of selected) {
    units += doc.content.length;
    if (doc.content.length > MAX_INSIGHT_SOURCE_UNITS || units > MAX_IDENTIFIER_EDIT_UNITS) {
      return fail('Source budget exceeded. Narrow the scope before reviewing.');
    }
    try { assertScarpSourceText(doc.content); } catch { return fail('Source contains unsupported text.'); }
    const lex = scanScarpSource(doc.content);
    if (!lex.complete || lex.issues.length) return fail('Source has incomplete or malformed lexical content. Resolve it before reviewing.');
    const tokens = lex.tokens.filter(token => token.kind !== 'comment');
    let collisionCount = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.kind !== 'identifier' || (token.text !== normalized.from && token.text !== normalized.to)) continue;
      if (!standalone(doc.content, token)) return fail('An identifier is adjacent to unsupported non-ASCII code. Review manually.');
      if (token.text === normalized.to) { collisionCount++; continue; }
      if (sites.length >= MAX_IDENTIFIER_EDIT_SITES) return fail('Too many matching sites for a complete review. Narrow the scope.');
      const previous = tokens[i - 1];
      const role = previous?.kind === 'identifier' && declaration.has(previous.text) ? 'declaration-like' :
        previous?.kind === 'operator' && ['.', '::', '->', '?.'].includes(previous.text) ? 'qualified' : 'other';
      const preview = excerpt(doc.content, token, normalized.to);
      if (preview.before.length > MAX_IDENTIFIER_EDIT_PREVIEW || preview.after.length > MAX_IDENTIFIER_EDIT_PREVIEW) {
        return fail('A replacement preview exceeded its full context budget.');
      }
      sites.push(Object.freeze({
        id: JSON.stringify([doc.id, token.start]), documentId: doc.id, documentName: doc.name,
        revision: doc.revision, offset: token.start, end: token.end, line: token.line, column: token.column,
        role, ...preview,
      }));
    }
    if (collisionCount) collisions.push(Object.freeze({ documentId: doc.id, documentName: doc.name, count: collisionCount }));
  }
  if (!sites.length) return fail('No matching code identifiers in the selected open buffers.');
  return { ok: true, value: Object.freeze({
    request: normalized, sessionRevision: editor.sessionRevision, activeId: editor.activeId,
    snapshots: Object.freeze(editor.documents.map(doc => Object.freeze({ ...doc }))),
    sites: Object.freeze(sites), collisions: Object.freeze(collisions), scannedFiles: selected.length,
  }) };
}
function sameInventory(a: IdentifierEditInventory, b: IdentifierEditInventory): boolean {
  // All fields are canonical plain data. Snapshots are checked separately
  // rather than serialized, avoiding a second giant source string.
  return a.sessionRevision === b.sessionRevision && a.activeId === b.activeId &&
    a.request.from === b.request.from && a.request.to === b.request.to && a.request.scope === b.request.scope &&
    a.scannedFiles === b.scannedFiles &&
    JSON.stringify(a.sites) === JSON.stringify(b.sites) && JSON.stringify(a.collisions) === JSON.stringify(b.collisions);
}
export function identifierInventoryIsCurrent(inventory: IdentifierEditInventory, editor: EditorState): boolean {
  return inventory.sessionRevision === editor.sessionRevision && inventory.activeId === editor.activeId &&
    sameOpenDocumentSnapshots(inventory.snapshots, editor.documents);
}
export function planIdentifierEdit(inventory: IdentifierEditInventory, selectedIds: readonly string[],
  editor: EditorState): Result<IdentifierEditPlan> {
  if (!identifierInventoryIsCurrent(inventory, editor)) return fail('Editor session changed. Scan again.');
  const fresh = scanIdentifierEdit(editor, inventory.request);
  if (!fresh.ok || !sameInventory(fresh.value, inventory)) return fail('Identifier inventory changed. Scan again.');
  const ids = new Set(selectedIds);
  if (!ids.size || ids.size !== selectedIds.length || ids.size > inventory.sites.length ||
      selectedIds.some(id => !inventory.sites.some(site => site.id === id))) return fail('Select distinct reviewed identifier sites.');
  const selected = fresh.value.sites.filter(site => ids.has(site.id));
  const changes: BufferReplacement[] = [];
  for (const snapshot of fresh.value.snapshots) {
    const sites = selected.filter(site => site.documentId === snapshot.id);
    if (!sites.length) continue;
    let offset = 0;
    const chunks: string[] = [];
    for (const site of sites) {
      if (site.offset < offset || snapshot.content.slice(site.offset, site.end) !== inventory.request.from) {
        return fail('Identifier offsets no longer match source.');
      }
      chunks.push(snapshot.content.slice(offset, site.offset), inventory.request.to);
      offset = site.end;
    }
    chunks.push(snapshot.content.slice(offset));
    const content = chunks.join('');
    try { assertScarpSourceText(content); } catch { return fail('Replacement would exceed the source limit.'); }
    changes.push(Object.freeze({ id: snapshot.id, snapshot, content }));
  }
  return { ok: true, value: Object.freeze({
    inventory: fresh.value, selectedIds: Object.freeze(selected.map(site => site.id)), changes: Object.freeze(changes),
  }) };
}
export function identifierPlanIsCurrent(plan: IdentifierEditPlan, editor: EditorState): boolean {
  const fresh = planIdentifierEdit(plan.inventory, plan.selectedIds, editor);
  return fresh.ok && fresh.value.changes.length === plan.changes.length &&
    fresh.value.selectedIds.every((id, i) => id === plan.selectedIds[i]) &&
    fresh.value.changes.every((change, i) => {
      const actual = plan.changes[i];
      return actual.id === change.id && actual.content === change.content &&
        sameOpenDocumentSnapshots([actual.snapshot], [change.snapshot]);
    });
}
export function identifierEditActiveName(editor: EditorState): string {
  return currentActiveDocument(editor)?.name ?? 'No active buffer';
}
