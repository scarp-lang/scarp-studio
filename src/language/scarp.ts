import type * as Monaco from 'monaco-editor';

/** Conservative, editor-only highlighting aligned to published Scarp v0.0.6-alpha.8.
 * Highlighting is not parsing or a guarantee of compatibility with any installed compiler.
 */
export function registerScarpLanguage(monaco: typeof Monaco): void {
  if (monaco.languages.getLanguages().some((language) => language.id === 'scarp')) return;
  monaco.languages.register({ id: 'scarp', extensions: ['.srp'], aliases: ['Scarp'] });
  monaco.languages.setLanguageConfiguration('scarp', {
    comments: { lineComment: '//' },
    brackets: [['{', '}'], ['(', ')'], ['[', ']']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
    ],
  });
  monaco.languages.setMonarchTokensProvider('scarp', {
    keywords: [
      'funcra', 'bind', 'var', 'pub', 'pure', 'import', 'if', 'elif', 'else',
      'while', 'repeat', 'as', 'return', 'break', 'continue', 'and', 'or', 'not',
      'needs', 'ensures', 'assert',
      'print', 'println', 'write', 'eprint', 'ewrite',
    ],
    typeKeywords: ['integer', 'float', 'boolean', 'string', 'unit', 'vector', 'integers', 'tile', 'tuple'],
    // Old declaration spellings are reserved but rejected by the current compiler.
    legacyKeywords: ['let', 'mut'],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        [/\b(?:true|false)\b/, 'constant'],
        // Hex/binary prefixes and numeric separators are not valid Scarp literals.
        [/\b(?:0[xX][A-Za-z0-9_]*|0[bB][A-Za-z0-9_]*|[0-9]+_[A-Za-z0-9_]*)\b/, 'number.invalid'],
        [/\b[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\b/, 'number'],
        [/[a-zA-Z_][\w]*/, {
          cases: { '@keywords': 'keyword', '@typeKeywords': 'type', '@legacyKeywords': 'invalid', '@default': 'identifier' },
        }],
        [/[{}()[\]]/, '@brackets'],
        [/[+\-*\/%&|^~!=<>?:;,.]+/, 'operator'],
        [/\s+/, 'white'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        // Alpha.7+ supports Unicode scalar escapes of one to six hex digits.
        [/\\u\{[0-9a-fA-F]{1,6}\}/, 'string.escape'],
        [/\\(?:\\|"|n|t|r)/, 'string.escape'],
        [/\\./, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  });
}
