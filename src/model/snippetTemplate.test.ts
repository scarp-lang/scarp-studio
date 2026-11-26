import { describe, expect, it } from 'vitest';
import { compileSnippet, MAX_SNIPPET_BODY_UNITS, MAX_SNIPPET_BODY_LINES, MAX_SNIPPET_STOP_OCCURRENCES } from './snippetTemplate';

function compiled(body: string) {
  const result = compileSnippet(body);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
describe('bounded user snippet grammar', () => {
  it('preserves literal Scarp text without triggering Monaco substitution', () => {
    const text = 'print("$TM_FILENAME");\n// literal $0 and $' + '{CLIPBOARD}';
    expect(compiled(text)).toEqual({ insertText: text, preview: text, stops: [], asSnippet: false });
  });
  it('compiles defined, repeated and final stops with correct UTF-16 offsets', () => {
    const result = compiled('bind {{1:name}} = {{2:42}};\nprint({{1}});{{0}}');
    expect(result.preview).toBe('bind name = 42;\nprint(name);');
    expect(result.insertText).toBe('bind $' + '{1:name} = $' + '{2:42};\nprint($1);$0');
    expect(result.stops).toEqual([
      { index: 1, value: 'name', offset: 5 }, { index: 2, value: '42', offset: 12 },
      { index: 1, value: 'name', offset: 22 }, { index: 0, value: '', offset: 28 },
    ]);
    expect(result.asSnippet).toBe(true);
    expect(Object.isFrozen(result.stops[0])).toBe(true);
  });
  it('normalizes CRLF, supports empty defaults and resolves forward references', () => {
    expect(compiled('{{1}}\r\n{{1:alpha}} {{2:}}{{0}}').preview).toBe('alpha\nalpha ');
    expect(compiled('{{1:}}').insertText).toBe('$' + '{1:}');
    expect(compiled('{{0}}print(1);').preview).toBe('print(1);');
  });
  it('escapes Monaco syntax and backslashes only when snippet parsing is active', () => {
    const result = compiled('print("$TM_FILENAME"); {{1:$0}} \\\\ {{0}}');
    expect(result.preview).toBe('print("$TM_FILENAME"); $0 \\\\ ');
    expect(result.insertText).toContain('\\$TM_FILENAME');
    expect(result.insertText).toContain('$' + '{1:\\$0}');
    expect(result.insertText).toContain('\\\\\\\\');
    expect(compiled('\\{{1:literal}}').preview).toBe('{{1:literal}}');
  });
  it.each(['', ' ', '{{1}}', '{{1:one}}{{1:two}}', '{{2:two}}', '{{0:bad}}',
    '{{0}}{{0}}', '{{17:bad}}', '{{01:bad}}', '{{1:bad', '{{1:{nested}}}', '{{1:multi\nline}}',
    'print("a\u0000b");', '\u202eprint(1);', '\ud800'])('rejects invalid body %j', body => {
    expect(compileSnippet(body).ok).toBe(false);
  });
  it('bounds size, lines and repeated occurrences', () => {
    expect(compileSnippet('x'.repeat(MAX_SNIPPET_BODY_UNITS)).ok).toBe(true);
    expect(compileSnippet('x'.repeat(MAX_SNIPPET_BODY_UNITS + 1)).ok).toBe(false);
    expect(compileSnippet(Array(MAX_SNIPPET_BODY_LINES).fill('x').join('\n')).ok).toBe(true);
    expect(compileSnippet(Array(MAX_SNIPPET_BODY_LINES + 1).fill('x').join('\n')).ok).toBe(false);
    expect(compileSnippet('{{1:x}}' + '{{1}}'.repeat(MAX_SNIPPET_STOP_OCCURRENCES)).ok).toBe(false);
  });
  it('keeps non-numbered double braces literal', () => {
    expect(compiled('print("{{text}}");').preview).toBe('print("{{text}}");');
    expect(compiled('print("🙂"); {{1:ok}}').stops[0].offset).toBe('print("🙂"); '.length);
  });
});
