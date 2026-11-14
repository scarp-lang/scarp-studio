import type * as Monaco from 'monaco-editor';
import {
  isScarpCodePosition, scanScarpFunctions, scarpCompletions, scarpTokenHelp,
  type ScarpCompletion,
} from './assist';

/** Conservative, editor-only highlighting aligned to published Scarp v0.0.6-alpha.10.
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
    typeKeywords: ['integer', 'float', 'boolean', 'string', 'unit', 'vector', 'integers', 'tile', 'tuple', 'bigint'],
    // Calls are not keywords: names such as ask and array can occur as bindings.
    builtinFunctions: [
      'input', 'ask', 'ask_or', 'input_integer', 'input_float', 'input_bigint',
      'try_read_line', 'flush_stdout', 'flush_stderr',
      'bigint_pow', 'bigint_gcd', 'bigint_lcm', 'bigint_sqrt', 'bigint_bit_length',
      'bigint_to_text', 'bigint_from_radix', 'bigint_to_radix', 'bigint_and',
      'bigint_or', 'bigint_xor', 'bigint_not', 'bigint_shl', 'bigint_shr',
      'bigint_pow_mod', 'bigint_divmod',
    ],
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
        [/\barray(?=\s*<)/, 'type'],
        [/[a-zA-Z_][\w]*(?=\s*\()/, {
          cases: { '@keywords': 'keyword', '@builtinFunctions': 'predefined',
            '@legacyKeywords': 'invalid', '@default': 'identifier' },
        }],
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

  // These are editor-only conveniences. Source acceptance remains the job of
  // the separately installed official Scarp compiler.
  const completionKinds: Record<ScarpCompletion['kind'], Monaco.languages.CompletionItemKind> = {
    keyword: monaco.languages.CompletionItemKind.Keyword,
    type: monaco.languages.CompletionItemKind.Class,
    function: monaco.languages.CompletionItemKind.Function,
    snippet: monaco.languages.CompletionItemKind.Snippet,
  };
  monaco.languages.registerCompletionItemProvider('scarp', {
    provideCompletionItems(model, position) {
      const line = model.getLineContent(position.lineNumber);
      if (!isScarpCodePosition(line, position.column - 1)) return { suggestions: [] };
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: scarpCompletions(word.word).map((item) => ({
          label: item.label,
          kind: completionKinds[item.kind],
          insertText: item.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: item.detail,
          documentation: item.documentation,
        })),
      };
    },
  });

  monaco.languages.registerHoverProvider('scarp', {
    provideHover(model, position) {
      const line = model.getLineContent(position.lineNumber);
      if (!isScarpCodePosition(line, position.column - 1)) return null;
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const item = scarpTokenHelp(word.word);
      if (!item) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn,
          position.lineNumber, word.endColumn),
        contents: [
          { value: '**Scarp: ' + item.label + '**' },
          { value: item.documentation },
        ],
      };
    },
  });

  monaco.languages.registerDocumentSymbolProvider('scarp', {
    provideDocumentSymbols(model) {
      return scanScarpFunctions(model.getValue()).map((symbol) => ({
        name: symbol.name,
        detail: 'Scarp function',
        kind: monaco.languages.SymbolKind.Function,
        tags: [],
        range: new monaco.Range(symbol.line, 1, symbol.line, model.getLineMaxColumn(symbol.line)),
        selectionRange: new monaco.Range(symbol.line, symbol.startColumn,
          symbol.line, symbol.endColumn),
      }));
    },
  });
}
