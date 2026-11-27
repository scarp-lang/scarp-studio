import { explicitTypeArguments, genericParameterHeader } from './genericSyntax';
import type { InlayHintMode } from '../model/intelliSensePreferences';
import { MAX_ASSIST_SCAN_UNITS } from './assist';
import { blocksIndirectCall, blocksLocalFunctionName } from './localCallContext';
import { scarpInsightIdentifier, type InsightToken, type SourceLexResult } from './sourceLex';

export const MAX_PARAMETER_INLAYS = 512;
const MAX_NESTING = 128;
const MAX_ARGUMENTS = 64;
export interface ParameterInlay { offset: number; label: string }
interface Argument {
  first: InsightToken;
  last: InsightToken;
  count: number;
}
interface Frame {
  close: string;
  name: string | null;
  args: Argument[];
  current: Argument | null;
  invalid: boolean;
  blocked: boolean;
  header: boolean;
}

/** Derive only complete, fixed-arity unqualified call decorations. The
 * scanner uses the bounded lexical inventory, not one prefix rescan per
 * argument. Unsupported generic/comparison expressions at argument level
 * suppress that call rather than guessing where its commas belong. */
export function collectParameterInlays(source: string, lex: SourceLexResult,
  mode: InlayHintMode, resolve: (name: string) => readonly string[] | null,
): ParameterInlay[] {
  if (mode === 'off' || !lex.complete || lex.issues.length || lex.sourceLength !== source.length) return [];
  const frames: Frame[] = [];
  const hints: ParameterInlay[] = [];
  let previous: InsightToken | undefined;
  let beforePrevious: InsightToken | undefined;
  function append(frame: Frame | undefined, token: InsightToken): void {
    if (!frame?.name || frame.invalid) return;
    if (!frame.current) frame.current = { first: token, last: token, count: 1 };
    else { frame.current.last = token; frame.current.count++; }
    if (token.kind === 'operator' && /[<>]/.test(token.text)) frame.invalid = true;
  }
  function finish(frame: Frame): void {
    if (!frame.current) { frame.invalid = true; return; }
    frame.args.push(frame.current);
    frame.current = null;
    if (frame.args.length > MAX_ARGUMENTS) frame.invalid = true;
  }
  function emit(frame: Frame): void {
    if (!frame.name || frame.invalid || frame.blocked || frame.header) return;
    if (frame.current) finish(frame);
    else if (frame.args.length) return; // trailing comma
    if (frame.invalid || !frame.args.length) return;
    const labels = resolve(frame.name);
    if (!labels || labels.length !== frame.args.length) return;
    for (let i = 0; i < labels.length; i++) {
      if (hints.length >= MAX_PARAMETER_INLAYS) break;
      const argument = frame.args[i];
      const label = /^([A-Za-z_][A-Za-z_0-9]*)(?::|$)/.exec(labels[i])?.[1];
      if (!label || argument.first.column > MAX_ASSIST_SCAN_UNITS) continue;
      // Omit labels that simply repeat a lone argument identifier.
      if (argument.count === 1 && argument.first.kind === 'identifier' && argument.first.text === label) continue;
      if (mode === 'literals' && !isLiteralArgument(argument, source)) continue;
      hints.push({ offset: argument.first.start, label });
    }
  }
  const tokens=lex.tokens.filter(token=>token.kind!=='comment');
  for (let index=0; index<tokens.length; index++) {
    const token=tokens[index];
    const frame = frames.at(-1);
    // Consume recognized type-only suffixes as part of the name, not as
    // value arguments. Incomplete/ambiguous syntax still follows the
    // conservative angle-operator invalidation below.
    if (token.kind==='identifier' && !token.previewTruncated) {
      const header=previous?.text==='funcra'?genericParameterHeader(tokens,index+1):null;
      const explicit=explicitTypeArguments(tokens,index+1);
      const open=header?.openIndex??explicit?.openIndex;
      if(open!==undefined){
        append(frame,token);
        beforePrevious=previous;
        previous=token;
        index=open-1;
        continue;
      }
    }
    if (token.kind === 'delimiter' && ['(', '[', '{'].includes(token.text)) {
      append(frame, token);
      const named = token.text === '(' && previous?.kind === 'identifier' &&
        !previous.previewTruncated && scarpInsightIdentifier(previous.text);
      const declared = named && beforePrevious?.kind === 'identifier' && beforePrevious.text === 'funcra';
      const blocked = !!(named && beforePrevious && blocksLocalFunctionName(beforePrevious.text)) ||
        (!named && token.text === '(' && !!previous && blocksIndirectCall(previous.text));
      frames.push({
        close: token.text === '(' ? ')' : token.text === '[' ? ']' : '}',
        name: named ? previous!.text : null, args: [], current: null,
        invalid: false, blocked, header: !!declared || !!frame?.header,
      });
      if (frames.length > MAX_NESTING) return [];
    } else if (token.kind === 'delimiter' && [')', ']', '}'].includes(token.text)) {
      const closed = frames.pop();
      if (!closed || closed.close !== token.text) return [];
      emit(closed);
      append(frames.at(-1), token);
    } else if (token.kind === 'delimiter' && token.text === ',' && frame?.name) {
      finish(frame);
    } else {
      append(frame, token);
    }
    beforePrevious = previous;
    previous = token;
  }
  // Incomplete trailing call frames do not produce hints; completed nested
  // calls can still be independently useful. Sort for stable viewport slicing.
  return hints.sort((a, b) => a.offset - b.offset);
}

function isLiteralArgument(argument: Argument, source: string): boolean {
  if (argument.count === 1) {
    const token = argument.first;
    return token.kind === 'number' || token.kind === 'string' ||
      token.kind === 'identifier' && (token.text === 'true' || token.text === 'false');
  }
  if (argument.count === 2 && argument.first.kind === 'operator' &&
      (argument.first.text === '-' || argument.first.text === '+') &&
      argument.last.kind === 'number') {
    return /^[ \t]*$/.test(source.slice(argument.first.end, argument.last.start));
  }
  return false;
}


/** One linear pass for shadow candidates, rather than rescanning the lexical
 * inventory for every unknown function name. Any competing declaration,
 * including nested functions and typed parameters, suppresses the label.
 * This intentionally trades some hints for conservative correctness. */
export function collectParameterShadowIndex(lex: SourceLexResult): {
  functions: ReadonlyMap<string, number>;
  bindings: ReadonlySet<string>;
} {
  const functions = new Map<string, number>();
  const bindings = new Set<string>();
  let previous: InsightToken | undefined;
  let beforePrevious: InsightToken | undefined;
  const introducers = new Set(['bind', 'var', 'record', 'variant', 'as']);
  for (const token of lex.tokens) {
    if (token.kind === 'comment') continue;
    if (token.kind === 'identifier' && !token.previewTruncated && previous?.kind === 'identifier') {
      if (previous.text === 'funcra') functions.set(token.text, (functions.get(token.text) ?? 0) + 1);
      else if (introducers.has(previous.text)) bindings.add(token.text);
    }
    if (token.kind === 'operator' && token.text === ':' && previous?.kind === 'identifier' &&
        beforePrevious?.text !== '.') bindings.add(previous.text);
    beforePrevious = previous;
    previous = token;
  }
  return { functions, bindings };
}
