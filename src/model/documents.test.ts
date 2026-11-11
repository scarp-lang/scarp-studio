import { describe, expect, it } from 'vitest';
import { createUntitled, isDirty, isScarpPath, markSaved, openedDocument, updateContent } from './documents';

describe('Scarp-only file state', () => {
  it('accepts .srp paths case-insensitively and rejects other files', () => {
    expect(isScarpPath('C:\\projects\\main.srp')).toBe(true);
    expect(isScarpPath('/tmp/MAIN.SRP')).toBe(true);
    expect(isScarpPath('/tmp/main.rs')).toBe(false);
    expect(isScarpPath('/tmp/main.srp.txt')).toBe(false);
  });

  it('tracks changes until the exact saved snapshot is written', () => {
    const original = createUntitled(1);
    expect(isDirty(original)).toBe(false);
    const edited = updateContent([original], original.id, 'bind answer = 42')[0];
    expect(isDirty(edited)).toBe(true);
    const saved = markSaved([edited], edited.id, '/tmp/main.srp', edited.content)[0];
    expect(saved.path).toBe('/tmp/main.srp');
    expect(saved.name).toBe('main.srp');
    expect(isDirty(saved)).toBe(false);
  });

  it('keeps newer edits marked dirty after an older snapshot completes saving', () => {
    const base = createUntitled(2);
    const saved = markSaved([{ ...base, content: 'new version' }], base.id, '/tmp/test.srp', 'old version')[0];
    expect(isDirty(saved)).toBe(true);
  });

  it('focuses the already-open path without erasing unsaved work', () => {
    const opened = openedDocument([], '/tmp/main.srp', 'old');
    const edited = updateContent(opened.documents, opened.id, 'unsaved');
    const openedAgain = openedDocument(edited, '/tmp/main.srp', 'on disk');
    expect(openedAgain.documents).toEqual(edited);
    expect(openedAgain.id).toBe(opened.id);
  });
});
