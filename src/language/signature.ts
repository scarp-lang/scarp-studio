import { MAX_ASSIST_SCAN_UNITS } from './assist';
import { indexLocalFunctionHeaders, MAX_DEFINITION_SOURCE_UNITS } from './definition';

export const MAX_SIGNATURE_HEADER_UNITS = 2048;
export const MAX_SIGNATURE_PARAMETERS = 64;
const MAX_NESTING = 128;

export interface LocalSignature {
  name: string;
  label: string;
  parameters: string[];
  activeParameter: number;
}

interface Frame {
  close: string;
  call: string | null;
  /** A declaration or qualified/unsupported call blocks outer hints. */
  blocked: boolean;
  commas: number;
}

/** Scan only the prefix ending at the caret. Strings and comments are
 * consumed before punctuation; commas inside grouped/nested expressions
 * never advance the surrounding call's argument index. */
export function activeLocalCall(source: string, offset: number): { name: string; argument: number } | null {
  if (source.length > MAX_DEFINITION_SOURCE_UNITS || !Number.isSafeInteger(offset) ||
      offset < 0 || offset > source.length) return null;
  const frames: Frame[] = [];
  let last = '';
  let beforeLast = '';
  let i = 0;
  const remember = (value: string) => { beforeLast = last; last = value; };
  while (i < offset) {
    const char = source[i];
    if (/\s/.test(char)) { i++; continue; }
    if (char === '/' && source[i + 1] === '/') {
      while (i < offset && source[i] !== '\r' && source[i] !== '\n') i++;
      if (i === offset) return null;
      continue;
    }
    if (char === '"') {
      i++;
      let closed = false;
      while (i < offset) {
        const next = source[i++];
        if (next === '\r' || next === '\n') return null;
        if (next === '"') { closed = true; break; }
        if (next === '\\') {
          if (i >= offset || /[\r\n]/.test(source[i])) return null;
          i++;
        }
      }
      if (!closed) return null;
      remember('"');
      continue;
    }
    if (/[A-Za-z_0-9]/.test(char)) {
      const start = i++;
      while (i < offset && /[A-Za-z_0-9]/.test(source[i])) i++;
      remember(source.slice(start, i));
      continue;
    }
    if (char === '(' || char === '[' || char === '{') {
      const named = char === '(' && /^[A-Za-z_][A-Za-z_0-9]*$/.test(last);
      const blocked = named && (beforeLast === '.' || beforeLast === ':' || beforeLast === '>' ||
        beforeLast === 'funcra' || beforeLast === 'new');
      frames.push({
        close: char === '(' ? ')' : char === '[' ? ']' : '}',
        call: named && !blocked ? last : null, blocked, commas: 0,
      });
      if (frames.length > MAX_NESTING) return null;
    } else if (char === ')' || char === ']' || char === '}') {
      if (frames.pop()?.close !== char) return null;
    } else if (char === ',') {
      const frame = frames.at(-1);
      if (frame?.call) frame.commas++;
    }
    remember(char);
    i++;
  }
  // Do not show a hint for an outer call while editing a different named
  // invocation, even when the inner function cannot be resolved locally.
  for (let j = frames.length - 1; j >= 0; j--) {
    const frame = frames[j];
    if (frame.blocked || frame.close === '}') return null;
    if (frame.call) return { name: frame.call, argument: frame.commas };
  }
  return null;
}

/** Parse typed parameter labels from a bounded declaration header. This is
 * display-only: unknown or malformed parameter syntax is not guessed. */
export function readLocalParameters(source: string, openOffset: number): string[] | null {
  if (!Number.isSafeInteger(openOffset) || openOffset < 0 || source[openOffset] !== '(') return null;
  const end = Math.min(source.length, openOffset + MAX_SIGNATURE_HEADER_UNITS);
  const labels: string[] = [];
  const nesting: string[] = [];
  let part = '';
  function finish(): boolean {
    const normalized = part.trim().replace(/\s+/g, ' ');
    if (!/^[A-Za-z_][A-Za-z_0-9]*\s*:\s*[A-Za-z_][A-Za-z_0-9<>,()[\]\s.:]*$/.test(normalized)) return false;
    labels.push(normalized.replace(/\s*:\s*/, ': '));
    part = '';
    return labels.length <= MAX_SIGNATURE_PARAMETERS;
  }
  for (let i = openOffset + 1; i < end; i++) {
    const ch = source[i];
    if (ch === '/' && source[i + 1] === '/') {
      while (i < end && source[i] !== '\r' && source[i] !== '\n') i++;
      part += ' ';
      continue;
    }
    if (ch === '<' || ch === '(' || ch === '[') {
      nesting.push(ch === '<' ? '>' : ch === '(' ? ')' : ']');
      if (nesting.length > MAX_NESTING) return null;
    } else if (ch === '>' || ch === ')' || ch === ']') {
      if (!nesting.length && ch === ')') {
        if (!part.trim() && !labels.length) return [];
        return finish() ? labels : null;
      }
      if (nesting.pop() !== ch) return null;
    } else if (ch === ',' && !nesting.length) {
      if (!finish()) return null;
      continue;
    } else if (!/[A-Za-z_0-9\s.,:]/.test(ch)) return null;
    part += ch;
  }
  return null;
}

export function localSignatureAt(source: string, offset: number): LocalSignature | null {
  const call = activeLocalCall(source, offset);
  if (!call) return null;
  // Suppress work when the current line's prefix exceeds the lexical budget.
  let lineStart = offset;
  while (lineStart > 0 && source[lineStart - 1] !== '\r' && source[lineStart - 1] !== '\n') {
    if (offset - lineStart >= MAX_ASSIST_SCAN_UNITS) return null;
    lineStart--;
  }
  const matches = indexLocalFunctionHeaders(source)?.filter(symbol => symbol.name === call.name);
  if (matches?.length !== 1) return null;
  const parameters = readLocalParameters(source, matches[0].openOffset);
  if (!parameters || call.argument >= Math.max(1, parameters.length)) return null;
  return { name: call.name, label: call.name + '(' + parameters.join(', ') + ')',
    parameters, activeParameter: call.argument };
}
