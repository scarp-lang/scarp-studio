import { describe, expect, it } from 'vitest';
import { buildWorkspaceArchitecture } from './workspaceArchitecture';
import { searchWorkspaceArchitecture } from './workspaceArchitectureQuery';
import { analyzeWorkspaceImpact } from './workspaceImpact';
import { reviewWorkspaceArchitecture } from './workspaceArchitectureReview';
import { calculateArchitectureMetrics } from './workspaceArchitectureMetrics';
import { findArchitectureRoutes } from './workspaceArchitectureRoutes';
import { buildArchitectureReport } from './workspaceArchitectureReport';
import { captureArchitectureSnapshot } from './workspaceArchitectureSnapshot';
import { smallArchitectureFixture } from '../test/workspaceArchitectureFixtures';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('workspace architecture pure derivations', () => {
  it('does not mutate input documents or listing while building architecture', () => {
    const fixture = smallArchitectureFixture();
    const documentsBefore = clone(fixture.documents);
    const listingBefore = clone(fixture.listing);
    buildWorkspaceArchitecture(fixture.documents, fixture.listing, 'main');
    expect(fixture.documents).toEqual(documentsBefore);
    expect(fixture.listing).toEqual(listingBefore);
  });

  it('does not mutate architecture while searching', () => {
    const { architecture } = smallArchitectureFixture();
    const before = JSON.stringify(architecture);
    searchWorkspaceArchitecture(architecture, 'kind:symbol incoming:>=0');
    expect(JSON.stringify(architecture)).toBe(before);
  });

  it('does not mutate architecture while tracing impact', () => {
    const { architecture } = smallArchitectureFixture();
    const before = JSON.stringify(architecture);
    const root = architecture.modules[0].id;
    analyzeWorkspaceImpact(architecture, root, { direction: 'both', edgeMode: 'combined', maxDepth: 5 });
    expect(JSON.stringify(architecture)).toBe(before);
  });

  it('does not mutate architecture while reviewing findings', () => {
    const { architecture } = smallArchitectureFixture();
    const before = JSON.stringify(architecture);
    reviewWorkspaceArchitecture(architecture, { fanInWarning: 2, fanOutWarning: 2 });
    expect(JSON.stringify(architecture)).toBe(before);
  });

  it('does not mutate architecture while calculating metrics', () => {
    const { architecture } = smallArchitectureFixture();
    const before = JSON.stringify(architecture);
    calculateArchitectureMetrics(architecture);
    expect(JSON.stringify(architecture)).toBe(before);
  });

  it('does not mutate architecture while finding routes', () => {
    const { architecture } = smallArchitectureFixture();
    const before = JSON.stringify(architecture);
    findArchitectureRoutes(architecture, architecture.modules[0].id, architecture.modules[1].id);
    expect(JSON.stringify(architecture)).toBe(before);
  });

  it('does not mutate architecture while building reports', () => {
    const { architecture } = smallArchitectureFixture();
    const before = JSON.stringify(architecture);
    buildArchitectureReport(architecture, { format: 'markdown', includeIds: true, includePaths: true });
    expect(JSON.stringify(architecture)).toBe(before);
  });

  it('does not mutate architecture while capturing a snapshot', () => {
    const { architecture } = smallArchitectureFixture();
    const before = JSON.stringify(architecture);
    captureArchitectureSnapshot(architecture, 'Snapshot', 1);
    expect(JSON.stringify(architecture)).toBe(before);
  });
});

