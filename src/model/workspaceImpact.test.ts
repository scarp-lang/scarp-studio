import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMPACT_OPTIONS,
  MAX_IMPACT_DEPTH,
  MAX_IMPACT_RESULTS,
  analyzeWorkspaceImpact,
  impactConfidenceLabel,
  impactNodePath,
  impactRiskLabel,
  impactSummary,
} from './workspaceImpact';
import {
  ambiguousCallFixture,
  functionId,
  importChainFixture,
  linearArchitectureFixture,
  moduleId,
  smallArchitectureFixture,
} from '../test/workspaceArchitectureFixtures';

describe('workspace impact roots', () => {
  it('traces a module root over combined observed edges', () => {
    const { architecture } = smallArchitectureFixture();
    const root = moduleId(architecture, 'main');
    const review = analyzeWorkspaceImpact(architecture, root);

    expect(review).not.toBeNull();
    expect(review?.rootId).toBe(root);
    expect(review?.rootKind).toBe('module');
    expect(review?.rootLabel).toBe('main.srp');
    expect(review?.options).toEqual(DEFAULT_IMPACT_OPTIONS);
    expect(review?.nodes.length).toBeGreaterThan(0);
  });

  it('traces a function root over observed call candidates', () => {
    const { architecture } = smallArchitectureFixture();
    const root = functionId(architecture, 'load', 'service');
    const review = analyzeWorkspaceImpact(architecture, root, { edgeMode: 'calls' });

    expect(review).not.toBeNull();
    expect(review?.rootKind).toBe('symbol');
    expect(review?.nodes.some(node => node.label.includes('normalize'))).toBe(true);
  });

  it('returns a bounded empty review for a non-function symbol instead of inventing topology', () => {
    const { architecture } = smallArchitectureFixture();
    const record = architecture.symbols.find(item => item.kind === 'record')!;
    const review = analyzeWorkspaceImpact(architecture, record.id);

    expect(review).not.toBeNull();
    expect(review?.nodes).toEqual([]);
    expect(review?.paths).toEqual([]);
    expect(review?.checklist.join(' ')).toContain('no function-call topology');
  });

  it('returns null for an unknown root', () => {
    const { architecture } = smallArchitectureFixture();
    expect(analyzeWorkspaceImpact(architecture, 'unknown-root')).toBeNull();
  });
});

describe('workspace impact directions', () => {
  it('returns only outgoing observations for outgoing mode', () => {
    const { architecture } = linearArchitectureFixture(7);
    const root = functionId(architecture, 'step_0', 'step-0');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 10,
    })!;

    expect(review.outgoingCount).toBeGreaterThan(0);
    expect(review.incomingCount).toBe(0);
    expect(review.nodes.every(node => node.direction === 'outgoing')).toBe(true);
    expect(review.paths.every(path => path.direction === 'outgoing')).toBe(true);
  });

  it('returns only incoming observations for incoming mode', () => {
    const { architecture } = linearArchitectureFixture(7);
    const root = functionId(architecture, 'step_6', 'step-6');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'incoming', edgeMode: 'calls', maxDepth: 10,
    })!;

    expect(review.incomingCount).toBeGreaterThan(0);
    expect(review.outgoingCount).toBe(0);
    expect(review.nodes.every(node => node.direction === 'incoming')).toBe(true);
    expect(review.paths.every(path => path.direction === 'incoming')).toBe(true);
  });

  it('merges nodes observed in both directions around a recursive pair', () => {
    const { architecture } = smallArchitectureFixture();
    const normalize = functionId(architecture, 'normalize', 'util');
    const helper = functionId(architecture, 'helper', 'util');
    const review = analyzeWorkspaceImpact(architecture, normalize, {
      direction: 'both', edgeMode: 'calls', maxDepth: 4,
    })!;
    const helperNode = review.nodes.find(node => node.id === helper)!;

    expect(helperNode).toBeDefined();
    expect(helperNode.direction).toBe('both');
    expect(helperNode.cycleCount).toBeGreaterThan(0);
  });
});

describe('workspace impact edge modes', () => {
  it('uses only module import edges in imports mode', () => {
    const { architecture } = importChainFixture(6, false);
    const root = moduleId(architecture, 'module-0');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'imports', maxDepth: 10,
    })!;

    expect(review.nodes).toHaveLength(5);
    expect(review.paths.length).toBeGreaterThan(0);
    expect(review.paths.every(path => path.steps.every(step => step.edgeKind === 'import'))).toBe(true);
  });

  it('uses only call edges in calls mode', () => {
    const { architecture } = linearArchitectureFixture(6);
    const root = functionId(architecture, 'step_0', 'step-0');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 10,
    })!;

    expect(review.nodes).toHaveLength(5);
    expect(review.paths.every(path => path.steps.every(step => step.edgeKind === 'call'))).toBe(true);
  });

  it('combines import and cross-module call observations for module roots', () => {
    const { architecture } = smallArchitectureFixture();
    const root = moduleId(architecture, 'main');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'combined', maxDepth: 3,
    })!;
    const kinds = new Set(review.paths.flatMap(path => path.steps.map(step => step.edgeKind)));

    expect(kinds).toContain('import');
    expect(kinds).toContain('call');
  });

  it('does not add import edges to function-level traces', () => {
    const { architecture } = smallArchitectureFixture();
    const root = functionId(architecture, 'main', 'main');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'combined', maxDepth: 4,
    })!;

    expect(review.paths.every(path => path.steps.every(step => step.edgeKind === 'call'))).toBe(true);
  });
});

