import type { StudioDocument } from '../model/documents';
import { assertScarpSourceText } from '../model/sourceLimits';
import { utf8ByteLength } from '../model/utf8Text';
import {
  MAX_WORKSPACE_RESTORE_BYTES, planWorkspaceRestore, sameWorkspaceRestorePlan,
  type WorkspaceListedSource, type WorkspaceSession, type WorkspaceRestorePlan,
} from '../model/workspaceSessions';

export interface LoadedWorkspaceSource {
  path: string;
  content: string;
}
export interface PreparedWorkspaceRestore {
  files: LoadedWorkspaceSource[];
  activePath: string | null;
  alreadyOpen: number;
  skipped: number;
}
export interface WorkspaceRestoreRequest {
  session: WorkspaceSession;
  expectedPlan: WorkspaceRestorePlan;
  selectedRoot: string;
  listedFiles: readonly WorkspaceListedSource[];
  documents: readonly StudioDocument[];
  /** Must compare the exact current listing, editor session and reviewed record. */
  isCurrent: () => boolean;
  /** Invoked only with the exact live listed path and remaining byte budget. */
  read: (path: string, maxBytes: number) => Promise<string>;
}

function checkCurrent(request: WorkspaceRestoreRequest): void {
  if (!request.isCurrent()) throw new Error('Workspace or editor changed during restore. Review the current session and retry.');
}

/** Stage all new files before changing any editor state. Existing tabs are
 * never read from disk, and any read failure cancels the entire new batch.
 * Missing/ambiguous entries are omitted only if present in the reviewed plan.
 */
export async function prepareWorkspaceRestore(request: WorkspaceRestoreRequest): Promise<PreparedWorkspaceRestore> {
  checkCurrent(request);
  const plan = planWorkspaceRestore(request.session, request.selectedRoot, request.listedFiles, request.documents);
  if (!plan.ok) throw new Error(plan.error);
  if (!sameWorkspaceRestorePlan(plan.value, request.expectedPlan)) {
    throw new Error('The workspace restore preview changed. Review the current files and retry.');
  }
  const files: LoadedWorkspaceSource[] = [];
  let remaining = MAX_WORKSPACE_RESTORE_BYTES;
  for (const row of plan.value.rows) {
    if (row.kind !== 'available') continue;
    checkCurrent(request);
    if (remaining < 1) throw new Error('Workspace restore reached its 4 MiB read budget. Open the remaining files individually.');
    let content: string;
    try {
      content = await request.read(row.path, remaining);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error('Cannot restore ' + row.name + ': ' + message);
    }
    checkCurrent(request);
    assertScarpSourceText(content);
    const size = utf8ByteLength(content);
    if (size > remaining) throw new Error('Workspace restore exceeded its 4 MiB read budget.');
    remaining -= size;
    files.push({ path: row.path, content });
  }
  checkCurrent(request);
  return {
    files, activePath: plan.value.activePath,
    alreadyOpen: plan.value.openCount,
    skipped: plan.value.missingCount + plan.value.ambiguousCount,
  };
}
