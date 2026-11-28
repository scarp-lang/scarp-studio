import { describe, expect, it } from 'vitest';
import {
  EMPTY_ARCHITECTURE_SNAPSHOT_STORE,
  MAX_ARCHITECTURE_SNAPSHOTS,
  MAX_SNAPSHOT_LABEL_UNITS,
  addArchitectureSnapshot,
  architectureFingerprint,
  architectureSnapshotDiffReport,
  architectureSnapshotReport,
  captureArchitectureSnapshot,
  clearArchitectureSnapshots,
  compareArchitectureSnapshots,
  removeArchitectureSnapshot,
  snapshotDiffSummary,
  snapshotSummary,
  stableArchitectureJson,
} from './workspaceArchitectureSnapshot';
import {
  ambiguousCallFixture,
  changedFixture,
  smallArchitectureFixture,
} from '../test/workspaceArchitectureFixtures';

describe('stable architecture snapshot serialization', () => {
  it('orders object keys recursively for deterministic fingerprints', () => {
    expect(stableArchitectureJson({ b: 2, a: 1 })).toBe(stableArchitectureJson({ a: 1, b: 2 }));
    expect(stableArchitectureJson({ z: { b: 2, a: 1 }, a: [3, { y: 2, x: 1 }] }))
      .toBe(stableArchitectureJson({ a: [3, { x: 1, y: 2 }], z: { a: 1, b: 2 } }));
  });

  it('preserves array order because architecture ordering is meaningful', () => {
    expect(stableArchitectureJson([1, 2, 3])).not.toBe(stableArchitectureJson([3, 2, 1]));
  });

  it('produces stable 64-bit hexadecimal fingerprints', () => {
    const first = architectureFingerprint({ a: 1, b: 'two' });
    const second = architectureFingerprint({ b: 'two', a: 1 });
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes fingerprints when a meaningful payload value changes', () => {
    expect(architectureFingerprint({ a: 1 })).not.toBe(architectureFingerprint({ a: 2 }));
    expect(architectureFingerprint(['a', 'b'])).not.toBe(architectureFingerprint(['a', 'c']));
  });

  it('does not claim cryptographic formatting or add a sha prefix', () => {
    const fingerprint = architectureFingerprint('source');
    expect(fingerprint).not.toContain('sha');
    expect(fingerprint).toHaveLength(16);
  });
});

describe('capturing architecture snapshots', () => {
  it('captures structural metadata without full source text', () => {
    const fixture = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(fixture.architecture, 'Baseline', 1000);

    expect(snapshot.label).toBe('Baseline');
    expect(snapshot.capturedAt).toBe(1000);
    expect(snapshot.generation).toBe(fixture.architecture.generation);
    expect(snapshot.modules).toHaveLength(fixture.architecture.modules.length);
    expect(snapshot.symbols).toHaveLength(fixture.architecture.symbols.length);
    expect(snapshot.calls).toHaveLength(fixture.architecture.callSites.length);
    expect(snapshot.imports).toHaveLength(fixture.architecture.importEdges.length);
    expect(JSON.stringify(snapshot)).not.toContain('missing_call();');
  });

  it('uses a safe default label when the supplied label is blank', () => {
    const { architecture } = smallArchitectureFixture();
    expect(captureArchitectureSnapshot(architecture, '   ', 1).label).toBe('Architecture snapshot');
  });

  it('bounds long labels and preserves valid UTF-16 at the boundary', () => {
    const { architecture } = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(architecture,
      'x'.repeat(MAX_SNAPSHOT_LABEL_UNITS - 2) + '🙂' + 'tail', 1);
    expect(snapshot.label.length).toBeLessThanOrEqual(MAX_SNAPSHOT_LABEL_UNITS);
    expect(snapshot.label.endsWith('…')).toBe(true);
    expect(snapshot.label).not.toMatch(/[\uD800-\uDBFF]…$/);
  });

  it('generates distinct IDs for distinct capture times even with the same graph and label', () => {
    const { architecture } = smallArchitectureFixture();
    const first = captureArchitectureSnapshot(architecture, 'Same', 1);
    const second = captureArchitectureSnapshot(architecture, 'Same', 2);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.id).not.toBe(second.id);
  });

  it('preserves architecture completeness and coverage reasons', () => {
    const fixture = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(fixture.architecture, 'Coverage', 1);
    expect(snapshot.complete).toBe(fixture.architecture.summary.complete);
    expect(snapshot.coverageReasons).toEqual(fixture.architecture.coverageReasons);
  });

  it('captures cycle and hotspot review metadata', () => {
    const { architecture } = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(architecture, 'Graph', 1);
    expect(snapshot.cycles.length).toBe(architecture.cycles.length);
    expect(snapshot.hotspots.length).toBe(architecture.hotspots.length);
    expect(snapshot.cycles.every(item => item.members.length > 0)).toBe(true);
    expect(snapshot.hotspots.every(item => item.score >= 0)).toBe(true);
  });
});

