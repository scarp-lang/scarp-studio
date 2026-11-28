import { describe, expect, it } from 'vitest';
import { buildWorkspaceArchitecture } from './workspaceArchitecture';
import { calculateArchitectureMetrics } from './workspaceArchitectureMetrics';
import { smallArchitectureFixture, importChainFixture, ambiguousCallFixture } from '../test/workspaceArchitectureFixtures';

function assertGraphInvariants(architecture: ReturnType<typeof buildWorkspaceArchitecture>): void {
  const moduleIds = new Set(architecture.modules.map(item => item.id));
  const symbolIds = new Set(architecture.symbols.map(item => item.id));
  const callSiteIds = new Set(architecture.callSites.map(item => item.id));
  const callEdgeIds = new Set(architecture.callEdges.map(item => item.id));
  const importEdgeIds = new Set(architecture.importEdges.map(item => item.id));

  expect(moduleIds.size).toBe(architecture.modules.length);
  expect(symbolIds.size).toBe(architecture.symbols.length);
  expect(callSiteIds.size).toBe(architecture.callSites.length);
  expect(callEdgeIds.size).toBe(architecture.callEdges.length);
  expect(importEdgeIds.size).toBe(architecture.importEdges.length);

  for (const module of architecture.modules) {
    expect(moduleIds.has(module.id)).toBe(true);
    expect(module.symbolIds.every(id => symbolIds.has(id))).toBe(true);
    expect(module.functionIds.every(id => symbolIds.has(id))).toBe(true);
    expect(module.importEdgeIds.every(id => importEdgeIds.has(id))).toBe(true);
    expect(module.incomingImportEdgeIds.every(id => importEdgeIds.has(id))).toBe(true);
    expect(module.callSiteIds.every(id => callSiteIds.has(id))).toBe(true);
    expect(new Set(module.symbolIds).size).toBe(module.symbolIds.length);
    expect(new Set(module.functionIds).size).toBe(module.functionIds.length);
  }

  for (const symbol of architecture.symbols) {
    expect(moduleIds.has(symbol.moduleId)).toBe(true);
    expect(symbol.incomingCallEdgeIds.every(id => callEdgeIds.has(id))).toBe(true);
    expect(symbol.outgoingCallEdgeIds.every(id => callEdgeIds.has(id))).toBe(true);
    expect(new Set(symbol.incomingCallEdgeIds).size).toBe(symbol.incomingCallEdgeIds.length);
    expect(new Set(symbol.outgoingCallEdgeIds).size).toBe(symbol.outgoingCallEdgeIds.length);
    if (symbol.kind === 'function') {
      const owner = architecture.modules.find(item => item.id === symbol.moduleId)!;
      expect(owner.functionIds).toContain(symbol.id);
    }
  }

  for (const site of architecture.callSites) {
    expect(moduleIds.has(site.moduleId)).toBe(true);
    expect(site.candidateSymbolIds.every(id => symbolIds.has(id))).toBe(true);
    expect(site.edgeIds.every(id => callEdgeIds.has(id))).toBe(true);
    expect(new Set(site.candidateSymbolIds).size).toBe(site.candidateSymbolIds.length);
    expect(new Set(site.edgeIds).size).toBe(site.edgeIds.length);
    if (site.enclosingSymbolId) expect(symbolIds.has(site.enclosingSymbolId)).toBe(true);
  }

  for (const edge of architecture.callEdges) {
    expect(callSiteIds.has(edge.callSiteId)).toBe(true);
    expect(moduleIds.has(edge.fromModuleId)).toBe(true);
    expect(moduleIds.has(edge.toModuleId)).toBe(true);
    expect(symbolIds.has(edge.toSymbolId)).toBe(true);
    if (edge.fromSymbolId) expect(symbolIds.has(edge.fromSymbolId)).toBe(true);
    const target = architecture.symbols.find(item => item.id === edge.toSymbolId)!;
    expect(target.kind).toBe('function');
    expect(target.moduleId).toBe(edge.toModuleId);
  }

  for (const edge of architecture.importEdges) {
    expect(moduleIds.has(edge.fromModuleId)).toBe(true);
    if (edge.toModuleId) expect(moduleIds.has(edge.toModuleId)).toBe(true);
  }
}

