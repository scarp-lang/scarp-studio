import type { StudioDocument } from './documents';
import { compareScarpSnapshots, MAX_DIFF_SOURCE_UNITS, type SourceDiffReport } from './sourceDiff';

export type ReferenceVersion = 'working' | 'saved';
export interface ReferenceComparisonRequest {
  readonly primaryId: string;
  readonly referenceId: string;
  readonly primaryVersion: ReferenceVersion;
  readonly referenceVersion: ReferenceVersion;
}
interface ComparisonIdentity {
  readonly id: string;
  readonly name: string;
  readonly path: string | null;
  readonly revision: number;
  readonly version: ReferenceVersion;
  readonly text: string;
}
export interface ReferenceComparisonReview {
  readonly request: ReferenceComparisonRequest;
  readonly primary: ComparisonIdentity;
  readonly reference: ComparisonIdentity;
  readonly report: SourceDiffReport;
}
export type ReferenceComparisonResult =
  | { readonly ok: true; readonly review: ReferenceComparisonReview }
  | { readonly ok: false; readonly error: string };
export type ReferenceComparisonFreshness = 'current' | 'selection-changed' | 'source-closed' | 'source-changed' | 'ambiguous';

function validVersion(version: string): version is ReferenceVersion {
  return version === 'working' || version === 'saved';
}
function snapshot(document: StudioDocument, version: ReferenceVersion): ComparisonIdentity {
  return Object.freeze({
    id: document.id, name: document.name, path: document.path, revision: document.revision,
    version, text: version === 'working' ? document.content : document.savedContent,
  });
}
function sameIdentity(a: ComparisonIdentity,b: ComparisonIdentity): boolean {
  return a.id === b.id && a.name === b.name && a.path === b.path && a.revision === b.revision &&
    a.version === b.version && a.text === b.text;
}
function validRequest(request: ReferenceComparisonRequest): boolean {
  return request.primaryId.length > 0 && request.referenceId.length > 0 &&
    request.primaryId !== request.referenceId && validVersion(request.primaryVersion) &&
    validVersion(request.referenceVersion);
}
/** Compare immutable, explicitly selected in-memory snapshots. Do not
 * compute on every keystroke or accept stale buffer identities. */
export function captureReferenceComparison(
  documents: readonly StudioDocument[], activeId: string | null, selectedId: string | null,
  request: ReferenceComparisonRequest,
): ReferenceComparisonResult {
  if (!validRequest(request)) return {ok:false,error:'Choose two distinct open sources and valid versions.'};
  if (activeId !== request.primaryId || selectedId !== request.referenceId) {
    return {ok:false,error:'The selected editor pair has changed.'};
  }
  const primary = documents.filter(doc=>doc.id===request.primaryId);
  const reference = documents.filter(doc=>doc.id===request.referenceId);
  if (primary.length !== 1 || reference.length !== 1) {
    return {ok:false,error:'Both sources must be uniquely identified open tabs.'};
  }
  const a = snapshot(primary[0],request.primaryVersion);
  const b = snapshot(reference[0],request.referenceVersion);
  if (a.text.length > MAX_DIFF_SOURCE_UNITS || b.text.length > MAX_DIFF_SOURCE_UNITS) {
    return {ok:false,error:'Either selected source exceeds the comparison size budget.'};
  }
  return {ok:true,review:Object.freeze({
    request:Object.freeze({...request}), primary:a, reference:b,
    report:compareScarpSnapshots(a.text,b.text),
  })};
}
export function referenceComparisonFreshness(
  review: ReferenceComparisonReview, documents: readonly StudioDocument[],
  activeId: string | null, selectedId: string | null,
  primaryVersion: ReferenceVersion, referenceVersion: ReferenceVersion,
): ReferenceComparisonFreshness {
  const {request}=review;
  if (activeId!==request.primaryId || selectedId!==request.referenceId ||
      primaryVersion!==request.primaryVersion || referenceVersion!==request.referenceVersion) return 'selection-changed';
  const primary=documents.filter(doc=>doc.id===request.primaryId);
  const reference=documents.filter(doc=>doc.id===request.referenceId);
  if (!primary.length || !reference.length) return 'source-closed';
  if (primary.length!==1 || reference.length!==1) return 'ambiguous';
  if (!sameIdentity(review.primary,snapshot(primary[0],primaryVersion)) ||
      !sameIdentity(review.reference,snapshot(reference[0],referenceVersion))) return 'source-changed';
  return 'current';
}
export const REFERENCE_COMPARISON_PAGE_SIZE = 4;
export function referenceComparisonPage(report: SourceDiffReport, page: number) {
  const total = Math.max(1,Math.ceil(report.hunks.length / REFERENCE_COMPARISON_PAGE_SIZE));
  const current = Number.isFinite(page) ? Math.max(1,Math.min(total,Math.trunc(page))) : 1;
  const start = (current-1)*REFERENCE_COMPARISON_PAGE_SIZE;
  return { page:current, total, hunks:report.hunks.slice(start,start+REFERENCE_COMPARISON_PAGE_SIZE) };
}
export function referenceVersionLabel(version: ReferenceVersion): string {
  return version==='working'?'Working buffer':'Last saved snapshot';
}
