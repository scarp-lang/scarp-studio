import type * as Monaco from 'monaco-editor';
import { readIntelliSensePreferences, type IntelliSensePreferences } from '../model/intelliSensePreferences';
import { LocalAnalysisCache } from './localAnalysis';
import { canCompleteLocalFunction } from './localCompletion';
import { collectScarpSuggestions, scarpCompletionEnabled } from './suggestionPipeline';
import { completionMatchRank, lineCompletionContext } from './completionMatching';
import { MAX_DEFINITION_SOURCE_UNITS } from './definition';
import {
  isScarpCodePosition, scarpDecimalLiteralAt, MAX_ASSIST_SCAN_UNITS, scarpTokenHelp,
  type ScarpCompletion,
} from './assist';

/** Avoid fetching a multi-megabyte line before deciding whether Monaco
 * completion or hover is within the lexical assistance scanning budget.
 * Positions come from Monaco and use one-based UTF-16 columns. */
function canAssistAtColumn(column: number): boolean {
  return Number.isSafeInteger(column) && column >= 1 &&
    column <= MAX_ASSIST_SCAN_UNITS + 1;
}

/** Conservative, editor-only highlighting aligned to published Scarp v0.0.6-alpha.20.
 * Highlighting is not parsing or a guarantee of compatibility with any installed compiler.
 */
