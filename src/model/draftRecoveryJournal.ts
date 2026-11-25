import type { StudioDocument } from './documents';
import {
  DRAFT_RECOVERY_KEY, captureRecoveryCheckpoint, encodeRecoveryRecord,
  parseRecoveryRecord, sameRecoveryDrafts, type RecoveryCheckpoint, type RecoveryRecord,
} from './draftRecovery';

export interface RecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface RecoveryView {
  available: boolean;
  enabled: boolean;
  blocked: boolean;
  paused: boolean;
  previous: RecoveryCheckpoint | null;
  checkpointTime: number | null;
  checkpointCount: number;
  error: string | null;
}

/** A single local record holds both the opt-in and its last complete checkpoint.
 * Startup data is held for review and never overwritten by the new session.
 * Compare the exact raw record before modifying it to detect other writers.
 * This is best-effort collision detection, not an interprocess atomic lock.
 */
export class DraftRecoveryJournal {
  private raw: string | null = null;
  private record: RecoveryRecord | null = null;
  private previous: RecoveryCheckpoint | null = null;
  private blocked = false;
  private error: string | null = null;
  private suspended = false;
  private readable = false;

  constructor(private readonly storage: RecoveryStorage | null) {
    if (!storage) {
      this.error = 'Local draft storage is unavailable.';
      return;
    }
    try {
      this.raw = storage.getItem(DRAFT_RECOVERY_KEY);
      this.readable = true;
      const parsed = parseRecoveryRecord(this.raw);
      if (!parsed.ok) {
        this.blocked = true;
        this.error = parsed.error;
        return;
      }
      this.record = parsed.value;
      this.previous = parsed.value?.checkpoint ?? null;
    } catch {
      this.error = 'Local draft storage could not be read.';
    }
  }

  view(): RecoveryView {
    return {
      available: this.readable,
      enabled: this.record !== null,
      blocked: this.blocked,
      paused: this.suspended,
      previous: this.previous,
      checkpointTime: this.record?.checkpoint?.createdAt ?? null,
      checkpointCount: this.record?.checkpoint?.drafts.length ?? 0,
      error: this.error,
    };
  }

  private fail(message: string): false {
    this.error = message;
    return false;
  }

  private checkCurrent(): boolean {
    if (!this.storage || !this.readable) return this.fail('Local draft storage is unavailable.');
    try {
      if (this.storage.getItem(DRAFT_RECOVERY_KEY) !== this.raw) {
        this.blocked = true;
        return this.fail('Local recovery changed outside this session. Restart Studio before reviewing or editing it.');
      }
      return true;
    } catch {
      return this.fail('Local recovery storage could not be checked.');
    }
  }

  private replace(next: RecoveryRecord | null): boolean {
    if (!this.checkCurrent()) return false;
    const encoded = next === null ? null : encodeRecoveryRecord(next);
    if (encoded && !encoded.ok) return this.fail(encoded.error);
    const raw = encoded?.value ?? null;
    try {
      if (raw === null) this.storage!.removeItem(DRAFT_RECOVERY_KEY);
      else this.storage!.setItem(DRAFT_RECOVERY_KEY, raw);
      this.raw = raw;
      this.record = next;
      this.error = null;
      this.blocked = false;
      return true;
    } catch {
      return this.fail('Recovery storage write failed. The previous complete checkpoint has been retained if storage permits.');
    }
  }

  /** Opt-in is committed only when the first complete checkpoint fits. */
  enable(documents: readonly StudioDocument[], now: number): boolean {
    if (this.blocked || this.suspended) return false;
    if (this.record) return true;
    const checkpoint = captureRecoveryCheckpoint(documents, now);
    if (!checkpoint.ok) return this.fail(checkpoint.error);
    return this.replace({ version: 1, enabled: true, checkpoint: checkpoint.value });
  }

  /** Explicit disable also removes the local source record. If it fails,
   * revoke writes immediately but retain the visible error and data status. */
  disable(): boolean {
    this.suspended = true;
    if (!this.readable) return this.fail('Local recovery storage is unavailable.');
    if (!this.replace(null)) return false;
    this.previous = null;
    this.suspended = false;
    return true;
  }

  /** Background checkpoints never replace a pending startup recovery or
   * an unrecognized stored record. Identical source snapshots do not write. */
  flush(documents: readonly StudioDocument[], now: number): boolean {
    if (!this.record || this.previous || this.blocked || this.suspended) return false;
    if (!this.checkCurrent()) return false;
    const checkpoint = captureRecoveryCheckpoint(documents, now);
    if (!checkpoint.ok) return this.fail(checkpoint.error);
    if (sameRecoveryDrafts(checkpoint.value, this.record.checkpoint)) {
      this.error = null;
      return true;
    }
    return this.replace({ version: 1, enabled: true, checkpoint: checkpoint.value });
  }

  /** Resolve only the exact startup checkpoint currently under review.
   * The caller supplies the proposed post-restore editor documents before
   * applying the corresponding synchronous reducer transition. This makes
   * storage failure leave the earlier checkpoint and live editor untouched. */
  resolvePrevious(
    expected: RecoveryCheckpoint, documents: readonly StudioDocument[], now: number,
  ): boolean {
    if (!this.record || this.blocked || this.suspended || this.previous !== expected) {
      return this.fail('The previous recovery checkpoint is no longer current.');
    }
    const checkpoint = captureRecoveryCheckpoint(documents, now);
    if (!checkpoint.ok) return this.fail(checkpoint.error);
    if (!this.replace({ version: 1, enabled: true, checkpoint: checkpoint.value })) return false;
    this.previous = null;
    return true;
  }

  /** Explicit clean exit or confirmed discard removes only this session's
   * checkpoint. Unreviewed prior-session data remains intact. Suspend first
   * so a later pagehide callback cannot recreate discarded drafts. */
  prepareExit(): boolean {
    this.suspended = true;
    if (!this.record || this.previous || this.blocked) return true;
    if (this.record.checkpoint === null) return true;
    return this.replace({ version: 1, enabled: true, checkpoint: null });
  }

  /** A native destroy failure must not leave the current session suspended. */
  resumeAfterExitFailure(documents: readonly StudioDocument[], now: number): void {
    this.suspended = false;
    this.flush(documents, now);
  }
}
