import type { StudioDocument } from '../model/documents';
import { resolveRecentlyClosed, type RecentlyClosedSource, type RecentlyClosedState } from '../model/recentlyClosed';
import { assertScarpSourceText } from '../model/sourceLimits';

export interface RecentlyClosedReadRequest {
  entry: RecentlyClosedSource;
  expectedPath: string;
  getCurrent: () => { history: RecentlyClosedState; documents: readonly StudioDocument[] };
  isCurrent: () => boolean;
  read: (path: string) => Promise<string>;
}

/** Read exactly the reviewed, previously open source. No state is committed
 * here: the caller still owns the native operation gate and editor update.
 * Revalidate after the asynchronous read, including history entry identity,
 * so a close/reopen/close cycle cannot revive a stale request.
 */
export function assertRecentlyClosedReadCurrent(request: RecentlyClosedReadRequest): void {
  const current = request.getCurrent();
  const decision = resolveRecentlyClosed(current.history, request.entry, current.documents);
  if (!request.isCurrent() || decision.kind !== 'read' ||
      decision.path !== request.expectedPath) {
    throw new Error('The editor or closed-source history changed. Review the history and retry.');
  }
}

export async function prepareRecentlyClosedRead(request: RecentlyClosedReadRequest): Promise<string> {
  assertRecentlyClosedReadCurrent(request);
  const content = await request.read(request.expectedPath);
  assertRecentlyClosedReadCurrent(request);
  assertScarpSourceText(content);
  return content;
}
