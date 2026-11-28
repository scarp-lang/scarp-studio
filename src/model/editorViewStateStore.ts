import type { StudioDocument } from './documents';

/** Bounded, session-local editor view state. No source text or view state
 * is written to localStorage, the filesystem, or workspace session export. */
export const MAX_EDITOR_VIEW_STATES = 80;

export interface EditorViewIdentity {
  readonly id: string;
  readonly revision: number;
  readonly path: string | null;
}

export interface EditorViewRecord<T> {
  readonly identity: EditorViewIdentity;
  readonly value: T;
}

function identity(document: StudioDocument): EditorViewIdentity {
  return Object.freeze({ id: document.id, revision: document.revision, path: document.path });
}

function validIdentity(document: StudioDocument): boolean {
  return document.id.length > 0 && Number.isSafeInteger(document.revision) && document.revision >= 0;
}

function matches(record: EditorViewIdentity, document: StudioDocument): boolean {
  return record.id === document.id && record.revision === document.revision && record.path === document.path;
}

/** Opaque Monaco view objects stay bound to their exact live tab generation.
 * An ID reused after close/reopen, Save As, or edit/revert cannot restore
 * another document's cursor, selections, scroll offset, or folding state. */
export class EditorViewStateStore<T> {
  private readonly records = new Map<string, EditorViewRecord<T>>();
  private readonly capacity: number;

  constructor(capacity = MAX_EDITOR_VIEW_STATES) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_EDITOR_VIEW_STATES) {
      throw Error('Invalid editor view state capacity.');
    }
    this.capacity = capacity;
  }

  get size(): number { return this.records.size; }

  capture(document: StudioDocument, value: T | null | undefined): boolean {
    if (!validIdentity(document) || value === null || value === undefined) return false;
    this.records.delete(document.id);
    this.records.set(document.id, Object.freeze({ identity: identity(document), value }));
    while (this.records.size > this.capacity) {
      const oldest = this.records.keys().next();
      if (oldest.done) break;
      this.records.delete(oldest.value);
    }
    return true;
  }

  restore(document: StudioDocument): T | null {
    const entry = this.records.get(document.id);
    if (!entry) return null;
    if (!validIdentity(document) || !matches(entry.identity, document)) {
      this.records.delete(document.id);
      return null;
    }
    // A successful restoration is a use; keep it near the front of the
    // bounded recent-state set without retaining any extra copies.
    this.records.delete(document.id);
    this.records.set(document.id, entry);
    return entry.value;
  }

  reconcile(documents: readonly StudioDocument[]): void {
    if (!this.records.size) return;
    const live = new Map<string, StudioDocument>();
    const ambiguous = new Set<string>();
    for (const document of documents) {
      if (live.has(document.id)) ambiguous.add(document.id);
      else live.set(document.id, document);
    }
    for (const [id, entry] of this.records) {
      const document = live.get(id);
      if (!document || ambiguous.has(id) || !validIdentity(document) || !matches(entry.identity, document)) {
        this.records.delete(id);
      }
    }
  }

  forget(id: string): boolean {
    return this.records.delete(id);
  }

  clear(): void {
    this.records.clear();
  }
}
