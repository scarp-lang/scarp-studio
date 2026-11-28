import { describe, expect, it } from 'vitest';
import {
  MAX_METRIC_PATH_DEPTH,
  architectureMetricNeighbors,
  architectureMetricsSummary,
  architectureModuleMetricFor,
  architectureSymbolMetricFor,
  calculateArchitectureMetrics,
  compareModuleArchitectureMetrics,
  topArchitectureMetricModules,
  topArchitectureMetricSymbols,
} from './workspaceArchitectureMetrics';
import {
  ambiguousCallFixture,
  changedFixture,
  functionId,
  importChainFixture,
  linearArchitectureFixture,
  moduleId,
  smallArchitectureFixture,
} from '../test/workspaceArchitectureFixtures';

describe('architecture graph metrics', () => {
  it('calculates one module metric per open module', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    expect(metrics.modules).toHaveLength(architecture.modules.length);
    expect(new Set(metrics.modules.map(item => item.moduleId))).toEqual(new Set(architecture.modules.map(item => item.id)));
  });

  it('calculates symbol metrics only for indexed functions', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const functions = architecture.symbols.filter(item => item.kind === 'function');
    expect(metrics.symbols).toHaveLength(functions.length);
    expect(metrics.symbols.every(item => item.kind === 'function')).toBe(true);
  });

  it('preserves the architecture generation', () => {
    const { architecture } = smallArchitectureFixture();
    expect(calculateArchitectureMetrics(architecture).generation).toBe(architecture.generation);
  });

  it('returns normalized global ratios between zero and one', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    for (const value of [metrics.moduleDensity, metrics.callDensity, metrics.importDensity,
      metrics.crossModuleCallRatio, metrics.ambiguousCallRatio, metrics.cyclicModuleRatio,
      metrics.cyclicFunctionRatio, metrics.meanModuleInstability, metrics.meanModuleCentrality]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('keeps dependency depth within the explicit traversal bound', () => {
    const metrics = calculateArchitectureMetrics(importChainFixture(24, false).architecture);
    expect(metrics.maxDependencyDepth).toBeLessThanOrEqual(MAX_METRIC_PATH_DEPTH);
    expect(metrics.maxDependentDepth).toBeLessThanOrEqual(MAX_METRIC_PATH_DEPTH);
  });
});

describe('module coupling metrics', () => {
  it('counts outgoing and incoming module dependencies from imports and calls', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const main = architectureModuleMetricFor(metrics, moduleId(architecture, 'main'))!;
    const service = architectureModuleMetricFor(metrics, moduleId(architecture, 'service'))!;
    expect(main.efferentCoupling).toBeGreaterThan(0);
    expect(service.afferentCoupling).toBeGreaterThan(0);
  });

  it('calculates instability as Ce divided by Ca plus Ce', () => {
    const { architecture } = importChainFixture(4, false);
    const metrics = calculateArchitectureMetrics(architecture);
    for (const item of metrics.modules) {
      const denominator = item.afferentCoupling + item.efferentCoupling;
      const expected = denominator ? item.efferentCoupling / denominator : 0;
      expect(item.instability).toBeCloseTo(expected, 4);
    }
  });

  it('uses records and variants as an explicit abstractness proxy instead of claiming language semantics', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const alt = architectureModuleMetricFor(metrics, moduleId(architecture, 'alt'))!;
    expect(alt.abstractnessProxy).toBeGreaterThan(0);
    expect(alt.abstractnessProxy).toBeLessThanOrEqual(1);
  });

  it('calculates distance proxy from instability plus abstractness proxy', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    for (const item of metrics.modules) {
      expect(item.distanceProxy).toBeCloseTo(Math.abs(item.abstractnessProxy + item.instability - 1), 4);
    }
  });

  it('counts internal and external call edges separately', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const util = architectureModuleMetricFor(metrics, moduleId(architecture, 'util'))!;
    const main = architectureModuleMetricFor(metrics, moduleId(architecture, 'main'))!;
    expect(util.internalCallEdges).toBeGreaterThan(0);
    expect(main.externalCallEdges).toBeGreaterThan(0);
  });

  it('counts ambiguous call sites in modules containing ambiguous calls', () => {
    const { architecture } = ambiguousCallFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const caller = architectureModuleMetricFor(metrics, moduleId(architecture, 'caller'))!;
    expect(caller.ambiguousCallSites).toBe(2);
    expect(metrics.ambiguousCallRatio).toBeGreaterThan(0);
  });

  it('counts unmatched call sites separately from ambiguous calls', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const main = architectureModuleMetricFor(metrics, moduleId(architecture, 'main'))!;
    expect(main.unmatchedCallSites).toBeGreaterThan(0);
  });

  it('detects import and call cycle participation at module level', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const service = architectureModuleMetricFor(metrics, moduleId(architecture, 'service'))!;
    const util = architectureModuleMetricFor(metrics, moduleId(architecture, 'util'))!;
    expect(service.importCycleCount).toBeGreaterThan(0);
    expect(util.importCycleCount).toBeGreaterThan(0);
    expect(util.callCycleCount).toBeGreaterThan(0);
  });
});