describe('workspace architecture graph invariants', () => {
  it('holds for the mixed call/import fixture', () => {
    assertGraphInvariants(smallArchitectureFixture().architecture);
  });

  it('holds for a linear import chain', () => {
    assertGraphInvariants(importChainFixture(12, false).architecture);
  });

  it('holds for a cyclic import ring', () => {
    assertGraphInvariants(importChainFixture(12, true).architecture);
  });

  it('holds for an ambiguous call graph', () => {
    assertGraphInvariants(ambiguousCallFixture().architecture);
  });
});

describe('component condensation invariants', () => {
  it('assigns every import-graph module to at most one component', () => {
    const architecture = importChainFixture(12, true).architecture;
    const memberships = new Map<string, number>();
    for (const component of architecture.importComponents) {
      for (const id of component.memberIds) memberships.set(id, (memberships.get(id) ?? 0) + 1);
    }
    for (const module of architecture.modules) expect(memberships.get(module.id)).toBe(1);
  });

  it('assigns every function participating in call topology to at most one component', () => {
    const architecture = smallArchitectureFixture().architecture;
    const memberships = new Map<string, number>();
    for (const component of architecture.callComponents) {
      for (const id of component.memberIds) memberships.set(id, (memberships.get(id) ?? 0) + 1);
    }
    for (const count of memberships.values()) expect(count).toBe(1);
  });

  it('never creates condensation self-links', () => {
    const architecture = importChainFixture(12, true).architecture;
    for (const component of [...architecture.importComponents, ...architecture.callComponents]) {
      expect(component.incomingComponentIds).not.toContain(component.id);
      expect(component.outgoingComponentIds).not.toContain(component.id);
    }
  });

  it('keeps reciprocal condensation adjacency consistent', () => {
    const architecture = smallArchitectureFixture().architecture;
    for (const components of [architecture.importComponents, architecture.callComponents]) {
      const byId = new Map(components.map(item => [item.id, item]));
      for (const component of components) {
        for (const outgoing of component.outgoingComponentIds) expect(byId.get(outgoing)?.incomingComponentIds).toContain(component.id);
        for (const incoming of component.incomingComponentIds) expect(byId.get(incoming)?.outgoingComponentIds).toContain(component.id);
      }
    }
  });
});

describe('summary invariants', () => {
  it('summary counts mirror materialized entity arrays', () => {
    const architecture = smallArchitectureFixture().architecture;
    expect(architecture.summary.moduleCount).toBe(architecture.modules.length);
    expect(architecture.summary.symbolCount).toBe(architecture.symbols.length);
    expect(architecture.summary.functionCount).toBe(architecture.symbols.filter(item => item.kind === 'function').length);
    expect(architecture.summary.callSiteCount).toBe(architecture.callSites.length);
    expect(architecture.summary.callEdgeCount).toBe(architecture.callEdges.length);
    expect(architecture.summary.importEdgeCount).toBe(architecture.importEdges.length);
    expect(architecture.summary.importCycleCount).toBe(architecture.cycles.filter(item => item.kind === 'import').length);
    expect(architecture.summary.callCycleCount).toBe(architecture.cycles.filter(item => item.kind === 'call').length);
  });

  it('resolved plus unresolved import counts equal total import edges', () => {
    const architecture = smallArchitectureFixture().architecture;
    expect(architecture.summary.resolvedImportEdgeCount + architecture.summary.unresolvedImportEdgeCount)
      .toBe(architecture.summary.importEdgeCount);
  });

  it('ambiguous and unmatched counts match call-site statuses', () => {
    const architecture = smallArchitectureFixture().architecture;
    expect(architecture.summary.ambiguousCallSiteCount).toBe(architecture.callSites
      .filter(item => item.status === 'multiple-candidates' || item.status === 'non-function-shadow').length);
    expect(architecture.summary.unmatchedCallSiteCount).toBe(architecture.callSites.filter(item => item.status === 'unmatched').length);
  });
});

describe('metric entity identity invariants', () => {
  it('module metric IDs always refer to current architecture modules', () => {
    const architecture = smallArchitectureFixture().architecture;
    const metrics = calculateArchitectureMetrics(architecture);
    const ids = new Set(architecture.modules.map(item => item.id));
    expect(metrics.modules.every(item => ids.has(item.moduleId))).toBe(true);
  });

  it('symbol metric IDs always refer to current architecture functions', () => {
    const architecture = smallArchitectureFixture().architecture;
    const metrics = calculateArchitectureMetrics(architecture);
    const ids = new Set(architecture.symbols.filter(item => item.kind === 'function').map(item => item.id));
    expect(metrics.symbols.every(item => ids.has(item.symbolId))).toBe(true);
  });
});
