import { describe, expect, it } from 'vitest';
import {
  compareScarpSnapshots, splitSnapshotLines, identicalSnapshotLines,
  MAX_DIFF_SOURCE_UNITS, MAX_DIFF_SOURCE_LINES, MAX_DIFF_DYNAMIC_CELLS,
  MAX_DIFF_HUNKS, MAX_DIFF_LINE_PREVIEW_UNITS,
} from './sourceDiff';

describe('Scarp Working Changes snapshot-only line diff', () => {
  it('returns clean results for identical empty and nonempty sources', () => {
    const empty = compareScarpSnapshots('', '');
    expect(empty).toMatchObject({
      status: 'clean', addedLines: 0, removedLines: 0,
      beforeLines: 1, afterLines: 1, hunkCount: 0, sourceIdentical: true,
    });
    const text = 'funcra main() {}\n';
    expect(compareScarpSnapshots(text, text).status).toBe('clean');
  });

  it('splits CRLF, lone CR, lone LF and final empty line without losing bytes', () => {
    const source = 'a\r\nb\rc\nd\n';
    const lines = splitSnapshotLines(source);
    expect(lines.map(line => [line.text, line.ending]))
      .toEqual([
        ['a', '\r\n'], ['b', '\r'], ['c', '\n'], ['d', '\n'], ['', ''],
      ]);
    expect(lines.map(line => line.index)).toEqual([1, 2, 3, 4, 5]);
    expect(lines.map(line => line.end)).toEqual([3, 5, 7, 9, 9]);
  });

  it('counts an inserted line with surrounding context and navigates to it', () => {
    const before = 'a\nb\nc\nd';
    const after = 'a\nb\nadded\nc\nd';
    const result = compareScarpSnapshots(before, after);
    expect(result.status).toBe('ready');
    expect(result.addedLines).toBe(1);
    expect(result.removedLines).toBe(0);
    expect(result.hunkCount).toBe(1);
    expect(result.hunks[0].navigateLine).toBe(3);
    expect(result.hunks[0].lines.some(line =>
      line.kind === 'added' && line.preview === 'added')).toBe(true);
  });

  it('counts removal and provides a current-source navigation line', () => {
    const result = compareScarpSnapshots('first\nremove\nlast', 'first\nlast');
    expect(result.status).toBe('ready');
    expect(result.removedLines).toBe(1);
    expect(result.addedLines).toBe(0);
    expect(result.hunks[0].navigateLine).toBeGreaterThanOrEqual(1);
    expect(result.hunks[0].navigateLine).toBeLessThanOrEqual(result.afterLines);
  });

  it('represents replacements as deletions and insertions, never silent mutation', () => {
    const saved = 'first\nold\nlast';
    const current = 'first\nnew\nlast';
    const result = compareScarpSnapshots(saved, current);
    expect(result.addedLines).toBe(1);
    expect(result.removedLines).toBe(1);
    expect(result.hunks[0].lines.filter(line => line.kind !== 'context')
      .map(line => [line.kind, line.preview]))
      .toEqual([['removed', 'old'], ['added', 'new']]);
    expect(saved).toBe('first\nold\nlast');
    expect(current).toBe('first\nnew\nlast');
  });

  it('shows newline spelling changes as meaningful changes', () => {
    const diff = compareScarpSnapshots('one\r\ntwo', 'one\ntwo');
    expect(diff.status).toBe('ready');
    expect(diff.addedLines).toBe(1);
    expect(diff.removedLines).toBe(1);
  });

  it('preserves precise line coordinates when Unicode appears', () => {
    const result = compareScarpSnapshots('नमस्ते\n🙂', 'नमस्ते\n🚀');
    expect(result.status).toBe('ready');
    expect(result.hunks[0].navigateLine).toBe(2);
    expect(result.hunks[0].lines.some(line => line.preview === '🚀')).toBe(true);
  });

  it('does not pay quadratic cost for distant changes separated by shared lines', () => {
    const middle = Array.from({ length: 400 }, (_, i) => 'shared ' + i);
    const saved = ['old start', ...middle, 'old end'].join('\n');
    const current = ['new start', ...middle, 'new end'].join('\n');
    const result = compareScarpSnapshots(saved, current);
    expect(result.status).toBe('ready');
    expect(result.hunkCount).toBe(2);
    expect(result.addedLines).toBe(2);
    expect(result.removedLines).toBe(2);
    expect(result.hunks).toHaveLength(2);
  });

  it('uses bounded matrix cost instead of freezing on completely different files', () => {
    const a = Array.from({ length: Math.sqrt(MAX_DIFF_DYNAMIC_CELLS) + 2 },
      (_, i) => 'old ' + i).join('\n');
    const b = Array.from({ length: Math.sqrt(MAX_DIFF_DYNAMIC_CELLS) + 2 },
      (_, i) => 'new ' + i).join('\n');
    const result = compareScarpSnapshots(a, b);
    expect(result.status).toBe('limited');
    expect(result.addedLines).toBeNull();
    expect(result.removedLines).toBeNull();
    expect(result.message).toContain('complexity');
  });

  it('marks oversize buffer as limited without emitting any source previews', () => {
    const report = compareScarpSnapshots('', 'z'.repeat(MAX_DIFF_SOURCE_UNITS + 1));
    expect(report.status).toBe('limited');
    expect(report.hunks).toEqual([]);
    expect(report.truncated).toBe(true);
  });

  it('marks over-budget line count rather than using unbounded memory', () => {
    const source = 'a\n'.repeat(MAX_DIFF_SOURCE_LINES + 1);
    const report = compareScarpSnapshots('', source);
    expect(report.status).toBe('limited');
    expect(report.afterLines).toBeGreaterThan(MAX_DIFF_SOURCE_LINES);
    expect(report.hunks).toEqual([]);
  });

  it('caps long previews while keeping original counts and navigation', () => {
    const source = 'x'.repeat(MAX_DIFF_LINE_PREVIEW_UNITS + 30);
    const report = compareScarpSnapshots('', source);
    expect(report.status).toBe('ready');
    const added = report.hunks.flatMap(h => h.lines).find(l => l.kind === 'added');
    expect(added?.preview.length).toBe(MAX_DIFF_LINE_PREVIEW_UNITS);
    expect(added?.previewTruncated).toBe(true);
  });

  it('caps displayed hunks while retaining complete change totals', () => {
    const saved: string[] = [], current: string[] = [];
    for (let i = 0; i < MAX_DIFF_HUNKS + 5; i++) {
      saved.push('old ' + i, ...Array.from({ length: 10 }, (_, j) => 'shared '+i+'/'+j));
      current.push('new ' + i, ...Array.from({ length: 10 }, (_, j) => 'shared '+i+'/'+j));
    }
    const report = compareScarpSnapshots(saved.join('\n'), current.join('\n'));
    expect(report.status).toBe('ready');
    expect(report.hunkCount).toBe(MAX_DIFF_HUNKS + 5);
    expect(report.hunks.length).toBeLessThanOrEqual(MAX_DIFF_HUNKS);
    expect(report.truncated).toBe(true);
    expect(report.message).toContain('bounded');
  });

  it('compares line ending bytes independently of source content', () => {
    const first = splitSnapshotLines('hello\r\nworld');
    const second = splitSnapshotLines('hello\nworld');
    expect(identicalSnapshotLines(first[0], second[0])).toBe(false);
    expect(identicalSnapshotLines(first[1], second[1])).toBe(true);
  });

  it('builds deterministic results for the same immutable snapshots', () => {
    const original = 'a\nb\nc';
    const updated = 'a\nnew\nc';
    const first = compareScarpSnapshots(original, updated);
    const second = compareScarpSnapshots(original, updated);
    expect(first).toEqual(second);
    expect(first.hunks).not.toBe(second.hunks);
  });
});
