import type { StudioDocument } from './documents';
import { isDirty } from './documents';
import { disambiguateDocumentNames } from './documentLabels';

export const MAX_REFERENCE_SOURCE_UNITS = 512 * 1024;
export const MAX_REFERENCE_CHOICES = 200;
export const MIN_REFERENCE_SHARE = 25;
export const MAX_REFERENCE_SHARE = 75;
export type ReferenceOrientation = 'horizontal' | 'vertical';

export interface ReferenceLayout {
  readonly orientation: ReferenceOrientation;
  readonly share: number;
}

export const DEFAULT_REFERENCE_LAYOUT: ReferenceLayout = Object.freeze({
  orientation: 'horizontal', share: 50,
});

export function referenceShare(value: number): number {
  return Number.isFinite(value) ? Math.max(MIN_REFERENCE_SHARE,
    Math.min(MAX_REFERENCE_SHARE, Math.round(value))) : DEFAULT_REFERENCE_LAYOUT.share;
}

export function updateReferenceLayout(layout: ReferenceLayout, patch: Partial<ReferenceLayout>): ReferenceLayout {
  const orientation = patch.orientation === 'horizontal' || patch.orientation === 'vertical'
    ? patch.orientation : layout.orientation;
  const share = patch.share === undefined ? layout.share : referenceShare(patch.share);
  return orientation === layout.orientation && share === layout.share
    ? layout : Object.freeze({ orientation, share });
}

export interface ReferenceChoice {
  readonly id: string;
  readonly label: string;
  readonly active: boolean;
  readonly modified: boolean;
  readonly unavailable: boolean;
}

export interface ReferenceInventory {
  readonly choices: readonly ReferenceChoice[];
  readonly total: number;
  readonly limited: boolean;
  readonly ambiguous: boolean;
}

function uniqueDocuments(documents: readonly StudioDocument[]): {
  readonly byId: ReadonlyMap<string, StudioDocument>;
  readonly duplicates: ReadonlySet<string>;
} {
  const byId = new Map<string, StudioDocument>();
  const duplicates = new Set<string>();
  for (const document of documents) {
    if (byId.has(document.id)) duplicates.add(document.id);
    else byId.set(document.id, document);
  }
  return { byId, duplicates };
}

/** Projection of already-open buffers only. Current and selected IDs are
 * retained in the bounded selector if tab reordering pushes them past the
 * ordinary cap. Duplicate IDs are withheld instead of choosing arbitrarily. */
export function buildReferenceInventory(
  documents: readonly StudioDocument[],
  activeId: string | null,
  selectedId: string | null,
): ReferenceInventory {
  const { byId, duplicates } = uniqueDocuments(documents);
  const valid = documents.filter(document => document.id.length > 0 && !duplicates.has(document.id));
  const mandatory = new Set([activeId, selectedId].filter((id): id is string =>
    id !== null && byId.has(id) && !duplicates.has(id)));
  const visible = valid.slice(0, MAX_REFERENCE_CHOICES);
  for (const id of mandatory) {
    if (visible.some(document => document.id === id)) continue;
    const document = byId.get(id)!;
    const replace = visible.findLastIndex(item => !mandatory.has(item.id));
    if (replace >= 0) visible[replace] = document;
  }
  const visibleIds = new Set(visible.map(document => document.id));
  const ordered = valid.filter(document => visibleIds.has(document.id));
  const labels = disambiguateDocumentNames(ordered);
  return Object.freeze({
    choices: Object.freeze(ordered.map(document => Object.freeze({
      id: document.id,
      label: labels.get(document.id) ?? document.name,
      active: document.id === activeId,
      modified: isDirty(document),
      unavailable: document.content.length > MAX_REFERENCE_SOURCE_UNITS,
    }))),
    total: valid.length,
    limited: valid.length > ordered.length,
    ambiguous: duplicates.size > 0,
  });
}

export type ReferenceSource =
  | { readonly kind: 'none' | 'closed' | 'ambiguous' | 'same-active' | 'too-large' }
  | { readonly kind: 'available'; readonly document: StudioDocument };

export function resolveReferenceSource(
  documents: readonly StudioDocument[],
  activeId: string | null,
  selectedId: string | null,
): ReferenceSource {
  if (selectedId === null) return { kind: 'none' };
  const matches = documents.filter(document => document.id === selectedId);
  if (matches.length === 0) return { kind: 'closed' };
  if (matches.length !== 1) return { kind: 'ambiguous' };
  if (selectedId === activeId) return { kind: 'same-active' };
  if (matches[0].content.length > MAX_REFERENCE_SOURCE_UNITS) return { kind: 'too-large' };
  return { kind: 'available', document: matches[0] };
}

export function reconcileReferenceSelection(
  selectedId: string | null,
  documents: readonly StudioDocument[],
): string | null {
  return selectedId !== null && documents.filter(document => document.id === selectedId).length === 1
    ? selectedId : null;
}

export interface ReferenceSwap {
  readonly primaryId: string;
  readonly referenceId: string;
}

/** Swapping exchanges live open tab identities. It cannot open a file,
 * mutate buffers, or turn an unavailable reference into an editor action. */
export function planReferenceSwap(
  documents: readonly StudioDocument[],
  activeId: string | null,
  selectedId: string | null,
): ReferenceSwap | null {
  const reference = resolveReferenceSource(documents, activeId, selectedId);
  if (activeId === null || reference.kind !== 'available') return null;
  const active = documents.filter(document => document.id === activeId);
  if (active.length !== 1 || active[0].content.length > MAX_REFERENCE_SOURCE_UNITS) return null;
  return Object.freeze({ primaryId: reference.document.id, referenceId: activeId });
}
