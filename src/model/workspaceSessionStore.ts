import { sameFilePath } from './documents';
import {
  WORKSPACE_SESSIONS_KEY, MAX_REMEMBERED_WORKSPACES, parseWorkspaceSessions,
  encodeWorkspaceSessions, validateWorkspaceSession, type WorkspaceSession,
  type WorkspaceSessionRecord,
} from './workspaceSessions';

export interface WorkspaceSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface WorkspaceSessionView {
  available: boolean;
  blocked: boolean;
  sessions: readonly WorkspaceSession[];
  error: string | null;
}

/** Manual, metadata-only storage. Nothing is captured automatically, no
 * record is silently evicted, and unknown versions require explicit removal. */
export class WorkspaceSessionStore {
  private raw: string | null = null;
  private sessions: WorkspaceSession[] = [];
  private available = false;
  private blocked = false;
  private error: string | null = null;

  constructor(private readonly storage: WorkspaceSessionStorage | null) {
    if (!storage) {
      this.error = 'Remembered workspace storage is unavailable.';
      return;
    }
    try {
      this.raw = storage.getItem(WORKSPACE_SESSIONS_KEY);
      this.available = true;
      const parsed = parseWorkspaceSessions(this.raw);
      if (!parsed.ok) {
        this.blocked = true;
        this.error = parsed.error;
      } else {
        this.sessions = parsed.value.sessions;
      }
    } catch {
      this.error = 'Remembered workspace storage could not be read.';
    }
  }

  view(): WorkspaceSessionView {
    return { available: this.available, blocked: this.blocked, sessions: this.sessions, error: this.error };
  }

  find(root: string): WorkspaceSession | null {
    return this.sessions.find(session => sameFilePath(session.root, root)) ?? null;
  }

  private fail(error: string): false {
    this.error = error;
    return false;
  }

  private current(): boolean {
    if (!this.storage || !this.available) return this.fail('Remembered workspace storage is unavailable.');
    try {
      if (this.storage.getItem(WORKSPACE_SESSIONS_KEY) !== this.raw) {
        this.blocked = true;
        return this.fail('Remembered workspace metadata changed outside this session. Restart Studio before changing it.');
      }
      return true;
    } catch {
      return this.fail('Remembered workspace storage could not be checked.');
    }
  }

  private replace(sessions: WorkspaceSession[]): boolean {
    if (!this.current()) return false;
    const value: WorkspaceSessionRecord = { version: 1, sessions };
    const encoded = sessions.length ? encodeWorkspaceSessions(value) : null;
    if (encoded && !encoded.ok) return this.fail(encoded.error);
    try {
      const raw = encoded?.value ?? null;
      if (raw === null) this.storage!.removeItem(WORKSPACE_SESSIONS_KEY);
      else this.storage!.setItem(WORKSPACE_SESSIONS_KEY, raw);
      this.raw = raw;
      this.sessions = sessions;
      this.blocked = false;
      this.error = null;
      return true;
    } catch {
      return this.fail('Remembered workspace storage write failed. Existing metadata was not intentionally removed.');
    }
  }

  /** Replacing an existing record requires the exact previously reviewed
   * object. A full store requires explicit forget/clear rather than eviction. */
  remember(session: WorkspaceSession, expected: WorkspaceSession | null): boolean {
    if (this.blocked) return false;
    const parsed = validateWorkspaceSession(session);
    if (!parsed.ok) return this.fail(parsed.error);
    const existing = this.find(session.root);
    if (existing !== expected) return this.fail('The remembered workspace changed. Review it before replacing.');
    if (!existing && this.sessions.length >= MAX_REMEMBERED_WORKSPACES) {
      return this.fail('Eight workspaces are already remembered. Forget one before adding another.');
    }
    const remaining = this.sessions.filter(item => item !== existing);
    return this.replace([parsed.value, ...remaining]);
  }

  forget(expected: WorkspaceSession): boolean {
    if (this.blocked) return false;
    if (this.find(expected.root) !== expected) return this.fail('The remembered workspace is no longer current.');
    return this.replace(this.sessions.filter(item => item !== expected));
  }

  /** Also permits explicit removal of a corrupt record, but never removes a
   * record that changed externally after the current session read it. */
  clearAll(expected: readonly WorkspaceSession[]): boolean {
    if (this.sessions !== expected) return this.fail('Remembered workspaces changed. Review before clearing.');
    return this.replace([]);
  }

  /** Validate the exact reviewed record before beginning an explicit restore.
   * The native workspace selection is still independently required. */
  canRestore(expected: WorkspaceSession): boolean {
    if (this.blocked || this.find(expected.root) !== expected) {
      return this.fail('The remembered workspace is no longer current.');
    }
    return this.current();
  }
}
