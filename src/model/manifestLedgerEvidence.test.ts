import { describe, expect, it } from 'vitest';
import type { ManifestFile } from './projectSourceManifest';
import type { LedgerComparison, LedgerComparisonRow, LedgerComparisonState } from './manifestLedgerComparison';
import { LEDGER_COMPARISON_STATES } from './manifestLedgerComparison';
import {
  analyzeLedgerEvidence, DEFAULT_EVIDENCE_FILTER, evidenceAnalysisText,
  evidenceCoverage, filterEvidenceGroups,
} from './manifestLedgerEvidence';

function row(
  label: string,
  batch: number,
  state: LedgerComparisonState,
  byteDelta: number | null = null,
  lineDelta: number | null = null,
  retainedHash = false,
): LedgerComparisonRow {
  const file: ManifestFile | null = retainedHash ? {
    name: label, state: 'hashed', origin: 'disk', bytes: 1,
    digest: 'a'.repeat(64), metrics: null, dirty: false,
  } : null;
  return {
    label, batch, state, byteDelta, lineDelta,
    previous: { label, batch, file, sequence: file ? 1 : null },
    current: { label, batch, file, sequence: file ? 1 : null },
  };
}

function comparison(rows: LedgerComparisonRow[]): LedgerComparison {
  const counts = Object.fromEntries(LEDGER_COMPARISON_STATES.map(state =>
    [state, rows.filter(item => item.state === state).length],
  )) as Record<LedgerComparisonState, number>;
  return {
    baselineSequence: 1, currentSequence: 3, rows, counts,
    refreshedBatches: new Set(rows.filter(item => item.state !== 'retained').map(item => item.batch)).size,
    comparableRows: counts.changed + counts.unchanged,
    selected: rows.length,
  };
}

const fixture = () => comparison([
  row('main.srp', 1, 'changed', 10, 2),
  row('src/a.srp', 1, 'changed', -10, -2),
  row('src/b.srp', 1, 'unchanged', 0, 0),
  row('src/nested/c.srp', 2, 'newly-hashed'),
  row('src/nested/d.srp', 2, 'retained', null, null, true),
  row('src/nested/e.srp', 2, 'origin-changed'),
  row('tests/a.srp', 3, 'retained'),
  row('tests/b.srp', 3, 'retained'),
]);

