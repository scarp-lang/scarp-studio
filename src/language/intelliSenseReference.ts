import { scarpReferenceCatalog, type ScarpCompletion } from './assist';
import { builtinSignatureAt } from './builtinSignatures';
import { allowsCatalogKind, type IntelliSensePreferences } from '../model/intelliSensePreferences';

export const MAX_REFERENCE_QUERY_UNITS = 120;
export const REFERENCE_PAGE_SIZE = 12;
export const REFERENCE_KINDS = ['all', 'function', 'type', 'keyword', 'snippet'] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];
export const REFERENCE_AVAILABILITY = ['all', 'enabled', 'disabled'] as const;
export type ReferenceAvailability = (typeof REFERENCE_AVAILABILITY)[number];
export interface ReferenceEntry extends ScarpCompletion {
  id: string;
  signature: string | null;
  enabled: boolean;
}
export interface ReferenceQuery {
  text: string;
  kind: ReferenceKind;
  availability: ReferenceAvailability;
}
export interface ReferenceResults {
  entries: ReferenceEntry[];
  total: number;
  catalogTotal: number;
  counts: Readonly<Record<ReferenceKind, number>>;
  page: number;
  pages: number;
}
interface IndexedEntry {
  entry: Readonly<Omit<ReferenceEntry, 'enabled'>>;
  searchable: string;
  label: string;
}
const fold = (text: string) => text.toLowerCase();
const catalog: readonly IndexedEntry[] = Object.freeze(scarpReferenceCatalog().map((item, index) => {
  const signature = item.kind === 'function' ? builtinSignatureAt(item.label, 0)?.label ?? null : null;
  const entry = Object.freeze({ ...item, id: item.kind + ':' + index + ':' + item.label, signature });
  return Object.freeze({ entry, label: fold(item.label),
    searchable: fold([item.label, item.detail, item.documentation, signature ?? ''].join(' ')) });
}));

function score(item: IndexedEntry, query: string, terms: readonly string[]): number {
  if (!query) return 0;
  if (item.label === query) return 0;
  if (item.label.startsWith(query)) return 1;
  if (terms.every(term => item.label.includes(term))) return 2;
  if (terms.every(term => item.searchable.includes(term))) return 3;
  return Infinity;
}

/** Reference queries never run source analysis or the compiler, and do not
 * inherit the completion popup cap. Availability is a preference indicator,
 * not a guarantee that the installed compiler or current context supports it. */
export function searchScarpReference(query: ReferenceQuery, settings: Readonly<IntelliSensePreferences>,
  requestedPage = 1): ReferenceResults {
  const normalized = fold(query.text.slice(0, MAX_REFERENCE_QUERY_UNITS).trim().replace(/\s+/g, ' '));
  const terms = normalized ? normalized.split(' ') : [];
  const counts: Record<ReferenceKind, number> = { all: 0, function: 0, type: 0, keyword: 0, snippet: 0 };
  const matches: { item: IndexedEntry; rank: number; enabled: boolean }[] = [];
  for (const item of catalog) {
    const enabled = allowsCatalogKind(settings, item.entry.kind);
    if (query.availability === 'enabled' && !enabled || query.availability === 'disabled' && enabled) continue;
    const rank = score(item, normalized, terms);
    if (!Number.isFinite(rank)) continue;
    counts.all++;
    counts[item.entry.kind]++;
    if (query.kind === 'all' || item.entry.kind === query.kind) matches.push({ item, rank, enabled });
  }
  matches.sort((a, b) => a.rank - b.rank ||
    (a.item.label < b.item.label ? -1 : a.item.label > b.item.label ? 1 : 0) ||
    (a.item.entry.id < b.item.entry.id ? -1 : a.item.entry.id > b.item.entry.id ? 1 : 0));
  const pages = Math.max(1, Math.ceil(matches.length / REFERENCE_PAGE_SIZE));
  const page = Number.isSafeInteger(requestedPage) ? Math.min(pages, Math.max(1, requestedPage)) : 1;
  return { entries: matches.slice((page - 1) * REFERENCE_PAGE_SIZE, page * REFERENCE_PAGE_SIZE)
    .map(({ item, enabled }) => ({ ...item.entry, enabled })),
    total: matches.length, catalogTotal: catalog.length, counts, page, pages };
}
