import { describe, expect, it } from 'vitest';
import { getScarpStarterTemplate, scarpStarterTemplates } from './starterTemplates';

describe('Scarp-only starter templates', () => {
  it('offers independent real Scarp learning scenarios', () => {
    expect(scarpStarterTemplates.map(({ id }) => id)).toEqual([
      'hello', 'bindings', 'functions', 'decisions', 'loops', 'input',
    ]);
    expect(new Set(scarpStarterTemplates.map(({ id }) => id)).size).toBe(6);
  });

  it('uses only .srp snippets that can be edited in an untitled buffer', () => {
    for (const starter of scarpStarterTemplates) {
      expect(starter.id).toMatch(/^[a-z]+$/);
      expect(starter.title.length).toBeGreaterThan(2);
      expect(starter.source.endsWith('\n')).toBe(true);
      expect(starter.source.length).toBeLessThan(4096);
      expect(starter.source).not.toContain('fn main(');
      expect(starter.source).not.toMatch(/\b(?:class|let|mut|def|async|await)\b/);
    }
  });

  it('includes an explicit saved-source compiler input example', () => {
    expect(getScarpStarterTemplate('input')?.source).toContain('read_line()');
    expect(getScarpStarterTemplate('input')?.source).toContain('Program Input');
  });

  it('looks up only registered templates without accepting arbitrary source', () => {
    expect(getScarpStarterTemplate('functions')?.source).toContain('pure funcra add');
    expect(getScarpStarterTemplate('../../outside')).toBeNull();
    expect(getScarpStarterTemplate('')).toBeNull();
  });
});
