import {
  isScarpCodePosition, MAX_ASSIST_SCAN_UNITS, MAX_SCARP_OUTLINE_SYMBOLS,
  type ScarpFunctionSymbol,
} from './assist';
import { scanScarpSource, tokenAtOffset, scarpInsightIdentifier, type SourceLexResult } from './sourceLex';
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

export function indexLocalFunctionHeaders(source: string): LocalFunctionHeader[] | null {
  if (source.length > MAX_DEFINITION_SOURCE_UNITS) return null;
  const symbols: LocalFunctionHeader[] = [];
  let offset = 0;
  let line = 1;
  let column = 1;
  let depth = 0;
  let expectingName = false;
  let pending: ScarpFunctionSymbol | null = null;

  function advance(): void {
    const char = source[offset++];
    if (char === '\r' || char === '\n') {
      if (char === '\r' && source[offset] === '\n') offset++;
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  while (offset < source.length) {
    const char = source[offset];
    if (/\s/.test(char)) { advance(); continue; }
    if (char === '/' && source[offset + 1] === '/') {
      while (offset < source.length && source[offset] !== '\r' && source[offset] !== '\n') advance();
      continue;
    }
    if (char === '"') {
      // Scarp strings are single-line. Never index declaration-like text
      // inside a string or after an unterminated lexical construct.
      expectingName = false;
      pending = null;
      advance();
      let closed = false;
      while (offset < source.length) {
        const current = source[offset];
        if (current === '\r' || current === '\n') return null;
        advance();
        if (current === '"') { closed = true; break; }
        if (current === '\\') {
          if (offset >= source.length || source[offset] === '\r' || source[offset] === '\n') return null;
          advance();
        }
      }
      if (!closed) return null;
      continue;
    }

    if (/[A-Za-z_0-9]/.test(char)) {
      const start = offset;
      const startColumn = column;
      while (offset < source.length && /[A-Za-z_0-9]/.test(source[offset])) advance();
      const name = source.slice(start, offset);
      if (depth === 0 && expectingName && /^[A-Za-z_]/.test(name)) {
        pending = { name, line, startColumn, endColumn: column };
        expectingName = false;
      } else {
        pending = null;
        expectingName = depth === 0 && name === 'funcra';
      }
      continue;
    }
    if (char === '(' && depth === 0 && pending) {
      symbols.push({ ...pending, openOffset: offset });
      if (symbols.length >= MAX_SCARP_OUTLINE_SYMBOLS) return null;
    }
    pending = null;
    expectingName = false;
    if (char === '{') depth++;
    else if (char === '}') {
      if (depth === 0) return null;
      depth--;
    }
    advance();
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
