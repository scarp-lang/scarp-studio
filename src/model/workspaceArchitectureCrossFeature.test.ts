import { describe, expect, it } from 'vitest';
import { architectureObservedLocationTarget } from './workspaceArchitecture';
import { searchWorkspaceArchitecture } from './workspaceArchitectureQuery';
import { analyzeWorkspaceImpact } from './workspaceImpact';
import { calculateArchitectureMetrics } from './workspaceArchitectureMetrics';
import { buildArchitectureReport } from './workspaceArchitectureReport';
import { reviewWorkspaceArchitecture } from './workspaceArchitectureReview';
import { findArchitectureRoutes } from './workspaceArchitectureRoutes';
import {
  architectureSnapshotDiffReport,
  captureArchitectureSnapshot,
  compareArchitectureSnapshots,
} from './workspaceArchitectureSnapshot';
import {
  ambiguousCallFixture,
  changedFixture,
  functionId,
  moduleId,
  smallArchitectureFixture,
} from '../test/workspaceArchitectureFixtures';

describe('workspace architecture cross-feature consistency', () => {
  it('keeps aggregate module and function counts consistent across metrics, review and reports', () => {
    const fixture = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(fixture.architecture);
    const review = reviewWorkspaceArchitecture(fixture.architecture);
    const report = buildArchitectureReport(fixture.architecture, {
      format: 'json', sections: ['summary', 'modules', 'symbols'], maxRows: 1000,
    });
    const parsed = JSON.parse(report.text) as { modules?: Array<Record<string, unknown>>; symbols?: Array<Record<string, unknown>> };
    expect(metrics.modules).toHaveLength(fixture.architecture.modules.length);
    expect(metrics.symbols).toHaveLength(fixture.architecture.symbols.filter(item => item.kind === 'function').length);
    expect(review.summary.total).toBe(review.findings.length);
    expect(parsed.modules).toHaveLength(fixture.architecture.modules.length);
    expect(parsed.symbols).toHaveLength(fixture.architecture.symbols.length);
  });

  it('keeps search identity stable enough to feed routes and impact without translating IDs', () => {
    const fixture = smallArchitectureFixture();
    const main = searchWorkspaceArchitecture(fixture.architecture, 'kind:symbol name:main').matches
      .find(match => match.item.symbolId !== null)!;
    const load = searchWorkspaceArchitecture(fixture.architecture, 'kind:symbol name:load').matches
      .find(match => match.item.symbolId !== null)!;
    expect(main.item.symbolId).not.toBeNull();
    expect(load.item.symbolId).not.toBeNull();
    const route = findArchitectureRoutes(fixture.architecture, main.item.symbolId!, load.item.symbolId!, {
      mode: 'calls', maxDepth: 4,
    });
    const impact = analyzeWorkspaceImpact(fixture.architecture, main.item.symbolId!, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 4,
    });
    expect(route.paths.length).toBeGreaterThan(0);
    expect(impact?.rootId).toBe(main.item.symbolId);
    expect(impact?.nodes.some(node => node.id === load.item.symbolId)).toBe(true);
  });

  it('keeps module query IDs compatible with import routes and module impact', () => {
    const fixture = smallArchitectureFixture();
    const main = searchWorkspaceArchitecture(fixture.architecture, 'kind:module name:main').matches[0];
    const service = searchWorkspaceArchitecture(fixture.architecture, 'kind:module name:service').matches[0];
    expect(main.item.id).toBe(moduleId(fixture.architecture, 'main'));
    expect(service.item.id).toBe(moduleId(fixture.architecture, 'service'));
    const route = findArchitectureRoutes(fixture.architecture, main.item.id, service.item.id, {
      mode: 'imports', direction: 'directed', maxDepth: 2,
    });
    const impact = analyzeWorkspaceImpact(fixture.architecture, main.item.id, {
      direction: 'outgoing', edgeMode: 'imports', maxDepth: 2,
    });
    expect(route.shortestDepth).toBe(1);
    expect(impact?.nodes.some(node => node.id === service.item.id)).toBe(true);
  });

  it('does not let an old search result navigate after its exact source generation changes', () => {
    const fixture = smallArchitectureFixture();
    const hit = searchWorkspaceArchitecture(fixture.architecture, 'kind:symbol name:normalize').matches
      .find(match => match.item.symbolId !== null)!;
    const current = architectureObservedLocationTarget(fixture.architecture, fixture.documents, hit.item.symbolId!);
    expect(current?.documentId).toBe('util');
    const edited = fixture.documents.map(document => document.id === 'util'
      ? { ...document, revision: document.revision + 1, content: document.content + '// edit\n' }
      : document);
    expect(architectureObservedLocationTarget(fixture.architecture, edited, hit.item.symbolId!)).toBeNull();
  });

  it('preserves ambiguity warnings across search, routes, impact and review', () => {
    const fixture = ambiguousCallFixture();
    const calls = searchWorkspaceArchitecture(fixture.architecture, 'kind:call status:multiple-candidates');
    const root = functionId(fixture.architecture, 'main', 'caller');
    const target = functionId(fixture.architecture, 'calculate', 'one');
    const route = findArchitectureRoutes(fixture.architecture, root, target, {
      mode: 'calls', includeAmbiguousCalls: true,
    });
    const impact = analyzeWorkspaceImpact(fixture.architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', includeAmbiguousCalls: true, maxDepth: 2,
    });
    const review = reviewWorkspaceArchitecture(fixture.architecture);
    expect(calls.matches.length).toBe(2);
    expect(route.paths.some(path => path.ambiguous)).toBe(true);
    expect(impact?.ambiguousPathCount).toBeGreaterThan(0);
    expect(review.findings.some(finding => finding.rule === 'ambiguous-call')).toBe(true);
  });

  it('removing ambiguous edges consistently narrows both routes and impact reachability', () => {
    const fixture = ambiguousCallFixture();
    const root = functionId(fixture.architecture, 'main', 'caller');
    const target = functionId(fixture.architecture, 'calculate', 'one');
    const route = findArchitectureRoutes(fixture.architecture, root, target, {
      mode: 'calls', includeAmbiguousCalls: false,
    });
    const impact = analyzeWorkspaceImpact(fixture.architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', includeAmbiguousCalls: false, maxDepth: 2,
    });
    expect(route.paths).toEqual([]);
    expect(impact?.nodes.some(node => node.id === target)).toBe(false);
    expect(impact?.boundaries.some(boundary => boundary.reason === 'ambiguous-call-excluded')).toBe(true);
  });

  it('snapshot diffs and full reports both expose a newly added function after an edit', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    const before = captureArchitectureSnapshot(beforeFixture.architecture, 'Before', 1);
    const after = captureArchitectureSnapshot(afterFixture.architecture, 'After', 2);
    const diff = compareArchitectureSnapshots(before, after);
    const diffReport = architectureSnapshotDiffReport(diff, before, after);
    const architectureReport = buildArchitectureReport(afterFixture.architecture, {
      format: 'markdown', sections: ['summary', 'symbols'], maxRows: 1000,
    });
    expect(diff.items.some(item => item.entity === 'symbol' && item.label === 'newly_added')).toBe(true);
    expect(diffReport).toContain('newly_added');
    expect(architectureReport.text).toContain('newly_added');
  });

  it('structural reporting never needs native path disclosure for normal review', () => {
    const fixture = smallArchitectureFixture();
    const report = buildArchitectureReport(fixture.architecture, {
      format: 'markdown', sections: ['modules', 'symbols', 'call-sites', 'call-edges', 'imports'], includePaths: false,
    });
    expect(report.text).not.toContain('C:\\work\\');
    expect(report.warning).toBeNull();
  });

  it('path disclosure remains an explicit report option and does not mutate architecture data', () => {
    const fixture = smallArchitectureFixture();
    const before = JSON.stringify(fixture.architecture);
    const withoutPaths = buildArchitectureReport(fixture.architecture, {
      format: 'text', sections: ['modules'], includePaths: false,
    });
    const withPaths = buildArchitectureReport(fixture.architecture, {
      format: 'text', sections: ['modules'], includePaths: true,
    });
    expect(withoutPaths.text).not.toContain('C:\\work\\');
    expect(withPaths.text).toContain('C:\\work\\');
    expect(JSON.stringify(fixture.architecture)).toBe(before);
  });

  it('the active module can be independently selected as a route and impact root', () => {
    const fixture = smallArchitectureFixture();
    const active = fixture.architecture.modules.find(module => module.documentId === fixture.architecture.symbolIndex.activeId)!;
    expect(active.documentId).toBe('main');
    const impact = analyzeWorkspaceImpact(fixture.architecture, active.id, {
      direction: 'both', edgeMode: 'combined', maxDepth: 3,
    });
    const service = moduleId(fixture.architecture, 'service');
    const route = findArchitectureRoutes(fixture.architecture, active.id, service, {
      mode: 'combined', maxDepth: 3,
    });
    expect(impact?.rootId).toBe(active.id);
    expect(route.paths.length).toBeGreaterThan(0);
  });

  it('all IDs emitted by reports still map back to the same architecture generation when IDs are requested', () => {
    const fixture = smallArchitectureFixture();
    const report = buildArchitectureReport(fixture.architecture, {
      format: 'json', sections: ['modules', 'symbols'], includeIds: true, maxRows: 1000,
    });
    const parsed = JSON.parse(report.text) as { modules?: Array<Record<string, unknown>>; symbols?: Array<Record<string, unknown>> };
    const rows = [...(parsed.modules ?? []), ...(parsed.symbols ?? [])];
    const ids = rows.map(row => row.id).filter((id): id is string => typeof id === 'string');
    const known = new Set([
      ...fixture.architecture.modules.map(item => item.id),
      ...fixture.architecture.symbols.map(item => item.id),
    ]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(id => known.has(id))).toBe(true);
  });
});
