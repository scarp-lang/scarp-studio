import { describe, expect, it } from 'vitest';
import { DEFAULT_INTELLISENSE_PREFERENCES as defaults } from '../model/intelliSensePreferences';
import {
  diagnosticReportIsCurrent, effectiveIntelliSenseBudget, inspectIntelliSenseDocument, intelliSenseAvailability,
} from './intelliSenseDiagnostics';

const source = 'funcra add(a: integer) -> integer {}\\nadd(1);'.replace('\\n', '\n');
const doc = { id: 'local-only-id', revision: 1, units: source.length };
function state(label: string, p = defaults, document: typeof doc | null = doc) {
  return intelliSenseAvailability(p, document).find(item => item.label === label)?.state;
}
describe('IntelliSense metadata-only availability', () => {
  it('distinguishes disabled, manual, no-document and size-limited features', () => {
    expect(state('Catalog completion')).toBe('available');
    expect(state('Inline local labels')).toBe('disabled');
    expect(state('Current-document words')).toBe('disabled');
    expect(state('Catalog completion', { ...defaults, completionMode: 'manual' })).toBe('manual');
    expect(state('Go to Definition', defaults, null)).toBe('no-document');
    const big = { ...doc, units: 65537 };
    expect(state('Local function completion', { ...defaults, localAnalysisKiB: 64 }, big)).toBe('size-limited');
    expect(state('Catalog completion', { ...defaults, localAnalysisKiB: 64 }, big)).toBe('available');
    expect(state('Inline built-in labels', { ...defaults, inlayHintMode: 'all', inlayBuiltins: false })).toBe('disabled');
    expect(state('Local parameter popup', { ...defaults, signatureHelp: false })).toBe('disabled');
  });
  it('uses the same configured size threshold as local providers', () => {
    expect(effectiveIntelliSenseBudget(64)).toBe(65536);
    expect(effectiveIntelliSenseBudget(512)).toBe(524288);
    expect(state('Go to Definition', { ...defaults, localAnalysisKiB: 64 }, { ...doc, units: 65536 })).toBe('available');
  });
});
describe('explicit aggregate-only source inspection', () => {
  it('reports bounded lexical counts without exposing source names or contents', () => {
    const report = inspectIntelliSenseDocument(source, 64);
    expect(report).toMatchObject({ status: 'eligible', sourceUnits: source.length, budgetUnits: 65536, lines: 2, issues: 0, declarations: 1 });
    expect(JSON.stringify(report)).not.toContain('add');
    expect(JSON.stringify(report)).not.toContain(doc.id);
  });
  it('does not scan oversized source and distinguishes lexical and structural limits', () => {
    expect(inspectIntelliSenseDocument('x'.repeat(65537), 64)).toMatchObject({ status: 'oversized', tokens: null, issues: null, lines: null, declarations: null });
    expect(inspectIntelliSenseDocument('x;'.repeat(13000), 64)).toMatchObject({ status: 'token-limit', declarations: null });
    expect(inspectIntelliSenseDocument('"unterminated', 64)).toMatchObject({ status: 'lexical-issues', declarations: null });
    expect(inspectIntelliSenseDocument('funcra add() {} ]', 64)).toMatchObject({ status: 'unsupported-structure', declarations: null });
  });
  it('does not reuse reports across edit/undo revisions, document changes or budget changes', () => {
    const report = inspectIntelliSenseDocument(source, 64);
    expect(diagnosticReportIsCurrent(doc, report, doc, 64)).toBe(true);
    expect(diagnosticReportIsCurrent(doc, report, { ...doc, revision: 2 }, 64)).toBe(false);
    expect(diagnosticReportIsCurrent(doc, report, { ...doc, id: 'other' }, 64)).toBe(false);
    expect(diagnosticReportIsCurrent(doc, report, { ...doc, units: doc.units + 1 }, 64)).toBe(false);
    expect(diagnosticReportIsCurrent(doc, report, doc, 256)).toBe(false);
    expect(diagnosticReportIsCurrent(doc, report, null, 64)).toBe(false);
  });
});
