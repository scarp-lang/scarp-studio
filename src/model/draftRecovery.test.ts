import { describe, expect, it } from 'vitest';
import { createUntitled, isDirty, type StudioDocument } from './documents';
import { editorReducer, initialEditorState, isUnchangedSnapshot } from './editorState';
import {
  captureRecoveryCheckpoint, encodeRecoveryRecord, parseRecoveryRecord,
  recoveryDraftName, sameRecoveryDrafts, validateRecoveryDrafts,
  MAX_RECOVERY_DRAFTS, MAX_RECOVERY_JSON_UNITS, MAX_RECOVERY_SOURCE_UNITS,
  type RecoveryCheckpoint, type RecoveryRecord,
} from './draftRecovery';
import { canAutoSave } from './autoSaveSettings';

function dirty(name = 'main.srp', content = 'print("hello");'): StudioDocument {
  return { id: name, name, path: 'C:/private/project/' + name, content,
    savedContent: 'previous saved source', revision: 1 };
}
function checkpoint(drafts = [{ name: 'main.srp', content: 'print("hello");' }]): RecoveryCheckpoint {
  return { version: 1, createdAt: 1700000000000, drafts };
}
function stored(value: RecoveryCheckpoint | null = checkpoint()): RecoveryRecord {
  return { version: 1, enabled: true, checkpoint: value };
}
function capture(documents: readonly StudioDocument[]): RecoveryCheckpoint | null {
  const result = captureRecoveryCheckpoint(documents, 1700000000000);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('bounded local draft checkpoints', () => {
  it('does not create a checkpoint from clean documents or an empty new tab', () => {
    expect(capture([createUntitled(1), { ...dirty(), content: 'previous saved source' }])).toBeNull();
  });

  it('captures only modified content, basename and time; never original paths or saved text', () => {
    const result = capture([
      createUntitled(1),
      dirty('main.srp', 'print("नमस्ते 🌍");\r\n'),
      { ...createUntitled(2), content: 'let x = 10;' },
      { ...dirty('clean.srp'), content: 'previous saved source' },
    ]);
    expect(result).toEqual({
      version: 1, createdAt: 1700000000000,
      drafts: [
        { name: 'main.srp', content: 'print("नमस्ते 🌍");\r\n' },
        { name: 'Untitled-2.srp', content: 'let x = 10;' },
      ],
    });
    const raw = JSON.stringify(result);
    expect(raw).not.toContain('C:/private');
    expect(raw).not.toContain('previous saved source');
    expect(raw).not.toContain('revision');
  });

  it('retains a blank modification when a saved file was emptied', () => {
    expect(capture([dirty('main.srp', '')])?.drafts).toEqual([{ name: 'main.srp', content: '' }]);
  });

  it('allows exactly the draft count limit, but refuses any partial checkpoint beyond it', () => {
    const docs = Array.from({ length: MAX_RECOVERY_DRAFTS }, (_, i) => dirty(i + '.srp'));
    expect(capture(docs)?.drafts).toHaveLength(MAX_RECOVERY_DRAFTS);
    expect(captureRecoveryCheckpoint([...docs, dirty('extra.srp')], 1)).toMatchObject({ ok: false });
    expect(capture([...docs, createUntitled(99)])?.drafts).toHaveLength(MAX_RECOVERY_DRAFTS);
  });

  it('enforces one aggregate source budget across documents', () => {
    const half = 'x'.repeat(MAX_RECOVERY_SOURCE_UNITS / 2);
    expect(capture([dirty('a.srp', half), dirty('b.srp', half)])?.drafts).toHaveLength(2);
    expect(captureRecoveryCheckpoint([dirty('a.srp', half), dirty('b.srp', half + 'x')], 1))
      .toMatchObject({ ok: false });
  });

  it('rejects ill-formed UTF-16 rather than replacing a source character', () => {
    expect(captureRecoveryCheckpoint([dirty('a.srp', '\ud800')], 1)).toMatchObject({ ok: false });
    expect(captureRecoveryCheckpoint([dirty('a.srp', '\udc00')], 1)).toMatchObject({ ok: false });
    expect(capture([dirty('a.srp', '🌍')])?.drafts[0].content).toBe('🌍');
  });

  it('never accepts timestamps outside the valid finite Date range', () => {
    for (const time of [NaN, Infinity, -1, 1.5, 8640000000000001]) {
      expect(captureRecoveryCheckpoint([dirty()], time)).toMatchObject({ ok: false });
    }
  });

  it('uses a safe display basename or generic label without changing the source', () => {
    expect(recoveryDraftName('C:/private/main.SRP')).toBe('main.SRP');
    expect(recoveryDraftName('C:\\private\\main.srp')).toBe('main.srp');
    expect(recoveryDraftName('bad\u0000name.srp')).toBe('Recovered.srp');
    expect(recoveryDraftName('a'.repeat(121) + '.srp')).toBe('Recovered.srp');
    expect(recoveryDraftName('.hidden.srp')).toBe('Recovered.srp');
    expect(recoveryDraftName('plain.txt')).toBe('Recovered.srp');
    expect(capture([dirty('bad:name.srp')])?.drafts[0].name).toBe('Recovered.srp');
  });
});

describe('strict local recovery parsing', () => {
  it('treats an absent key as disabled and a valid empty record as explicitly enabled', () => {
    expect(parseRecoveryRecord(null)).toEqual({ ok: true, value: null });
    expect(parseRecoveryRecord(JSON.stringify(stored(null)))).toEqual({ ok: true, value: stored(null) });
  });

  it('round-trips exact Unicode and newline contents', () => {
    const value = stored(checkpoint([{ name: 'hello.srp', content: '\ufeffprint("भारत 🌟");\r\n\n\t' }]));
    const encoded = encodeRecoveryRecord(value);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(parseRecoveryRecord(encoded.value)).toEqual({ ok: true, value });
  });

  it('rejects corrupt data instead of interpreting it as disabled', () => {
    for (const raw of ['', '{', '[]', 'null', 'true', '{"enabled":true}']) {
      expect(parseRecoveryRecord(raw)).toMatchObject({ ok: false });
    }
  });

  it('rejects unknown schemas, disabled records and extra fields', () => {
    for (const value of [
      { ...stored(), version: 2 },
      { ...stored(), enabled: false },
      { ...stored(), path: '/tmp/source.srp' },
      { ...stored(), checkpoint: { ...checkpoint(), version: 2 } },
      { ...stored(), checkpoint: { ...checkpoint(), extra: true } },
      { ...stored(), checkpoint: { ...checkpoint(), createdAt: 'yesterday' } },
      { ...stored(), checkpoint: { ...checkpoint(), createdAt: -1 } },
    ]) expect(parseRecoveryRecord(JSON.stringify(value))).toMatchObject({ ok: false });
  });

  it('rejects unsafe draft metadata and source shapes', () => {
    for (const drafts of [
      [],
      [{ name: '../outside.srp', content: 'x' }],
      [{ name: 'C:/outside.srp', content: 'x' }],
      [{ name: 'nested\\main.srp', content: 'x' }],
      [{ name: 'main.srp', content: 4 }],
      [{ name: 'main.srp', content: 'x', path: 'C:/outside.srp' }],
      [{ name: 'main.txt', content: 'x' }],
      [{ name: 'main.srp', content: '\ud800' }],
      [{ name: 'invalid\ud800.srp', content: 'x' }],
      [{ name: 'main.srp', content: 'x'.repeat(MAX_RECOVERY_SOURCE_UNITS + 1) }],
    ]) expect(validateRecoveryDrafts(drafts)).toMatchObject({ ok: false });
  });

  it('rejects a huge raw record before parsing', () => {
    expect(parseRecoveryRecord(' '.repeat(MAX_RECOVERY_JSON_UNITS + 1))).toMatchObject({ ok: false });
  });

  it('rejects JSON escape expansion beyond the encoded storage budget', () => {
    const value = stored(checkpoint([{ name: 'large.srp', content: '\u0000'.repeat(MAX_RECOVERY_SOURCE_UNITS) }]));
    expect(encodeRecoveryRecord(value)).toMatchObject({ ok: false });
  });

  it('compares content and ordered names, ignoring timestamps only', () => {
    const a = checkpoint();
    expect(sameRecoveryDrafts(a, { ...a, createdAt: a.createdAt + 1 })).toBe(true);
    expect(sameRecoveryDrafts(a, checkpoint([{ name: 'other.srp', content: a.drafts[0].content }]))).toBe(false);
    expect(sameRecoveryDrafts(a, checkpoint([{ ...a.drafts[0], content: 'different' }]))).toBe(false);
    expect(sameRecoveryDrafts(a, null)).toBe(false);
    expect(sameRecoveryDrafts(null, null)).toBe(true);
  });
});

describe('recover into new untitled editor documents', () => {
  it('appends all recovered copies without mutating existing documents or reusing paths', () => {
    const opened = editorReducer(initialEditorState, {
      type: 'open', path: 'C:/project/main.srp', content: 'saved',
    });
    const existing = editorReducer(opened, { type: 'edit', id: opened.activeId!, content: 'current edit' });
    const next = editorReducer(existing, {
      type: 'restore-drafts',
      drafts: [{ name: 'main.srp', content: 'old draft' }, { name: 'main.srp', content: '' }],
    });
    expect(next.documents.slice(0, existing.documents.length)).toEqual(existing.documents);
    const restored = next.documents.slice(existing.documents.length);
    expect(restored.map(doc => doc.name)).toEqual(['Recovered-2-main.srp', 'Recovered-3-main.srp']);
    expect(restored.map(doc => doc.content)).toEqual(['old draft', '']);
    expect(restored.every(doc => doc.path === null && isDirty(doc) && !canAutoSave(doc))).toBe(true);
    expect(new Set(next.documents.map(doc => doc.id)).size).toBe(next.documents.length);
    expect(next.activeId).toBe(restored[0].id);
    expect(next.nextUntitled).toBe(4);
    expect(next.sessionRevision).toBe(existing.sessionRevision + 1);
    expect(editorReducer(next, { type: 'new' }).activeId).toBe('untitled-4');
  });

  it('keeps a blank recovered copy dirty until the exact source is saved', () => {
    const state = editorReducer(initialEditorState, { type: 'restore-drafts', drafts: [{ name: 'main.srp', content: '' }] });
    const doc = state.documents.at(-1)!;
    expect(isDirty(doc)).toBe(true);
    expect(isUnchangedSnapshot(doc, { ...doc, recoveredDraft: undefined })).toBe(false);
    const saved = editorReducer(state, { type: 'saved', id: doc.id, path: 'C:/project/recovered.srp', savedContent: '' });
    const savedDoc = saved.documents.at(-1)!;
    expect(isDirty(savedDoc)).toBe(false);
    expect(savedDoc.recoveredDraft).toBeUndefined();
    expect(savedDoc.path).toBe('C:/project/recovered.srp');
    expect(capture(saved.documents)).toBeNull();
  });

  it('keeps newer edits dirty if a save completes for an older recovery snapshot', () => {
    const state = editorReducer(initialEditorState, { type: 'restore-drafts', drafts: [{ name: 'main.srp', content: 'old' }] });
    const doc = state.documents.at(-1)!;
    const edited = editorReducer(state, { type: 'edit', id: doc.id, content: 'newer' });
    const saved = editorReducer(edited, { type: 'saved', id: doc.id, path: 'C:/project/recovered.srp', savedContent: 'old' });
    expect(saved.documents.at(-1)?.content).toBe('newer');
    expect(isDirty(saved.documents.at(-1)!)).toBe(true);
  });

  it('does not accumulate a new recovery-name prefix after each restart', () => {
    const state = editorReducer(initialEditorState, { type: 'restore-drafts', drafts: [{ name: 'main.srp', content: 'old' }] });
    expect(capture(state.documents)?.drafts).toEqual([{ name: 'main.srp', content: 'old' }]);
  });

  it('rejects invalid and oversized restore batches atomically', () => {
    for (const drafts of [[], [{ name: '../bad.srp', content: 'x' }],
      [{ name: 'huge.srp', content: 'x'.repeat(MAX_RECOVERY_SOURCE_UNITS + 1) }]]) {
      expect(editorReducer(initialEditorState, { type: 'restore-drafts', drafts })).toBe(initialEditorState);
    }
  });
});
