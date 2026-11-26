import { MAX_ASSIST_SCAN_UNITS } from './assist';
import { indexLocalFunctionHeaders, MAX_DEFINITION_SOURCE_UNITS } from './definition';
import { scanScarpSource, MAX_INSIGHT_TOKENS } from './sourceLex';
import { MAX_PARAMETER_INLAYS } from './parameterInlays';
import type { IntelliSensePreferences } from '../model/intelliSensePreferences';

export interface DiagnosticDocument { id: string; revision: number; units: number }
export interface IntelliSenseDocumentReport {
  status: 'eligible' | 'oversized' | 'token-limit' | 'lexical-issues' | 'unsupported-structure';
  sourceUnits: number;
  budgetUnits: number;
  tokens: number | null;
  issues: number | null;
  lines: number | null;
  declarations: number | null;
}
export interface AssistanceAvailability {
  label: string;
  state: 'available' | 'manual' | 'disabled' | 'no-document' | 'size-limited';
  detail: string;
}

export function effectiveIntelliSenseBudget(ki: IntelliSensePreferences['localAnalysisKiB']): number {
  return Math.min(ki * 1024, MAX_DEFINITION_SOURCE_UNITS);
}
/** A metadata-only eligibility report; it makes no assertion that the current
 * source context, lexer, scope or installed compiler can resolve a symbol. */
export function intelliSenseAvailability(p: Readonly<IntelliSensePreferences>,
  document: DiagnosticDocument | null): AssistanceAvailability[] {
  const tooLarge = document !== null && document.units > effectiveIntelliSenseBudget(p.localAnalysisKiB);
  function feature(label: string, enabled: boolean, bounded: boolean, detail: string,
    manual = false): AssistanceAvailability {
    if (!enabled) return { label, state: 'disabled', detail: 'Disabled by current preferences.' };
    if (!document) return { label, state: 'no-document', detail: 'Open or create a Scarp source to use this feature.' };
    if (bounded && tooLarge) return { label, state: 'size-limited', detail: 'The active source exceeds the local analysis budget.' };
    return { label, state: manual ? 'manual' : 'available', detail };
  }
  const completion = p.completionMode !== 'off';
  const manual = p.completionMode === 'manual';
  return [
    feature('Catalog completion', completion && (p.templates || p.builtins || p.keywordsAndTypes), false,
      'Requires a supported code position and a matching enabled entry.', manual),
    feature('Local function completion', completion && p.localFunctions, true,
      'Requires a bounded, unambiguous same-file declaration and matching prefix.', manual),
    feature('Current-document words', completion && p.documentWords, false,
      'Monaco word suggestions; not compiler symbol resolution.', manual),
    feature('Catalog hover', p.hover, false, 'Requires a recognized token in a supported code position.'),
    feature('Local function hover', p.hover && p.localFunctionHover, true,
      'Requires an unambiguous supported local call.'),
    feature('Local parameter popup', p.signatureHelp, true, 'Requires a supported local call at the caret.'),
    feature('Built-in parameter popup', p.signatureHelp && p.builtinSignatureHelp, true,
      'Requires a known unqualified call without competing declarations.'),
    feature('Inline local labels', p.inlayHintMode !== 'off', true, 'Requires a complete fixed-arity call.'),
    feature('Inline built-in labels', p.inlayHintMode !== 'off' && p.inlayBuiltins, true,
      'Requires a supported fixed-arity catalog call without competing declarations.'),
    feature('Go to Definition', p.goToDefinition, true, 'Requires a unique supported same-file declaration.'),
    feature('Monaco document symbols', p.documentSymbols, true, 'Returns bounded editor-only symbols; sidebar outline is independent.'),
  ];
}
export const INTELLISENSE_DIAGNOSTIC_LIMITS = Object.freeze({
  lineUnits: MAX_ASSIST_SCAN_UNITS,
  tokens: MAX_INSIGHT_TOKENS,
  inlineLabels: MAX_PARAMETER_INLAYS,
});

/** Explicit local inspection. Source never leaves this function; returned
 * metadata contains no source excerpts, names, paths, compiler information,
 * or diagnostic messages that could reveal user code. */
export function inspectIntelliSenseDocument(source: string,
  ki: IntelliSensePreferences['localAnalysisKiB']): IntelliSenseDocumentReport {
  const budgetUnits = effectiveIntelliSenseBudget(ki);
  const base = { sourceUnits: source.length, budgetUnits };
  if (source.length > budgetUnits) return {
    ...base, status: 'oversized', tokens: null, issues: null, lines: null, declarations: null,
  };
  const lex = scanScarpSource(source);
  const counts = { ...base, tokens: lex.tokens.length, issues: lex.issues.length, lines: lex.lines };
  if (!lex.complete) return { ...counts, status: 'token-limit', declarations: null };
  if (lex.issues.length) return { ...counts, status: 'lexical-issues', declarations: null };
  const headers = indexLocalFunctionHeaders(source, () => lex);
  if (!headers) return { ...counts, status: 'unsupported-structure', declarations: null };
  return { ...counts, status: 'eligible', declarations: headers.length };
}
export function diagnosticReportIsCurrent(snapshot: DiagnosticDocument, report: IntelliSenseDocumentReport,
  current: DiagnosticDocument | null, ki: IntelliSensePreferences['localAnalysisKiB']): boolean {
  return current !== null && snapshot.id === current.id && snapshot.revision === current.revision &&
    snapshot.units === current.units && report.sourceUnits === current.units &&
    report.budgetUnits === effectiveIntelliSenseBudget(ki);
}
