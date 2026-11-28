import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ARCHITECTURE_ROUTE_OPTIONS,
  MAX_ROUTE_DEPTH,
  architectureRoutePathText,
  architectureRouteStatusLabel,
  architectureRouteSummary,
  findArchitectureRoutes,
} from './workspaceArchitectureRoutes';
import {
  ambiguousCallFixture,
  functionId,
  importChainFixture,
  linearArchitectureFixture,
  moduleId,
  smallArchitectureFixture,
} from '../test/workspaceArchitectureFixtures';

describe('architecture route endpoint validation', () => {
  it('rejects an unknown source endpoint', () => {
    const { architecture } = smallArchitectureFixture();
    const target = moduleId(architecture, 'main');
    const result = findArchitectureRoutes(architecture, 'missing', target);
    expect(result.status).toBe('unknown-node');
    expect(result.paths).toEqual([]);
    expect(result.shortestDepth).toBeNull();
  });

  it('rejects an unknown destination endpoint', () => {
    const { architecture } = smallArchitectureFixture();
    const source = moduleId(architecture, 'main');
    expect(findArchitectureRoutes(architecture, source, 'missing').status).toBe('unknown-node');
  });

  it('returns same-node without graph expansion', () => {
    const { architecture } = smallArchitectureFixture();
    const source = moduleId(architecture, 'main');
    const result = findArchitectureRoutes(architecture, source, source);
    expect(result.status).toBe('same-node');
    expect(result.shortestDepth).toBe(0);
    expect(result.expansions).toBe(0);
    expect(result.visitedNodes).toBe(1);
  });

  it('rejects mixed module and symbol endpoint kinds', () => {
    const { architecture } = smallArchitectureFixture();
    const result = findArchitectureRoutes(architecture,
      moduleId(architecture, 'main'), functionId(architecture, 'load', 'service'));
    expect(result.status).toBe('incompatible-node-kinds');
  });

  it('rejects non-function symbol routes', () => {
    const { architecture } = smallArchitectureFixture();
    const record = architecture.symbols.find(item => item.kind === 'record')!;
    const functionSymbol = architecture.symbols.find(item => item.kind === 'function')!;
    const result = findArchitectureRoutes(architecture, record.id, functionSymbol.id, { mode: 'calls' });
    expect(result.status).toBe('incompatible-node-kinds');
  });
});

describe('directed module routes', () => {
  it('finds a one-edge import route between adjacent modules', () => {
    const { architecture } = importChainFixture(5, false);
    const result = findArchitectureRoutes(architecture,
      moduleId(architecture, 'module-0'), moduleId(architecture, 'module-1'), { mode: 'imports' });
    expect(result.status).toBe('found');
    expect(result.shortestDepth).toBe(1);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].steps[0].edgeKind).toBe('import');
  });

  it('finds the full shortest route through a linear import chain', () => {
    const { architecture } = importChainFixture(7, false);
    const result = findArchitectureRoutes(architecture,
      moduleId(architecture, 'module-0'), moduleId(architecture, 'module-6'),
      { mode: 'imports', maxDepth: 12 });
    expect(result.status).toBe('found');
    expect(result.shortestDepth).toBe(6);
    expect(result.paths[0].steps).toHaveLength(6);
  });

  it('does not traverse a directed import chain backwards', () => {
    const { architecture } = importChainFixture(6, false);
    const result = findArchitectureRoutes(architecture,
      moduleId(architecture, 'module-5'), moduleId(architecture, 'module-0'),
      { mode: 'imports', direction: 'directed', maxDepth: 12 });
    expect(result.status).toBe('not-found');
    expect(result.paths).toEqual([]);
  });

  it('can traverse observed edges backwards in explicit either-direction mode', () => {
    const { architecture } = importChainFixture(6, false);
    const result = findArchitectureRoutes(architecture,
      moduleId(architecture, 'module-5'), moduleId(architecture, 'module-0'),
      { mode: 'imports', direction: 'either-direction', maxDepth: 12 });
    expect(result.status).toBe('found');
    expect(result.shortestDepth).toBe(5);
    expect(result.paths[0].reversedEdges).toBe(5);
    expect(result.paths[0].steps.every(step => step.reversed)).toBe(true);
  });
});

describe('function call routes', () => {
  it('finds a directed function route through a linear call chain', () => {
    const { architecture } = linearArchitectureFixture(8);
    const result = findArchitectureRoutes(architecture,
      functionId(architecture, 'step_0', 'step-0'), functionId(architecture, 'step_7', 'step-7'),
      { mode: 'calls', maxDepth: 12 });
    expect(result.status).toBe('found');
    expect(result.shortestDepth).toBe(7);
    expect(result.paths[0].steps.every(step => step.edgeKind === 'call')).toBe(true);
  });

  it('does not use import edges for symbol routes even in combined mode', () => {
    const { architecture } = smallArchitectureFixture();
    const result = findArchitectureRoutes(architecture,
      functionId(architecture, 'main', 'main'), functionId(architecture, 'load', 'service'),
      { mode: 'combined' });
    if (result.paths.length) expect(result.paths.every(path => path.steps.every(step => step.edgeKind === 'call'))).toBe(true);
  });

  it('returns no function route in imports-only mode', () => {
    const { architecture } = linearArchitectureFixture(4);
    const result = findArchitectureRoutes(architecture,
      functionId(architecture, 'step_0', 'step-0'), functionId(architecture, 'step_3', 'step-3'),
      { mode: 'imports' });
    expect(result.status).toBe('not-found');
  });
});

