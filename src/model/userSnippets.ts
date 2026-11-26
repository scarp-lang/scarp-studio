import { exactKeys, hasUniqueJsonKeys, profileError, recordOf, type ProfileResult } from './intelliSenseProfileTransfer';
import type { IntelliSenseStorage } from './intelliSensePreferences';
import { compileSnippet, validSnippetText, MAX_SNIPPET_BODY_UNITS, type CompiledSnippet } from './snippetTemplate';
import { scarpReferenceCatalog } from '../language/assist';

export const SNIPPET_STORAGE_KEY = 'studio.userSnippets.v1';
export const SNIPPET_FORMAT = 'scarp-studio.snippets';
export const MAX_USER_SNIPPETS = 32;
export const MAX_SNIPPET_STORAGE_UNITS = 196608;
export const MAX_SNIPPET_PREFIX_UNITS = 48;
export const MAX_SNIPPET_NAME_UNITS = 80;
export const MAX_SNIPPET_DESCRIPTION_UNITS = 160;
export interface UserSnippet {
  readonly prefix: string;
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly enabled: boolean;
}
export interface PreparedUserSnippet extends UserSnippet { readonly compiled: CompiledSnippet }
const reserved = new Set(scarpReferenceCatalog().map(item => item.label.toLowerCase()));
export function validateUserSnippet(value: unknown): ProfileResult<PreparedUserSnippet> {
  const item = recordOf(value);
  if (!item || !exactKeys(item, ['prefix', 'name', 'description', 'body', 'enabled'])) return profileError('Snippet must contain exactly the supported fields.');
  const { prefix, name, description, body, enabled } = item;
  if (typeof prefix !== 'string' || prefix.length > MAX_SNIPPET_PREFIX_UNITS || !/^[A-Za-z_][A-Za-z_0-9]*$/.test(prefix)) {
    return profileError('Use a 1–48 character ASCII identifier as the prefix.');
  }
  if (reserved.has(prefix.toLowerCase())) return profileError('This prefix belongs to a built-in Scarp suggestion. Choose another.');
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_SNIPPET_NAME_UNITS || name !== name.trim() ||
      /[\r\n\t]/.test(name) || !validSnippetText(name)) return profileError('Use a nonempty name of at most 80 characters.');
  if (typeof description !== 'string' || description.length > MAX_SNIPPET_DESCRIPTION_UNITS ||
      /[\r\n\t]/.test(description) || !validSnippetText(description)) return profileError('Description must be a single line of at most 160 characters.');
  if (typeof body !== 'string' || body.length > MAX_SNIPPET_BODY_UNITS || typeof enabled !== 'boolean') {
    return profileError('Snippet body or enabled state is invalid.');
  }
  const compiled = compileSnippet(body);
  if (!compiled.ok) return compiled;
  return { ok: true, value: Object.freeze({ prefix, name, description, body: body.replace(/\r\n?/g, '\n'), enabled, compiled: compiled.value }) };
}
function portable(item: UserSnippet): UserSnippet {
  return { prefix: item.prefix, name: item.name, description: item.description, body: item.body, enabled: item.enabled };
}
export function snippetIdentity(prefix: string): string { return prefix.toLowerCase(); }
export function serializeSnippets(items: readonly UserSnippet[]): string {
  return JSON.stringify({ format: SNIPPET_FORMAT, version: 1, snippets: items.map(portable) });
}
export function exportSnippets(items: readonly UserSnippet[]): string {
  const compact = serializeSnippets(items);
  const formatted = JSON.stringify(JSON.parse(compact), null, 2);
  return formatted.length <= MAX_SNIPPET_STORAGE_UNITS ? formatted : compact;
}
export function parseSnippets(raw: string | null): ProfileResult<readonly PreparedUserSnippet[]> {
  if (raw === null) return { ok: true, value: Object.freeze([]) };
  if (raw.length > MAX_SNIPPET_STORAGE_UNITS) return profileError('Snippet collection is too large.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return profileError('Snippet collection is not valid JSON.'); }
  if (!hasUniqueJsonKeys(raw)) return profileError('Snippet collection contains duplicate keys or unsupported nesting.');
  const root = recordOf(value);
  if (!root || !exactKeys(root, ['format', 'version', 'snippets']) || root.format !== SNIPPET_FORMAT || root.version !== 1 ||
      !Array.isArray(root.snippets) || root.snippets.length > MAX_USER_SNIPPETS) return profileError('Unsupported snippet collection or too many snippets.');
  const items: PreparedUserSnippet[] = [];
  const seen = new Set<string>();
  for (const snippet of root.snippets) {
    const result = validateUserSnippet(snippet);
    if (!result.ok) return result;
    const identity = snippetIdentity(result.value.prefix);
    if (seen.has(identity)) return profileError('Duplicate snippet prefix: ' + result.value.prefix);
    seen.add(identity); items.push(result.value);
  }
  return { ok: true, value: Object.freeze(items) };
}
export interface SnippetSnapshot {
  readonly items: readonly PreparedUserSnippet[];
  readonly revision: number;
  readonly persistence: 'available' | 'session-only' | 'blocked';
}
export type SnippetMutation =
  | { kind: 'create'; item: UserSnippet }
  | { kind: 'replace'; prefix: string; item: UserSnippet }
  | { kind: 'delete'; prefix: string };
export function mutateSnippets(current: readonly PreparedUserSnippet[], mutation: SnippetMutation): ProfileResult<readonly PreparedUserSnippet[]> {
  const index = mutation.kind === 'create' ? -1 : current.findIndex(item => snippetIdentity(item.prefix) === snippetIdentity(mutation.prefix));
  if (mutation.kind !== 'create' && index < 0) return profileError('Snippet no longer exists. Refresh the review.');
  if (mutation.kind === 'delete') return { ok: true, value: Object.freeze(current.filter((_, i) => i !== index)) };
  const result = validateUserSnippet(mutation.item);
  if (!result.ok) return result;
  if (current.some((item, i) => i !== index && snippetIdentity(item.prefix) === snippetIdentity(result.value.prefix))) return profileError('A snippet with this prefix already exists.');
  if (mutation.kind === 'create' && current.length >= MAX_USER_SNIPPETS) return profileError('Snippet library is full.');
  return { ok: true, value: Object.freeze(mutation.kind === 'create' ? [...current, result.value] :
    current.map((item, i) => i === index ? result.value : item)) };
}
export interface SnippetImportReview {
  readonly baseline: string;
  readonly result: readonly PreparedUserSnippet[];
  readonly additions: readonly string[];
  readonly unchanged: readonly string[];
  readonly conflicts: readonly string[];
}
/** Import is merge-only. Existing prefixes, including differently cased
 * versions, cannot be silently overwritten. Conflicts are reported and
 * retained, so a later explicit edit is required to replace one. */
export function reviewSnippetImport(current: readonly PreparedUserSnippet[], raw: string): ProfileResult<SnippetImportReview> {
  const incoming = parseSnippets(raw);
  if (!incoming.ok) return incoming;
  const result = [...current];
  const additions: string[] = [], unchanged: string[] = [], conflicts: string[] = [];
  for (const item of incoming.value) {
    const previous = current.find(existing => snippetIdentity(existing.prefix) === snippetIdentity(item.prefix));
    if (previous) {
      (JSON.stringify(portable(previous)) === JSON.stringify(portable(item)) ? unchanged : conflicts).push(item.prefix);
    } else { result.push(item); additions.push(item.prefix); }
  }
  if (result.length > MAX_USER_SNIPPETS || serializeSnippets(result).length > MAX_SNIPPET_STORAGE_UNITS) {
    return profileError('Merged snippet collection exceeds the library limit.');
  }
  return { ok: true, value: Object.freeze({ baseline: serializeSnippets(current), result: Object.freeze(result),
    additions: Object.freeze(additions), unchanged: Object.freeze(unchanged), conflicts: Object.freeze(conflicts) }) };
}
export function searchUserSnippets(items: readonly PreparedUserSnippet[], query: string, enabledOnly = false): PreparedUserSnippet[] {
  const terms = query.slice(0, 120).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => (!enabledOnly || item.enabled) && terms.every(term =>
    (item.prefix + ' ' + item.name + ' ' + item.description).toLowerCase().includes(term)));
}
export function createSnippetStore(storage: IntelliSenseStorage | null) {
  let raw: string | null = null;
  let initial: readonly PreparedUserSnippet[] = Object.freeze([]);
  let persistence: SnippetSnapshot['persistence'] = storage ? 'available' : 'session-only';
  try {
    if (storage) {
      raw = storage.getItem(SNIPPET_STORAGE_KEY);
      const parsed = parseSnippets(raw);
      if (parsed.ok) initial = parsed.value; else persistence = 'blocked';
    }
  } catch { persistence = 'session-only'; }
  let snapshot: SnippetSnapshot = Object.freeze({ items: initial, revision: 0, persistence });
  const listeners = new Set<() => void>();
  const getSnapshot = () => snapshot;
  function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  function publish(items: readonly PreparedUserSnippet[], persistence: SnippetSnapshot['persistence']) {
    snapshot = Object.freeze({ items, persistence, revision: snapshot.revision + 1 });
    for (const listener of [...listeners]) listener();
  }
  function write(items: readonly PreparedUserSnippet[], expectedRevision: number): ProfileResult<true> {
    if (snapshot.revision !== expectedRevision) return profileError('Snippet library changed. Review again.');
    if (snapshot.persistence === 'blocked') return profileError('Unreadable snippet data is blocked. Reload or explicitly discard it.');
    const next = serializeSnippets(items);
    if (next.length > MAX_SNIPPET_STORAGE_UNITS) return profileError('Snippet collection is too large.');
    let status: SnippetSnapshot['persistence'] = 'session-only';
    try {
      if (storage) {
        const disk = storage.getItem(SNIPPET_STORAGE_KEY);
        if (disk !== raw) {
          const parsed = parseSnippets(disk);
          raw = disk;
          publish(parsed.ok ? parsed.value : snapshot.items, parsed.ok ? 'available' : 'blocked');
          return profileError('Stored snippet library changed. Review again.');
        }
        storage.setItem(SNIPPET_STORAGE_KEY, next); raw = next; status = 'available';
      }
    } catch { /* retain explicit session-only changes */ }
    publish(items, status);
    return { ok: true, value: true };
  }
  function mutate(mutation: SnippetMutation, expectedRevision: number): ProfileResult<true> {
    if (snapshot.revision !== expectedRevision) return profileError('Snippet library changed. Review again.');
    const result = mutateSnippets(snapshot.items, mutation);
    return result.ok ? write(result.value, expectedRevision) : result;
  }
  function applyImport(review: SnippetImportReview, expectedRevision: number): ProfileResult<true> {
    if (review.baseline !== serializeSnippets(snapshot.items) || !review.additions.length) return profileError('Import review is stale or has no additions.');
    const validated = parseSnippets(serializeSnippets(review.result));
    if (!validated.ok) return validated;
    // Reconstruct the merge so a caller cannot bypass the no-overwrite rule.
    const checked = reviewSnippetImport(snapshot.items, serializeSnippets(validated.value));
    if (!checked.ok || checked.value.conflicts.length || serializeSnippets(checked.value.result) !== serializeSnippets(validated.value)) {
      return profileError('Import review would overwrite or remove an existing snippet.');
    }
    return write(checked.value.result, expectedRevision);
  }
  function reload(): ProfileResult<true> {
    if (!storage) return profileError('Persistent storage is unavailable.');
    try {
      raw = storage.getItem(SNIPPET_STORAGE_KEY);
      const parsed = parseSnippets(raw);
      if (!parsed.ok) { publish(snapshot.items, 'blocked'); return parsed; }
      publish(parsed.value, 'available'); return { ok: true, value: true };
    } catch { return profileError('Could not read snippet storage.'); }
  }
  function discardUnreadable(expectedRevision: number): ProfileResult<true> {
    if (!storage || snapshot.persistence !== 'blocked' || snapshot.revision !== expectedRevision) return profileError('Discard review is stale.');
    try {
      if (storage.getItem(SNIPPET_STORAGE_KEY) !== raw) return profileError('Stored data changed; reload before discarding.');
      const empty = serializeSnippets([]);
      storage.setItem(SNIPPET_STORAGE_KEY, empty); raw = empty; publish(Object.freeze([]), 'available');
      return { ok: true, value: true };
    } catch { return profileError('Could not discard unreadable snippet data.'); }
  }
  return { getSnapshot, subscribe, mutate, applyImport, reload, discardUnreadable };
}
function storageOrNull(): IntelliSenseStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export const userSnippetStore = createSnippetStore(storageOrNull());
