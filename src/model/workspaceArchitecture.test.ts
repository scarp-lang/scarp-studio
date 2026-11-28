import { describe, expect, it } from 'vitest';
import {
  MAX_ARCHITECTURE_CALLS,
  MAX_ARCHITECTURE_MODULES,
  architectureCallStatusLabel,
  architectureCoverageLabel,
  architectureCycleMembership,
  architectureDirectNeighbors,
  architectureHotspotFor,
  architectureIsCurrent,
  architectureModuleForSymbol,
  architectureNavigationTarget,
  architectureNode,
  architectureNodeLabel,
  architectureObservedLocationTarget,
  architectureRiskLabel,
  architectureSymbolForCallSite,
  buildWorkspaceArchitecture,
} from './workspaceArchitecture';
import {
  ambiguousCallFixture,
  functionId,
  importChainFixture,
  linearArchitectureFixture,
  moduleId,
  shadowedCallFixture,
  smallArchitectureFixture,
  studioDocument,
  listed,
} from '../test/workspaceArchitectureFixtures';

describe('workspace architecture graph construction', () => {
  it('combines open-buffer symbols and literal import observations without filesystem IO', () => {
    const fixture = smallArchitectureFixture();
    const architecture = fixture.architecture;

    expect(architecture.modules.map(item => item.documentId)).toEqual(['main', 'service', 'util', 'alt']);
    expect(architecture.summary.moduleCount).toBe(4);
    expect(architecture.summary.symbolCount).toBeGreaterThanOrEqual(9);
    expect(architecture.summary.functionCount).toBeGreaterThanOrEqual(8);
    expect(architecture.summary.callSiteCount).toBeGreaterThanOrEqual(8);
    expect(architecture.summary.importEdgeCount).toBe(3);
    expect(architecture.documents.map(item => item.content)).toEqual(fixture.documents.map(item => item.content));
    expect(architecture.listing).toEqual(fixture.listing);
  });

  it('assigns every indexed declaration to exactly one open module', () => {
    const { architecture } = smallArchitectureFixture();
    const members = new Map<string, number>();
    for (const module of architecture.modules) {
      for (const id of module.symbolIds) members.set(id, (members.get(id) ?? 0) + 1);
    }

    expect(members.size).toBe(architecture.symbols.length);
    for (const symbol of architecture.symbols) {
      expect(members.get(symbol.id)).toBe(1);
      expect(architectureModuleForSymbol(architecture, symbol.id)?.id).toBe(symbol.moduleId);
    }
  });

  it('keeps function IDs separately from records and other declarations', () => {
    const { architecture } = smallArchitectureFixture();
    const alt = architecture.modules.find(item => item.documentId === 'alt')!;
    const functionNames = alt.functionIds.map(id => architecture.symbols.find(item => item.id === id)?.name);
    const allNames = alt.symbolIds.map(id => architecture.symbols.find(item => item.id === id)?.name);

    expect(functionNames).toContain('render');
    expect(functionNames).not.toContain('Payload');
    expect(allNames).toContain('Payload');
  });

  it('records source coordinates and bounded headers for declarations', () => {
    const { architecture } = smallArchitectureFixture();
    const load = architecture.symbols.find(item => item.name === 'load')!;

    expect(load.documentId).toBe('service');
    expect(load.line).toBe(2);
    expect(load.column).toBeGreaterThan(0);
    expect(load.offset).toBeLessThan(load.end);
    expect(load.header).toContain('funcra load');
    expect(load.header.length).toBeLessThanOrEqual(240);
  });

  it('preserves the active document identity in the underlying symbol index', () => {
    const { architecture } = smallArchitectureFixture();
    expect(architecture.symbolIndex.activeId).toBe('main');
    expect(architecture.symbolIndex.scope).toBe('open');
  });

  it('produces a generation that changes when source revision changes', () => {
    const fixture = smallArchitectureFixture();
    const edited = fixture.documents.map((document, index) => index === 0
      ? { ...document, revision: document.revision + 1, content: document.content + '\n// edit' }
      : document);
    const next = buildWorkspaceArchitecture(edited, fixture.listing, 'main');

    expect(next.generation).not.toBe(fixture.architecture.generation);
  });

  it('produces a generation that changes when the reviewed listing changes', () => {
    const fixture = smallArchitectureFixture();
    const nextListing = [...fixture.listing, listed('extra.srp', 'C:\\work\\extra.srp')];
    const next = buildWorkspaceArchitecture(fixture.documents, nextListing, 'main');

    expect(next.generation).not.toBe(fixture.architecture.generation);
  });
});

