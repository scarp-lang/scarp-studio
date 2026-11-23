import { describe, expect, it } from 'vitest';
import { createUntitled, updateContent } from './documents';
import { inspectDiskSnapshot, isCurrentDiskReview } from './diskReview';
import { assertWellFormedUtf16 } from './utf8Text';

function loaded(text: string) {
  return {
    ...createUntitled(1),
    id: 'disk-source',
    name: 'main.srp',
    path: 'C:/Scarp/main.srp',
    content: text,
    savedContent: text,
    revision: 7,
  };
}

describe('explicit, read-only external source comparison', () => {
  it('recognizes unchanged saved files with or without unsaved edits', () => {
    const original = loaded('print("disk");');
    expect(inspectDiskSnapshot(original, original.content)).toMatchObject({
      status: 'unchanged', editorDirty: false,
      externalLine: null, editorLine: null,
      savedExcerpt: null, diskExcerpt: null, editorExcerpt: null,
    });
    const dirty = { ...original, content: 'print("buffer");', revision: 8 };
    const review = inspectDiskSnapshot(dirty, original.savedContent);
    expect(review).toMatchObject({
      status: 'unchanged', editorDirty: true,
      externalLine: null, editorLine: 1,
    });
    expect(review.diskExcerpt).toContain('disk');
    expect(review.editorExcerpt).toContain('buffer');
    expect(original.content).toBe('print("disk");');
  });

  it('distinguishes external-only modifications from conflicting local edits', () => {
    const original = loaded('first\r\nsecond\rthird\nlast');
    const disk = 'first\r\nsecond\rTHIRD\nlast';
    const external = inspectDiskSnapshot(original, disk);
    expect(external.status).toBe('external-change');
    expect(external.externalLine).toBe(3);
    expect(external.editorLine).toBe(3);
    expect(external.savedExcerpt).toContain('third');
    expect(external.diskExcerpt).toContain('THIRD');

    const edited = { ...original, content: original.content.replace('last', 'edited') };
    expect(inspectDiskSnapshot(edited, disk).status).toBe('conflict');
    expect(edited.content.endsWith('edited')).toBe(true);
  });

  it('does not call bytes that match the editor an externally conflicting edit', () => {
    const original = loaded('print(1);');
    const locallyEdited = { ...original, content: 'print(2);', revision: 8 };
    const result = inspectDiskSnapshot(locallyEdited, 'print(2);');
    expect(result.status).toBe('disk-matches-editor');
    expect(result.externalLine).toBe(1);
    expect(result.editorLine).toBeNull();
    expect(result.editorExcerpt).toBeNull();
    // Matching the editor is not proof that the original saved baseline did not change.
    expect(result.diskBytes).toBe(9);
  });

  it('preserves complete Unicode scalars and bounds excerpts for huge sources', () => {
    const original = loaded('😀'.repeat(80) + 'हिन्दी' + 'x'.repeat(100_000));
    const disk = original.content.replace('हिन्दी', 'नया');
    const review = inspectDiskSnapshot(original, disk);
    expect(review.status).toBe('external-change');
    expect(review.externalLine).toBe(1);
    expect(review.savedExcerpt!.length).toBeLessThan(160);
    expect(review.diskExcerpt!.length).toBeLessThan(160);
    expect(review.editorExcerpt!.length).toBeLessThan(160);
    expect(() => assertWellFormedUtf16(review.savedExcerpt!, 'saved')).not.toThrow();
    expect(() => assertWellFormedUtf16(review.diskExcerpt!, 'disk')).not.toThrow();
    expect(review.diskBytes).toBe(new TextEncoder().encode(disk).length);
  });

  it('handles empty files, insertion at EOF and mixed CRLF/CR/LF', () => {
    const empty = inspectDiskSnapshot(loaded(''), 'new');
    expect(empty.externalLine).toBe(1);
    expect(empty.savedExcerpt).toBe('(empty file)');
    expect(empty.diskExcerpt).toBe('new');

    const appended = inspectDiskSnapshot(loaded('line\r\n'), 'line\r\nnew');
    expect(appended.externalLine).toBe(2);
    expect(appended.savedExcerpt).toContain('end of file');
    expect(appended.diskExcerpt).toContain('new');
  });

  it('rejects stale tab identity, rename, edit and ABA restored text', () => {
    const first = loaded('print("old");');
    expect(isCurrentDiskReview(first, { ...first })).toBe(true);
    expect(isCurrentDiskReview(first, null)).toBe(false);
    expect(isCurrentDiskReview(first, { ...first, id: 'other' })).toBe(false);
    expect(isCurrentDiskReview(first, { ...first, path: 'C:/Scarp/renamed.srp' })).toBe(false);
    const edited = updateContent([first], first.id, 'print("new");')[0];
    const restored = updateContent([edited], first.id, first.content)[0];
    expect(restored.content).toBe(first.content);
    expect(restored.revision).toBe(first.revision + 2);
    expect(isCurrentDiskReview(first, restored)).toBe(false);
  });
});
