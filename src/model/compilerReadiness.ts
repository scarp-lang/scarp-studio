import { isDirty, isScarpPath, type StudioDocument } from './documents';

/** Compiler commands always operate on a saved Scarp file, never a stale buffer. */
export function runnableSource(document: StudioDocument | null): string {
  if (!document) throw new Error('Open a Scarp source file first.');
  if (!document.path || !isScarpPath(document.path)) {
    throw new Error('Save the source as a .srp file before Run or Verify.');
  }
  if (isDirty(document)) {
    throw new Error('Save your latest edits before Run or Verify.');
  }
  return document.path;
}

export type CompilerActionBlock = 'desktop' | 'busy' | 'no-source' | 'unsaved' | 'dirty' | 'invalid-input';
export interface CompilerActionState {
  native: boolean;
  busy: boolean;
  source: StudioDocument | null;
  inputError: string | null;
}

/** Shared presentation decision for Run and Verify. Compiler trust is
 * intentionally not a UI blocker: first Run may discover and ask for
 * explicit approval. Native launch checks remain independently enforced. */
export function compilerActionBlock(state: CompilerActionState, mode: 'exec' | 'verify'): CompilerActionBlock | null {
  if (!state.native) return 'desktop';
  if (state.busy) return 'busy';
  if (!state.source) return 'no-source';
  if (!state.source.path || !isScarpPath(state.source.path)) return 'unsaved';
  if (isDirty(state.source)) return 'dirty';
  if (mode === 'exec' && state.inputError !== null) return 'invalid-input';
  return null;
}

export function compilerActionHint(block: CompilerActionBlock | null, inputError: string | null): string | null {
  switch (block) {
    case 'desktop': return 'Run and Verify require the Windows desktop application.';
    case 'busy': return 'Another editor or compiler operation is in progress.';
    case 'no-source': return 'Open or create a Scarp source to get started.';
    case 'unsaved': return 'Save the source as .srp before Run or Verify (Ctrl+S).';
    case 'dirty': return 'Save the latest edits before Run or Verify (Ctrl+S).';
    case 'invalid-input': return inputError ?? 'Review Program Input before Run.';
    default: return null;
  }
}