describe('dependency depths', () => {
  it('increases dependency depth down a linear import chain', () => {
    const { architecture } = importChainFixture(8, false);
    const metrics = calculateArchitectureMetrics(architecture);
    const first = architectureModuleMetricFor(metrics, moduleId(architecture, 'module-0'))!;
    const last = architectureModuleMetricFor(metrics, moduleId(architecture, 'module-7'))!;
    expect(first.dependencyDepth).toBe(7);
    expect(first.dependentDepth).toBe(0);
    expect(last.dependencyDepth).toBe(0);
    expect(last.dependentDepth).toBe(7);
  });

  it('terminates depth calculations through an import cycle', () => {
    const { architecture } = importChainFixture(8, true);
    const metrics = calculateArchitectureMetrics(architecture);
    expect(metrics.modules.every(item => item.dependencyDepth <= MAX_METRIC_PATH_DEPTH)).toBe(true);
    expect(metrics.modules.every(item => item.dependentDepth <= MAX_METRIC_PATH_DEPTH)).toBe(true);
  });
});

describe('bounded centrality', () => {
  it('normalizes maximum module centrality to one when a graph has edges', () => {
    const metrics = calculateArchitectureMetrics(importChainFixture(6, false).architecture);
    expect(Math.max(...metrics.modules.map(item => item.centrality))).toBeCloseTo(1, 4);
  });

  it('normalizes maximum function centrality to one when the call graph has edges', () => {
    const metrics = calculateArchitectureMetrics(linearArchitectureFixture(6).architecture);
    expect(Math.max(...metrics.symbols.map(item => item.centrality))).toBeCloseTo(1, 4);
  });

  it('keeps all centrality values finite and normalized', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    for (const item of [...metrics.modules, ...metrics.symbols]) {
      expect(Number.isFinite(item.centrality)).toBe(true);
      expect(item.centrality).toBeGreaterThanOrEqual(0);
      expect(item.centrality).toBeLessThanOrEqual(1);
    }
  });
});

describe('function metrics', () => {
  it('counts incoming and outgoing observed calls', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const normalize = architectureSymbolMetricFor(metrics, functionId(architecture, 'normalize', 'util'))!;
    expect(normalize.incomingCalls).toBeGreaterThan(0);
    expect(normalize.outgoingCalls).toBeGreaterThan(0);
  });

  it('counts cross-module incoming calls separately', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const load = architectureSymbolMetricFor(metrics, functionId(architecture, 'load', 'service'))!;
    expect(load.crossModuleIncoming).toBeGreaterThan(0);
  });

  it('counts ambiguous incoming candidate edges', () => {
    const { architecture } = ambiguousCallFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const calculate = metrics.symbols.filter(item => item.label.includes('calculate'));
    expect(calculate).toHaveLength(2);
    expect(calculate.every(item => item.ambiguousIncoming > 0)).toBe(true);
  });

  it('includes recursive call cycle membership in function scoring', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const normalize = architectureSymbolMetricFor(metrics, functionId(architecture, 'normalize', 'util'))!;
    expect(normalize.cycleCount).toBeGreaterThan(0);
    expect(normalize.score).toBeGreaterThan(0);
  });
});

