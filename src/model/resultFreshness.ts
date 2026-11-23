import type { StudioDocument } from './documents';
import { isCurrentVerifiedSource, type VerifiedSourceSnapshot } from './verifiedSource';
import type { ScarpProjectAction } from '../services/project';

/** Compiler output belongs to the saved source generation that actually ran.
 * A tab switch or unrelated edit is harmless. Same-content Save, A→B→A,
 * close/reopen and Save As cannot revive an obsolete result.
 */
export function sourceResultIsStale(
  source: VerifiedSourceSnapshot,
  documents: readonly StudioDocument[],
): boolean {
  return !documents.some((document) => isCurrentVerifiedSource(source, document));
}

export interface ProjectResultIdentity {
  /** Increments after an in-project buffer change or successful Explorer scan. */
  epoch: number;
  /** Exact selection instance, not merely an equal pathname. */
  listing: object | null;
}

/** Provenance for a successful project output still visible after execution. */
export interface CompletedProjectOutput extends ProjectResultIdentity {
  action: ScarpProjectAction;
}

export interface ProjectResultFreshness {
  stale: boolean;
  allowStructuredTests: boolean;
  warning: string | null;
}

/** Every project action is disk-backed. Even though saves are blocked during
 * execution, an editor can still change an open source buffer, and a project
 * listing could be refreshed. Keep raw compiler output visible but distinguish
 * it from results about the CURRENT editor state.
 */
export function projectResultFreshness(
  action: ScarpProjectAction,
  started: ProjectResultIdentity,
  current: ProjectResultIdentity,
): ProjectResultFreshness {
  const stale = started.epoch !== current.epoch || started.listing !== current.listing;
  const isTestAction = action === 'list-tests' || action === 'run-tests';
  return {
    stale,
    allowStructuredTests: isTestAction && !stale,
    warning: stale
      ? '[Selected project sources or Explorer changed while Scarp project ' + action +
        ' was running. The output below describes an earlier saved-on-disk state; save edits and rerun.]'
      : null,
  };
}

/** A result may become obsolete AFTER the CLI has finished, not just during
 * the command. Call this again on every UI render to avoid presenting old
 * project output as a result for newly edited sources or a new Explorer scan.
 */
export function completedProjectOutputWarning(
  completed: CompletedProjectOutput | null,
  current: ProjectResultIdentity,
): string | null {
  if (!completed || !projectResultFreshness(completed.action, completed, current).stale) {
    return null;
  }
  return '[Scarp project ' + completed.action +
    ' output is now stale. Selected project sources or Explorer changed after ' +
    'this result was produced. The output below describes an earlier saved-on-disk ' +
    'state; save changes and rerun.]';
}
