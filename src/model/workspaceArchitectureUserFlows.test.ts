import { describe, expect, it } from 'vitest';
import { architectureObservedLocationTarget } from './workspaceArchitecture';
import { searchWorkspaceArchitecture } from './workspaceArchitectureQuery';
import { analyzeWorkspaceImpact } from './workspaceImpact';
import { findArchitectureRoutes } from './workspaceArchitectureRoutes';
import { reviewWorkspaceArchitecture, filterArchitectureFindings } from './workspaceArchitectureReview';
import {
  addArchitectureSnapshot,
  captureArchitectureSnapshot,
  compareArchitectureSnapshots,
  EMPTY_ARCHITECTURE_SNAPSHOT_STORE,
} from './workspaceArchitectureSnapshot';
import { buildArchitectureReport, buildSelectedArchitectureReport } from './workspaceArchitectureReport';
import { calculateArchitectureMetrics, architectureModuleMetricFor } from './workspaceArchitectureMetrics';
import {
  ambiguousCallFixture,
  changedFixture,
  functionId,
  moduleId,
  smallArchitectureFixture,
} from '../test/workspaceArchitectureFixtures';

describe('workspace architecture review user flows', () => {
  it('searches a declaration, navigates it, then traces its observed impact', () => {
    const fixture = smallArchitectureFixture();
    const search = searchWorkspaceArchitecture(fixture.architecture, 'kind:symbol name:load file:service');
    const match = search.matches.find(item => item.item.symbolId !== null)!;
    expect(match).toBeDefined();

    const target = architectureObservedLocationTarget(fixture.architecture, fixture.documents, match.item.symbolId!);
    expect(target).not.toBeNull();
    expect(target?.documentId).toBe('service');

    const impact = analyzeWorkspaceImpact(fixture.architecture, match.item.symbolId!, {
      direction: 'both', edgeMode: 'calls', maxDepth: 4,
    });
    expect(impact).not.toBeNull();
    expect(impact?.rootLabel).toContain('load');
    expect((impact?.incomingCount ?? 0) + (impact?.outgoingCount ?? 0)).toBeGreaterThan(0);
  });

  it('starts from a review finding and preserves exact source evidence navigation', () => {
    const fixture = ambiguousCallFixture();
    const review = reviewWorkspaceArchitecture(fixture.architecture);
    const findings = filterArchitectureFindings(review, { rule: 'ambiguous-call' });
    expect(findings.length).toBeGreaterThan(0);
    const callTarget = findings[0].targets.find(item => item.kind === 'call-site')!;
    expect(callTarget).toBeDefined();
    const navigation = architectureObservedLocationTarget(fixture.architecture, fixture.documents, callTarget.id);
    expect(navigation).not.toBeNull();
    expect(navigation?.documentId).toBe('caller');
  });

  it('searches a module and traces a route to a connected module', () => {
    const fixture = smallArchitectureFixture();
    const modules = searchWorkspaceArchitecture(fixture.architecture, 'kind:module');
    const main = modules.matches.find(item => item.item.name === 'main.srp')!;
    const serviceId = moduleId(fixture.architecture, 'service');
    expect(main).toBeDefined();
    const route = findArchitectureRoutes(fixture.architecture, main.item.id, serviceId, {
      mode: 'combined', direction: 'directed', maxDepth: 4,
    });
    expect(['found', 'limited']).toContain(route.status);
    expect(route.paths.length).toBeGreaterThan(0);
  });

  it('uses module metrics to choose a higher-coupling review root', () => {
    const fixture = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(fixture.architecture);
    const ranked = metrics.modules[0];
    const root = architectureModuleMetricFor(metrics, ranked.moduleId)!;
    expect(root.score).toBe(ranked.score);
    const impact = analyzeWorkspaceImpact(fixture.architecture, root.moduleId, {
      direction: 'both', edgeMode: 'combined', maxDepth: 3,
    });
    expect(impact).not.toBeNull();
  });
});