describe('architecture snapshot store', () => {
  it('starts with a frozen empty store', () => {
    expect(EMPTY_ARCHITECTURE_SNAPSHOT_STORE.snapshots).toEqual([]);
    expect(Object.isFrozen(EMPTY_ARCHITECTURE_SNAPSHOT_STORE)).toBe(true);
  });

  it('prepends new snapshots', () => {
    const { architecture } = smallArchitectureFixture();
    const one = captureArchitectureSnapshot(architecture, 'One', 1);
    const two = captureArchitectureSnapshot(architecture, 'Two', 2);
    const store = addArchitectureSnapshot(addArchitectureSnapshot(EMPTY_ARCHITECTURE_SNAPSHOT_STORE, one), two);
    expect(store.snapshots.map(item => item.label)).toEqual(['Two', 'One']);
  });

  it('returns the same store when the exact snapshot ID already exists', () => {
    const { architecture } = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(architecture, 'One', 1);
    const store = addArchitectureSnapshot(EMPTY_ARCHITECTURE_SNAPSHOT_STORE, snapshot);
    expect(addArchitectureSnapshot(store, snapshot)).toBe(store);
  });

  it('bounds retained session snapshots to the configured maximum', () => {
    const { architecture } = smallArchitectureFixture();
    let store = EMPTY_ARCHITECTURE_SNAPSHOT_STORE;
    for (let index = 0; index < MAX_ARCHITECTURE_SNAPSHOTS + 5; index++) {
      store = addArchitectureSnapshot(store, captureArchitectureSnapshot(architecture, 'S' + index, index + 1));
    }
    expect(store.snapshots).toHaveLength(MAX_ARCHITECTURE_SNAPSHOTS);
    expect(store.snapshots[0].label).toBe('S' + (MAX_ARCHITECTURE_SNAPSHOTS + 4));
  });

  it('removes only the selected snapshot', () => {
    const { architecture } = smallArchitectureFixture();
    const one = captureArchitectureSnapshot(architecture, 'One', 1);
    const two = captureArchitectureSnapshot(architecture, 'Two', 2);
    const store = addArchitectureSnapshot(addArchitectureSnapshot(EMPTY_ARCHITECTURE_SNAPSHOT_STORE, one), two);
    const next = removeArchitectureSnapshot(store, one.id);
    expect(next.snapshots.map(item => item.id)).toEqual([two.id]);
  });

  it('returns the same store when removing an unknown ID', () => {
    const { architecture } = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(architecture, 'One', 1);
    const store = addArchitectureSnapshot(EMPTY_ARCHITECTURE_SNAPSHOT_STORE, snapshot);
    expect(removeArchitectureSnapshot(store, 'missing')).toBe(store);
  });

  it('clears back to the shared empty store', () => {
    expect(clearArchitectureSnapshots()).toBe(EMPTY_ARCHITECTURE_SNAPSHOT_STORE);
  });
});