describe('workspace architecture call observations', () => {
  it('uses a same-source unique function name when only one local candidate exists', () => {
    const { architecture } = smallArchitectureFixture();
    const site = architecture.callSites.find(item => item.documentId === 'service' && item.name === 'load')!;

    expect(site.status).toBe('same-source-unique');
    expect(site.candidateSymbolIds).toHaveLength(1);
    const candidate = architecture.symbols.find(item => item.id === site.candidateSymbolIds[0])!;
    expect(candidate.name).toBe('load');
    expect(candidate.documentId).toBe('service');
  });

  it('uses a workspace unique status for one open function in another source', () => {
    const { architecture } = smallArchitectureFixture();
    const site = architecture.callSites.find(item => item.documentId === 'main' && item.name === 'load')!;

    expect(site.status).toBe('workspace-unique');
    expect(site.candidateSymbolIds).toHaveLength(1);
    expect(architecture.symbols.find(item => item.id === site.candidateSymbolIds[0])?.documentId).toBe('service');
  });

  it('does not pretend two same-named open functions are resolved', () => {
    const { architecture } = ambiguousCallFixture();
    const sites = architecture.callSites.filter(item => item.name === 'calculate');

    expect(sites).toHaveLength(2);
    for (const site of sites) {
      expect(site.status).toBe('multiple-candidates');
      expect(site.candidateSymbolIds).toHaveLength(2);
      expect(site.edgeIds).toHaveLength(2);
    }
    expect(architecture.summary.ambiguousCallSiteCount).toBe(2);
  });

  it('marks a function spelling as shadow-prone when another declaration kind shares it', () => {
    const { architecture } = shadowedCallFixture();
    const site = architecture.callSites.find(item => item.name === 'target')!;

    expect(site.status).toBe('non-function-shadow');
    expect(site.candidateSymbolIds).toHaveLength(1);
    expect(architecture.symbols.some(item => item.name === 'target' && item.kind === 'binding')).toBe(true);
  });

  it('retains unmatched call-shaped identifiers without inventing edges', () => {
    const { architecture } = smallArchitectureFixture();
    const site = architecture.callSites.find(item => item.name === 'missing_call')!;

    expect(site.status).toBe('unmatched');
    expect(site.candidateSymbolIds).toEqual([]);
    expect(site.edgeIds).toEqual([]);
    expect(architecture.summary.unmatchedCallSiteCount).toBeGreaterThanOrEqual(1);
  });

  it('records the closest recognized enclosing function for call sites', () => {
    const { architecture } = smallArchitectureFixture();
    const site = architecture.callSites.find(item => item.documentId === 'service' && item.name === 'normalize')!;
    const caller = architectureSymbolForCallSite(architecture, site.id)!;

    expect(caller.name).toBe('load');
    expect(caller.documentId).toBe('service');
    expect(site.enclosingSymbolId).toBe(caller.id);
  });

  it('creates one edge per lexical candidate so ambiguity remains inspectable', () => {
    const { architecture } = ambiguousCallFixture();
    const site = architecture.callSites.find(item => item.name === 'calculate')!;
    const edges = architecture.callEdges.filter(edge => edge.callSiteId === site.id);

    expect(edges).toHaveLength(2);
    expect(new Set(edges.map(edge => edge.toSymbolId))).toEqual(new Set(site.candidateSymbolIds));
    expect(edges.every(edge => edge.status === 'multiple-candidates')).toBe(true);
    expect(edges.every(edge => edge.confidence === 'bounded-name-observation')).toBe(true);
  });

  it('marks candidate edges as same source only when caller and candidate share a document', () => {
    const { architecture } = smallArchitectureFixture();
    const local = architecture.callEdges.find(edge => edge.name === 'load' && edge.fromModuleId === edge.toModuleId)!;
    const cross = architecture.callEdges.find(edge => edge.name === 'load' && edge.fromModuleId !== edge.toModuleId)!;

    expect(local.sameSource).toBe(true);
    expect(cross.sameSource).toBe(false);
  });

  it('exposes stable human labels for every call status', () => {
    expect(architectureCallStatusLabel('same-source-unique')).toContain('same-source');
    expect(architectureCallStatusLabel('workspace-unique')).toContain('open-workspace');
    expect(architectureCallStatusLabel('multiple-candidates')).toContain('Multiple');
    expect(architectureCallStatusLabel('non-function-shadow')).toContain('declaration');
    expect(architectureCallStatusLabel('unmatched')).toContain('No indexed');
    expect(architectureCallStatusLabel('index-incomplete')).toContain('incomplete');
  });
});

