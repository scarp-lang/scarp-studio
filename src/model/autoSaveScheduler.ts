import { canAutoSave } from './autoSaveSettings';
import type { StudioDocument } from './documents';

type Timer = ReturnType<typeof setTimeout>;
type Pending = { document: StudioDocument; delay: number; timer: Timer };

// Another file's native write or a compiler command can temporarily block a
// save. Retry at a bounded rate rather than spinning every 250 ms indefinitely.
const BUSY_RETRY_MS = 250;
const MAX_BUSY_RETRY_MS = 2000;

/**
 * One timer per dirty file. No disk I/O here; callers provide a guarded
 * snapshot writer. Reconciliation invalidates stale callbacks and retries.
 */
export class AutoSaveScheduler {
  private readonly pending = new Map<string, Pending>();
  private currentDocuments = new Map<string, StudioDocument>();
  private enabled = false;
  private paused = false;
  private delay = 3000;
  private revision = 0;
  private disposed = false;

  constructor(
    private readonly onSave: (document: StudioDocument) => void | boolean,
    private readonly schedule: (callback: () => void, delay: number) => Timer = setTimeout,
    private readonly cancel: (handle: Timer) => void = clearTimeout,
  ) {}

  private eligible(document: StudioDocument, delay: number): boolean {
    return !this.disposed && this.enabled && !this.paused &&
      this.delay === delay && this.currentDocuments.get(document.id) === document &&
      canAutoSave(document);
  }

  private arm(document: StudioDocument, delay: number, wait: number,
    nextRetry = BUSY_RETRY_MS): void {
    const timer = this.schedule(() => {
      if (this.pending.get(document.id)?.timer !== timer) return;
      this.pending.delete(document.id);
      if (!this.eligible(document, delay)) return;

      // onSave may synchronously trigger a settings change, close or dispose.
      // Only a blocked, still-eligible *same snapshot* can be retried. A
      // reentrant reconcile already owns any new timer for that document.
      const revision = this.revision;
      if (this.onSave(document) === false &&
          revision === this.revision && this.eligible(document, delay) &&
          !this.pending.has(document.id)) {
        this.arm(document, delay, nextRetry,
          Math.min(nextRetry * 2, MAX_BUSY_RETRY_MS));
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
    if (this.disposed) return;
    this.revision++;
    this.currentDocuments = new Map(documents.map((doc) => [doc.id, doc]));
    this.enabled = enabled;
    this.paused = paused;
    this.delay = delay;

    for (const [id, pending] of this.pending) {
      if (!this.eligible(pending.document, pending.delay)) {
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
    this.disposed = true;
    this.enabled = false;
    this.revision++;
    this.currentDocuments.clear();
    for (const pending of this.pending.values()) this.cancel(pending.timer);
    this.pending.clear();
  }
}
