import { describe, expect, it } from 'vitest';
import { buildWorkspaceArchitecture, architectureObservedLocationTarget } from './workspaceArchitecture';
import { parseArchitectureQuery, searchWorkspaceArchitecture } from './workspaceArchitectureQuery';
import { analyzeWorkspaceImpact } from './workspaceImpact';
import { findArchitectureRoutes } from './workspaceArchitectureRoutes';
import { reviewWorkspaceArchitecture } from './workspaceArchitectureReview';
import { buildArchitectureReport } from './workspaceArchitectureReport';
import { calculateArchitectureMetrics } from './workspaceArchitectureMetrics';
import { captureArchitectureSnapshot, compareArchitectureSnapshots } from './workspaceArchitectureSnapshot';
import { listed, studioDocument } from '../test/workspaceArchitectureFixtures';

function architectureFor(content: string) {
  const document = studioDocument('edge', 'edge.srp', 'C:\\edge\\edge.srp', content);
  const listing = [listed('edge.srp', document.path!)];
  return { document, listing, architecture: buildWorkspaceArchitecture([document], listing, 'edge') };
}

describe('empty workspace edge cases', () => {
  it('builds an empty architecture without throwing', () => {
    const architecture = buildWorkspaceArchitecture([], [], null);
    expect(architecture.modules).toEqual([]);
    expect(architecture.symbols).toEqual([]);
    expect(architecture.callSites).toEqual([]);
    expect(architecture.importEdges).toEqual([]);
    expect(architecture.summary.moduleCount).toBe(0);
  });

  it('searches an empty architecture deterministically', () => {
    const architecture = buildWorkspaceArchitecture([], [], null);
    const result = searchWorkspaceArchitecture(architecture, 'anything');
    expect(result.matches).toEqual([]);
    expect(result.totalMatches).toBe(0);
  });

  it('reviews an empty architecture without fake findings', () => {
    const architecture = buildWorkspaceArchitecture([], [], null);
    const review = reviewWorkspaceArchitecture(architecture);
    expect(review.summary.total).toBe(0);
    expect(review.findings).toEqual([]);
  });

  it('calculates zero-safe metrics for an empty graph', () => {
    const metrics = calculateArchitectureMetrics(buildWorkspaceArchitecture([], [], null));
    expect(metrics.modules).toEqual([]);
    expect(metrics.symbols).toEqual([]);
    expect(metrics.moduleDensity).toBe(0);
    expect(metrics.callDensity).toBe(0);
    expect(metrics.importDensity).toBe(0);
    expect(metrics.meanModuleInstability).toBe(0);
  });

  it('generates a useful summary report for an empty graph', () => {
    const report = buildArchitectureReport(buildWorkspaceArchitecture([], [], null), { sections: ['summary'] });
    expect(report.text).toContain('Open modules=0');
    expect(report.text).toContain('Declarations=0');
  });
});

describe('single-source edge cases', () => {
  it('handles a source with no declarations', () => {
    const fixture = architectureFor('// only a comment\n');
    expect(fixture.architecture.modules).toHaveLength(1);
    expect(fixture.architecture.symbols).toEqual([]);
    expect(fixture.architecture.entrypoints).toEqual([]);
  });

  it('handles a source with a declaration but no calls', () => {
    const fixture = architectureFor('funcra main() { return; }\n');
    expect(fixture.architecture.symbols.some(item => item.name === 'main')).toBe(true);
    expect(fixture.architecture.callEdges).toEqual([]);
    expect(fixture.architecture.entrypoints.some(item => item.name === 'main')).toBe(true);
  });

  it('handles self recursion without an unbounded route search', () => {
    const fixture = architectureFor('funcra main() { main(); }\n');
    const main = fixture.architecture.symbols.find(item => item.name === 'main')!;
    const route = findArchitectureRoutes(fixture.architecture, main.id, main.id, { mode: 'calls' });
    expect(route.status).toBe('same-node');
    expect(route.expansions).toBe(0);
  });

  it('handles a self recursive impact graph with bounded path count', () => {
    const fixture = architectureFor('funcra main() { main(); }\n');
    const main = fixture.architecture.symbols.find(item => item.name === 'main')!;
    const impact = analyzeWorkspaceImpact(fixture.architecture, main.id, { edgeMode: 'calls', maxDepth: 12 })!;
    expect(impact.paths.length).toBeLessThanOrEqual(128);
    expect(impact.cycleCount).toBeGreaterThan(0);
  });
});