describe('metric ranking helpers', () => {
  it('sorts module metrics by descending review score', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    for (let index = 1; index < metrics.modules.length; index++) {
      expect(metrics.modules[index - 1].score).toBeGreaterThanOrEqual(metrics.modules[index].score);
    }
  });

  it('sorts function metrics by descending review score', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    for (let index = 1; index < metrics.symbols.length; index++) {
      expect(metrics.symbols[index - 1].score).toBeGreaterThanOrEqual(metrics.symbols[index].score);
    }
  });

  it('returns bounded top module and symbol lists', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    expect(topArchitectureMetricModules(metrics, 2)).toHaveLength(Math.min(2, metrics.modules.length));
    expect(topArchitectureMetricSymbols(metrics, 3)).toHaveLength(Math.min(3, metrics.symbols.length));
    expect(topArchitectureMetricModules(metrics, 999).length).toBeLessThanOrEqual(100);
  });

  it('returns null for unknown metric IDs', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    expect(architectureModuleMetricFor(metrics, 'missing')).toBeNull();
    expect(architectureSymbolMetricFor(metrics, 'missing')).toBeNull();
  });
});

describe('metric comparisons', () => {
  it('reports no changed module metrics between identical graphs', () => {
    const fixture = smallArchitectureFixture();
    const before = calculateArchitectureMetrics(fixture.architecture);
    const after = calculateArchitectureMetrics(fixture.architecture);
    const comparison = compareModuleArchitectureMetrics(before, after);
    expect(comparison.every(item => !item.changed)).toBe(true);
    expect(comparison.every(item => item.deltas.every(delta => delta.direction === 'unchanged'))).toBe(true);
  });

  it('reports changed metrics after adding source structure', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    const comparison = compareModuleArchitectureMetrics(
      calculateArchitectureMetrics(beforeFixture.architecture),
      calculateArchitectureMetrics(afterFixture.architecture),
    );
    expect(comparison.some(item => item.changed)).toBe(true);
  });

  it('uses signed numeric deltas with explicit direction', () => {
    const beforeFixture = smallArchitectureFixture();
    const afterFixture = changedFixture(beforeFixture);
    const comparison = compareModuleArchitectureMetrics(
      calculateArchitectureMetrics(beforeFixture.architecture),
      calculateArchitectureMetrics(afterFixture.architecture),
    );
    for (const item of comparison) {
      for (const delta of item.deltas) {
        expect(delta.delta).toBeCloseTo(delta.after - delta.before, 4);
        expect(delta.direction).toBe(delta.delta > 0 ? 'up' : delta.delta < 0 ? 'down' : 'unchanged');
      }
    }
  });
});

describe('metric neighborhood helpers', () => {
  it('labels incoming, outgoing and bidirectional module neighbors', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const util = moduleId(architecture, 'util');
    const neighbors = architectureMetricNeighbors(architecture, metrics, util);
    expect(neighbors.length).toBeGreaterThan(0);
    expect(neighbors.every(item => ['incoming', 'outgoing', 'both'].includes(item.direction))).toBe(true);
  });

  it('sorts neighbor review rows by score then label', () => {
    const { architecture } = smallArchitectureFixture();
    const metrics = calculateArchitectureMetrics(architecture);
    const neighbors = architectureMetricNeighbors(architecture, metrics, moduleId(architecture, 'service'));
    for (let index = 1; index < neighbors.length; index++) {
      expect(neighbors[index - 1].score).toBeGreaterThanOrEqual(neighbors[index].score);
    }
  });
});

describe('metric summary', () => {
  it('describes density, cross-module ratio, ambiguity and depth', () => {
    const metrics = calculateArchitectureMetrics(smallArchitectureFixture().architecture);
    const summary = architectureMetricsSummary(metrics);
    expect(summary).toContain('module density');
    expect(summary).toContain('call density');
    expect(summary).toContain('import density');
    expect(summary).toContain('cross-module calls');
    expect(summary).toContain('ambiguous calls');
    expect(summary).toContain('dependency depth');
  });
});