describe('workspace architecture imports and components', () => {
  it('maps open literal imports onto module edges without changing import status', () => {
    const { architecture } = smallArchitectureFixture();
    const mainImport = architecture.importEdges.find(edge => edge.fromModuleId === moduleId(architecture, 'main'))!;

    expect(mainImport.specifier).toBe('src/service.srp');
    expect(mainImport.status).toBe('open');
    expect(mainImport.toModuleId).toBe(moduleId(architecture, 'service'));
  });

  it('records incoming and outgoing import IDs on module nodes', () => {
    const { architecture } = smallArchitectureFixture();
    const service = architecture.modules.find(item => item.documentId === 'service')!;
    const util = architecture.modules.find(item => item.documentId === 'util')!;

    expect(service.importEdgeIds.length).toBeGreaterThan(0);
    expect(service.incomingImportEdgeIds.length).toBeGreaterThan(0);
    expect(util.importEdgeIds.length).toBeGreaterThan(0);
    expect(util.incomingImportEdgeIds.length).toBeGreaterThan(0);
  });

  it('detects strongly connected import components', () => {
    const { architecture } = smallArchitectureFixture();
    const serviceId = moduleId(architecture, 'service');
    const utilId = moduleId(architecture, 'util');
    const cycle = architecture.cycles.find(item => item.kind === 'import' &&
      item.memberIds.includes(serviceId) && item.memberIds.includes(utilId));

    expect(cycle).toBeDefined();
    expect(cycle?.size).toBe(2);
    expect(cycle?.selfLoop).toBe(false);
    expect(cycle?.edgeIds.length).toBeGreaterThanOrEqual(2);
  });

  it('detects call recursion as an observed call component rather than runtime proof', () => {
    const { architecture } = smallArchitectureFixture();
    const normalize = functionId(architecture, 'normalize', 'util');
    const helper = functionId(architecture, 'helper', 'util');
    const cycle = architecture.cycles.find(item => item.kind === 'call' &&
      item.memberIds.includes(normalize) && item.memberIds.includes(helper));

    expect(cycle).toBeDefined();
    expect(cycle?.size).toBe(2);
  });

  it('returns all cycle memberships for a graph node', () => {
    const { architecture } = smallArchitectureFixture();
    const utilId = moduleId(architecture, 'util');
    const normalize = functionId(architecture, 'normalize', 'util');

    expect(architectureCycleMembership(architecture, utilId).some(item => item.kind === 'import')).toBe(true);
    expect(architectureCycleMembership(architecture, normalize).some(item => item.kind === 'call')).toBe(true);
  });

  it('creates acyclic component layers for a linear import chain', () => {
    const { architecture } = importChainFixture(7, false);
    const components = architecture.importComponents;

    expect(components).toHaveLength(7);
    expect(components.every(item => !item.cyclic)).toBe(true);
    expect(Math.max(...components.map(item => item.layer))).toBeGreaterThan(0);
  });

  it('collapses an entire import ring into one strongly connected component', () => {
    const { architecture } = importChainFixture(7, true);
    const cyclic = architecture.importComponents.filter(item => item.cyclic);

    expect(cyclic).toHaveLength(1);
    expect(cyclic[0].memberIds).toHaveLength(7);
    expect(architecture.cycles.some(item => item.kind === 'import' && item.size === 7)).toBe(true);
  });

  it('keeps component incoming and outgoing IDs internally consistent', () => {
    const { architecture } = importChainFixture(6, false);
    const byId = new Map(architecture.importComponents.map(component => [component.id, component]));

    for (const component of architecture.importComponents) {
      for (const outgoing of component.outgoingComponentIds) {
        expect(byId.get(outgoing)?.incomingComponentIds).toContain(component.id);
      }
      for (const incoming of component.incomingComponentIds) {
        expect(byId.get(incoming)?.outgoingComponentIds).toContain(component.id);
      }
    }
  });
});