describe('query parser edge cases', () => {
  it('handles repeated negation markers as literal bounded input instead of throwing', () => {
    expect(() => parseArchitectureQuery('---name:main')).not.toThrow();
  });

  it('handles punctuation-only terms', () => {
    const parsed = parseArchitectureQuery('... ::: !!!');
    expect(parsed.terms.length).toBeGreaterThanOrEqual(0);
  });

  it('handles a quoted empty value as an invalid field filter', () => {
    const parsed = parseArchitectureQuery('name:""');
    expect(parsed.complete).toBe(false);
    expect(parsed.issues.length).toBeGreaterThan(0);
  });

  it('does not throw on a trailing escape in a quote', () => {
    expect(() => parseArchitectureQuery('name:"abc\\')).not.toThrow();
  });
});

describe('navigation edge cases', () => {
  it('does not navigate an unknown observation ID', () => {
    const fixture = architectureFor('funcra main() { return; }\n');
    expect(architectureObservedLocationTarget(fixture.architecture, [fixture.document], 'unknown')).toBeNull();
  });

  it('does not navigate after the file name changes even if content and revision are reused', () => {
    const fixture = architectureFor('funcra main() { return; }\n');
    const main = fixture.architecture.symbols.find(item => item.name === 'main')!;
    const renamed = { ...fixture.document, name: 'renamed.srp' };
    expect(architectureObservedLocationTarget(fixture.architecture, [renamed], main.id)).toBeNull();
  });

  it('does not navigate after the path changes even if source text is identical', () => {
    const fixture = architectureFor('funcra main() { return; }\n');
    const main = fixture.architecture.symbols.find(item => item.name === 'main')!;
    const moved = { ...fixture.document, path: 'C:\\edge\\moved.srp' };
    expect(architectureObservedLocationTarget(fixture.architecture, [moved], main.id)).toBeNull();
  });
});

describe('snapshot edge cases', () => {
  it('compares two empty architecture snapshots as identical', () => {
    const architecture = buildWorkspaceArchitecture([], [], null);
    const before = captureArchitectureSnapshot(architecture, 'Before', 1);
    const after = captureArchitectureSnapshot(architecture, 'After', 2);
    const diff = compareArchitectureSnapshots(before, after);
    expect(diff.identical).toBe(true);
    expect(diff.items).toEqual([]);
  });

  it('does not let a label change alter the structural fingerprint', () => {
    const fixture = architectureFor('funcra main() { return; }\n');
    const one = captureArchitectureSnapshot(fixture.architecture, 'One', 1);
    const two = captureArchitectureSnapshot(fixture.architecture, 'Two', 2);
    expect(one.fingerprint).toBe(two.fingerprint);
  });
});

describe('report edge cases', () => {
  it('handles a one-row maximum without producing an invalid result', () => {
    const fixture = architectureFor('funcra main() { return; }\n');
    const report = buildArchitectureReport(fixture.architecture, { maxRows: 1 });
    expect(report.rows).toBe(1);
    expect(report.truncated).toBe(true);
  });

  it('keeps JSON output parseable at a tiny row limit', () => {
    const fixture = architectureFor('funcra main() { return; }\n');
    const report = buildArchitectureReport(fixture.architecture, { format: 'json', maxRows: 1 });
    expect(() => JSON.parse(report.text)).not.toThrow();
  });
});
