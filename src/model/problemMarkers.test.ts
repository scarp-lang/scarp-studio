import { describe, expect, it } from 'vitest';
import { parseScarpDiagnostic } from './diagnostics';
import { verifiedProblemMarker } from './problemMarkers';

const diagnostic = (path: string, column: number, line = 1) => parseScarpDiagnostic(JSON.stringify({
  schema_version: 1, severity: 'error', code: 'E0010',
  message: 'Unknown Scarp binding', span_encoding: 'utf-8-bytes',
  column_encoding: 'unicode-scalar', position_base: 1,
  primary: { path, start: { line, column } },
  help: null,
}));

describe('Scarp Verify Monaco error markers', () => {
  it('marks exactly one UTF-16 scalar after an emoji', () => {
    const source = 'A😀B';
    expect(verifiedProblemMarker(diagnostic('main.srp', 3),
      { path: 'C:/project/main.srp', content: source },
      { path: 'c:/PROJECT/main.srp', content: source })).toEqual({
        startLineNumber: 1, startColumn: 4,
        endLineNumber: 1, endColumn: 5,
        message: 'Unknown Scarp binding', code: 'E0010',
      });
    expect(verifiedProblemMarker(diagnostic('main.srp', 2),
      { path: 'C:/project/main.srp', content: source },
      { path: 'C:/project/main.srp', content: source })?.endColumn).toBe(4);
  });

  it('keeps EOF insertion diagnostics in source bounds', () => {
    const text = 'ABC';
    expect(verifiedProblemMarker(diagnostic('main.srp', 4),
      { path: 'C:/project/main.srp', content: text },
      { path: 'C:/project/main.srp', content: text })).toMatchObject({
        startColumn: 4, endColumn: 4,
      });
  });

  it('rejects stale buffers, a different tab and unrecognized positions', () => {
    const current = { path: 'C:/project/main.srp', content: 'ABC' };
    const saved = { path: 'C:/project/main.srp', content: 'ABC' };
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), saved,
      { ...current, content: 'EDITED' })).toBeNull();
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), saved,
      { ...current, path: 'C:/project/other.srp' })).toBeNull();
    expect(verifiedProblemMarker(diagnostic('main.srp', 10), saved, current)).toBeNull();
    expect(verifiedProblemMarker(null, saved, current)).toBeNull();
    expect(verifiedProblemMarker(diagnostic('main.srp', 2), null, current)).toBeNull();
  });

  it('does not mark ambiguous compiler basenames when imports are present', () => {
    const content = 'import "module.srp" as module;\nprint(unknown_name);';
    const verified = { path: 'C:/project/main.srp', content };
    expect(verifiedProblemMarker(diagnostic('main.srp', 7, 2), verified, verified)).toBeNull();
    expect(verifiedProblemMarker(diagnostic('C:/project/main.srp', 7, 2),
      verified, verified)?.startLineNumber).toBe(2);
  });

  it('does not fabricate a diagnostic error code', () => {
    const raw = diagnostic('main.srp', 1);
    const verified = { path: '/tmp/main.srp', content: 'A' };
    const result = verifiedProblemMarker({ ...raw!, code: null }, verified, verified);
    expect(result).toMatchObject({ message: 'Unknown Scarp binding' });
    expect(result).not.toHaveProperty('code');
  });
});
