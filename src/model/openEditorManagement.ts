import { disambiguateDocumentNames } from './documentLabels';
import { isDirty, type StudioDocument } from './documents';

export const MAX_MANAGED_TABS = 200;
export const MAX_TAB_QUERY = 160;
export type TabFilter = 'all' | 'modified' | 'saved' | 'untitled';
export type TabSort = 'tab-order' | 'name' | 'modified';
export interface TabEntry {
  document: StudioDocument;
  label: string;
  active: boolean;
  modified: boolean;
  closeEligible: boolean;
}
export interface TabInventory {
  entries: TabEntry[];
  total: number;
  modified: number;
  untitled: number;
  closeEligible: number;
  limited: boolean;
}
export interface TabSelection {
  id: string;
  revision: number;
  path: string;
}

/** Only clean named sources may be bulk-closed. Untitled buffers are always
 * excluded, even empty ones; explicit single-tab Close remains available. */
export function canBulkClose(document: StudioDocument): boolean {
  return document.path !== null && !isDirty(document);
}

/** Metadata-only view, bounded independently of source length. */
export function buildTabInventory(
  documents: readonly StudioDocument[], activeId: string | null,
): TabInventory {
  const visible = documents.slice(0, MAX_MANAGED_TABS);
  const labels = disambiguateDocumentNames(visible);
  return {
    entries: visible.map(document => ({
      document,
      label: labels.get(document.id) ?? document.name,
      active: document.id === activeId,
      modified: isDirty(document),
      closeEligible: canBulkClose(document),
    })),
    total: documents.length,
    modified: documents.filter(isDirty).length,
    untitled: documents.filter(document => document.path === null).length,
    closeEligible: visible.filter(canBulkClose).length,
    limited: documents.length > visible.length,
  };
}

export function filterTabInventory(
  entries: readonly TabEntry[], query: string, filter: TabFilter, sort: TabSort,
): TabEntry[] {
  const terms = query.slice(0, MAX_TAB_QUERY).toLowerCase().trim().split(/\s+/).filter(Boolean);
  const result = entries.filter(entry => {
    if (filter === 'modified' && !entry.modified) return false;
    if (filter === 'saved' && !entry.closeEligible) return false;
    if (filter === 'untitled' && entry.document.path !== null) return false;
    const haystack = (entry.label + ' ' + (entry.document.path ?? '')).toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
  if (sort === 'name') result.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  if (sort === 'modified') result.sort((a, b) => Number(b.modified) - Number(a.modified));
  return result;
}

export function tabSelection(document: StudioDocument): TabSelection | null {
  return canBulkClose(document)
    ? { id: document.id, revision: document.revision, path: document.path! }
    : null;
}

/** Identity, revision and path are all required. Selection never survives a
 * save, edit/revert, close/reopen or Save As to a different destination. */
export function matchesTabSelection(selection: TabSelection, document: StudioDocument): boolean {
  return canBulkClose(document) && selection.id === document.id &&
    selection.revision === document.revision && selection.path === document.path;
}

export function currentTabSelection(
  selections: readonly TabSelection[], documents: readonly StudioDocument[],
): TabSelection[] {
  const current = new Map(documents.map(document => [document.id, document]));
  const seen = new Set<string>();
  return selections.slice(0, MAX_MANAGED_TABS).filter(selection => {
    if (seen.has(selection.id)) return false;
    seen.add(selection.id);
    const document = current.get(selection.id);
    return document !== undefined && matchesTabSelection(selection, document);
  });
}

/** Select visible clean rows, without retaining hidden selections. */
export function selectVisibleTabs(entries: readonly TabEntry[]): TabSelection[] {
  return entries.slice(0, MAX_MANAGED_TABS).flatMap(entry => {
    const selection = tabSelection(entry.document);
    return selection ? [selection] : [];
  });
}

/** Fail closed if any requested tab has become invalid. No partial close. */
export function resolveBulkClose(
  selections: readonly TabSelection[], documents: readonly StudioDocument[],
): StudioDocument[] | null {
  if (!selections.length || selections.length > MAX_MANAGED_TABS) return null;
  const valid = currentTabSelection(selections, documents);
  if (valid.length !== selections.length) return null;
  const requested = new Set(valid.map(selection => selection.id));
  const targets = documents.filter(document => requested.has(document.id));
  return targets.length === selections.length ? targets : null;
}