describe('workspace architecture snapshot comparison user flows', () => {
  it('captures a baseline, captures edited architecture, and obtains a reviewable diff', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    let store = EMPTY_ARCHITECTURE_SNAPSHOT_STORE;
    const before = captureArchitectureSnapshot(beforeFixture.architecture, 'Before refactor', 1);
    store = addArchitectureSnapshot(store, before);
    const after = captureArchitectureSnapshot(afterFixture.architecture, 'After refactor', 2);
    store = addArchitectureSnapshot(store, after);

    expect(store.snapshots.map(item => item.label)).toEqual(['After refactor', 'Before refactor']);
    const diff = compareArchitectureSnapshots(before, after);
    expect(diff.identical).toBe(false);
    expect(diff.items.length).toBeGreaterThan(0);
    expect(diff.symbolDelta).toBeGreaterThan(0);
  });

  it('generates a selected report from entities called out by snapshot review', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    const before = captureArchitectureSnapshot(beforeFixture.architecture, 'Before', 1);
    const after = captureArchitectureSnapshot(afterFixture.architecture, 'After', 2);
    const diff = compareArchitectureSnapshots(before, after);
    const changedSymbolIds = diff.items.filter(item => item.entity === 'symbol').map(item => item.id);
    const report = buildSelectedArchitectureReport(afterFixture.architecture, { symbolIds: changedSymbolIds }, {
      format: 'markdown', sections: ['symbols'], includeIds: true,
    });
    expect(report.format).toBe('markdown');
    expect(report.text).toContain('newly_added');
  });

  it('produces a full report after a snapshot without mutating the session snapshot', () => {
    const fixture = smallArchitectureFixture();
    const snapshot = captureArchitectureSnapshot(fixture.architecture, 'Baseline', 1);
    const before = JSON.stringify(snapshot);
    const report = buildArchitectureReport(fixture.architecture, {
      format: 'json', sections: ['summary', 'modules', 'cycles', 'hotspots'],
    });
    expect(() => JSON.parse(report.text)).not.toThrow();
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});

describe('workspace architecture ambiguity review user flows', () => {
  it('moves from ambiguous query results to review findings without losing the candidate set', () => {
    const fixture = ambiguousCallFixture();
    const search = searchWorkspaceArchitecture(fixture.architecture, 'kind:call status:multiple-candidates');
    const review = reviewWorkspaceArchitecture(fixture.architecture);
    const findings = filterArchitectureFindings(review, { rule: 'ambiguous-call' });
    expect(search.matches.length).toBe(2);
    expect(findings.length).toBe(2);
    for (const match of search.matches) {
      const finding = findings.find(item => item.targets.some(target => target.id === match.item.id));
      expect(finding).toBeDefined();
      expect(finding?.targets.filter(target => target.kind === 'symbol')).toHaveLength(2);
    }
  });

  it('shows that ambiguous candidates affect impact confidence', () => {
    const fixture = ambiguousCallFixture();
    const root = functionId(fixture.architecture, 'main', 'caller');
    const impact = analyzeWorkspaceImpact(fixture.architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 2, includeAmbiguousCalls: true,
    })!;
    expect(impact.ambiguousPathCount).toBeGreaterThan(0);
    expect(impact.confidence).not.toBe('high-observation');
  });

  it('lets a reviewer rerun the same impact surface with ambiguous candidates excluded', () => {
    const fixture = ambiguousCallFixture();
    const root = functionId(fixture.architecture, 'main', 'caller');
    const included = analyzeWorkspaceImpact(fixture.architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 2, includeAmbiguousCalls: true,
    })!;
    const excluded = analyzeWorkspaceImpact(fixture.architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 2, includeAmbiguousCalls: false,
    })!;
    expect(included.nodes.length).toBeGreaterThan(excluded.nodes.length);
    expect(excluded.boundaries.some(item => item.reason === 'ambiguous-call-excluded')).toBe(true);
  });
});

describe('workspace architecture stale UI workflow protection', () => {
  it('lets old search results exist but rejects their source navigation after an edit', () => {
    const fixture = smallArchitectureFixture();
    const search = searchWorkspaceArchitecture(fixture.architecture, 'name:load kind:symbol');
    const symbolId = search.matches.find(item => item.item.symbolId)?.item.symbolId!;
    const changed = fixture.documents.map(document => document.id === 'service'
      ? { ...document, revision: document.revision + 1, content: document.content.replace('load', 'load_next') }
      : document);
    expect(architectureObservedLocationTarget(fixture.architecture, changed, symbolId)).toBeNull();
  });

  it('keeps old snapshot comparison valid even after live buffers change because snapshots are structural copies', () => {
    const fixture = smallArchitectureFixture();
    const before = captureArchitectureSnapshot(fixture.architecture, 'Before', 1);
    const afterFixture = changedFixture(fixture);
    const after = captureArchitectureSnapshot(afterFixture.architecture, 'After', 2);
    const diff = compareArchitectureSnapshots(before, after);
    expect(diff.beforeId).toBe(before.id);
    expect(diff.afterId).toBe(after.id);
    expect(diff.fingerprintChanged).toBe(true);
  });
});
