import { profileError, type ProfileResult } from './intelliSenseProfileTransfer';

export const MAX_SNIPPET_BODY_UNITS = 4096;
export const MAX_SNIPPET_BODY_LINES = 100;
export const MAX_SNIPPET_STOPS = 16;
export const MAX_SNIPPET_STOP_OCCURRENCES = 64;
export interface SnippetStop { readonly index: number; readonly value: string; readonly offset: number }
export interface CompiledSnippet {
  readonly insertText: string;
  readonly preview: string;
  readonly stops: readonly SnippetStop[];
  readonly asSnippet: boolean;
}
function validText(text: string): boolean {
  // Reject invisible directional overrides, invalid UTF-16 and control
  // characters other than indentation and line breaks.
  return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text)
    && !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(text);
}
export function validSnippetText(text: string): boolean { return validText(text); }
function escapeMonaco(text: string): string { return text.replace(/[\\$}]/g, '\\$&'); }

/** A deliberately small, deterministic placeholder grammar:
 * {{1:name}} defines a numbered stop, {{1}} repeats it, {{0}} is the
 * optional final caret. Backslash before an opening double brace escapes
 * that delimiter. No environment variables, commands or transformations
 * are passed to Monaco; every other character is emitted as literal text.
 */
export function compileSnippet(raw: string): ProfileResult<CompiledSnippet> {
  if (raw.length > MAX_SNIPPET_BODY_UNITS) return profileError('Snippet body is too large.');
  const body = raw.replace(/\r\n?/g, '\n');
  if (!body.trim() || body.split('\n').length > MAX_SNIPPET_BODY_LINES || !validText(body)) {
    return profileError('Snippet body must be nonempty, valid text with at most 100 lines.');
  }
  type Part = { text: string } | { index: number; definition: string | null };
  const parts: Part[] = [];
  const values = new Map<number, string>();
  const references = new Set<number>();
  let literal = '';
  let finalSeen = false;
  let occurrences = 0;
  const flush = () => { if (literal) { parts.push({ text: literal }); literal = ''; } };
  for (let i = 0; i < body.length;) {
    if (body.startsWith('\\{{', i)) { literal += '{{'; i += 3; continue; }
    if (!body.startsWith('{{', i) || !/[0-9]/.test(body[i + 2] ?? '')) {
      literal += body[i++]; continue;
    }
    const end = body.indexOf('}}', i + 2);
    if (end < 0) return profileError('Unclosed numbered placeholder.');
    const inside = body.slice(i + 2, end);
    const match = /^(0|[1-9][0-9]?)(?::([^\r\n{}]*))?$/.exec(inside);
    if (!match) return profileError('Use numbered placeholders such as {{1:name}} or {{1}}.');
    const index = Number(match[1]);
    if (index > MAX_SNIPPET_STOPS) return profileError('Placeholder numbers must be 0–16.');
    if (++occurrences > MAX_SNIPPET_STOP_OCCURRENCES) return profileError('Too many placeholder occurrences.');
    const definition = match[2] ?? null;
    if (index === 0) {
      if (finalSeen || definition !== null) return profileError('The optional final caret {{0}} may occur only once and has no default.');
      finalSeen = true;
    } else if (definition !== null) {
      if (values.has(index)) return profileError('Define each numbered placeholder only once; use {{n}} to repeat it.');
      values.set(index, definition);
    } else references.add(index);
    flush(); parts.push({ index, definition }); i = end + 2;
  }
  flush();
  for (const index of references) if (!values.has(index)) return profileError('Repeated placeholder ' + index + ' has no definition.');
  // Contiguous indices make actual tab order predictable. Definitions may
  // occur anywhere, including after a reference.
  for (let index = 1; index <= values.size; index++) if (!values.has(index)) return profileError('Number placeholders consecutively, starting at 1.');
  let preview = '';
  let insertText = '';
  const stops: SnippetStop[] = [];
  const asSnippet = occurrences > 0;
  const defined = new Set<number>();
  for (const part of parts) {
    if ('text' in part) {
      preview += part.text;
      insertText += asSnippet ? escapeMonaco(part.text) : part.text;
      continue;
    }
    const value = values.get(part.index) ?? '';
    stops.push(Object.freeze({ index: part.index, value, offset: preview.length }));
    preview += value;
    if (part.index === 0) insertText += '$0';
    else if (!defined.has(part.index)) {
      defined.add(part.index);
      insertText += '$' + '{' + part.index + ':' + escapeMonaco(value) + '}';
    } else insertText += '$' + part.index;
  }
  return { ok: true, value: Object.freeze({ insertText, preview, stops: Object.freeze(stops), asSnippet }) };
}
