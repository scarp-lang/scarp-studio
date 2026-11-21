import { describe, expect, it } from 'vitest';
import { AutoSaveReviewGate } from './autoSaveReviewGate';
import type { StudioDocument } from './documents';
import { editorReducer, initialEditorState } from './editorState';
import { planOpenFileReplacement } from './openFileReplace';
import { canUndoOpenFileReplace, createOpenFileReplaceUndo } from './openFileReplaceUndo';

function source(id: string): StudioDocument {
  return {
    id, name: id + '.srp', path: '/src/' + id + '.srp',
    content: 'after replace', savedContent: 'before replace',
    revision: 4,
  };
}

describe('Replace All Auto Save review gate', () => {
  it('holds only named changed dirty sources and keeps unrelated Auto Save active', () => {
    const gate = new AutoSaveReviewGate();
    const affected = source('affected');
    const other = source('unrelated');
    gate.holdReplacements([affected, other], [affected.id]);
    expect(gate.isHeld(affected)).toBe(true);
    expect(gate.canWrite(affected, affected, true)).toBe(false);
    expect(gate.canWrite(other, other, true)).toBe(true);
    expect(gate.reviewCount([affected, other])).toBe(1);
  });

  it('does not automatically persist Replace All when settings become enabled later', () => {
    const gate = new AutoSaveReviewGate();
    const affected = source('disabled-first');
    gate.holdReplacements([affected], [affected.id]);
    expect(gate.canWrite(affected, affected, false)).toBe(false);
    expect(gate.canWrite(affected, affected, true)).toBe(false);
    gate.reconcile([affected]);
    expect(gate.reviewCount([affected])).toBe(1);
  });

  it('allows Auto Save after a subsequent explicit edit but never an older timer', () => {
    const gate = new AutoSaveReviewGate();
    const replaced = source('edited');
    gate.holdReplacements([replaced], [replaced.id]);
    const typed = { ...replaced, content: 'user typed more', revision: 5 };
    expect(gate.canWrite(replaced, typed, true)).toBe(false);
    gate.reconcile([typed]);
    expect(gate.canWrite(typed, typed, true)).toBe(true);
    expect(gate.reviewCount([typed])).toBe(0);
  });

  it('clears on manual Save, Undo or close and never revives after A-B-A', () => {
    const gate = new AutoSaveReviewGate();
    const replaced = source('roundtrip');
    gate.holdReplacements([replaced], [replaced.id]);
    const reverted = { ...replaced, content: replaced.savedContent, revision: 5 };
    gate.reconcile([reverted]);
    expect(gate.isHeld(reverted)).toBe(false);
    const editedAgain = { ...replaced, revision: 6 };
    expect(gate.canWrite(editedAgain, editedAgain, true)).toBe(true);
    gate.holdReplacements([editedAgain], [editedAgain.id]);
    const saved = { ...editedAgain, savedContent: editedAgain.content, revision: 7 };
    gate.reconcile([saved]);
    expect(gate.isHeld(saved)).toBe(false);
    gate.holdReplacements([editedAgain], [editedAgain.id]);
    gate.reconcile([]);
    expect(gate.reviewCount([editedAgain])).toBe(0);
  });

  it('rejects in-flight writes if the setting is switched off before preflight', () => {
    const gate = new AutoSaveReviewGate();
    const doc = source('toggle');
    expect(gate.canWrite(doc, doc, true)).toBe(true);
    expect(gate.canWrite(doc, doc, false)).toBe(false);
    expect(gate.canWrite(doc, undefined, true)).toBe(false);
  });

  it('never places untitled or clean buffer snapshots on manual review hold', () => {
    const gate = new AutoSaveReviewGate();
    const untitled = { ...source('new'), path: null };
    const clean = { ...source('clean'), savedContent: 'after replace' };
    gate.holdReplacements([untitled, clean], [untitled.id, clean.id]);
    expect(gate.reviewCount([untitled, clean])).toBe(0);
  });
  it('protects real reducer Replace All, preserves unrelated Auto Save, and permits explicit Save', () => {
    const original = editorReducer(initialEditorState, {
      type: 'open', path: '/project/first.srp', content: 'print("old");',
    });
    const both = editorReducer(original, {
      type: 'open', path: '/project/second.srp', content: 'print("unrelated");',
    });
    const query = planOpenFileReplacement(
      both.documents, 'old', 'new', { caseSensitive: false, wholeWord: false },
    );
    expect(query.changes).toHaveLength(1);
    const replaced = editorReducer(both, {
      type: 'replace-open-files', changes: query.changes, allSnapshots: query.sourceSnapshots,
    });
    const gate = new AutoSaveReviewGate();
    gate.holdReplacements(replaced.documents, query.changes.map((change) => change.id));
    const changed = replaced.documents.find((doc) => doc.id === query.changes[0].id)!;
    expect(changed.content).toContain('new');
    expect(changed.savedContent).toContain('old');
    expect(gate.canWrite(changed, changed, true)).toBe(false);

    // A regular subsequent edit to an unrelated tab is still eligible.
    const editedOther = editorReducer(replaced, {
      type: 'edit', id: both.activeId!, content: 'print("unrelated but now dirty");',
    });
    gate.reconcile(editedOther.documents);
    expect(gate.isHeld(editedOther.documents.find((doc) => doc.id === changed.id)!))
      .toBe(true);
    const other = editedOther.documents.find((doc) => doc.id === both.activeId)!;
    expect(gate.canWrite(other, other, true)).toBe(true);

    const undo = createOpenFileReplaceUndo(query.sourceSnapshots, replaced.documents)!;
    expect(canUndoOpenFileReplace(undo, replaced)).toBe(true);
    const undone = editorReducer(replaced, {
      type: 'replace-open-files', changes: undo.changes, allSnapshots: undo.after,
    });
    gate.reconcile(undone.documents);
    expect(gate.reviewCount(undone.documents)).toBe(0);
    expect(undone.documents.find((doc) => doc.id === changed.id)!.content)
      .toBe('print("old");');

    const explicitlySaved = editorReducer(replaced, {
      type: 'saved', id: changed.id, path: changed.path!, savedContent: changed.content,
    });
    gate.reconcile(explicitlySaved.documents);
    expect(gate.reviewCount(explicitlySaved.documents)).toBe(0);
    expect(canUndoOpenFileReplace(undo, explicitlySaved)).toBe(false);
  });

});
