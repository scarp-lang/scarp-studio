import {
  isScarpCodePosition, MAX_ASSIST_SCAN_UNITS, MAX_SCARP_OUTLINE_SYMBOLS,
  type ScarpFunctionSymbol,
} from './assist';
import { scanScarpSource, tokenAtOffset, scarpInsightIdentifier, type SourceLexResult, type InsightToken } from './sourceLex';
import { blocksLocalFunctionName } from './localCallContext';

/** Editor-only, bounded lookup for unqualified function calls. It is not
 * compiler symbol resolution: imports, field access, and duplicate names
 * deliberately yield no result rather than a guessed navigation target.
 */
export const MAX_DEFINITION_SOURCE_UNITS = 512 * 1024;

export function scarpCallNameAt(line: string, column: number): string | null {
  const offset = column - 1;
  if (!Number.isSafeInteger(column) || offset < 0 || offset >= line.length ||
      line.length > MAX_ASSIST_SCAN_UNITS || !isScarpCodePosition(line, offset)) return null;
  for (const match of line.matchAll(/[A-Za-z_][A-Za-z_0-9]*/g)) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset < start) return null;
    if (offset >= end) continue;
    if (!isScarpCodePosition(line, start) ||
        (start > 0 && /[A-Za-z_0-9]/.test(line[start - 1])) ||
        !/^\s*\(/.test(line.slice(end))) return null;
    const prefix = line.slice(0, start).trimEnd();
    // Module names use '.', variant constructors '::', fields '->'.
    // Do not resolve declaration names or construction syntax as calls.
    if (/[.:>]$/.test(prefix) || /\b(?:funcra|new)\s*$/.test(prefix)) return null;
    return match[0];
  }
  return null;
}

/** Resolve a call from a complete bounded lexical snapshot, not an isolated
 * line. Newlines and line comments are trivia, but strings are not. This
 * prevents multiline module access and declaration headers being confused
 * with unqualified calls. A partial token inventory is never authoritative.
 * The offset is a zero-based UTF-16 position inside the identifier.
 */
export function scarpCallNameAtOffset(source: string, offset: number): string | null {
  return scarpCallNameFromLexical(source, offset, () => scanScarpSource(source));
}

/** The lazy scanner must describe the exact supplied source snapshot. */
export function scarpCallNameFromLexical(source: string, offset: number,
  scan: () => SourceLexResult): string | null {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= source.length ||
      source.length > MAX_DEFINITION_SOURCE_UNITS) return null;
  const lexical = scan();
  if (lexical.sourceLength !== source.length || !lexical.complete || lexical.issues.length) return null;
  const token = tokenAtOffset(lexical.tokens, offset);
  if (!token || token.kind !== 'identifier' || token.previewTruncated ||
      !scarpInsightIdentifier(token.text) || token.column > MAX_ASSIST_SCAN_UNITS) return null;
  const index = lexical.tokens.indexOf(token);
  let previous = index - 1;
  while (previous >= 0 && lexical.tokens[previous].kind === 'comment') previous--;
  let next = index + 1;
  while (next < lexical.tokens.length && lexical.tokens[next].kind === 'comment') next++;
  const before = lexical.tokens[previous];
  const after = lexical.tokens[next];
  if (!after || after.kind !== 'delimiter' || after.text !== '(') return null;
  if (before && (before.kind === 'identifier' || before.kind === 'operator') &&
      blocksLocalFunctionName(before.text)) return null;
  // Unsupported adjacent non-ASCII identifier characters must not make a
  // suffix appear to be an independent ASCII Scarp name.
  if (token.start > 0 && /[^\x00-\x7f]/.test(source[token.start - 1]) ||
      token.end < source.length && /[^\x00-\x7f]/.test(source[token.end])) return null;
  return token.text;
}

/** Lexical top-level inventory for definition lookup. Unlike the sidebar's
 * deliberately line-oriented outline, this consumes the entire bounded buffer,
 * including multiple declarations on one line and multiline headers. It never
 * returns a first match from a potentially incomplete or duplicate inventory.
 */
export interface LocalFunctionHeader extends ScarpFunctionSymbol {
  openOffset: number;
}

export const MAX_LOCAL_DECLARATION_NESTING = 128;

/** Reuse the exact bounded lexical snapshot when called by LocalSourceAnalysis.
 * A declaration must occur outside braces, parentheses and brackets. An
 * unfinished trailing expression is permitted during editing; a mismatched
 * closer or incomplete lexical inventory is not. */
export function indexLocalFunctionHeaders(source: string,
  scan: () => SourceLexResult = () => scanScarpSource(source),
): LocalFunctionHeader[] | null {
  if (source.length > MAX_DEFINITION_SOURCE_UNITS) return null;
  const lexical = scan();
  if (!lexical.complete || lexical.issues.length || lexical.sourceLength !== source.length) return null;
  const symbols: LocalFunctionHeader[] = [];
  const stack: string[] = [];
  let previous: InsightToken | undefined;
  let state: 'idle' | 'name' | 'open' = 'idle';
  let pending: InsightToken | undefined;
  for (const token of lexical.tokens) {
    if (token.kind === 'comment') continue;
    // The current local analysis recognizes ASCII code tokens only. Never
    // reinterpret unsupported code units as an independent declaration.
    if (token.kind !== 'string' && /[^\x20-\x7e]/.test(token.text)) return null;
    if (stack.length === 0) {
      if (state === 'name' && token.kind === 'identifier' &&
          !token.previewTruncated && scarpInsightIdentifier(token.text)) {
        pending = token;
        state = 'open';
      } else if (state === 'open' && pending && token.kind === 'delimiter' && token.text === '(') {
        symbols.push({ name: pending.text, line: pending.line, startColumn: pending.column,
          endColumn: pending.column + pending.end - pending.start, openOffset: token.start });
        if (symbols.length >= MAX_SCARP_OUTLINE_SYMBOLS) return null;
        state = 'idle';
        pending = undefined;
      } else {
        // A qualified keyword is not a top-level declaration introducer.
        const qualified = previous?.kind === 'operator' && /[.:>]$/.test(previous.text);
        state = token.kind === 'identifier' && token.text === 'funcra' && !qualified ? 'name' : 'idle';
        pending = undefined;
      }
    } else {
      state = 'idle';
      pending = undefined;
    }
    if (token.kind === 'delimiter') {
      if (token.text === '(' || token.text === '[' || token.text === '{') {
        stack.push(token.text === '(' ? ')' : token.text === '[' ? ']' : '}');
        if (stack.length > MAX_LOCAL_DECLARATION_NESTING) return null;
      } else if (token.text === ')' || token.text === ']' || token.text === '}') {
        if (stack.pop() !== token.text) return null;
      }
    }
    previous = token;
  }
  return symbols;
}

export function indexLocalFunctionDefinitions(source: string): ScarpFunctionSymbol[] | null {
  return indexLocalFunctionHeaders(source)?.map(({ openOffset: _openOffset, ...symbol }) => symbol) ?? null;
}

export function findLocalFunctionDefinition(
  source: string, name: string,
): ScarpFunctionSymbol | null {
  if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name)) return null;
  const symbols = indexLocalFunctionDefinitions(source);
  if (!symbols) return null;
  const matches = symbols.filter(symbol => symbol.name === name);
  return matches.length === 1 ? matches[0] : null;
}
