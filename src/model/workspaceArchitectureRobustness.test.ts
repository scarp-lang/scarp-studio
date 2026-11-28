import { describe, expect, it } from 'vitest';
import { buildWorkspaceArchitecture, architectureIsCurrent, architectureObservedLocationTarget } from './workspaceArchitecture';
import { searchWorkspaceArchitecture } from './workspaceArchitectureQuery';
import { buildArchitectureReport } from './workspaceArchitectureReport';
import { captureArchitectureSnapshot, architectureFingerprint } from './workspaceArchitectureSnapshot';
import { calculateArchitectureMetrics } from './workspaceArchitectureMetrics';
import { findArchitectureRoutes } from './workspaceArchitectureRoutes';
import { reviewWorkspaceArchitecture } from './workspaceArchitectureReview';
import { listed, studioDocument } from '../test/workspaceArchitectureFixtures';

function single(content: string, name = 'main.srp') {
  const document = studioDocument('doc', name, 'C:\\robust\\' + name, content);
  const listing = [listed(name, document.path!)];
  return { document, listing, architecture: buildWorkspaceArchitecture([document], listing, 'doc') };
}

describe('workspace architecture malformed lexical input safety', () => {
  it('does not throw on an unterminated string', () => {
    const fixture = single('funcra main() { print("unterminated); }\n');
    expect(fixture.architecture.summary.complete).toBe(false);
    expect(fixture.architecture.coverageReasons).toContain('symbol-index-limited');
  });

  it('does not create declaration or call observations from comment text', () => {
    const fixture = single('// funcra fake() { hidden(); }\nfuncra main() { return; }\n');
    expect(fixture.architecture.symbols.some(item => item.name === 'fake')).toBe(false);
    expect(fixture.architecture.callSites.some(item => item.name === 'hidden')).toBe(false);
  });

  it('does not create call observations from string contents', () => {
    const fixture = single('funcra main() { print("fake_call()"); }\n');
    expect(fixture.architecture.callSites.some(item => item.name === 'fake_call')).toBe(false);
  });

  it('keeps a malformed import as a bounded import observation rather than following it', () => {
    const fixture = single('import "../escape.srp" as escape;\nfuncra main() { return; }\n');
    expect(fixture.architecture.importEdges).toHaveLength(1);
    expect(['unsafe', 'unrecognized', 'missing']).toContain(fixture.architecture.importEdges[0].status);
    expect(fixture.architecture.importEdges[0].toModuleId).toBeNull();
  });
});

describe('workspace architecture Unicode handling', () => {
  it('keeps Unicode string contents out of identifier indexing', () => {
    const fixture = single('funcra main() { print("नमस्ते🙂"); }\n');
    expect(fixture.architecture.symbols.some(item => item.name.includes('नमस्ते'))).toBe(false);
  });

  it('keeps reports valid when source display names contain Unicode', () => {
    const document = studioDocument('unicode', 'नमूना.srp', 'C:\\robust\\नमूना.srp', 'funcra main() { return; }\n');
    const architecture = buildWorkspaceArchitecture([document], [listed('नमूना.srp', document.path!)], 'unicode');
    const report = buildArchitectureReport(architecture, { sections: ['modules'], format: 'json' });
    expect(() => JSON.parse(report.text)).not.toThrow();
    expect(report.text).toContain('नमूना.srp');
  });

  it('keeps snapshot fingerprints deterministic for surrogate pairs', () => {
    expect(architectureFingerprint({ label: '🙂' })).toBe(architectureFingerprint({ label: '🙂' }));
    expect(architectureFingerprint({ label: '🙂' })).not.toBe(architectureFingerprint({ label: '🙃' }));
  });
});

describe('workspace architecture control-character reporting safety', () => {
  it('replaces unsafe C0 controls in generated reports', () => {
    const fixture = single('funcra main() { return; }\n', 'bad\u0001name.srp');
    const report = buildArchitectureReport(fixture.architecture, { sections: ['modules'] });
    expect(report.text).not.toContain('\u0001');
    expect(report.text).toContain('�');
  });

  it('escapes bidirectional formatting controls in generated report cells', () => {
    const fixture = single('funcra main() { return; }\n', 'safe.srp');
    const architecture = {
      ...fixture.architecture,
      modules: Object.freeze(fixture.architecture.modules.map(module => ({ ...module, name: 'ab\u202Ecd.srp', listedName: null }))),
    };
    const report = buildArchitectureReport(architecture, { sections: ['modules'] });
    expect(report.text).toContain('\\u202e');
    expect(report.text).not.toContain('\u202E');
  });
});

