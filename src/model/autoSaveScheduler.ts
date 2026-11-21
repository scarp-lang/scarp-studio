import { canAutoSave } from './studioSettings';
import type { StudioDocument } from './documents';

type Timer = ReturnType<typeof setTimeout>;
type Pending = { document: StudioDocument; delay: number; timer: Timer };

// A save can be temporarily blocked by an unrelated file being written.
// Defer that file rather than dropping the pending save forever.
const BUSY_RETRY_MS = 250;

/**
 * One timer per dirty file. No disk I/O here; callers provide a guarded
 * snapshot writer. The snapshot identity prevents stale callbacks from saving.
 */
export class AutoSaveScheduler {
  private readonly pending = new Map<string, Pending>();

  constructor(
    private readonly onSave: (document: StudioDocument) => void | boolean,
    private readonly schedule: (callback: () => void, delay: number) => Timer = setTimeout,
    private readonly cancel: (handle: Timer) => void = clearTimeout,
  ) {}

  private arm(document: StudioDocument, delay: number, wait: number): void {
    const timer = this.schedule(() => {
      if (this.pending.get(document.id)?.timer !== timer) return;
      this.pending.delete(document.id);
      // false means the write was not started because another file is busy.
      // A stale document or disabled Auto Save must return normally (no retry).
      if (this.onSave(document) === false) {
        this.arm(document, delay, BUSY_RETRY_MS);
      }
    }, wait);
    this.pending.set(document.id, { document, delay, timer });
  }

  reconcile(
    documents: readonly StudioDocument[],
    enabled: boolean,
    delay: number,
    paused: boolean,
  ): void {
    const byId = new Map(documents.map((doc) => [doc.id, doc]));
    for (const [id, pending] of this.pending) {
      const current = byId.get(id);
      if (!enabled || paused || !current || !canAutoSave(current) ||
          current !== pending.document || delay !== pending.delay) {
        this.cancel(pending.timer);
        this.pending.delete(id);
      }
    }
    if (!enabled || paused) return;
    for (const document of documents) {
      if (!canAutoSave(document) || this.pending.has(document.id)) continue;
      this.arm(document, delay, delay);
    }
  }

  dispose(): void {
    for (const pending of this.pending.values()) this.cancel(pending.timer);
    this.pending.clear();
  }
}
