import { isDirty, type StudioDocument } from './documents';

export const MAX_PINNED_EDITOR_TABS = 32;
export const TAB_ORGANIZATION_SORTS = ['name', 'folder', 'modified'] as const;
export type TabOrganizationSort = typeof TAB_ORGANIZATION_SORTS[number];
export type TabOrganizationOperation =
  | { readonly kind: 'pin'; readonly id: string; readonly pinned: boolean }
  | { readonly kind: 'move'; readonly id: string; readonly direction: -1 | 1 }
  | { readonly kind: 'sort'; readonly order: TabOrganizationSort };

export interface TabOrganizationPlan {
  readonly documents: StudioDocument[];
  readonly pinnedIds: readonly string[];
}
export type TabOrganizationResult =
  | { readonly ok: true; readonly value: TabOrganizationPlan }
  | { readonly ok: false; readonly error: string };

const fail = (error: string): TabOrganizationResult => ({ ok: false, error });

export function validTabOrganization(
  documents: readonly StudioDocument[],
  pinnedIds: readonly string[],
): boolean {
  if (pinnedIds.length > MAX_PINNED_EDITOR_TABS || pinnedIds.length > documents.length ||
      new Set(documents.map(document => document.id)).size !== documents.length) return false;
  return pinnedIds.every((id, index) => documents[index]?.id === id);
}

function sameOrder(a: readonly StudioDocument[], b: readonly StudioDocument[]): boolean {
  return a.length === b.length && a.every((document, index) => document === b[index]);
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }) ||
    (a < b ? -1 : a > b ? 1 : 0);
}
function folder(document: StudioDocument): string {
  if (document.path === null) return '';
  const normalized = document.path.replace(/\\/g, '/');
  return normalized.slice(0, normalized.lastIndexOf('/') + 1);
}

function compareDocuments(a: StudioDocument, b: StudioDocument, order: TabOrganizationSort): number {
  if (order === 'modified') {
    const difference = Number(isDirty(b)) - Number(isDirty(a));
    if (difference) return difference;
  }
  if (order === 'folder') {
    const difference = Number(a.path === null) - Number(b.path === null) ||
      compareText(folder(a), folder(b));
    if (difference) return difference;
  }
  return compareText(a.name, b.name) || compareText(a.path ?? '', b.path ?? '');
}

/** Produce a new ordered projection of the exact existing document objects.
 * Pinning and sorting never change content, saved snapshots or revisions.
 * The pinned prefix is invariant across all supported operations. */
export function organizeEditorTabs(
  documents: readonly StudioDocument[],
  pinnedIds: readonly string[],
  operation: TabOrganizationOperation,
): TabOrganizationResult {
  if (!validTabOrganization(documents, pinnedIds)) return fail('The tab organization is inconsistent.');
  const pinnedCount = pinnedIds.length;
  let next = [...documents];
  let nextPins = [...pinnedIds];
  if (operation.kind === 'pin') {
    if (typeof operation.pinned !== 'boolean') return fail('Invalid pin request.');
    const index = documents.findIndex(document => document.id === operation.id);
    if (index < 0) return fail('The requested tab is no longer open.');
    const wasPinned = index < pinnedCount;
    if (wasPinned === operation.pinned) return fail('The tab already has the requested pin state.');
    if (operation.pinned && pinnedCount >= MAX_PINNED_EDITOR_TABS) {
      return fail('Unpin a tab before pinning another source.');
    }
    const [document] = next.splice(index, 1);
    if (operation.pinned) {
      next.splice(pinnedCount, 0, document);
      nextPins.push(document.id);
    } else {
      nextPins = nextPins.filter(id => id !== document.id);
      next.splice(nextPins.length, 0, document);
    }
  } else if (operation.kind === 'move') {
    const index = documents.findIndex(document => document.id === operation.id);
    if (index < 0 || (operation.direction !== -1 && operation.direction !== 1)) {
      return fail('Choose a current tab and a valid move direction.');
    }
    const target = index + operation.direction;
    if (target < 0 || target >= next.length || (index < pinnedCount) !== (target < pinnedCount)) {
      return fail('The tab is already at the edge of its group.');
    }
    [next[index], next[target]] = [next[target], next[index]];
    if (index < pinnedCount) nextPins = next.slice(0, pinnedCount).map(document => document.id);
  } else if (operation.kind === 'sort') {
    if (!TAB_ORGANIZATION_SORTS.includes(operation.order)) return fail('Choose a supported sort order.');
    next = [...next.slice(0, pinnedCount),
      ...next.slice(pinnedCount).sort((a, b) => compareDocuments(a, b, operation.order))];
  } else {
    return fail('Unsupported tab organization operation.');
  }

  if (!validTabOrganization(next, nextPins)) return fail('Could not preserve the pinned tab group.');
  if (sameOrder(documents, next) && pinnedIds.length === nextPins.length &&
      pinnedIds.every((id, index) => id === nextPins[index])) {
    return fail('The tab order is already unchanged.');
  }
  return { ok: true, value: { documents: next, pinnedIds: Object.freeze(nextPins) } };
}

export function tabMoveAvailability(
  documents: readonly StudioDocument[],
  pinnedIds: readonly string[],
  id: string | null,
): { readonly left: boolean; readonly right: boolean } {
  if (id === null || !validTabOrganization(documents, pinnedIds)) return { left: false, right: false };
  const index = documents.findIndex(document => document.id === id);
  if (index < 0) return { left: false, right: false };
  const first = index < pinnedIds.length ? 0 : pinnedIds.length;
  const last = index < pinnedIds.length ? pinnedIds.length - 1 : documents.length - 1;
  return { left: index > first, right: index < last };
}
