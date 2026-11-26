import type { StudioDocument } from './documents';
import type { NavigationEntry } from './navigation';
import type { SnippetSnapshot } from './userSnippets';
import { snippetIdentity } from './userSnippets';
import { profileError, type ProfileResult } from './intelliSenseProfileTransfer';
import { assertScarpSourceText } from './sourceLimits';

const prefix = 'user-snippet:';
export interface SnippetPaletteEntry extends NavigationEntry {
  readonly prefix: string;
  readonly snippetRevision: number;
  readonly documentId: string;
  readonly documentRevision: number;
}
export interface SnippetInsertionSelection { readonly start: number; readonly end: number }
export interface SnippetInsertionPlan {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly caret: number;
}
/** Search metadata only: never index the snippet body, workspace path or
 * current buffer content in the command palette. */
export function buildSnippetPaletteEntries(snapshot: SnippetSnapshot, document: StudioDocument | null): SnippetPaletteEntry[] {
  if (!document || snapshot.persistence === 'blocked') return [];
  return snapshot.items.filter(item => item.enabled).map(item => Object.freeze({
    id: prefix + snippetIdentity(item.prefix),
    label: 'Insert user snippet: ' + item.name,
    detail: item.prefix + ' · expanded defaults' + (item.description ? ' · ' + item.description : ''),
    prefix: item.prefix, snippetRevision: snapshot.revision,
    documentId: document.id, documentRevision: document.revision,
  }));
}
export function isSnippetPaletteEntry(entry: NavigationEntry): entry is SnippetPaletteEntry {
  if (!entry.id.startsWith(prefix)) return false;
  const item = entry as Partial<SnippetPaletteEntry>;
  return typeof item.prefix === 'string' && typeof item.documentId === 'string' &&
    Number.isSafeInteger(item.snippetRevision) && Number.isSafeInteger(item.documentRevision) &&
    entry.id === prefix + snippetIdentity(item.prefix);
}
function splitsSurrogate(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;
  const previous = text.charCodeAt(index - 1);
  const next = text.charCodeAt(index);
  return previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
}
/** Pure bounded plan. This is plain text insertion with expanded defaults;
 * completion retains the independent numbered-placeholder interaction.
 * The caller owns actual Monaco mutation and verifies model identity. */
export function planSnippetInsertion(document: StudioDocument, entry: SnippetPaletteEntry,
  snapshot: SnippetSnapshot, selection: SnippetInsertionSelection, eol: string): ProfileResult<SnippetInsertionPlan> {
  if (!isSnippetPaletteEntry(entry) || entry.documentId !== document.id || entry.documentRevision !== document.revision ||
      entry.snippetRevision !== snapshot.revision || snapshot.persistence === 'blocked') {
    return profileError('The snippet or source changed. Reopen the command palette.');
  }
  const item = snapshot.items.find(value => snippetIdentity(value.prefix) === snippetIdentity(entry.prefix));
  if (!item?.enabled) return profileError('This snippet is no longer enabled.');
  const { start, end } = selection;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > document.content.length ||
      splitsSurrogate(document.content, start) || splitsSurrogate(document.content, end)) {
    return profileError('The selection is not a valid source range.');
  }
  if (eol !== '\n' && eol !== '\r\n') return profileError('Unsupported editor line ending.');
  const text = item.compiled.preview.replace(/\n/g, eol);
  const final = item.compiled.stops.find(stop => stop.index === 0);
  const localCaret = final ? item.compiled.preview.slice(0, final.offset).replace(/\n/g, eol).length : text.length;
  try {
    assertScarpSourceText(document.content.slice(0, start) + text + document.content.slice(end));
  } catch (error) { return profileError(error instanceof Error ? error.message : 'Invalid source after insertion.'); }
  return { ok: true, value: Object.freeze({ text, start, end, caret: start + localCaret }) };
}
