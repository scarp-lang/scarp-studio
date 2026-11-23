import { describe, expect, it } from 'vitest';
import { fileName, type StudioDocument } from './documents';
import { parseScarpDiagnostic } from './diagnostics';
import { verifiedProblemMarker } from './problemMarkers';
import { captureVerifiedSource } from './verifiedSource';

const diagnostic = (
  path: string, column: number, line = 1,
  end?: { line: number; column: number },
) => parseScarpDiagnostic(JSON.stringify({
  schema_version: 1, severity: 'error', code: 'E0010',
  message: 'Unknown Scarp binding', span_encoding: 'utf-8-bytes',
  column_encoding: 'unicode-scalar', position_base: 1,
  primary: { path, start: { line, column }, ...(end ? { end } : {}) },
  help: null,
}));

function document(path: string, content: string): StudioDocument {
  return {
    id: 'file:' + path,
    name: fileName(path),
    path,
    content,
    savedContent: content,
    revision: 2,
  };
}

describe('Scarp Verify Monaco error markers', () => {
  it('marks exactly one UTF-16 scalar after an emoji', () => {
    const source = 'A😀B';
    const current = document('C:/project/main.srp', source);
    const verified = captureVerifiedSource(current);
    expect(verifiedProblemMarker(diagnostic('main.srp', 3), verified, {
      ...current, path: 'c:/PROJECT/main.srp',
    })).toEqual({
      startLineNumber: 1, startColumn: 4,
      endLineNumber: 1, endColumn: 5,
      message: 'Unknown Scarp binding', code: 'E0010',
    });
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), verified, current)?.endColumn).toBe(4);
  });

  it('underlines the correct scalar on CR-only and mixed-ending source lines', () => {
    const content = 'first\rA\r\n😀B\nend';
    const current = document('C:/project/main.srp', content);
    const verified = captureVerifiedSource(current);
    expect(verifiedProblemMarker(
      diagnostic('C:/project/main.srp', 1, 2), verified, current,
    )).toMatchObject({
      startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 2,
    });
    expect(verifiedProblemMarker(
      diagnostic('C:/project/main.srp', 1, 3), verified, current,
    )).toMatchObject({
      startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 3,
    });
    expect(verifiedProblemMarker(
      diagnostic('C:/project/main.srp', 2, 3), verified, current,
    )).toMatchObject({
      startLineNumber: 3, startColumn: 3, endLineNumber: 3, endColumn: 4,
    });
  });

  it('underlines complete, verified same-line spans with Unicode-scalar endpoints', () => {
    const current = document('C:/project/main.srp', 'A😀unknown + 1');
    const verified = captureVerifiedSource(current);
    const marker = verifiedProblemMarker(
      diagnostic('main.srp', 3, 1, { line: 1, column: 10 }),
      verified, current,
    );
    expect(marker).toMatchObject({
      startLineNumber: 1, startColumn: 4,
      endLineNumber: 1, endColumn: 11,
    });
    // A valid span after an emoji must never split its UTF-16 surrogate pair.
    expect(verifiedProblemMarker(
      diagnostic('main.srp', 2, 1, { line: 1, column: 3 }),
      verified, current,
    )).toMatchObject({ startColumn: 2, endColumn: 4 });
  });

  it('falls back to a single scalar for invalid or oversized compiler spans', () => {
    const current = document('C:/project/main.srp', 'A😀B');
    const verified = captureVerifiedSource(current);
    for (const end of [
      { line: 1, column: 500 }, // Beyond EOL
      { line: 2, column: 2 }, // Multiline span
      { line: 1, column: 2 }, // Zero-width end
    ]) {
      expect(verifiedProblemMarker(
        diagnostic('main.srp', 2, 1, end), verified, current,
      )).toMatchObject({ startColumn: 2, endColumn: 4 });
    }
    const long = document('C:/project/long.srp', 'x'.repeat(300));
    expect(verifiedProblemMarker(
      diagnostic('long.srp', 1, 1, { line: 1, column: 250 }),
      captureVerifiedSource(long), long,
    )).toMatchObject({ startColumn: 1, endColumn: 2 });
  });

  it('keeps EOF insertion diagnostics in source bounds', () => {
    const current = document('C:/project/main.srp', 'ABC');
    expect(verifiedProblemMarker(diagnostic('main.srp', 4),
      captureVerifiedSource(current), current)).toMatchObject({
        startColumn: 4, endColumn: 4,
      });
  });

  it('rejects stale, foreign or malformed diagnostic positions', () => {
    const current = document('C:/project/main.srp', 'ABC');
    const verified = captureVerifiedSource(current);
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), verified,
      { ...current, content: 'EDITED' })).toBeNull();
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), verified,
      { ...current, path: 'C:/project/other.srp' })).toBeNull();
    expect(verifiedProblemMarker(diagnostic('main.srp', 10), verified, current)).toBeNull();
    expect(verifiedProblemMarker(null, verified, current)).toBeNull();
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), null, current)).toBeNull();
  });

  it('never revives an error marker after an A-B-A edit, save, or reopened same file', () => {
    const current = document('C:/project/main.srp', 'abc');
    const verified = captureVerifiedSource(current);
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), verified, current)).not.toBeNull();
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), verified, {
      ...current, revision: current.revision + 2,
    })).toBeNull();
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), verified, {
      ...current, savedContent: 'newer disk state',
    })).toBeNull();
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), verified, {
      ...current, id: 'reopened-alias',
    })).toBeNull();
  });

  it('does not mark ambiguous compiler basenames when imports are present', () => {
    const current = document('C:/project/main.srp',
      'import "module.srp" as module;\nprint(unknown_name);');
    const verified = captureVerifiedSource(current);
    expect(verifiedProblemMarker(diagnostic('main.srp', 7, 2), verified, current)).toBeNull();
    expect(verifiedProblemMarker(diagnostic('C:/project/main.srp', 7, 2),
      verified, current)?.startLineNumber).toBe(2);
  });

  it('does not fabricate a diagnostic error code', () => {
    const raw = diagnostic('main.srp', 1);
    const current = document('/tmp/main.srp', 'A');
    const result = verifiedProblemMarker({ ...raw!, code: null },
      captureVerifiedSource(current), current);
    expect(result).toMatchObject({ message: 'Unknown Scarp binding' });
    expect(result).not.toHaveProperty('code');
  });
});