describe('workspace impact depth and boundary controls', () => {
  it('stops traversal at a configured depth and records the boundary', () => {
    const { architecture } = linearArchitectureFixture(8);
    const root = functionId(architecture, 'step_0', 'step-0');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 2,
    })!;

    expect(review.maxObservedDepth).toBeLessThanOrEqual(2);
    expect(review.nodes.every(node => node.depth <= 2)).toBe(true);
    expect(review.boundaries.some(boundary => boundary.reason === 'depth-limit')).toBe(true);
    expect(review.complete).toBe(false);
  });

  it('clamps an excessive depth to the hard maximum', () => {
    const { architecture } = linearArchitectureFixture(20);
    const root = functionId(architecture, 'step_0', 'step-0');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 999,
    })!;

    expect(review.options.maxDepth).toBe(MAX_IMPACT_DEPTH);
    expect(review.maxObservedDepth).toBeLessThanOrEqual(MAX_IMPACT_DEPTH);
  });

  it('clamps an invalid nonpositive depth to a safe value', () => {
    const { architecture } = linearArchitectureFixture(5);
    const root = functionId(architecture, 'step_0', 'step-0');
    const review = analyzeWorkspaceImpact(architecture, root, { maxDepth: 0 })!;
    expect(review.options.maxDepth).toBeGreaterThanOrEqual(1);
  });

  it('keeps the materialized impact surface bounded', () => {
    const { architecture } = linearArchitectureFixture(24);
    const root = functionId(architecture, 'step_0', 'step-0');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'both', edgeMode: 'calls', maxDepth: 12,
    })!;
    expect(review.nodes.length).toBeLessThanOrEqual(MAX_IMPACT_RESULTS);
    expect(review.boundaries.length).toBeLessThanOrEqual(MAX_IMPACT_RESULTS);
  });
});

describe('workspace impact ambiguity controls', () => {
  it('includes ambiguous call candidates by default', () => {
    const { architecture } = ambiguousCallFixture();
    const root = functionId(architecture, 'main', 'caller');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 2,
    })!;

    expect(review.nodes.filter(node => node.label.includes('calculate'))).toHaveLength(2);
    expect(review.ambiguousPathCount).toBeGreaterThan(0);
    expect(review.confidence).not.toBe('high-observation');
  });

  it('can exclude ambiguous call edges while explaining the stopped boundary', () => {
    const { architecture } = ambiguousCallFixture();
    const root = functionId(architecture, 'main', 'caller');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 2, includeAmbiguousCalls: false,
    })!;

    expect(review.nodes).toEqual([]);
    expect(review.boundaries.some(boundary => boundary.reason === 'ambiguous-call-excluded')).toBe(true);
    expect(review.complete).toBe(false);
  });

  it('marks representative paths as ambiguous when any step came from an ambiguous call site', () => {
    const { architecture } = ambiguousCallFixture();
    const root = functionId(architecture, 'main', 'caller');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 2,
    })!;

    expect(review.paths.length).toBeGreaterThan(0);
    expect(review.paths.every(path => path.ambiguous)).toBe(true);
    expect(review.paths.every(path => path.steps.some(step => step.ambiguous))).toBe(true);
  });
});

describe('workspace impact module boundary controls', () => {
  it('can stop call traversal at module boundaries', () => {
    const { architecture } = smallArchitectureFixture();
    const root = functionId(architecture, 'main', 'main');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 4, crossModules: false,
    })!;

    expect(review.nodes.every(node => {
      const symbol = architecture.symbols.find(item => item.id === node.id);
      return !symbol || symbol.documentId === 'main';
    })).toBe(true);
    expect(review.boundaries.some(boundary => boundary.reason === 'cross-module-disabled')).toBe(true);
  });

  it('allows cross-module traversal when explicitly enabled', () => {
    const { architecture } = smallArchitectureFixture();
    const root = functionId(architecture, 'main', 'main');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 4, crossModules: true,
    })!;

    expect(review.nodes.some(node => architecture.symbols.find(symbol => symbol.id === node.id)?.documentId === 'service')).toBe(true);
  });
});

