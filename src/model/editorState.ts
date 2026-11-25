import {
  createUntitled, isDirty, markSaved, openedDocument, updateContent,
  type StudioDocument,
} from './documents';
import { validateRecoveryDrafts, type RecoveryDraft } from './draftRecovery';

export interface EditorState {
  documents: StudioDocument[];
  activeId: string | null;
  nextUntitled: number;
  /** Monotonic whole-session generation, including close/reopen ABA transitions. */
  sessionRevision: number;
}

/** User-reviewed replacements commit atomically only against unchanged tabs. */
export interface BufferReplacement {
  id: string;
  snapshot: StudioDocument;
  content: string;
}

export function canApplyReplacementSnapshots(
  state: EditorState,
  changes: readonly BufferReplacement[],
): boolean {
  if (!changes.length) return false;
  const ids = new Set<string>();
  return changes.every((change) => {
    if (ids.has(change.id) || change.id !== change.snapshot.id ||
        change.content === change.snapshot.content) return false;
    ids.add(change.id);
    const current = state.documents.find((document) => document.id === change.id);
    return current !== undefined && isUnchangedSnapshot(current, change.snapshot);
  });
}

export type EditorAction =
  | { type: 'new' }
  | { type: 'restore-drafts'; drafts: readonly RecoveryDraft[] }
  | { type: 'open'; path: string; content: string }
  | { type: 'edit'; id: string; content: string }
  | { type: 'saved'; id: string; path: string; savedContent: string }
  | { type: 'reload'; id: string; snapshot: StudioDocument; content: string }
  | { type: 'replace-open-files'; changes: readonly BufferReplacement[]; allSnapshots: readonly StudioDocument[] }
  | { type: 'activate'; id: string }
  | { type: 'close'; id: string; snapshot: StudioDocument };

export const initialEditorState: EditorState = {
  documents: [createUntitled(1)],
  activeId: 'untitled-1',
  nextUntitled: 2,
  sessionRevision: 0,
};

/** Guard against a native close dialog racing with new keystrokes or a save. */
export function isUnchangedSnapshot(
  current: StudioDocument,
  snapshot: StudioDocument,
): boolean {
  return current.id === snapshot.id &&
    current.path === snapshot.path &&
    current.name === snapshot.name &&
    current.content === snapshot.content &&
    current.savedContent === snapshot.savedContent &&
    current.revision === snapshot.revision &&
    current.recoveredDraft === snapshot.recoveredDraft;
}

/** Validate *every* open buffer, not just those with search hits.
 * A newly created tab or edit in an initially unmatched document must
 * invalidate a preview claiming to replace in all open files.
 */
export function sameOpenDocumentSnapshots(
  snapshot: readonly StudioDocument[],
  current: readonly StudioDocument[],
): boolean {
  return snapshot.length === current.length &&
    snapshot.every((expected, index) => isUnchangedSnapshot(current[index], expected));
}

/** Resolve Save and Close targets from synchronous live editor state, not
 * a potentially stale React render's activeId closure.
 */
export function currentActiveDocument(state: EditorState): StudioDocument | null {
  return state.documents.find((document) => document.id === state.activeId) ?? null;
}

/** A deferred native operation is current only while the entire in-memory
 * editor session remains unchanged. Focus-switch-back and file-close/reopen
 * must not turn an older native result into a fresh user intent.
 * The reducer increments this revision for all meaningful transitions.
 */
export function hasUnchangedEditorSession(
  initial: EditorState,
  current: EditorState,
): boolean {
  return initial.sessionRevision === current.sessionRevision &&
    initial.activeId === current.activeId;
}

/** Every *genuine* editor transition advances the session revision once.
 * This detects close/reopen and focus-switch ABA even when per-tab snapshots
 * become byte-identical again. No-op edits/opens preserve object identity.
 */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const next = reduceEditorState(state, action);
  return next === state
    ? state
    : { ...next, sessionRevision: state.sessionRevision + 1 };
}