describe('workspace architecture neighborhood and hotspots', () => {
  it('combines cross-module import and call observations for module neighbors', () => {
    const { architecture } = smallArchitectureFixture();
    const main = moduleId(architecture, 'main');
    const service = moduleId(architecture, 'service');
    const neighbors = architectureDirectNeighbors(architecture, main);

    expect(neighbors.outgoing).toContain(service);
    expect(neighbors.incoming).not.toContain(main);
  });

  it('uses call edges for function neighbors', () => {
    const { architecture } = smallArchitectureFixture();
    const normalize = functionId(architecture, 'normalize', 'util');
    const helper = functionId(architecture, 'helper', 'util');
    const neighbors = architectureDirectNeighbors(architecture, normalize);

    expect(neighbors.outgoing).toContain(helper);
    expect(neighbors.incoming).toContain(helper);
  });

  it('returns empty neighbors for unknown nodes', () => {
    const { architecture } = smallArchitectureFixture();
    expect(architectureDirectNeighbors(architecture, 'missing')).toEqual({ incoming: [], outgoing: [] });
  });

  it('provides hotspot records for ranked modules or functions', () => {
    const { architecture } = smallArchitectureFixture();
    expect(architecture.hotspots.length).toBeGreaterThan(0);
    const first = architecture.hotspots[0];

    expect(architectureHotspotFor(architecture, first.id)).toBe(first);
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(['low', 'medium', 'high', 'critical']).toContain(first.risk);
    expect(architectureRiskLabel(first.risk)).toContain('review priority');
  });

  it('returns null when a requested hotspot ID was never ranked', () => {
    const { architecture } = smallArchitectureFixture();
    expect(architectureHotspotFor(architecture, 'not-a-node')).toBeNull();
  });

  it('identifies isolated modules in a graph with no cross-source observations', () => {
    const documents = [
      studioDocument('a', 'a.srp', 'C:\\isolated\\a.srp', 'funcra alpha() { return; }\n'),
      studioDocument('b', 'b.srp', 'C:\\isolated\\b.srp', 'funcra beta() { return; }\n'),
    ];
    const listing = documents.map(document => listed(document.name, document.path!));
    const architecture = buildWorkspaceArchitecture(documents, listing, 'a');

    expect(new Set(architecture.isolatedModuleIds)).toEqual(new Set(architecture.modules.map(item => item.id)));
    expect(architecture.summary.isolatedModuleCount).toBe(2);
  });

  it('does not label a module isolated when it imports another open source', () => {
    const { architecture } = importChainFixture(3, false);
    expect(architecture.summary.isolatedModuleCount).toBe(0);
  });
});

describe('workspace architecture entrypoint observations', () => {
  it('marks a main-named function as an explicit entrypoint observation', () => {
    const { architecture } = smallArchitectureFixture();
    const main = architecture.entrypoints.find(item => item.name === 'main');

    expect(main).toBeDefined();
    expect(main?.reason).toBe('main-name');
    expect(main?.sourceName).toBe('main.srp');
  });

  it('marks functions without observed callers as possible entrypoints', () => {
    const { architecture } = smallArchitectureFixture();
    const publicEntry = architecture.entrypoints.find(item => item.name === 'public_entry');

    expect(publicEntry).toBeDefined();
    expect(publicEntry?.reason).toBe('no-observed-callers');
  });

  it('does not mark an ordinary called function as a caller-free entrypoint', () => {
    const { architecture } = smallArchitectureFixture();
    const load = architecture.entrypoints.find(item => item.name === 'load');
    expect(load).toBeUndefined();
  });
});