describe('workspace impact paths', () => {
  it('retains an inspectable representative path to a downstream function', () => {
    const { architecture } = linearArchitectureFixture(6);
    const root = functionId(architecture, 'step_0', 'step-0');
    const target = functionId(architecture, 'step_5', 'step-5');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 10,
    })!;
    const path = impactNodePath(review, target, 'outgoing');

    expect(path).not.toBeNull();
    expect(path?.rootId).toBe(root);
    expect(path?.targetId).toBe(target);
    expect(path?.steps).toHaveLength(5);
    expect(path?.steps[0].fromId).toBe(root);
    expect(path?.steps.at(-1)?.toId).toBe(target);
  });

  it('returns null for an unobserved target path', () => {
    const { architecture } = linearArchitectureFixture(4);
    const root = functionId(architecture, 'step_0', 'step-0');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 1,
    })!;
    expect(impactNodePath(review, 'missing')).toBeNull();
  });

  it('distinguishes incoming and outgoing paths for the same cycle member', () => {
    const { architecture } = smallArchitectureFixture();
    const normalize = functionId(architecture, 'normalize', 'util');
    const helper = functionId(architecture, 'helper', 'util');
    const review = analyzeWorkspaceImpact(architecture, normalize, {
      direction: 'both', edgeMode: 'calls', maxDepth: 3,
    })!;

    expect(impactNodePath(review, helper, 'incoming')).not.toBeNull();
    expect(impactNodePath(review, helper, 'outgoing')).not.toBeNull();
  });

  it('keeps path steps tied to concrete observed edge IDs', () => {
    const { architecture } = linearArchitectureFixture(5);
    const root = functionId(architecture, 'step_0', 'step-0');
    const review = analyzeWorkspaceImpact(architecture, root, {
      direction: 'outgoing', edgeMode: 'calls', maxDepth: 10,
    })!;
    const knownEdges = new Set(architecture.callEdges.map(edge => edge.id));

    for (const path of review.paths) {
      for (const step of path.steps) expect(knownEdges.has(step.edgeId)).toBe(true);
    }
  });
});

describe('workspace impact cycles and risk', () => {
  it('counts cycle observations around a recursive function', () => {
    const { architecture } = smallArchitectureFixture();
    const normalize = functionId(architecture, 'normalize', 'util');
    const review = analyzeWorkspaceImpact(architecture, normalize, {
      direction: 'both', edgeMode: 'calls', maxDepth: 4,
    })!;

    expect(review.cycleCount).toBeGreaterThan(0);
    expect(review.score).toBeGreaterThan(0);
    expect(['low', 'medium', 'high', 'critical']).toContain(review.risk);
  });

  it('increases change-surface score for longer observed chains', () => {
    const short = linearArchitectureFixture(3);
    const long = linearArchitectureFixture(10);
    const shortReview = analyzeWorkspaceImpact(short.architecture,
      functionId(short.architecture, 'step_0', 'step-0'), { direction: 'outgoing', edgeMode: 'calls', maxDepth: 12 })!;
    const longReview = analyzeWorkspaceImpact(long.architecture,
      functionId(long.architecture, 'step_0', 'step-0'), { direction: 'outgoing', edgeMode: 'calls', maxDepth: 12 })!;

    expect(longReview.score).toBeGreaterThan(shortReview.score);
    expect(longReview.outgoingCount).toBeGreaterThan(shortReview.outgoingCount);
  });

  it('provides review checklist items rather than automatic refactoring instructions', () => {
    const { architecture } = smallArchitectureFixture();
    const root = moduleId(architecture, 'service');
    const review = analyzeWorkspaceImpact(architecture, root)!;

    expect(review.checklist.length).toBeGreaterThan(0);
    expect(review.checklist.every(item => typeof item === 'string' && item.length > 10)).toBe(true);
  });
});

describe('workspace impact labels and summaries', () => {
  it('maps all risk levels to readable change-surface labels', () => {
    expect(impactRiskLabel('low')).toContain('Low');
    expect(impactRiskLabel('medium')).toContain('Medium');
    expect(impactRiskLabel('high')).toContain('High');
    expect(impactRiskLabel('critical')).toContain('Critical');
  });

  it('maps all confidence levels to explicit bounded-observation language', () => {
    expect(impactConfidenceLabel('high-observation')).toContain('bounded observation');
    expect(impactConfidenceLabel('mixed-observation')).toContain('ambiguous');
    expect(impactConfidenceLabel('low-observation')).toContain('incomplete');
  });

  it('summarizes root, directions, depth, ambiguity, cycles and completeness', () => {
    const { architecture } = smallArchitectureFixture();
    const review = analyzeWorkspaceImpact(architecture, moduleId(architecture, 'main'))!;
    const summary = impactSummary(review);

    expect(summary).toContain(review.rootLabel);
    expect(summary).toContain('incoming');
    expect(summary).toContain('outgoing');
    expect(summary).toContain('depth');
    expect(summary).toContain('ambiguous');
    expect(summary).toContain('cycle');
  });
});
