import { canAutoSave } from './autoSaveSettings';
import type { StudioDocument } from './documents';

/**
 * Replace All is explicitly an in-memory, review-before-save operation.
 * Timed Auto Save must not silently persist the replacement, including when
 * Auto Save is enabled *after* Replace All. Hold exactly those replaced source
 * snapshots until their next explicit Save, edit, undo, close or reopen.
 *
 * This is not a filesystem lock. Actual writes still run the independently
 * guarded native file service with external-change and post-write checks.
 */
export class AutoSaveReviewGate {
  private readonly held = new Map<string, StudioDocument>();

  holdReplacements(
    documents: readonly StudioDocument[],
    changedIds: readonly string[],
  ): void {
    const selected = new Set(changedIds);
    for (const document of documents) {
      if (selected.has(document.id) && canAutoSave(document)) {
        this.held.set(document.id, document);
      }
    }
  }

  /** Compare object identity, not content: A→B→A edits must not revive holds. */
  isHeld(document: StudioDocument): boolean {
    return this.held.get(document.id) === document;
  }

  /** Reject an expired timer, settings-off or a held Replace All snapshot. */
  canWrite(
    original: StudioDocument,
    live: StudioDocument | undefined,
    enabled: boolean,
  ): boolean {
    return enabled && live === original && canAutoSave(original) &&
      !this.isHeld(original);
  }

  /** Remove holds as soon as the exact snapshot is no longer in the editor. */
  reconcile(documents: readonly StudioDocument[]): void {
    const byId = new Map(documents.map((document) => [document.id, document]));
    for (const [id, snapshot] of this.held) {
      if (byId.get(id) !== snapshot || !canAutoSave(snapshot)) this.held.delete(id);
    }
  }

  reviewCount(documents: readonly StudioDocument[]): number {
    return documents.filter((document) => this.isHeld(document)).length;
  }
}