/** Pure transitions keep asynchronous file-open events from replacing newer tabs. */
function reduceEditorState(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'new': {
      const created = createUntitled(state.nextUntitled);
      return {
        ...state,
        documents: [...state.documents, created],
        activeId: created.id,
        nextUntitled: state.nextUntitled + 1,
      };
    }
    case 'restore-drafts': {
      const validated = validateRecoveryDrafts(action.drafts);
      if (!validated.ok) return state;
      const restored: StudioDocument[] = validated.value.map((draft, index) => {
        const sequence = state.nextUntitled + index;
        return {
          id: 'untitled-' + sequence,
          name: 'Recovered-' + sequence + '-' + draft.name,
          path: null,
          content: draft.content,
          savedContent: '',
          recoveredDraft: true,
          revision: state.sessionRevision + 1,
        };
      });
      return {
        ...state,
        documents: [...state.documents, ...restored],
        activeId: restored[0].id,
        nextUntitled: state.nextUntitled + restored.length,
      };
    }
    case 'open': {
      const opened = openedDocument(
        state.documents, action.path, action.content, state.sessionRevision + 1,
      );
      if (opened.documents === state.documents && opened.id === state.activeId) return state;
      return { ...state, documents: opened.documents, activeId: opened.id };
    }
    case 'edit': {
      const updated = updateContent(state.documents, action.id, action.content);
      return updated === state.documents ? state : { ...state, documents: updated };
    }
    case 'saved':
      if (!state.documents.some((document) => document.id === action.id)) return state;
      return {
        ...state,
        documents: markSaved(state.documents, action.id, action.path, action.savedContent),
      };
    case 'reload': {
      const current = state.documents.find((doc) => doc.id === action.id);
      // A completed disk read cannot overwrite an edited, saved, closed or
      // switched-away tab. Keep this as a reducer-level safety invariant.
      if (!current?.path || state.activeId !== action.id ||
          !isUnchangedSnapshot(current, action.snapshot)) return state;
      if (current.content === action.content && current.savedContent === action.content) return state;
      return {
        ...state,
        documents: state.documents.map((doc) =>
          doc.id === action.id
            ? { ...doc, content: action.content, savedContent: action.content,
                revision: doc.revision + 1 }
            : doc,
        ),
      };
    }
    case 'replace-open-files': {
      if (!sameOpenDocumentSnapshots(action.allSnapshots, state.documents) ||
          !canApplyReplacementSnapshots(state, action.changes)) return state;
      const byId = new Map(action.changes.map((change) => [change.id, change.content]));
      return {
        ...state,
        documents: state.documents.map((document) => byId.has(document.id)
          ? { ...document, content: byId.get(document.id)!,
              revision: document.revision + 1 }
          : document),
      };
    }
    case 'activate':
      if (state.activeId === action.id ||
          !state.documents.some((document) => document.id === action.id)) return state;
      return { ...state, activeId: action.id };
    case 'close': {
      const current = state.documents.find((document) => document.id === action.id);
      if (!current || !isUnchangedSnapshot(current, action.snapshot)) return state;
      // A changed saved snapshot is treated as a new edit, not an authorized discard.
      if (isDirty(current) !== isDirty(action.snapshot)) return state;
      const remaining = state.documents.filter((document) => document.id !== action.id);
      return {
        ...state,
        documents: remaining,
        activeId: state.activeId === action.id
          ? remaining.at(-1)?.id ?? null
          : state.activeId,
      };
    }
  }
}

/** Native exit dialogs must never authorize edits created after the prompt opened. */
export function sameDirtyDocuments(
  snapshot: readonly StudioDocument[],
  currentDocuments: readonly StudioDocument[],
): boolean {
  const currentDirty = currentDocuments.filter(isDirty);
  if (snapshot.length !== currentDirty.length) return false;
  return snapshot.every((expected) => {
    const current = currentDirty.find((document) => document.id === expected.id);
    return current !== undefined && isUnchangedSnapshot(current, expected);
  });
}
