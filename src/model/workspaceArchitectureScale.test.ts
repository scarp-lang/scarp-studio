import { describe, expect, it } from 'vitest';
import {
  MAX_ARCHITECTURE_MODULES,
  MAX_ARCHITECTURE_NEIGHBORS,
  buildWorkspaceArchitecture,
  architectureDirectNeighbors,
} from './workspaceArchitecture';
import { searchWorkspaceArchitecture, MAX_ARCHITECTURE_QUERY_RESULTS } from './workspaceArchitectureQuery';
import { reviewWorkspaceArchitecture, MAX_ARCHITECTURE_FINDINGS } from './workspaceArchitectureReview';
import { calculateArchitectureMetrics } from './workspaceArchitectureMetrics';
import { findArchitectureRoutes, MAX_ROUTE_EXPANSIONS, MAX_ROUTE_PATHS } from './workspaceArchitectureRoutes';
import { buildArchitectureReport, MAX_ARCHITECTURE_REPORT_ROWS } from './workspaceArchitectureReport';
import { captureArchitectureSnapshot, MAX_SNAPSHOT_MODULES, MAX_SNAPSHOT_SYMBOLS } from './workspaceArchitectureSnapshot';
import { analyzeWorkspaceImpact, MAX_IMPACT_RESULTS } from './workspaceImpact';
import { listed, studioDocument } from '../test/workspaceArchitectureFixtures';

function generatedWorkspace(moduleCount: number, functionsPerModule: number) {
  const count = Math.max(1, Math.min(MAX_ARCHITECTURE_MODULES + 8, moduleCount));
  const functions = Math.max(1, Math.min(40, functionsPerModule));
  const documents = Array.from({ length: count }, (_, moduleIndex) => {
    const nextModule = moduleIndex + 1 < count ? moduleIndex + 1 : null;
    const lines: string[] = [];
    if (nextModule !== null) lines.push('import "m' + nextModule + '.srp" as next;');
    for (let functionIndex = 0; functionIndex < functions; functionIndex++) {
      const name = 'f_' + moduleIndex + '_' + functionIndex;
      const next = functionIndex + 1 < functions
        ? 'f_' + moduleIndex + '_' + (functionIndex + 1)
        : nextModule !== null ? 'f_' + nextModule + '_0' : null;
      lines.push('funcra ' + name + '() {');
      if (next) lines.push('  ' + next + '();');
      lines.push('}');
    }
    const name = 'm' + moduleIndex + '.srp';
    return studioDocument('m-' + moduleIndex, name, 'C:\\scale\\' + name, lines.join('\n') + '\n');
  });
  const listing = documents.map(document => listed(document.name, document.path!));
  return { documents, listing };
}

describe('workspace architecture bounded scale behavior', () => {
  it('caps module capture and marks incomplete coverage when too many buffers are supplied', () => {
    const fixture = generatedWorkspace(MAX_ARCHITECTURE_MODULES + 6, 1);
    const architecture = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    expect(architecture.modules).toHaveLength(MAX_ARCHITECTURE_MODULES);
    expect(architecture.coverageReasons).toContain('module-limit');
    expect(architecture.summary.complete).toBe(false);
  });

  it('keeps every module neighbor projection within its hard bound', () => {
    const fixture = generatedWorkspace(80, 3);
    const architecture = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    for (const module of architecture.modules) {
      const neighbors = architectureDirectNeighbors(architecture, module.id);
      expect(neighbors.incoming.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_NEIGHBORS);
      expect(neighbors.outgoing.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_NEIGHBORS);
    }
  });

  it('keeps architecture search result materialization bounded on a large graph', () => {
    const fixture = generatedWorkspace(70, 8);
    const architecture = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    const result = searchWorkspaceArchitecture(architecture, '');
    expect(result.matches.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_QUERY_RESULTS);
    expect(result.totalMatches).toBeGreaterThanOrEqual(result.matches.length);
  });

  it('keeps review findings bounded when many rules can match', () => {
    const fixture = generatedWorkspace(60, 10);
    const architecture = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    const review = reviewWorkspaceArchitecture(architecture, {
      fanInWarning: 2,
      fanOutWarning: 2,
      moduleSymbolWarning: 8,
      entrypointWarning: 2,
    });
    expect(review.findings.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_FINDINGS);
  });

  it('keeps impact traversal materialization bounded', () => {
    const fixture = generatedWorkspace(50, 8);
    const architecture = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    const root = architecture.symbols.find(item => item.name === 'f_0_0')!;
    const review = analyzeWorkspaceImpact(architecture, root.id, { direction: 'outgoing', edgeMode: 'calls', maxDepth: 12 })!;
    expect(review.nodes.length).toBeLessThanOrEqual(MAX_IMPACT_RESULTS);
    expect(review.boundaries.length).toBeLessThanOrEqual(MAX_IMPACT_RESULTS);
  });

  it('keeps route expansion and alternate path surfaces bounded', () => {
    const fixture = generatedWorkspace(45, 6);
    const architecture = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    const from = architecture.symbols.find(item => item.name === 'f_0_0')!;
    const to = architecture.symbols.find(item => item.name === 'f_10_0')!;
    const route = findArchitectureRoutes(architecture, from.id, to.id, { mode: 'calls', maxDepth: 12 });
    expect(route.expansions).toBeLessThanOrEqual(MAX_ROUTE_EXPANSIONS + 1);
    expect(route.paths.length).toBeLessThanOrEqual(MAX_ROUTE_PATHS);
  });

  it('keeps reports within the chosen row budget', () => {
    const fixture = generatedWorkspace(50, 8);
    const architecture = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    const report = buildArchitectureReport(architecture, { maxRows: MAX_ARCHITECTURE_REPORT_ROWS });
    expect(report.rows).toBeLessThanOrEqual(MAX_ARCHITECTURE_REPORT_ROWS);
  });

  it('keeps snapshot entity arrays within configured bounds', () => {
    const fixture = generatedWorkspace(80, 20);
    const architecture = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    const snapshot = captureArchitectureSnapshot(architecture, 'Scale', 1);
    expect(snapshot.modules.length).toBeLessThanOrEqual(MAX_SNAPSHOT_MODULES);
    expect(snapshot.symbols.length).toBeLessThanOrEqual(MAX_SNAPSHOT_SYMBOLS);
  });

  it('keeps metric values finite across a larger graph', () => {
    const fixture = generatedWorkspace(80, 12);
    const architecture = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    const metrics = calculateArchitectureMetrics(architecture);
    for (const value of [metrics.moduleDensity, metrics.callDensity, metrics.importDensity,
      metrics.crossModuleCallRatio, metrics.ambiguousCallRatio, metrics.meanModuleInstability, metrics.meanModuleCentrality]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    for (const module of metrics.modules) {
      expect(Number.isFinite(module.instability)).toBe(true);
      expect(Number.isFinite(module.centrality)).toBe(true);
      expect(Number.isFinite(module.score)).toBe(true);
    }
  });

  it('rebuilds deterministically for identical large inputs', () => {
    const fixture = generatedWorkspace(30, 10);
    const first = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    const second = buildWorkspaceArchitecture(fixture.documents, fixture.listing, fixture.documents[0].id);
    expect(second.generation).toBe(first.generation);
    expect(second.summary).toEqual(first.summary);
    expect(second.cycles).toEqual(first.cycles);
    expect(second.hotspots).toEqual(first.hotspots);
  });
});