describe('manifest ledger evidence analysis', () => {
  it('partitions sources into nonoverlapping direct folders, including root', () => {
    const result = analyzeLedgerEvidence(fixture(), 'folder');
    expect(result.groups.map(group => [group.label, group.selected])).toEqual([
      ['(project root)', 1], ['src', 2], ['src/nested', 3], ['tests', 2],
    ]);
    expect(result.groups.reduce((sum, group) => sum + group.selected, 0)).toBe(8);
    expect(result.total.selected).toBe(8);
  });

  it('groups the same evidence by exact numbered batch', () => {
    const result = analyzeLedgerEvidence(fixture(), 'batch');
    expect(result.groups.map(group => [group.label, group.selected])).toEqual([
      ['Batch 1', 3], ['Batch 2', 3], ['Batch 3', 2],
    ]);
    expect(result.groups[0].comparable).toBe(3);
    expect(result.groups[1].refreshed).toBe(2);
    expect(result.groups[2].refreshed).toBe(0);
  });

  it('preserves opposing movements instead of presenting net zero as no change', () => {
    const result = analyzeLedgerEvidence(fixture(), 'folder');
    expect(result.total.bytes).toEqual({
      measured: 3, increased: 1, decreased: 1, stable: 1, net: 0, movement: 20,
    });
    expect(result.total.lines).toEqual({
      measured: 3, increased: 1, decreased: 1, stable: 1, net: 0, movement: 4,
    });
    expect(result.total.changed).toBe(2);
  });

  it('distinguishes retained digest evidence from retained unobserved files', () => {
    const result = analyzeLedgerEvidence(fixture(), 'folder');
    expect(result.total.retained).toBe(3);
    expect(result.total.retainedWithoutDigest).toBe(2);
    expect(result.total.refreshed).toBe(5);
    expect(result.total.comparable).toBe(3);
    expect(result.total.incomplete).toBe(5);
  });

  it('does not turn unavailable deltas or noncomparable states into measurements', () => {
    const result = analyzeLedgerEvidence(comparison([
      row('a.srp', 1, 'changed', 1, null),
      row('b.srp', 1, 'origin-changed', 99, 99),
      row('c.srp', 1, 'inconsistent', 99, 99),
      row('d.srp', 1, 'changed', Number.NaN, Number.POSITIVE_INFINITY),
    ]), 'folder');
    expect(result.total.comparable).toBe(2);
    expect(result.total.bytes.measured).toBe(1);
    expect(result.total.bytes.net).toBe(1);
    expect(result.total.lines.measured).toBe(0);
    expect(evidenceAnalysisText(result)).toContain('editor lines: no measurements');
  });

  it('classifies complete, partial and unrefreshed groups by fresh digest coverage', () => {
    const result = analyzeLedgerEvidence(fixture(), 'batch');
    expect(result.groups.map(evidenceCoverage)).toEqual(['complete', 'partial', 'unobserved']);
    expect(filterEvidenceGroups(result, { ...DEFAULT_EVIDENCE_FILTER, coverage: 'partial' })
      .map(group => group.label)).toEqual(['Batch 2']);
    expect(filterEvidenceGroups(result, { ...DEFAULT_EVIDENCE_FILTER, coverage: 'unobserved' })
      .map(group => group.label)).toEqual(['Batch 3']);
  });

  it('filters by case-insensitive label, changed flag and explicit sort order', () => {
    const result = analyzeLedgerEvidence(fixture(), 'folder');
    expect(filterEvidenceGroups(result, { ...DEFAULT_EVIDENCE_FILTER, query: 'SRC' })
      .map(group => group.label)).toEqual(['src', 'src/nested']);
    expect(filterEvidenceGroups(result, { ...DEFAULT_EVIDENCE_FILTER, changedOnly: true }))
      .toHaveLength(2);
    expect(filterEvidenceGroups(result, { ...DEFAULT_EVIDENCE_FILTER, order: 'incomplete' })[0].label)
      .toBe('src/nested');
    expect(filterEvidenceGroups(result, { ...DEFAULT_EVIDENCE_FILTER, query: '\u0000' })).toEqual([]);
    expect(filterEvidenceGroups(result, { ...DEFAULT_EVIDENCE_FILTER, query: 'x'.repeat(121) })).toEqual([]);
  });

  it('keeps aggregate export private by default and never includes per-file digests', () => {
    const result = analyzeLedgerEvidence(fixture(), 'folder');
    const privateText = evidenceAnalysisText(result);
    expect(privateText).not.toContain('src/nested');
    expect(privateText).not.toContain('main.srp');
    expect(privateText).not.toContain('a'.repeat(64));
    expect(privateText).toContain('NOT atomic snapshots or Git line contributions');
    const detailed = evidenceAnalysisText(result, true);
    expect(detailed).toContain('src/nested');
    expect(detailed).not.toContain('src/nested/c.srp');
    expect(detailed).not.toContain('a'.repeat(64));
  });

  it('maintains all state counts when switching grouping modes', () => {
    const input = fixture();
    for (const grouping of ['folder', 'batch'] as const) {
      const result = analyzeLedgerEvidence(input, grouping);
      for (const state of LEDGER_COMPARISON_STATES) {
        expect(result.total.counts[state]).toBe(input.counts[state]);
        expect(result.groups.reduce((sum, group) => sum + group.counts[state], 0))
          .toBe(input.counts[state]);
      }
      expect(Object.isFrozen(result.total.bytes)).toBe(true);
      expect(Object.isFrozen(result.groups)).toBe(true);
    }
  });

  it('handles an empty comparison without inventing complete coverage', () => {
    const result = analyzeLedgerEvidence(comparison([]), 'folder');
    expect(result.groups).toEqual([]);
    expect(result.total.selected).toBe(0);
    expect(evidenceCoverage(result.total)).toBe('unobserved');
    expect(evidenceAnalysisText(result)).toContain('bytes: no measurements');
  });
});