describe('workspace architecture deterministic derivation', () => {
  it('produces the same summary for the same exact inputs', () => {
    const fixture = single('funcra helper() { return; }\nfuncra main() { helper(); }\n');
    const second = buildWorkspaceArchitecture([fixture.document], fixture.listing, 'doc');
    expect(second.summary).toEqual(fixture.architecture.summary);
    expect(second.generation).toBe(fixture.architecture.generation);
    expect(second.callEdges).toEqual(fixture.architecture.callEdges);
  });

  it('produces stable search ordering for repeated queries', () => {
    const fixture = single('funcra alpha() { return; }\nfuncra beta() { alpha(); }\n');
    const one = searchWorkspaceArchitecture(fixture.architecture, 'kind:symbol');
    const two = searchWorkspaceArchitecture(fixture.architecture, 'kind:symbol');
    expect(one.matches.map(item => item.item.id)).toEqual(two.matches.map(item => item.item.id));
  });

  it('produces stable review ordering', () => {
    const fixture = single('funcra main() { missing(); }\n');
    const one = reviewWorkspaceArchitecture(fixture.architecture);
    const two = reviewWorkspaceArchitecture(fixture.architecture);
    expect(one.findings.map(item => item.id)).toEqual(two.findings.map(item => item.id));
  });

  it('produces stable metric ordering', () => {
    const fixture = single('funcra helper() { return; }\nfuncra main() { helper(); }\n');
    const one = calculateArchitectureMetrics(fixture.architecture);
    const two = calculateArchitectureMetrics(fixture.architecture);
    expect(one.modules).toEqual(two.modules);
    expect(one.symbols).toEqual(two.symbols);
  });
});

describe('workspace architecture stale-data rejection', () => {
  it('rejects exact source freshness after content changes without a path change', () => {
    const fixture = single('funcra main() { return; }\n');
    const changed = { ...fixture.document, revision: 2, content: 'funcra main() { print(1); }\n' };
    expect(architectureIsCurrent(fixture.architecture, [changed], fixture.listing)).toBe(false);
  });

  it('rejects observed-location navigation after an ABA revision change', () => {
    const fixture = single('funcra main() { return; }\n');
    const symbol = fixture.architecture.symbols.find(item => item.name === 'main')!;
    const aba = { ...fixture.document, revision: fixture.document.revision + 2 };
    expect(architectureObservedLocationTarget(fixture.architecture, [aba], symbol.id)).toBeNull();
  });

  it('rejects observed-location navigation when document identity disappears', () => {
    const fixture = single('funcra main() { return; }\n');
    const symbol = fixture.architecture.symbols.find(item => item.name === 'main')!;
    expect(architectureObservedLocationTarget(fixture.architecture, [], symbol.id)).toBeNull();
  });
});

describe('workspace architecture route safety on cycles', () => {
  it('terminates route search on a recursive two-function cycle', () => {
    const fixture = single('funcra a() { b(); }\nfuncra b() { a(); }\nfuncra c() { return; }\n');
    const a = fixture.architecture.symbols.find(item => item.name === 'a')!;
    const c = fixture.architecture.symbols.find(item => item.name === 'c')!;
    const result = findArchitectureRoutes(fixture.architecture, a.id, c.id, { mode: 'calls', maxDepth: 12 });
    expect(['not-found', 'limited']).toContain(result.status);
    expect(result.expansions).toBeLessThanOrEqual(4096);
  });

  it('does not repeat a route forever through a self-recursive function', () => {
    const fixture = single('funcra self() { self(); }\nfuncra other() { return; }\n');
    const self = fixture.architecture.symbols.find(item => item.name === 'self')!;
    const other = fixture.architecture.symbols.find(item => item.name === 'other')!;
    const result = findArchitectureRoutes(fixture.architecture, self.id, other.id, { mode: 'calls', maxDepth: 12 });
    expect(result.paths).toEqual([]);
    expect(result.expansions).toBeLessThanOrEqual(4096);
  });
});

describe('workspace architecture snapshots avoid source retention', () => {
  it('does not retain secret-like source string contents in snapshot JSON', () => {
    const fixture = single('funcra main() { print("SUPER_SECRET_TOKEN_123"); }\n');
    const snapshot = captureArchitectureSnapshot(fixture.architecture, 'Safe', 1);
    expect(JSON.stringify(snapshot)).not.toContain('SUPER_SECRET_TOKEN_123');
  });
});
