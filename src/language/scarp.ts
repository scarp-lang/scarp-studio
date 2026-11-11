import type * as Monaco from 'monaco-editor';

/** Conservative tokenization based on scarp-vscode's scarp.tmLanguage.json.
 * Highlighting is not a claim that a keyword is supported by a given compiler.
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
    ],
    typeKeywords: ['integer', 'float', 'boolean', 'string', 'unit', 'vector', 'tile', 'tuple'],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        [/\b(?:true|false)\b/, 'constant'],
        [/\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)\b/, 'number'],
        [/[a-zA-Z_][\w]*/, {
          cases: { '@keywords': 'keyword', '@typeKeywords': 'type', '@default': 'identifier' },
        }],
        [/[{}()[\]]/, '@brackets'],
        [/[+\-*\/%&|^~!=<>?:;,.]+/, 'operator'],
        [/\s+/, 'white'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\(?:\\|"|n|t|r)/, 'string.escape'],
        [/\\./, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  });
}