describe('workspace architecture result independence', () => {
  it('builds equal but distinct architecture objects for the same input', () => {
    const fixture = smallArchitectureFixture();
    const first = buildWorkspaceArchitecture(fixture.documents, fixture.listing, 'main');
    const second = buildWorkspaceArchitecture(fixture.documents, fixture.listing, 'main');
    expect(second).not.toBe(first);
    expect(second.summary).toEqual(first.summary);
    expect(second.generation).toBe(first.generation);
  });

  it('builds distinct search arrays for repeated searches', () => {
    const { architecture } = smallArchitectureFixture();
    const first = searchWorkspaceArchitecture(architecture, 'render');
    const second = searchWorkspaceArchitecture(architecture, 'render');
    expect(second.matches).not.toBe(first.matches);
    expect(second.matches).toEqual(first.matches);
  });

  it('builds distinct impact results for repeated traces', () => {
    const { architecture } = smallArchitectureFixture();
    const root = architecture.modules[0].id;
    const first = analyzeWorkspaceImpact(architecture, root)!;
    const second = analyzeWorkspaceImpact(architecture, root)!;
    expect(second).not.toBe(first);
    expect(second.nodes).toEqual(first.nodes);
  });

  it('builds distinct review results with deterministic finding identities', () => {
    const { architecture } = smallArchitectureFixture();
    const first = reviewWorkspaceArchitecture(architecture);
    const second = reviewWorkspaceArchitecture(architecture);
    expect(second).not.toBe(first);
    expect(second.findings.map(item => item.id)).toEqual(first.findings.map(item => item.id));
  });

  it('builds distinct metric results with deterministic ordering', () => {
    const { architecture } = smallArchitectureFixture();
    const first = calculateArchitectureMetrics(architecture);
    const second = calculateArchitectureMetrics(architecture);
    expect(second).not.toBe(first);
    expect(second.modules.map(item => item.moduleId)).toEqual(first.modules.map(item => item.moduleId));
  });

  it('builds distinct route results with deterministic path identities', () => {
    const { architecture } = smallArchitectureFixture();
    const from = architecture.modules[0].id;
    const to = architecture.modules[1].id;
    const first = findArchitectureRoutes(architecture, from, to);
    const second = findArchitectureRoutes(architecture, from, to);
    expect(second).not.toBe(first);
    expect(second.paths.map(item => item.id)).toEqual(first.paths.map(item => item.id));
  });

  it('builds equivalent reports for identical options', () => {
    const { architecture } = smallArchitectureFixture();
    const first = buildArchitectureReport(architecture, { format: 'json', sections: ['summary', 'modules'] });
    const second = buildArchitectureReport(architecture, { format: 'json', sections: ['summary', 'modules'] });
    expect(second.text).toBe(first.text);
    expect(second.rows).toBe(first.rows);
  });

  it('builds identical structural fingerprints for repeated snapshots of the same graph', () => {
    const { architecture } = smallArchitectureFixture();
    const first = captureArchitectureSnapshot(architecture, 'One', 1);
    const second = captureArchitectureSnapshot(architecture, 'Two', 2);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.id).not.toBe(first.id);
  });
});

describe('workspace architecture option isolation', () => {
  it('search kind restrictions do not alter later unrestricted searches', () => {
    const { architecture } = smallArchitectureFixture();
    const restricted = searchWorkspaceArchitecture(architecture, '', ['module']);
    const unrestricted = searchWorkspaceArchitecture(architecture, '');
    expect(restricted.matches.every(item => item.item.kind === 'module')).toBe(true);
    expect(unrestricted.matches.some(item => item.item.kind !== 'module')).toBe(true);
  });

  it('impact settings do not leak across calls', () => {
    const { architecture } = smallArchitectureFixture();
    const root = architecture.modules[0].id;
    const outgoing = analyzeWorkspaceImpact(architecture, root, { direction: 'outgoing', maxDepth: 1 })!;
    const defaults = analyzeWorkspaceImpact(architecture, root)!;
    expect(outgoing.options.direction).toBe('outgoing');
    expect(defaults.options.direction).toBe('both');
    expect(defaults.options.maxDepth).toBe(6);
  });

  it('review disabled rules do not leak across calls', () => {
    const { architecture } = smallArchitectureFixture();
    const disabled = reviewWorkspaceArchitecture(architecture, { disabledRules: ['unmatched-call'] });
    const defaults = reviewWorkspaceArchitecture(architecture);
    expect(disabled.findings.some(item => item.rule === 'unmatched-call')).toBe(false);
    expect(defaults.findings.some(item => item.rule === 'unmatched-call')).toBe(true);
  });

  it('report path disclosure remains opt-in for each call', () => {
    const { architecture } = smallArchitectureFixture();
    const full = buildArchitectureReport(architecture, { sections: ['modules'], includePaths: true });
    const safe = buildArchitectureReport(architecture, { sections: ['modules'] });
    expect(full.text).toContain('C:\\work\\');
    expect(safe.text).not.toContain('C:\\work\\');
  });
});
