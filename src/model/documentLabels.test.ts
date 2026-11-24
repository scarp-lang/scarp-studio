import { describe, expect, it } from 'vitest';
import { disambiguateDocumentNames } from './documentLabels';

describe('multi-project workspace editor tab names', () => {
  it('identifies same-named sources by their shortest unique parent folder', () => {
    const labels = disambiguateDocumentNames([
      { id: 'tuple', name: 'main.srp', path: 'C:/Scarp-Practice/basic_tuple/main.srp' },
      { id: 'loop', name: 'main.srp', path: 'C:/Scarp-Practice/loops/main.srp' },
      { id: 'other', name: 'helper.srp', path: 'C:/Scarp-Practice/loops/helper.srp' },
    ]);
    expect(labels.get('tuple')).toBe('basic_tuple/main.srp');
    expect(labels.get('loop')).toBe('loops/main.srp');
    expect(labels.get('other')).toBe('helper.srp');
  });

  it('adds deeper folder context when different projects each have src/main.srp', () => {
    const labels = disambiguateDocumentNames([
      { id: 'tuple', name: 'main.srp', path: 'C:/Scarp-Practice/basic_tuple/src/main.srp' },
      { id: 'loop', name: 'main.srp', path: 'C:/Scarp-Practice/loops/src/main.srp' },
    ]);
    expect(labels.get('tuple')).toBe('basic_tuple/src/main.srp');
    expect(labels.get('loop')).toBe('loops/src/main.srp');
  });

  it('handles Windows separators and unresolved duplicate names', () => {
    const labels = disambiguateDocumentNames([
      { id: 'tuple', name: 'main.srp', path: 'C:\\Workspace\\tuples\\main.srp' },
      { id: 'loop', name: 'main.srp', path: 'C:/Workspace/loops/main.srp' },
    ]);
    expect(labels.get('tuple')).toBe('tuples/main.srp');
    expect(labels.get('loop')).toBe('loops/main.srp');
    const unnamed = disambiguateDocumentNames([
      { id: 'a', name: 'Untitled.srp', path: null },
      { id: 'b', name: 'Untitled.srp', path: null },
    ]);
    expect(unnamed.get('a')).toBe('Untitled.srp (1)');
    expect(unnamed.get('b')).toBe('Untitled.srp (2)');
  });
});