describe('workspace architecture node helpers', () => {
  it('resolves module and symbol IDs through the same node helper', () => {
    const { architecture } = smallArchitectureFixture();
    const module = architecture.modules[0];
    const symbol = architecture.symbols[0];

    expect(architectureNode(architecture, module.id)).toBe(module);
    expect(architectureNode(architecture, symbol.id)).toBe(symbol);
    expect(architectureNode(architecture, 'missing')).toBeNull();
  });

  it('labels modules with listed names when available', () => {
    const { architecture } = smallArchitectureFixture();
    const service = architecture.modules.find(item => item.documentId === 'service')!;
    expect(architectureNodeLabel(architecture, service.id)).toBe('src/service.srp');
  });

  it('labels symbols with their owning source', () => {
    const { architecture } = smallArchitectureFixture();
    const load = functionId(architecture, 'load', 'service');
    expect(architectureNodeLabel(architecture, load)).toContain('load');
    expect(architectureNodeLabel(architecture, load)).toContain('src/service.srp');
  });

  it('falls back to the supplied ID for an unknown node', () => {
    const { architecture } = smallArchitectureFixture();
    expect(architectureNodeLabel(architecture, 'unknown-node')).toBe('unknown-node');
  });

  it('provides readable coverage labels for each bounded reason', () => {
    const reasons = [
      'symbol-index-limited', 'import-graph-limited', 'module-limit', 'symbol-limit',
      'call-limit', 'import-limit', 'component-limit', 'cycle-limit',
    ] as const;
    for (const reason of reasons) expect(architectureCoverageLabel(reason).length).toBeGreaterThan(5);
  });
});

describe('workspace architecture freshness and navigation', () => {
  it('recognizes an unchanged architecture capture as current', () => {
    const fixture = smallArchitectureFixture();
    expect(architectureIsCurrent(fixture.architecture, fixture.documents, fixture.listing)).toBe(true);
  });

  it('rejects a source edit even when the document ID and path are unchanged', () => {
    const fixture = smallArchitectureFixture();
    const changed = fixture.documents.map((document, index) => index === 0
      ? { ...document, revision: document.revision + 1, content: document.content + ' ' }
      : document);
    expect(architectureIsCurrent(fixture.architecture, changed, fixture.listing)).toBe(false);
  });

  it('rejects ABA source text when the revision changed', () => {
    const fixture = smallArchitectureFixture();
    const changed = fixture.documents.map((document, index) => index === 0
      ? { ...document, revision: document.revision + 2 }
      : document);
    expect(architectureIsCurrent(fixture.architecture, changed, fixture.listing)).toBe(false);
  });

  it('rejects listing reordering because the capture describes an exact reviewed generation', () => {
    const fixture = smallArchitectureFixture();
    const reordered = [...fixture.listing].reverse();
    expect(architectureIsCurrent(fixture.architecture, fixture.documents, reordered)).toBe(false);
  });

  it('navigates only to a declaration that still matches the exact captured buffer', () => {
    const fixture = smallArchitectureFixture();
    const load = functionId(fixture.architecture, 'load', 'service');
    const target = architectureNavigationTarget(fixture.architecture, fixture.documents, load);

    expect(target).not.toBeNull();
    expect(target?.documentId).toBe('service');
    expect(target?.line).toBe(2);
  });

  it('rejects declaration navigation after the target buffer changes', () => {
    const fixture = smallArchitectureFixture();
    const load = functionId(fixture.architecture, 'load', 'service');
    const changed = fixture.documents.map(document => document.id === 'service'
      ? { ...document, revision: document.revision + 1, content: document.content.replace('load', 'load2') }
      : document);

    expect(architectureNavigationTarget(fixture.architecture, changed, load)).toBeNull();
  });

  it('supports exact call-site navigation while the captured token is current', () => {
    const fixture = smallArchitectureFixture();
    const site = fixture.architecture.callSites.find(item => item.documentId === 'main' && item.name === 'load')!;
    const target = architectureObservedLocationTarget(fixture.architecture, fixture.documents, site.id);

    expect(target).not.toBeNull();
    expect(target?.documentId).toBe('main');
    expect(target?.line).toBe(3);
  });

  it('rejects call-site navigation after an edit moves or changes the token', () => {
    const fixture = smallArchitectureFixture();
    const site = fixture.architecture.callSites.find(item => item.documentId === 'main' && item.name === 'load')!;
    const changed = fixture.documents.map(document => document.id === 'main'
      ? { ...document, revision: document.revision + 1, content: document.content.replace('load();', 'other();') }
      : document);

    expect(architectureObservedLocationTarget(fixture.architecture, changed, site.id)).toBeNull();
  });

  it('supports exact import observation navigation while the source generation is current', () => {
    const fixture = smallArchitectureFixture();
    const edge = fixture.architecture.importEdges.find(item => item.fromModuleId === moduleId(fixture.architecture, 'main'))!;
    const target = architectureObservedLocationTarget(fixture.architecture, fixture.documents, edge.id);

    expect(target).not.toBeNull();
    expect(target?.documentId).toBe('main');
    expect(target?.line).toBe(1);
    expect(target?.column).toBe(1);
  });

  it('rejects import navigation when import no longer begins at the captured offset', () => {
    const fixture = smallArchitectureFixture();
    const edge = fixture.architecture.importEdges.find(item => item.fromModuleId === moduleId(fixture.architecture, 'main'))!;
    const changed = fixture.documents.map(document => document.id === 'main'
      ? { ...document, revision: document.revision + 1, content: '// moved\n' + document.content }
      : document);

    expect(architectureObservedLocationTarget(fixture.architecture, changed, edge.id)).toBeNull();
  });

  it('does not invent navigation for module, cycle or unknown IDs', () => {
    const fixture = smallArchitectureFixture();
    expect(architectureObservedLocationTarget(fixture.architecture, fixture.documents, fixture.architecture.modules[0].id)).toBeNull();
    expect(architectureObservedLocationTarget(fixture.architecture, fixture.documents, fixture.architecture.cycles[0].id)).toBeNull();
    expect(architectureObservedLocationTarget(fixture.architecture, fixture.documents, 'missing')).toBeNull();
  });
});