describe('architecture snapshot comparisons', () => {
  it('reports two captures of the same graph as identical', () => {
    const { architecture } = smallArchitectureFixture();
    const before = captureArchitectureSnapshot(architecture, 'Before', 1);
    const after = captureArchitectureSnapshot(architecture, 'After', 2);
    const diff = compareArchitectureSnapshots(before, after);

    expect(diff.identical).toBe(true);
    expect(diff.fingerprintChanged).toBe(false);
    expect(diff.items).toEqual([]);
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.changed).toBe(0);
  });

  it('detects a newly added declaration after an edited capture', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    const before = captureArchitectureSnapshot(beforeFixture.architecture, 'Before', 1);
    const after = captureArchitectureSnapshot(afterFixture.architecture, 'After', 2);
    const diff = compareArchitectureSnapshots(before, after);

    expect(diff.identical).toBe(false);
    expect(diff.fingerprintChanged).toBe(true);
    expect(diff.symbolDelta).toBeGreaterThanOrEqual(1);
    expect(diff.items.some(item => item.entity === 'symbol' && item.kind === 'added' && item.label === 'newly_added')).toBe(true);
  });

  it('detects changed module structural counts', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    const diff = compareArchitectureSnapshots(
      captureArchitectureSnapshot(beforeFixture.architecture, 'Before', 1),
      captureArchitectureSnapshot(afterFixture.architecture, 'After', 2),
    );
    expect(diff.items.some(item => item.entity === 'module' && item.kind === 'changed')).toBe(true);
  });

  it('classifies ambiguous call changes as high-priority review evidence', () => {
    const base = smallArchitectureFixture();
    const ambiguous = ambiguousCallFixture();
    const diff = compareArchitectureSnapshots(
      captureArchitectureSnapshot(base.architecture, 'Base', 1),
      captureArchitectureSnapshot(ambiguous.architecture, 'Ambiguous', 2),
    );
    expect(diff.highPriorityChanges).toBeGreaterThan(0);
  });

  it('reports signed entity deltas', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    const diff = compareArchitectureSnapshots(
      captureArchitectureSnapshot(beforeFixture.architecture, 'Before', 1),
      captureArchitectureSnapshot(afterFixture.architecture, 'After', 2),
    );
    expect(diff.moduleDelta).toBe(0);
    expect(diff.symbolDelta).toBeGreaterThan(0);
  });
});

describe('architecture snapshot summaries and reports', () => {
  it('summarizes snapshot counts and fingerprint', () => {
    const { architecture } = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(architecture, 'Baseline', 1);
    const summary = snapshotSummary(snapshot);
    expect(summary).toContain('Baseline');
    expect(summary).toContain(snapshot.fingerprint);
    expect(summary).toContain('modules');
    expect(summary).toContain('declarations');
  });

  it('uses a concise no-change summary for identical captures', () => {
    const { architecture } = smallArchitectureFixture();
    const before = captureArchitectureSnapshot(architecture, 'Before', 1);
    const after = captureArchitectureSnapshot(architecture, 'After', 2);
    expect(snapshotDiffSummary(compareArchitectureSnapshots(before, after))).toContain('No architecture changes');
  });

  it('includes added, removed, changed and high-priority counts in changed summaries', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    const summary = snapshotDiffSummary(compareArchitectureSnapshots(
      captureArchitectureSnapshot(beforeFixture.architecture, 'Before', 1),
      captureArchitectureSnapshot(afterFixture.architecture, 'After', 2),
    ));
    expect(summary).toContain('added');
    expect(summary).toContain('removed');
    expect(summary).toContain('changed');
    expect(summary).toContain('high-priority');
  });

  it('labels FNV fingerprinting as non-cryptographic in snapshot reports', () => {
    const fixture = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(fixture.architecture, 'Baseline', 1);
    const report = architectureSnapshotReport(fixture.architecture, snapshot);
    expect(report).toContain('non-cryptographic');
    expect(report).toContain(snapshot.fingerprint);
    expect(report).toContain('lexical observations only');
  });

  it('prints cycle observations in snapshot reports when cycles exist', () => {
    const fixture = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(fixture.architecture, 'Baseline', 1);
    const report = architectureSnapshotReport(fixture.architecture, snapshot);
    if (snapshot.cycles.length) expect(report).toContain('Cycle:');
  });

  it('prints before and after fingerprints plus diff items in comparison reports', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    const before = captureArchitectureSnapshot(beforeFixture.architecture, 'Before', 1);
    const after = captureArchitectureSnapshot(afterFixture.architecture, 'After', 2);
    const diff = compareArchitectureSnapshots(before, after);
    const report = architectureSnapshotDiffReport(diff, before, after);

    expect(report).toContain(before.fingerprint);
    expect(report).toContain(after.fingerprint);
    expect(report).toContain('Before:');
    expect(report).toContain('After:');
    expect(report).toContain('Summary:');
  });
});
