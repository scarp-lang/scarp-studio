import { describe, expect, it } from 'vitest';
import { editorReducer, initialEditorState, type EditorState } from './editorState';
import { scanIdentifierEdit, planIdentifierEdit, identifierInventoryIsCurrent, identifierPlanIsCurrent,
  validEditIdentifier, MAX_IDENTIFIER_EDIT_FILES, MAX_IDENTIFIER_EDIT_SITES, MAX_IDENTIFIER_EDIT_UNITS,
  type IdentifierEditRequest } from './identifierEdit';
import { createOpenFileReplaceUndo, canUndoOpenFileReplace } from './openFileReplaceUndo';
import { AutoSaveReviewGate } from './autoSaveReviewGate';

const request: IdentifierEditRequest = { from: 'old_counter', to: 'new_counter', scope: 'active' };
function state(content: string): EditorState {
  return editorReducer(initialEditorState, { type: 'edit', id: initialEditorState.activeId!, content });
}
function inventory(editor: EditorState, patch: Partial<IdentifierEditRequest> = {}) {
  const result = scanIdentifierEdit(editor, { ...request, ...patch });
  if (!result.ok) throw Error(result.error);
  return result.value;
}
function plan(editor: EditorState, patch: Partial<IdentifierEditRequest> = {}) {
  const scan = inventory(editor, patch);
  const result = planIdentifierEdit(scan, scan.sites.map(site => site.id), editor);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
describe('literal identifier inventory', () => {
  it('excludes strings, line comments, longer names, and differently cased tokens', () => {
    const source = 'bind old_counter = 1;\nprint(old_counter, old_counter_2, OLD_COUNTER);\n// old_counter\nprint("old_counter");';
    const scan = inventory(state(source));
    expect(scan.sites.map(site => [site.line, site.column, site.role])).toEqual([
      [1, 6, 'declaration-like'], [2, 7, 'other'],
    ]);
    expect(plan(state(source)).changes[0].content).toBe(
      'bind new_counter = 1;\nprint(new_counter, old_counter_2, OLD_COUNTER);\n// old_counter\nprint("old_counter");');
  });
  it('marks qualified sites without claiming semantic resolution', () => {
    const scan = inventory(state('mod.old_counter(); old_counter(); bind old_counter = 1;'));
    expect(scan.sites.map(site => site.role)).toEqual(['qualified', 'other', 'declaration-like']);
  });
  it('reports existing replacement spelling only in code', () => {
    const scan = inventory(state('old_counter(); new_counter(); // new_counter\nprint("new_counter");'));
    expect(scan.collisions).toEqual([{ documentId: 'untitled-1', documentName: initialEditorState.documents[0].name, count: 1 }]);
  });
  it('preserves line endings and uses UTF-16 coordinates', () => {
    const source = 'print("😀"); old_counter();\r\nold_counter();\rold_counter();';
    const scan = inventory(state(source));
    expect(scan.sites.map(site => [site.line, site.column])).toEqual([[1, 14], [2, 1], [3, 1]]);
    expect(plan(state(source)).changes[0].content).toBe(source.replaceAll('old_counter','new_counter'));
  });
  it('shows bounded context around distant token sites', () => {
    const source = 'print("' + '😀'.repeat(140) + '"); old_counter(); ' + 'a'.repeat(200);
    const item = inventory(state(source)).sites[0];
    expect(item.omittedPrefix).toBe(true);
    expect(item.omittedSuffix).toBe(true);
    expect(item.before).toContain('old_counter');
    expect(item.after).toContain('new_counter');
    expect(new TextDecoder().decode(new TextEncoder().encode(item.before))).toBe(item.before);
  });
  it('supports active-only and open-buffer scopes without disk access', () => {
    let editor = state('old_counter();');
    editor = editorReducer(editor, { type: 'open', path: 'C:/demo/second.srp', content: 'old_counter();' });
    expect(inventory(editor).sites).toHaveLength(1);
    expect(inventory(editor,{scope:'open'}).sites).toHaveLength(2);
    expect(plan(editor,{scope:'open'}).changes).toHaveLength(2);
  });
  it('does not return a partial inventory when the lexer or result budget is exceeded', () => {
    for (const source of [
      'old_counter '.repeat(MAX_IDENTIFIER_EDIT_SITES + 1),
      'x '.repeat(24001) + 'old_counter',
      'old_counter; "unfinished',
      'old_counter;\u0000',
      'अold_counter;',
      'old_counterअ;',
      'old_counter; new_counterअ;',
    ]) expect(scanIdentifierEdit(state(source),request).ok).toBe(false);
  });
  it('enforces file and aggregate source budgets for complete scans', () => {
    const many = Array.from({length: MAX_IDENTIFIER_EDIT_FILES + 1}, (_, i) => ({
      ...initialEditorState.documents[0], id: 'file'+i, content: 'old_counter;',
    }));
    expect(scanIdentifierEdit({...initialEditorState,documents:many}, {...request,scope:'open'}).ok).toBe(false);
    const large = Array.from({length: 3}, (_, i) => ({
      ...initialEditorState.documents[0], id: 'file'+i, content: ' '.repeat(Math.floor(MAX_IDENTIFIER_EDIT_UNITS/2)) + 'old_counter;',
    }));
    expect(scanIdentifierEdit({...initialEditorState,documents:large}, {...request,scope:'open'}).ok).toBe(false);
  });
  it.each(['','if','print','integer','2foo','a-b','x'.repeat(129),'😀','new counter'])('rejects unsupported identifier %j', name => {
    expect(validEditIdentifier(name)).toBe(false);
    expect(scanIdentifierEdit(state('old_counter;'),{...request,to:name}).ok).toBe(false);
  });
  it('rejects same spelling and no matches', () => {
    expect(scanIdentifierEdit(state('old_counter;'),{...request,to:'old_counter'}).ok).toBe(false);
    expect(scanIdentifierEdit(state('unrelated;'),request).ok).toBe(false);
  });
});
describe('reviewed identifier edits', () => {
  it('applies only selected exact token spans even on one line', () => {
    const editor = state('old_counter(); old_counter(); old_counter();');
    const scan = inventory(editor);
    const selected = planIdentifierEdit(scan,[scan.sites[2].id,scan.sites[0].id],editor);
    if (!selected.ok) throw Error(selected.error);
    expect(selected.value.changes[0].content).toBe('new_counter(); old_counter(); new_counter();');
    expect(selected.value.selectedIds).toEqual([scan.sites[0].id,scan.sites[2].id]);
    expect(identifierPlanIsCurrent(selected.value,editor)).toBe(true);
  });
  it('rejects missing, duplicate and unknown selection ids', () => {
    const editor = state('old_counter();'), scan = inventory(editor);
    for (const ids of [[],['fake'],[scan.sites[0].id,scan.sites[0].id]]) {
      expect(planIdentifierEdit(scan,ids,editor).ok).toBe(false);
    }
  });
  it('rejects source edits, focus changes and ABA even if token text still matches', () => {
    const editor = state('old_counter();'), scan = inventory(editor);
    const changed = editorReducer(editor,{type:'edit',id:editor.activeId!,content:'old_counter(); // edit'});
    const restored = editorReducer(changed,{type:'edit',id:editor.activeId!,content:'old_counter();'});
    const added = editorReducer(editor,{type:'new'});
    const back = editorReducer(added,{type:'activate',id:editor.activeId!});
    for (const other of [changed,restored,added,back]) {
      expect(identifierInventoryIsCurrent(scan,other)).toBe(false);
      expect(planIdentifierEdit(scan,[scan.sites[0].id],other).ok).toBe(false);
    }
  });
  it('rejects forged offsets, preview text, replacement buffers and collision counts', () => {
    const editor = state('old_counter(); new_counter();'), scan = inventory(editor);
    for (const changed of [
      {...scan,sites:[{...scan.sites[0],offset:1}]},
      {...scan,sites:[{...scan.sites[0],after:'fabricated'}]},
      {...scan,collisions:[]},
    ]) expect(planIdentifierEdit(changed,[scan.sites[0].id],editor).ok).toBe(false);
    const reviewed = plan(editor);
    expect(identifierPlanIsCurrent({...reviewed,changes:[{...reviewed.changes[0],content:'fake'}]},editor)).toBe(false);
  });
  it('keeps the saved text intact, holds Auto Save and supports exact undo', () => {
    let editor = editorReducer(initialEditorState,{type:'open',path:'C:/demo/first.srp',content:'old_counter();'});
    editor = editorReducer(editor,{type:'open',path:'C:/demo/second.srp',content:'old_counter();'});
    const reviewed = plan(editor,{scope:'open'});
    const applied = editorReducer(editor,{type:'replace-open-files',changes:reviewed.changes,allSnapshots:editor.documents});
    const gate = new AutoSaveReviewGate();
    gate.holdReplacements(applied.documents,reviewed.changes.map(change=>change.id));
    for (const doc of applied.documents.filter(doc=>doc.path)) {
      expect(doc.content).toBe('new_counter();');
      expect(doc.savedContent).toBe('old_counter();');
      expect(gate.canWrite(doc,doc,true)).toBe(false);
    }
    const undo = createOpenFileReplaceUndo(editor.documents,applied.documents)!;
    expect(canUndoOpenFileReplace(undo,applied)).toBe(true);
    const restored = editorReducer(applied,{type:'replace-open-files',changes:undo.changes,allSnapshots:undo.after});
    expect(restored.documents.map(doc=>doc.content)).toEqual(editor.documents.map(doc=>doc.content));
  });
});


describe('alpha.3 literal safety', () => {
  it('never edits identifier-shaped raw or multiline text', () => {
    const source = 'bind old_counter = 1;\nprint(r"old_counter\\");\nprint("""\nold_counter\n""");\nprint(old_counter);';
    expect(plan(state(source)).changes[0].content).toBe(
      'bind new_counter = 1;\nprint(r"old_counter\\");\nprint("""\nold_counter\n""");\nprint(new_counter);');
  });
});