describe('workspace architecture bounds', () => {
  it('caps captured modules and records a coverage reason', () => {
    const documents = Array.from({ length: MAX_ARCHITECTURE_MODULES + 3 }, (_, index) =>
      studioDocument('doc-' + index, 'd' + index + '.srp', 'C:\\bound\\d' + index + '.srp',
        'funcra f' + index + '() { return; }\n'));
    const listing = documents.map(document => listed(document.name, document.path!));
    const architecture = buildWorkspaceArchitecture(documents, listing, documents[0].id);

    expect(architecture.modules).toHaveLength(MAX_ARCHITECTURE_MODULES);
    expect(architecture.coverageReasons).toContain('module-limit');
    expect(architecture.summary.complete).toBe(false);
  });

  it('keeps the call-site surface bounded for generated open-buffer observations', () => {
    const calls = Array.from({ length: Math.min(MAX_ARCHITECTURE_CALLS + 10, 5000) }, () => '  target();').join('\n');
    const source = 'funcra target() { return; }\nfuncra main() {\n' + calls + '\n}\n';
    const document = studioDocument('calls', 'calls.srp', 'C:\\bound\\calls.srp', source);
    const architecture = buildWorkspaceArchitecture([document], [listed(document.name, document.path!)], 'calls');

    expect(architecture.callSites.length).toBeLessThanOrEqual(MAX_ARCHITECTURE_CALLS);
  });

  it('keeps direct-neighbor arrays bounded for large linear graphs', () => {
    const { architecture } = linearArchitectureFixture(24);
    for (const symbol of architecture.symbols.filter(item => item.kind === 'function')) {
      const neighbors = architectureDirectNeighbors(architecture, symbol.id);
      expect(neighbors.incoming.length).toBeLessThanOrEqual(256);
      expect(neighbors.outgoing.length).toBeLessThanOrEqual(256);
    }
  });
});