describe('ambiguous route controls', () => {
  it('includes ambiguous function candidate edges by default', () => {
    const { architecture } = ambiguousCallFixture();
    const root = functionId(architecture, 'main', 'caller');
    const target = functionId(architecture, 'calculate', 'one');
    const result = findArchitectureRoutes(architecture, root, target, { mode: 'calls' });
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.paths[0].ambiguous).toBe(true);
    expect(result.paths[0].steps.some(step => step.ambiguous)).toBe(true);
  });

  it('excludes ambiguous function candidate edges when requested', () => {
    const { architecture } = ambiguousCallFixture();
    const result = findArchitectureRoutes(architecture,
      functionId(architecture, 'main', 'caller'), functionId(architecture, 'calculate', 'one'),
      { mode: 'calls', includeAmbiguousCalls: false });
    expect(result.status).toBe('not-found');
    expect(result.paths).toEqual([]);
  });
});

describe('route depth controls', () => {
  it('stops before a route longer than the selected max depth', () => {
    const { architecture } = linearArchitectureFixture(8);
    const result = findArchitectureRoutes(architecture,
      functionId(architecture, 'step_0', 'step-0'), functionId(architecture, 'step_7', 'step-7'),
      { mode: 'calls', maxDepth: 3 });
    expect(result.status).toBe('not-found');
  });

  it('clamps excessive depth to the hard maximum', () => {
    const { architecture } = linearArchitectureFixture(20);
    const result = findArchitectureRoutes(architecture,
      functionId(architecture, 'step_0', 'step-0'), functionId(architecture, 'step_19', 'step-19'),
      { mode: 'calls', maxDepth: 999 });
    expect(result.options.maxDepth).toBe(MAX_ROUTE_DEPTH);
  });

  it('restores the default for non-integer depth', () => {
    const { architecture } = linearArchitectureFixture(4);
    const result = findArchitectureRoutes(architecture,
      functionId(architecture, 'step_0', 'step-0'), functionId(architecture, 'step_3', 'step-3'),
      { mode: 'calls', maxDepth: Number.NaN });
    expect(result.options.maxDepth).toBe(DEFAULT_ARCHITECTURE_ROUTE_OPTIONS.maxDepth);
  });
});

describe('route path explanations', () => {
  it('stores labels for every from/to step', () => {
    const { architecture } = importChainFixture(4, false);
    const result = findArchitectureRoutes(architecture,
      moduleId(architecture, 'module-0'), moduleId(architecture, 'module-3'), { mode: 'imports' });
    for (const step of result.paths[0].steps) {
      expect(step.fromLabel.length).toBeGreaterThan(0);
      expect(step.toLabel.length).toBeGreaterThan(0);
      expect(step.label.length).toBeGreaterThan(0);
    }
  });

  it('creates deterministic path IDs from observed edge sequence and orientation', () => {
    const { architecture } = importChainFixture(4, false);
    const from = moduleId(architecture, 'module-0');
    const to = moduleId(architecture, 'module-3');
    const first = findArchitectureRoutes(architecture, from, to, { mode: 'imports' });
    const second = findArchitectureRoutes(architecture, from, to, { mode: 'imports' });
    expect(first.paths.map(path => path.id)).toEqual(second.paths.map(path => path.id));
  });

  it('formats a readable route path without hiding reversed edges', () => {
    const { architecture } = importChainFixture(4, false);
    const result = findArchitectureRoutes(architecture,
      moduleId(architecture, 'module-3'), moduleId(architecture, 'module-0'),
      { mode: 'imports', direction: 'either-direction' });
    const text = architectureRoutePathText(result.paths[0]);
    expect(text).toContain('←');
    expect(text).toContain('[import');
  });
});

describe('route labels and summaries', () => {
  it('provides a human label for every route status', () => {
    for (const status of ['found', 'same-node', 'not-found', 'incompatible-node-kinds', 'unknown-node', 'limited'] as const) {
      expect(architectureRouteStatusLabel(status).length).toBeGreaterThan(4);
    }
  });

  it('summarizes route count, depth, expansion count and selected options', () => {
    const { architecture } = importChainFixture(4, false);
    const result = findArchitectureRoutes(architecture,
      moduleId(architecture, 'module-0'), moduleId(architecture, 'module-3'), { mode: 'imports' });
    const summary = architectureRouteSummary(result);
    expect(summary).toContain('path');
    expect(summary).toContain('depth');
    expect(summary).toContain('edge expansions');
    expect(summary).toContain('imports');
    expect(summary).toContain('directed');
  });
});