export function registerScarpLanguage(monaco: typeof Monaco,
  preferences: () => Readonly<IntelliSensePreferences> = readIntelliSensePreferences,
): void {
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
      'needs', 'ensures', 'assert', 'record', 'variant', 'match', 'on', 'case', 'new',
      'print', 'println', 'write', 'eprint', 'ewrite',
    ],
    typeKeywords: ['integer', 'float', 'boolean', 'string', 'unit', 'vector', 'integers', 'tile', 'tuple', 'bigint', 'decimal', 'list', 'map', 'option', 'result'],
    // Calls are not keywords: names such as ask and array can occur as bindings.
    builtinFunctions: [
      'input', 'ask', 'ask_or', 'input_integer', 'input_float', 'input_bigint',
      'try_read_line', 'flush_stdout', 'flush_stderr',
      'bigint_pow', 'bigint_gcd', 'bigint_lcm', 'bigint_sqrt', 'bigint_bit_length',
      'bigint_to_text', 'bigint_from_radix', 'bigint_to_radix', 'bigint_and',
      'bigint_or', 'bigint_xor', 'bigint_not', 'bigint_shl', 'bigint_shr',
      'bigint_pow_mod', 'bigint_divmod',
      'decimal', 'decimal_from_integer', 'decimal_to_integer', 'decimal_to_text',
      'decimal_round', 'decimal_format', 'decimal_div_rounded', 'input_decimal',
      'list_len', 'list_push', 'list_set', 'list_remove',
      'map_len', 'map_keys', 'map_values', 'map_contains', 'map_get_or', 'map_set', 'map_remove',
      'array_len', 'array_get_or', 'array_set', 'input_boolean',
    ],
    // Old declaration spellings are reserved but rejected by the current compiler.
    legacyKeywords: ['let', 'mut'],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        [/\b(?:true|false)\b/, 'constant'],
        // The published compiler accepts hexadecimal and binary integers.
        // Match only complete tokens so malformed forms never become valid prefixes.
        [/\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+)(?![A-Za-z0-9_])/, 'number'],
        // Separators, missing digits and invalid radix digits are unsupported.
        [/\b(?:0[xX][A-Za-z0-9_]*|0[bB][A-Za-z0-9_]*|[0-9]+_[A-Za-z0-9_]*)\b/, 'number.invalid'],
        // Exact decimal literals choose base-10 arithmetic; exponents are float-only.
        [/\b[0-9]+(?:\.[0-9]+)?d(?![A-Za-z0-9_])/, 'number'],
        [/\b[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?d[A-Za-z0-9_]*/, 'number.invalid'],
        [/\b[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\b/, 'number'],
        [/\b(?:array|list|map|option|result)(?=\s*<)/, 'type'],
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
  const localAnalysis = new LocalAnalysisCache();
  const completionKinds: Record<ScarpCompletion['kind'], Monaco.languages.CompletionItemKind> = {
    keyword: monaco.languages.CompletionItemKind.Keyword,
    type: monaco.languages.CompletionItemKind.Class,
    function: monaco.languages.CompletionItemKind.Function,
    snippet: monaco.languages.CompletionItemKind.Snippet,
  };
  monaco.languages.registerCompletionItemProvider('scarp', {
    provideCompletionItems(model, position, _context, token) {
      const settings = preferences();
      if (!scarpCompletionEnabled(settings) || token?.isCancellationRequested ||
          !canAssistAtColumn(position.column)) return { suggestions: [] };
      if (model.getLineMaxColumn?.(position.lineNumber) > MAX_ASSIST_SCAN_UNITS + 1) return { suggestions: [] };
      const line = model.getLineContent(position.lineNumber);
      if (line.length > MAX_ASSIST_SCAN_UNITS || !isScarpCodePosition(line, position.column - 1)) return { suggestions: [] };
      const word = model.getWordUntilPosition(position);
      const completeWord = model.getWordAtPosition(position);
      // Completing inside an identifier must replace its existing suffix:
      // fun|cra -> funcra, not funcracra. A mismatching word at a
      // punctuation boundary cannot widen the replacement.
      const endColumn = completeWord &&
        completeWord.startColumn === word.startColumn &&
        completeWord.endColumn >= word.endColumn &&
        completeWord.word.startsWith(word.word)
        ? completeWord.endColumn : word.endColumn;
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn,
      };
      const context = lineCompletionContext(line, word.startColumn - 1);
      const rank = (name: string, needle: string) => completionMatchRank(name, needle, settings.matchingMode);
      const planned = collectScarpSuggestions(settings, word.word, exclude => {
        const sourceLength = model.getValueLength();
        if (!canCompleteLocalFunction(line, word.startColumn - 1, word.word) ||
            sourceLength <= 0 || sourceLength > Math.min(MAX_DEFINITION_SOURCE_UNITS, settings.localAnalysisKiB * 1024)) return [];
        const analysis = localAnalysis.get(model, settings.localAnalysisKiB * 1024);
        if (!analysis) return [];
        const start = model.getOffsetAt({ lineNumber: position.lineNumber, column: word.startColumn });
        const end = model.getOffsetAt({ lineNumber: position.lineNumber, column: endColumn });
        return analysis.complete(start, end, word.word, exclude,
          (name, needle) => Number.isFinite(rank(name, needle)), settings.matchingMode === 'subsequence' ? rank : undefined);
      }, context);
      const suggestions: Monaco.languages.CompletionItem[] = planned.map(item => ({
        label: item.label,
        kind: completionKinds[item.kind],
        insertText: item.insertText,
        ...(item.source === 'catalog' ? { insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet } : {}),
        range, detail: item.detail, documentation: item.documentation, sortText: item.sortText,
      }));
      return { suggestions: token?.isCancellationRequested ? [] : suggestions };
    },
  });

  monaco.languages.registerHoverProvider('scarp', {
    provideHover(model, position, token) {
      const settings = preferences();
      if (!settings.hover || token?.isCancellationRequested || !canAssistAtColumn(position.column)) return null;
      if (model.getLineMaxColumn?.(position.lineNumber) > MAX_ASSIST_SCAN_UNITS + 1) return null;
      const line = model.getLineContent(position.lineNumber);
      if (line.length > MAX_ASSIST_SCAN_UNITS || !isScarpCodePosition(line, position.column - 1)) return null;
      const literal = scarpDecimalLiteralAt(line, position.column - 1);
      if (literal) {
        return {
          range: new monaco.Range(position.lineNumber, literal.start + 1,
            position.lineNumber, literal.end + 1),
          contents: [
            { value: '**Scarp: exact decimal literal (alpha.20+)**' },
            { value: 'The lowercase d suffix selects exact base-10 arithmetic. Exponents and implicit float/integer conversion are unsupported. Verify checks precision and range.' },
          ],
        };
      }
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const item = scarpTokenHelp(word.word);
      if (!item) {
        if (!settings.localFunctionHover || model.getValueLength() > settings.localAnalysisKiB * 1024) return null;
        const analysis = localAnalysis.get(model, settings.localAnalysisKiB * 1024);
        const local = analysis?.hover(model.getOffsetAt(position));
        if (!local || token?.isCancellationRequested) return null;
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [
            { value: '`' + local.label + '`', isTrusted: false, supportHtml: false },
            { value: 'Local function declaration · line ' + local.line + ' (editor-only, not compiler resolution).' },
          ],
        };
      }
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

  monaco.languages.registerSignatureHelpProvider('scarp', {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [')'],
    provideSignatureHelp(model, position, token) {
      const settings = preferences();
      if (!settings.signatureHelp || token.isCancellationRequested || !canAssistAtColumn(position.column) ||
          model.getValueLength() > Math.min(MAX_DEFINITION_SOURCE_UNITS, settings.localAnalysisKiB * 1024)) return null;
      const signature = localAnalysis.get(model, settings.localAnalysisKiB * 1024)?.signature(model.getOffsetAt(position));
      if (!signature || token.isCancellationRequested) return null;
      return {
        value: {
          signatures: [{
            label: signature.label,
            documentation: 'Local Scarp declaration (editor-only assistance).',
            parameters: signature.parameters.map(label => ({ label })),
          }],
          activeSignature: 0,
          activeParameter: signature.activeParameter,
        },
        dispose() {},
      };
    },
  });

  monaco.languages.registerDefinitionProvider('scarp', {
    provideDefinition(model, position, token) {
      const settings = preferences();
      if (!settings.goToDefinition || token.isCancellationRequested || !canAssistAtColumn(position.column) ||
          model.getLineMaxColumn(position.lineNumber) > MAX_ASSIST_SCAN_UNITS + 1 ||
          model.getValueLength() > Math.min(MAX_DEFINITION_SOURCE_UNITS, settings.localAnalysisKiB * 1024)) return null;
      const target = localAnalysis.get(model, settings.localAnalysisKiB * 1024)?.definition(model.getOffsetAt(position));
      if (!target || token.isCancellationRequested) return null;
      return {
        uri: model.uri,
        range: new monaco.Range(target.line, target.startColumn, target.line, target.endColumn),
      };
    },
  });

  monaco.languages.registerDocumentSymbolProvider('scarp', {
    provideDocumentSymbols(model, token) {
      const settings = preferences();
      if (!settings.documentSymbols || token?.isCancellationRequested ||
          model.getValueLength() > Math.min(MAX_DEFINITION_SOURCE_UNITS, settings.localAnalysisKiB * 1024)) return [];
      const analysis = localAnalysis.get(model, settings.localAnalysisKiB * 1024);
      return (analysis?.symbols() ?? []).map((symbol) => ({
        name: symbol.name,
        detail: 'Scarp ' + symbol.kind,
        kind: symbol.kind === 'function' ? monaco.languages.SymbolKind.Function
          : symbol.kind === 'record' ? monaco.languages.SymbolKind.Struct
            : monaco.languages.SymbolKind.Enum,
        tags: [],
        range: new monaco.Range(symbol.line, 1, symbol.line, model.getLineMaxColumn(symbol.line)),
        selectionRange: new monaco.Range(symbol.line, symbol.startColumn,
          symbol.line, symbol.endColumn),
      }));
    },
  });
}
