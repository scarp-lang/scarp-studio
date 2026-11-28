import type { StudioDocument } from './documents';
import type { ListedImportSource, ScarpSourceImport, SourceImportGraph } from './sourceImports';
import { buildScarpImportGraph } from './sourceImports';
import {
  buildWorkspaceSymbolIndex,
  type SymbolKind,
  type WorkspaceCall,
  type WorkspaceSymbol,
  type WorkspaceSymbolIndex,
} from './workspaceSymbols';

/**
 * Read-only architecture observations for already-open Scarp buffers.
 *
 * This module intentionally combines two existing bounded editor indexes:
 * - sourceImports: literal import headers matched against the reviewed Explorer listing;
 * - workspaceSymbols: lexical declarations and call-shaped identifiers in open buffers.
 *
 * It does not perform compiler name resolution, module resolution, type checking,
 * overload resolution, reachability analysis, dead-code analysis, or semantic rename.
 * Every call edge is therefore explicitly represented as an observed candidate edge.
 */

export const MAX_ARCHITECTURE_MODULES = 200;
export const MAX_ARCHITECTURE_SYMBOLS = 1500;
export const MAX_ARCHITECTURE_CALLS = 4000;
export const MAX_ARCHITECTURE_IMPORTS = 768;
export const MAX_ARCHITECTURE_COMPONENTS = 512;
export const MAX_ARCHITECTURE_CYCLES = 64;
export const MAX_ARCHITECTURE_HOTSPOTS = 96;
export const MAX_ARCHITECTURE_ENTRYPOINTS = 64;
export const MAX_ARCHITECTURE_NEIGHBORS = 256;
export const MAX_ARCHITECTURE_PATH_DEPTH = 64;
export const MAX_ARCHITECTURE_PATHS = 128;
export const MAX_ARCHITECTURE_NAME_GROUP = 128;
export const MAX_ARCHITECTURE_HEADER_UNITS = 240;

export type ArchitectureCoverageReason =
  | 'symbol-index-limited'
  | 'import-graph-limited'
  | 'module-limit'
  | 'symbol-limit'
  | 'call-limit'
  | 'import-limit'
  | 'component-limit'
  | 'cycle-limit';

export type ArchitectureCallStatus =
  | 'same-source-unique'
  | 'workspace-unique'
  | 'multiple-candidates'
  | 'non-function-shadow'
  | 'unmatched'
  | 'index-incomplete';

export type ArchitectureImportStatus = ScarpSourceImport['status'];
export type ArchitectureNodeKind = 'module' | 'symbol';
export type ArchitectureEdgeKind = 'import' | 'call';
export type ArchitectureComponentKind = 'import' | 'call';
export type ArchitectureRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ArchitectureModule {
  readonly id: string;
  readonly documentId: string;
  readonly revision: number;
  readonly name: string;
  readonly path: string | null;
  readonly listedName: string | null;
  readonly contentLength: number;
  readonly symbolIds: readonly string[];
  readonly functionIds: readonly string[];
  readonly importEdgeIds: readonly string[];
  readonly incomingImportEdgeIds: readonly string[];
  readonly callSiteIds: readonly string[];
  readonly incomplete: boolean;
}

export interface ArchitectureSymbol {
  readonly id: string;
  readonly documentId: string;
  readonly moduleId: string;
  readonly revision: number;
  readonly name: string;
  readonly kind: SymbolKind;
  readonly scope: WorkspaceSymbol['scope'];
  readonly visibility: WorkspaceSymbol['visibility'];
  readonly pure: boolean;
  readonly line: number;
  readonly column: number;
  readonly offset: number;
  readonly end: number;
  readonly depth: number;
  readonly header: string;
  readonly incomingCallEdgeIds: readonly string[];
  readonly outgoingCallEdgeIds: readonly string[];
  readonly observedCallSiteCount: number;
}

export interface ArchitectureCallSite {
  readonly id: string;
  readonly documentId: string;
  readonly moduleId: string;
  readonly revision: number;
  readonly name: string;
  readonly line: number;
  readonly column: number;
  readonly offset: number;
  readonly end: number;
  readonly enclosingSymbolId: string | null;
  readonly candidateSymbolIds: readonly string[];
  readonly status: ArchitectureCallStatus;
  readonly edgeIds: readonly string[];
}

export interface ArchitectureCallEdge {
  readonly id: string;
  readonly kind: 'call';
  readonly callSiteId: string;
  readonly fromModuleId: string;
  readonly fromSymbolId: string | null;
  readonly toSymbolId: string;
  readonly toModuleId: string;
  readonly name: string;
  readonly status: ArchitectureCallStatus;
  readonly sameSource: boolean;
  readonly confidence: 'bounded-name-observation';
}

export interface ArchitectureImportEdge {
  readonly id: string;
  readonly kind: 'import';
  readonly sourceImportId: string;
  readonly fromModuleId: string;
  readonly toModuleId: string | null;
  readonly status: ArchitectureImportStatus;
  readonly specifier: string;
  readonly alias: string | null;
  readonly line: number;
  readonly column: number;
  readonly targetRelativeName: string | null;
  readonly note: string | null;
}

export type ArchitectureEdge = ArchitectureCallEdge | ArchitectureImportEdge;

export interface ArchitectureComponent {
  readonly id: string;
  readonly kind: ArchitectureComponentKind;
  readonly memberIds: readonly string[];
  readonly cyclic: boolean;
  readonly selfLoop: boolean;
  readonly incomingComponentIds: readonly string[];
  readonly outgoingComponentIds: readonly string[];
  readonly layer: number;
}

export interface ArchitectureCycle {
  readonly id: string;
  readonly kind: ArchitectureComponentKind;
  readonly memberIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly size: number;
  readonly selfLoop: boolean;
}

export interface ArchitectureHotspot {
  readonly id: string;
  readonly kind: ArchitectureNodeKind;
  readonly label: string;
  readonly incoming: number;
  readonly outgoing: number;
  readonly ambiguous: number;
  readonly cycleCount: number;
  readonly score: number;
  readonly risk: ArchitectureRiskLevel;
  readonly reasons: readonly string[];
}

export interface ArchitectureEntrypoint {
  readonly symbolId: string;
  readonly moduleId: string;
  readonly name: string;
  readonly sourceName: string;
  readonly line: number;
  readonly reason: 'main-name' | 'no-observed-callers';
}

export interface ArchitectureSummary {
  readonly moduleCount: number;
  readonly symbolCount: number;
  readonly functionCount: number;
  readonly callSiteCount: number;
  readonly callEdgeCount: number;
  readonly importEdgeCount: number;
  readonly resolvedImportEdgeCount: number;
  readonly unresolvedImportEdgeCount: number;
  readonly ambiguousCallSiteCount: number;
  readonly unmatchedCallSiteCount: number;
  readonly importCycleCount: number;
  readonly callCycleCount: number;
  readonly orphanModuleCount: number;
  readonly isolatedModuleCount: number;
  readonly entrypointCount: number;
  readonly complete: boolean;
}

export interface WorkspaceArchitecture {
  readonly generation: string;
  readonly documents: readonly {
    id: string;
    revision: number;
    name: string;
    path: string | null;
    content: string;
  }[];
  readonly listing: readonly ListedImportSource[];
  readonly symbolIndex: WorkspaceSymbolIndex;
  readonly importGraph: SourceImportGraph;
  readonly modules: readonly ArchitectureModule[];
  readonly symbols: readonly ArchitectureSymbol[];
  readonly callSites: readonly ArchitectureCallSite[];
  readonly callEdges: readonly ArchitectureCallEdge[];
  readonly importEdges: readonly ArchitectureImportEdge[];
  readonly importComponents: readonly ArchitectureComponent[];
  readonly callComponents: readonly ArchitectureComponent[];
  readonly cycles: readonly ArchitectureCycle[];
  readonly hotspots: readonly ArchitectureHotspot[];
  readonly entrypoints: readonly ArchitectureEntrypoint[];
  readonly orphanModuleIds: readonly string[];
  readonly isolatedModuleIds: readonly string[];
  readonly coverageReasons: readonly ArchitectureCoverageReason[];
  readonly summary: ArchitectureSummary;
}

interface MutableModule {
  id: string;
  documentId: string;
  revision: number;
  name: string;
  path: string | null;
  listedName: string | null;
  contentLength: number;
  symbolIds: string[];
  functionIds: string[];
  importEdgeIds: string[];
  incomingImportEdgeIds: string[];
  callSiteIds: string[];
  incomplete: boolean;
}

interface MutableSymbol extends Omit<ArchitectureSymbol,
  'incomingCallEdgeIds' | 'outgoingCallEdgeIds' | 'observedCallSiteCount'> {
  incomingCallEdgeIds: string[];
  outgoingCallEdgeIds: string[];
  observedCallSiteCount: number;
}

interface MutableCallSite extends Omit<ArchitectureCallSite, 'candidateSymbolIds' | 'edgeIds'> {
  candidateSymbolIds: string[];
  edgeIds: string[];
}

interface GraphComponentResult {
  components: ArchitectureComponent[];
  componentOf: Map<string, number>;
  cycles: ArchitectureCycle[];
  limited: boolean;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareText);
}

function boundedText(value: string, units: number): string {
  if (value.length <= units) return value;
  const end = Math.max(0, units - 1);
  const adjusted = end > 0 && /[\uD800-\uDBFF]/.test(value[end - 1]) &&
    /[\uDC00-\uDFFF]/.test(value[end]) ? end - 1 : end;
  return value.slice(0, adjusted) + '…';
}

function moduleId(documentId: string): string {
  return JSON.stringify(['architecture-module', documentId]);
}

function listedNameForDocument(
  document: StudioDocument,
  importGraph: SourceImportGraph,
): string | null {
  return importGraph.nodes.find(node => node.documentId === document.id)?.sourceName ?? null;
}

function architectureGeneration(
  documents: readonly StudioDocument[],
  listing: readonly ListedImportSource[],
): string {
  const docPart = documents.map(document => [document.id, document.revision, document.name,
    document.path, document.content.length]);
  const listPart = listing.map(item => [item.name, item.path]);
  return JSON.stringify([docPart, listPart]);
}

function callStatus(
  call: WorkspaceCall,
  functionsByName: ReadonlyMap<string, readonly WorkspaceSymbol[]>,
  nonFunctionsByName: ReadonlyMap<string, readonly WorkspaceSymbol[]>,
  complete: boolean,
): { status: ArchitectureCallStatus; candidates: WorkspaceSymbol[] } {
  const functions = [...(functionsByName.get(call.name) ?? [])];
  const nonFunctions = nonFunctionsByName.get(call.name) ?? [];
  const sameSource = functions.filter(symbol => symbol.documentId === call.documentId);
  if (!complete) return { status: 'index-incomplete', candidates: sameSource.length ? sameSource : functions };
  if (nonFunctions.length) return { status: 'non-function-shadow', candidates: sameSource.length ? sameSource : functions };
  if (sameSource.length === 1) return { status: 'same-source-unique', candidates: sameSource };
  if (sameSource.length > 1) return { status: 'multiple-candidates', candidates: sameSource };
  if (functions.length === 1) return { status: 'workspace-unique', candidates: functions };
  if (functions.length > 1) return { status: 'multiple-candidates', candidates: functions };
  return { status: 'unmatched', candidates: [] };
}

function riskFromScore(score: number): ArchitectureRiskLevel {
  if (score >= 28) return 'critical';
  if (score >= 16) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}

function graphComponents(
  kind: ArchitectureComponentKind,
  nodeIds: readonly string[],
  edges: readonly { id: string; from: string; to: string }[],
): GraphComponentResult {
  const nodes = uniqueSorted(nodeIds).slice(0, MAX_ARCHITECTURE_COMPONENTS * MAX_ARCHITECTURE_NEIGHBORS);
  const nodeSet = new Set(nodes);
  const adjacency = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  const edgeIdsByPair = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node, []);
    reverse.set(node, []);
  }
  for (const edge of edges) {
    if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) continue;
    const outgoing = adjacency.get(edge.from)!;
    if (outgoing.length < MAX_ARCHITECTURE_NEIGHBORS && !outgoing.includes(edge.to)) outgoing.push(edge.to);
    const incoming = reverse.get(edge.to)!;
    if (incoming.length < MAX_ARCHITECTURE_NEIGHBORS && !incoming.includes(edge.from)) incoming.push(edge.from);
    const key = edge.from + '\0' + edge.to;
    const ids = edgeIdsByPair.get(key);
    if (ids) ids.push(edge.id); else edgeIdsByPair.set(key, [edge.id]);
  }
  for (const list of adjacency.values()) list.sort(compareText);
  for (const list of reverse.values()) list.sort(compareText);

  // Iterative Kosaraju keeps recursion depth independent of workspace structure.
  const visited = new Set<string>();
  const finishOrder: string[] = [];
  for (const root of nodes) {
    if (visited.has(root)) continue;
    const stack: { id: string; next: number }[] = [{ id: root, next: 0 }];
    visited.add(root);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const nexts = adjacency.get(frame.id) ?? [];
      if (frame.next < nexts.length) {
        const next = nexts[frame.next++];
        if (!visited.has(next)) {
          visited.add(next);
          stack.push({ id: next, next: 0 });
        }
      } else {
        finishOrder.push(frame.id);
        stack.pop();
      }
    }
  }

  const assigned = new Set<string>();
  const rawComponents: string[][] = [];
  for (let index = finishOrder.length - 1; index >= 0; index--) {
    const root = finishOrder[index];
    if (assigned.has(root)) continue;
    const members: string[] = [];
    const stack = [root];
    assigned.add(root);
    while (stack.length) {
      const current = stack.pop()!;
      members.push(current);
      for (const next of reverse.get(current) ?? []) {
        if (!assigned.has(next)) {
          assigned.add(next);
          stack.push(next);
        }
      }
    }
    members.sort(compareText);
    rawComponents.push(members);
  }
  rawComponents.sort((a, b) => compareText(a[0] ?? '', b[0] ?? ''));
  const limited = rawComponents.length > MAX_ARCHITECTURE_COMPONENTS;
  const selectedComponents = rawComponents.slice(0, MAX_ARCHITECTURE_COMPONENTS);
  const componentOf = new Map<string, number>();
  selectedComponents.forEach((members, componentIndex) => {
    for (const member of members) componentOf.set(member, componentIndex);
  });

  const incoming = selectedComponents.map(() => new Set<number>());
  const outgoing = selectedComponents.map(() => new Set<number>());
  const selfLoops = selectedComponents.map(() => false);
  for (const edge of edges) {
    const from = componentOf.get(edge.from);
    const to = componentOf.get(edge.to);
    if (from === undefined || to === undefined) continue;
    if (from === to) {
      if (edge.from === edge.to) selfLoops[from] = true;
      continue;
    }
    outgoing[from].add(to);
    incoming[to].add(from);
  }

  // Layer each condensed DAG component by longest predecessor distance.
  const indegree = incoming.map(set => set.size);
  const queue: number[] = [];
  for (let i = 0; i < indegree.length; i++) if (indegree[i] === 0) queue.push(i);
  queue.sort((a, b) => compareText(selectedComponents[a][0] ?? '', selectedComponents[b][0] ?? ''));
  const layers = selectedComponents.map(() => 0);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const nexts = [...outgoing[current]].sort((a, b) =>
      compareText(selectedComponents[a][0] ?? '', selectedComponents[b][0] ?? ''));
    for (const next of nexts) {
      layers[next] = Math.max(layers[next], layers[current] + 1);
      indegree[next]--;
      if (indegree[next] === 0) queue.push(next);
    }
  }

  const components: ArchitectureComponent[] = selectedComponents.map((members, index) => {
    const cyclic = members.length > 1 || selfLoops[index];
    return Object.freeze({
      id: JSON.stringify(['architecture-component', kind, members]),
      kind,
      memberIds: Object.freeze([...members]),
      cyclic,
      selfLoop: selfLoops[index],
      incomingComponentIds: Object.freeze(uniqueSorted([...incoming[index]].map(value =>
        JSON.stringify(['architecture-component', kind, selectedComponents[value]])))),
      outgoingComponentIds: Object.freeze(uniqueSorted([...outgoing[index]].map(value =>
        JSON.stringify(['architecture-component', kind, selectedComponents[value]])))),
      layer: layers[index],
    });
  });

  const cycles: ArchitectureCycle[] = [];
  for (let index = 0; index < selectedComponents.length && cycles.length < MAX_ARCHITECTURE_CYCLES; index++) {
    const members = selectedComponents[index];
    if (members.length < 2 && !selfLoops[index]) continue;
    const memberSet = new Set(members);
    const edgeIds: string[] = [];
    for (const edge of edges) {
      if (memberSet.has(edge.from) && memberSet.has(edge.to)) edgeIds.push(edge.id);
    }
    cycles.push(Object.freeze({
      id: JSON.stringify(['architecture-cycle', kind, members]),
      kind,
      memberIds: Object.freeze([...members]),
      edgeIds: Object.freeze(uniqueSorted(edgeIds)),
      size: members.length,
      selfLoop: members.length === 1 && selfLoops[index],
    }));
  }
  return { components, componentOf, cycles, limited: limited || cycles.length >= MAX_ARCHITECTURE_CYCLES };
}

function buildHotspots(
  modules: readonly ArchitectureModule[],
  symbols: readonly ArchitectureSymbol[],
  callSites: readonly ArchitectureCallSite[],
  callEdges: readonly ArchitectureCallEdge[],
  importEdges: readonly ArchitectureImportEdge[],
  cycles: readonly ArchitectureCycle[],
): ArchitectureHotspot[] {
  const cycleMembership = new Map<string, number>();
  for (const cycle of cycles) {
    for (const id of cycle.memberIds) cycleMembership.set(id, (cycleMembership.get(id) ?? 0) + 1);
  }
  const ambiguousByModule = new Map<string, number>();
  const ambiguousBySymbol = new Map<string, number>();
  for (const site of callSites) {
    if (site.status === 'multiple-candidates' || site.status === 'non-function-shadow' ||
        site.status === 'index-incomplete') {
      ambiguousByModule.set(site.moduleId, (ambiguousByModule.get(site.moduleId) ?? 0) + 1);
      if (site.enclosingSymbolId) {
        ambiguousBySymbol.set(site.enclosingSymbolId, (ambiguousBySymbol.get(site.enclosingSymbolId) ?? 0) + 1);
      }
    }
  }
  const moduleIncoming = new Map<string, number>();
  const moduleOutgoing = new Map<string, number>();
  for (const edge of importEdges) {
    moduleOutgoing.set(edge.fromModuleId, (moduleOutgoing.get(edge.fromModuleId) ?? 0) + 1);
    if (edge.toModuleId) moduleIncoming.set(edge.toModuleId, (moduleIncoming.get(edge.toModuleId) ?? 0) + 1);
  }
  for (const edge of callEdges) {
    if (edge.fromModuleId !== edge.toModuleId) {
      moduleOutgoing.set(edge.fromModuleId, (moduleOutgoing.get(edge.fromModuleId) ?? 0) + 1);
      moduleIncoming.set(edge.toModuleId, (moduleIncoming.get(edge.toModuleId) ?? 0) + 1);
    }
  }
  const hotspots: ArchitectureHotspot[] = [];
  for (const module of modules) {
    const incoming = moduleIncoming.get(module.id) ?? 0;
    const outgoing = moduleOutgoing.get(module.id) ?? 0;
    const ambiguous = ambiguousByModule.get(module.id) ?? 0;
    const cycleCount = cycleMembership.get(module.id) ?? 0;
    const score = Math.min(99, incoming * 2 + outgoing + ambiguous * 3 + cycleCount * 8 +
      (module.incomplete ? 4 : 0));
    const reasons: string[] = [];
    if (incoming >= 4) reasons.push('many observed inbound dependencies');
    if (outgoing >= 6) reasons.push('many observed outbound dependencies');
    if (ambiguous) reasons.push(ambiguous + ' ambiguous call site' + (ambiguous === 1 ? '' : 's'));
    if (cycleCount) reasons.push('participates in ' + cycleCount + ' observed cycle' + (cycleCount === 1 ? '' : 's'));
    if (module.incomplete) reasons.push('source analysis is incomplete');
    if (score >= 4 || reasons.length) hotspots.push(Object.freeze({
      id: module.id,
      kind: 'module',
      label: module.listedName ?? module.name,
      incoming,
      outgoing,
      ambiguous,
      cycleCount,
      score,
      risk: riskFromScore(score),
      reasons: Object.freeze(reasons),
    }));
  }
  const incomingCalls = new Map<string, number>();
  const outgoingCalls = new Map<string, number>();
  for (const edge of callEdges) {
    incomingCalls.set(edge.toSymbolId, (incomingCalls.get(edge.toSymbolId) ?? 0) + 1);
    if (edge.fromSymbolId) outgoingCalls.set(edge.fromSymbolId, (outgoingCalls.get(edge.fromSymbolId) ?? 0) + 1);
  }
  for (const symbol of symbols.filter(item => item.kind === 'function')) {
    const incoming = incomingCalls.get(symbol.id) ?? 0;
    const outgoing = outgoingCalls.get(symbol.id) ?? 0;
    const ambiguous = ambiguousBySymbol.get(symbol.id) ?? 0;
    const cycleCount = cycleMembership.get(symbol.id) ?? 0;
    const score = Math.min(99, incoming * 2 + outgoing + ambiguous * 3 + cycleCount * 8 +
      (symbol.scope === 'nested' ? 1 : 0));
    const reasons: string[] = [];
    if (incoming >= 5) reasons.push('many observed callers');
    if (outgoing >= 7) reasons.push('many observed outgoing calls');
    if (ambiguous) reasons.push(ambiguous + ' ambiguous nested call site' + (ambiguous === 1 ? '' : 's'));
    if (cycleCount) reasons.push('participates in ' + cycleCount + ' observed call cycle' + (cycleCount === 1 ? '' : 's'));
    if (score >= 5 || reasons.length) hotspots.push(Object.freeze({
      id: symbol.id,
      kind: 'symbol',
      label: symbol.name,
      incoming,
      outgoing,
      ambiguous,
      cycleCount,
      score,
      risk: riskFromScore(score),
      reasons: Object.freeze(reasons),
    }));
  }
  return hotspots.sort((a, b) => b.score - a.score || compareText(a.label, b.label) || compareText(a.id, b.id))
    .slice(0, MAX_ARCHITECTURE_HOTSPOTS);
}

function freezeModule(module: MutableModule): ArchitectureModule {
  return Object.freeze({
    ...module,
    symbolIds: Object.freeze(uniqueSorted(module.symbolIds)),
    functionIds: Object.freeze(uniqueSorted(module.functionIds)),
    importEdgeIds: Object.freeze(uniqueSorted(module.importEdgeIds)),
    incomingImportEdgeIds: Object.freeze(uniqueSorted(module.incomingImportEdgeIds)),
    callSiteIds: Object.freeze(uniqueSorted(module.callSiteIds)),
  });
}

function freezeSymbol(symbol: MutableSymbol): ArchitectureSymbol {
  return Object.freeze({
    ...symbol,
    incomingCallEdgeIds: Object.freeze(uniqueSorted(symbol.incomingCallEdgeIds)),
    outgoingCallEdgeIds: Object.freeze(uniqueSorted(symbol.outgoingCallEdgeIds)),
  });
}

function freezeCallSite(site: MutableCallSite): ArchitectureCallSite {
  return Object.freeze({
    ...site,
    candidateSymbolIds: Object.freeze(uniqueSorted(site.candidateSymbolIds)),
    edgeIds: Object.freeze(uniqueSorted(site.edgeIds)),
  });
}

export function buildWorkspaceArchitecture(
  documents: readonly StudioDocument[],
  listing: readonly ListedImportSource[],
  activeId: string | null = null,
): WorkspaceArchitecture {
  const coverage = new Set<ArchitectureCoverageReason>();
  const selectedDocuments = documents.slice(0, MAX_ARCHITECTURE_MODULES);
  if (documents.length > selectedDocuments.length) coverage.add('module-limit');
  const selectedListing = listing.slice(0, MAX_ARCHITECTURE_MODULES);
  const symbolIndex = buildWorkspaceSymbolIndex(selectedDocuments, activeId, 'open');
  const importGraph = buildScarpImportGraph(selectedDocuments, selectedListing);
  if (!symbolIndex.complete) coverage.add('symbol-index-limited');
  if (importGraph.limited) coverage.add('import-graph-limited');

  const modulesMutable = new Map<string, MutableModule>();
  const moduleIdByDocument = new Map<string, string>();
  for (const document of selectedDocuments) {
    const id = moduleId(document.id);
    moduleIdByDocument.set(document.id, id);
    modulesMutable.set(id, {
      id,
      documentId: document.id,
      revision: document.revision,
      name: document.name,
      path: document.path,
      listedName: listedNameForDocument(document, importGraph),
      contentLength: document.content.length,
      symbolIds: [],
      functionIds: [],
      importEdgeIds: [],
      incomingImportEdgeIds: [],
      callSiteIds: [],
      incomplete: false,
    });
  }
  for (const file of symbolIndex.files) {
    const id = moduleIdByDocument.get(file.document.id);
    if (id) modulesMutable.get(id)!.incomplete ||= !file.complete;
  }
  for (const node of importGraph.nodes) {
    const id = moduleIdByDocument.get(node.documentId);
    if (id) modulesMutable.get(id)!.incomplete ||= node.incomplete;
  }

  const symbolsMutable = new Map<string, MutableSymbol>();
  const functionsByName = new Map<string, WorkspaceSymbol[]>();
  const nonFunctionsByName = new Map<string, WorkspaceSymbol[]>();
  for (const symbol of symbolIndex.symbols.slice(0, MAX_ARCHITECTURE_SYMBOLS)) {
    const owner = moduleIdByDocument.get(symbol.documentId);
    if (!owner) continue;
    const item: MutableSymbol = {
      id: symbol.id,
      documentId: symbol.documentId,
      moduleId: owner,
      revision: symbol.revision,
      name: symbol.name,
      kind: symbol.kind,
      scope: symbol.scope,
      visibility: symbol.visibility,
      pure: symbol.pure,
      line: symbol.line,
      column: symbol.column,
      offset: symbol.offset,
      end: symbol.end,
      depth: symbol.depth,
      header: boundedText(symbol.header, MAX_ARCHITECTURE_HEADER_UNITS),
      incomingCallEdgeIds: [],
      outgoingCallEdgeIds: [],
      observedCallSiteCount: 0,
    };
    symbolsMutable.set(item.id, item);
    const module = modulesMutable.get(owner)!;
    module.symbolIds.push(item.id);
    if (item.kind === 'function') module.functionIds.push(item.id);
    const target = item.kind === 'function' ? functionsByName : nonFunctionsByName;
    const list = target.get(item.name);
    if (list) list.push(symbol); else target.set(item.name, [symbol]);
  }
  if (symbolIndex.symbols.length > symbolsMutable.size) coverage.add('symbol-limit');

  const callSitesMutable: MutableCallSite[] = [];
  const callEdges: ArchitectureCallEdge[] = [];
  for (const call of symbolIndex.calls.slice(0, MAX_ARCHITECTURE_CALLS)) {
    const owner = moduleIdByDocument.get(call.documentId);
    if (!owner) continue;
    const observation = callStatus(call, functionsByName, nonFunctionsByName, symbolIndex.complete);
    const site: MutableCallSite = {
      id: call.id,
      documentId: call.documentId,
      moduleId: owner,
      revision: call.revision,
      name: call.name,
      line: call.line,
      column: call.column,
      offset: call.offset,
      end: call.end,
      enclosingSymbolId: call.enclosingSymbolId && symbolsMutable.has(call.enclosingSymbolId)
        ? call.enclosingSymbolId : null,
      candidateSymbolIds: observation.candidates.map(item => item.id).filter(id => symbolsMutable.has(id))
        .slice(0, MAX_ARCHITECTURE_NAME_GROUP),
      status: observation.status,
      edgeIds: [],
    };
    callSitesMutable.push(site);
    modulesMutable.get(owner)!.callSiteIds.push(site.id);
    if (site.enclosingSymbolId) symbolsMutable.get(site.enclosingSymbolId)!.observedCallSiteCount++;
    for (const candidateId of site.candidateSymbolIds) {
      const target = symbolsMutable.get(candidateId);
      if (!target) continue;
      const edgeId = JSON.stringify(['architecture-call-edge', site.id, candidateId]);
      const edge: ArchitectureCallEdge = Object.freeze({
        id: edgeId,
        kind: 'call',
        callSiteId: site.id,
        fromModuleId: owner,
        fromSymbolId: site.enclosingSymbolId,
        toSymbolId: candidateId,
        toModuleId: target.moduleId,
        name: site.name,
        status: site.status,
        sameSource: owner === target.moduleId,
        confidence: 'bounded-name-observation',
      });
      callEdges.push(edge);
      site.edgeIds.push(edgeId);
      target.incomingCallEdgeIds.push(edgeId);
      if (site.enclosingSymbolId) symbolsMutable.get(site.enclosingSymbolId)!.outgoingCallEdgeIds.push(edgeId);
    }
  }
  if (symbolIndex.calls.length > callSitesMutable.length) coverage.add('call-limit');

  const importEdges: ArchitectureImportEdge[] = [];
  for (const edge of importGraph.edges.slice(0, MAX_ARCHITECTURE_IMPORTS)) {
    const from = moduleIdByDocument.get(edge.documentId);
    if (!from) continue;
    const targetDocumentId = edge.targetDocumentId ?? importGraph.nodes.find(node =>
      edge.targetPath && node.path === edge.targetPath)?.documentId ?? null;
    const to = targetDocumentId ? moduleIdByDocument.get(targetDocumentId) ?? null : null;
    const item: ArchitectureImportEdge = Object.freeze({
      id: JSON.stringify(['architecture-import-edge', edge.id]),
      kind: 'import',
      sourceImportId: edge.id,
      fromModuleId: from,
      toModuleId: to,
      status: edge.status,
      specifier: edge.specifier,
      alias: edge.alias,
      line: edge.line,
      column: edge.column,
      targetRelativeName: edge.targetRelativeName,
      note: edge.note,
    });
    importEdges.push(item);
    modulesMutable.get(from)!.importEdgeIds.push(item.id);
    if (to) modulesMutable.get(to)!.incomingImportEdgeIds.push(item.id);
  }
  if (importGraph.edges.length > importEdges.length) coverage.add('import-limit');

  const modules = [...modulesMutable.values()].map(freezeModule)
    .sort((a, b) => compareText(a.listedName ?? a.name, b.listedName ?? b.name) || compareText(a.id, b.id));
  const symbols = [...symbolsMutable.values()].map(freezeSymbol)
    .sort((a, b) => compareText(a.moduleId, b.moduleId) || a.offset - b.offset || compareText(a.id, b.id));
  const callSites = callSitesMutable.map(freezeCallSite)
    .sort((a, b) => compareText(a.moduleId, b.moduleId) || a.offset - b.offset || compareText(a.id, b.id));
  callEdges.sort((a, b) => compareText(a.fromModuleId, b.fromModuleId) ||
    compareText(a.fromSymbolId ?? '', b.fromSymbolId ?? '') || compareText(a.toSymbolId, b.toSymbolId) ||
    compareText(a.id, b.id));
  importEdges.sort((a, b) => compareText(a.fromModuleId, b.fromModuleId) ||
    compareText(a.toModuleId ?? '', b.toModuleId ?? '') || a.line - b.line || compareText(a.id, b.id));

  const importComponentResult = graphComponents('import', modules.map(item => item.id),
    importEdges.filter(edge => edge.toModuleId !== null).map(edge => ({ id: edge.id, from: edge.fromModuleId, to: edge.toModuleId! })));
  const functionIds = symbols.filter(item => item.kind === 'function').map(item => item.id);
  const callComponentResult = graphComponents('call', functionIds,
    callEdges.filter(edge => edge.fromSymbolId !== null).map(edge => ({ id: edge.id, from: edge.fromSymbolId!, to: edge.toSymbolId })));
  if (importComponentResult.limited || callComponentResult.limited) coverage.add('component-limit');
  const cycles = [...importComponentResult.cycles, ...callComponentResult.cycles]
    .sort((a, b) => compareText(a.kind, b.kind) || b.size - a.size || compareText(a.id, b.id))
    .slice(0, MAX_ARCHITECTURE_CYCLES);
  if (importComponentResult.cycles.length + callComponentResult.cycles.length > cycles.length) coverage.add('cycle-limit');

  const moduleIncoming = new Set(importEdges.filter(edge => edge.toModuleId).map(edge => edge.toModuleId!));
  const moduleOutgoing = new Set(importEdges.filter(edge => edge.toModuleId).map(edge => edge.fromModuleId));
  for (const edge of callEdges.filter(edge => edge.fromModuleId !== edge.toModuleId)) {
    moduleIncoming.add(edge.toModuleId);
    moduleOutgoing.add(edge.fromModuleId);
  }
  const orphanModuleIds = modules.filter(module => !moduleIncoming.has(module.id)).map(module => module.id);
  const isolatedModuleIds = modules.filter(module => !moduleIncoming.has(module.id) && !moduleOutgoing.has(module.id))
    .map(module => module.id);

  const incomingCallsBySymbol = new Map<string, number>();
  for (const edge of callEdges) incomingCallsBySymbol.set(edge.toSymbolId,
    (incomingCallsBySymbol.get(edge.toSymbolId) ?? 0) + 1);
  const entrypoints: ArchitectureEntrypoint[] = [];
  for (const symbol of symbols.filter(item => item.kind === 'function')) {
    const incoming = incomingCallsBySymbol.get(symbol.id) ?? 0;
    const module = modulesMutable.get(symbol.moduleId)!;
    const mainName = symbol.name === 'main';
    if (mainName || (incoming === 0 && symbol.scope === 'top-level')) {
      entrypoints.push(Object.freeze({
        symbolId: symbol.id,
        moduleId: symbol.moduleId,
        name: symbol.name,
        sourceName: module.listedName ?? module.name,
        line: symbol.line,
        reason: mainName ? 'main-name' : 'no-observed-callers',
      }));
    }
    if (entrypoints.length >= MAX_ARCHITECTURE_ENTRYPOINTS) break;
  }

  const hotspots = buildHotspots(modules, symbols, callSites, callEdges, importEdges, cycles);
  const ambiguousCallSiteCount = callSites.filter(site => site.status === 'multiple-candidates' ||
    site.status === 'non-function-shadow' || site.status === 'index-incomplete').length;
  const unmatchedCallSiteCount = callSites.filter(site => site.status === 'unmatched').length;
  const resolvedImportEdgeCount = importEdges.filter(edge => edge.toModuleId !== null).length;
  const summary: ArchitectureSummary = Object.freeze({
    moduleCount: modules.length,
    symbolCount: symbols.length,
    functionCount: symbols.filter(item => item.kind === 'function').length,
    callSiteCount: callSites.length,
    callEdgeCount: callEdges.length,
    importEdgeCount: importEdges.length,
    resolvedImportEdgeCount,
    unresolvedImportEdgeCount: importEdges.length - resolvedImportEdgeCount,
    ambiguousCallSiteCount,
    unmatchedCallSiteCount,
    importCycleCount: cycles.filter(cycle => cycle.kind === 'import').length,
    callCycleCount: cycles.filter(cycle => cycle.kind === 'call').length,
    orphanModuleCount: orphanModuleIds.length,
    isolatedModuleCount: isolatedModuleIds.length,
    entrypointCount: entrypoints.length,
    complete: coverage.size === 0,
  });

  return Object.freeze({
    generation: architectureGeneration(selectedDocuments, selectedListing),
    documents: Object.freeze(selectedDocuments.map(document => Object.freeze({
      id: document.id,
      revision: document.revision,
      name: document.name,
      path: document.path,
      content: document.content,
    }))),
    listing: Object.freeze(selectedListing.map(item => Object.freeze({ ...item }))),
    symbolIndex,
    importGraph,
    modules: Object.freeze(modules),
    symbols: Object.freeze(symbols),
    callSites: Object.freeze(callSites),
    callEdges: Object.freeze(callEdges),
    importEdges: Object.freeze(importEdges),
    importComponents: Object.freeze(importComponentResult.components),
    callComponents: Object.freeze(callComponentResult.components),
    cycles: Object.freeze(cycles),
    hotspots: Object.freeze(hotspots),
    entrypoints: Object.freeze(entrypoints),
    orphanModuleIds: Object.freeze(orphanModuleIds),
    isolatedModuleIds: Object.freeze(isolatedModuleIds),
    coverageReasons: Object.freeze([...coverage]),
    summary,
  });
}

export function architectureNode(
  architecture: WorkspaceArchitecture,
  id: string,
): ArchitectureModule | ArchitectureSymbol | null {
  return architecture.modules.find(item => item.id === id) ??
    architecture.symbols.find(item => item.id === id) ?? null;
}

export function architectureModuleForSymbol(
  architecture: WorkspaceArchitecture,
  symbolId: string,
): ArchitectureModule | null {
  const symbol = architecture.symbols.find(item => item.id === symbolId);
  return symbol ? architecture.modules.find(module => module.id === symbol.moduleId) ?? null : null;
}

export function architectureSymbolForCallSite(
  architecture: WorkspaceArchitecture,
  callSiteId: string,
): ArchitectureSymbol | null {
  const site = architecture.callSites.find(item => item.id === callSiteId);
  return site?.enclosingSymbolId ? architecture.symbols.find(item => item.id === site.enclosingSymbolId) ?? null : null;
}

export function architectureNodeLabel(
  architecture: WorkspaceArchitecture,
  id: string,
): string {
  const module = architecture.modules.find(item => item.id === id);
  if (module) return module.listedName ?? module.name;
  const symbol = architecture.symbols.find(item => item.id === id);
  if (!symbol) return id;
  const owner = architecture.modules.find(item => item.id === symbol.moduleId);
  return symbol.name + ' · ' + (owner?.listedName ?? owner?.name ?? symbol.documentId);
}

export function architectureCallStatusLabel(status: ArchitectureCallStatus): string {
  switch (status) {
    case 'same-source-unique': return 'One same-source function name';
    case 'workspace-unique': return 'One open-workspace function name';
    case 'multiple-candidates': return 'Multiple function-name candidates';
    case 'non-function-shadow': return 'Other declaration kinds share this name';
    case 'unmatched': return 'No indexed function name';
    case 'index-incomplete': return 'Index incomplete';
  }
}

export function architectureCoverageLabel(reason: ArchitectureCoverageReason): string {
  switch (reason) {
    case 'symbol-index-limited': return 'Workspace symbol index incomplete';
    case 'import-graph-limited': return 'Import graph incomplete';
    case 'module-limit': return 'Architecture module limit reached';
    case 'symbol-limit': return 'Architecture symbol limit reached';
    case 'call-limit': return 'Architecture call-site limit reached';
    case 'import-limit': return 'Architecture import-edge limit reached';
    case 'component-limit': return 'Strong-component analysis limit reached';
    case 'cycle-limit': return 'Cycle display limit reached';
  }
}

export function architectureRiskLabel(risk: ArchitectureRiskLevel): string {
  return risk === 'critical' ? 'Critical review priority'
    : risk === 'high' ? 'High review priority'
    : risk === 'medium' ? 'Medium review priority'
    : 'Low review priority';
}

export function architectureDirectNeighbors(
  architecture: WorkspaceArchitecture,
  id: string,
): { incoming: readonly string[]; outgoing: readonly string[] } {
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  const module = architecture.modules.find(item => item.id === id);
  if (module) {
    for (const edge of architecture.importEdges) {
      if (edge.fromModuleId === id && edge.toModuleId) outgoing.add(edge.toModuleId);
      if (edge.toModuleId === id) incoming.add(edge.fromModuleId);
    }
    for (const edge of architecture.callEdges) {
      if (edge.fromModuleId === id && edge.toModuleId !== id) outgoing.add(edge.toModuleId);
      if (edge.toModuleId === id && edge.fromModuleId !== id) incoming.add(edge.fromModuleId);
    }
  } else {
    const symbol = architecture.symbols.find(item => item.id === id);
    if (symbol?.kind === 'function') {
      for (const edge of architecture.callEdges) {
        if (edge.fromSymbolId === id) outgoing.add(edge.toSymbolId);
        if (edge.toSymbolId === id && edge.fromSymbolId) incoming.add(edge.fromSymbolId);
      }
    }
  }
  return {
    incoming: Object.freeze(uniqueSorted(incoming).slice(0, MAX_ARCHITECTURE_NEIGHBORS)),
    outgoing: Object.freeze(uniqueSorted(outgoing).slice(0, MAX_ARCHITECTURE_NEIGHBORS)),
  };
}

export function architectureCycleMembership(
  architecture: WorkspaceArchitecture,
  id: string,
): readonly ArchitectureCycle[] {
  return architecture.cycles.filter(cycle => cycle.memberIds.includes(id));
}

export function architectureHotspotFor(
  architecture: WorkspaceArchitecture,
  id: string,
): ArchitectureHotspot | null {
  return architecture.hotspots.find(item => item.id === id) ?? null;
}

export function architectureIsCurrent(
  architecture: WorkspaceArchitecture,
  documents: readonly StudioDocument[],
  listing: readonly ListedImportSource[],
): boolean {
  if (documents.length > MAX_ARCHITECTURE_MODULES || listing.length > MAX_ARCHITECTURE_MODULES) return false;
  if (architecture.documents.length !== documents.length || architecture.listing.length !== listing.length) return false;
  for (let i = 0; i < documents.length; i++) {
    const current = documents[i];
    const captured = architecture.documents[i];
    if (!captured || current.id !== captured.id || current.revision !== captured.revision ||
        current.name !== captured.name || current.path !== captured.path || current.content !== captured.content) return false;
  }
  for (let i = 0; i < listing.length; i++) {
    const current = listing[i];
    const captured = architecture.listing[i];
    if (!captured || current.name !== captured.name || current.path !== captured.path) return false;
  }
  return true;
}

export function architectureNavigationTarget(
  architecture: WorkspaceArchitecture,
  documents: readonly StudioDocument[],
  id: string,
): { documentId: string; revision: number; source: string; line: number; column: number } | null {
  const symbol = architecture.symbols.find(item => item.id === id);
  if (!symbol) return null;
  const captured = architecture.documents.find(item => item.id === symbol.documentId);
  const current = documents.find(item => item.id === symbol.documentId);
  if (!captured || !current || current.revision !== captured.revision || current.revision !== symbol.revision ||
      current.content !== captured.content || current.path !== captured.path || current.name !== captured.name) return null;
  if (current.content.slice(symbol.offset, symbol.end) !== symbol.name) return null;
  return {
    documentId: current.id,
    revision: current.revision,
    source: current.content,
    line: symbol.line,
    column: symbol.column,
  };
}

/**
 * Resolve a current editor navigation target for any architecture observation
 * that carries an exact source coordinate. Module and cycle IDs deliberately
 * do not invent a location. The current buffer must still match the captured
 * revision and source text, preventing stale architecture clicks after edits.
 */
export function architectureObservedLocationTarget(
  architecture: WorkspaceArchitecture,
  documents: readonly StudioDocument[],
  id: string,
): { documentId: string; revision: number; source: string; line: number; column: number } | null {
  const symbolTarget = architectureNavigationTarget(architecture, documents, id);
  if (symbolTarget) return symbolTarget;

  const site = architecture.callSites.find(item => item.id === id);
  if (site) {
    const captured = architecture.documents.find(item => item.id === site.documentId);
    const current = documents.find(item => item.id === site.documentId);
    if (!captured || !current || current.revision !== captured.revision ||
        current.revision !== site.revision || current.content !== captured.content ||
        current.path !== captured.path || current.name !== captured.name ||
        current.content.slice(site.offset, site.end) !== site.name) return null;
    return {
      documentId: current.id,
      revision: current.revision,
      source: current.content,
      line: site.line,
      column: site.column,
    };
  }

  const edge = architecture.importEdges.find(item => item.id === id);
  if (!edge) return null;
  const observed = architecture.importGraph.edges.find(item => item.id === edge.sourceImportId);
  if (!observed) return null;
  const captured = architecture.documents.find(item => item.id === observed.documentId);
  const current = documents.find(item => item.id === observed.documentId);
  if (!captured || !current || current.revision !== captured.revision ||
      current.revision !== observed.documentRevision || current.content !== captured.content ||
      current.path !== captured.path || current.name !== captured.name) return null;
  if (observed.offset < 0 || observed.offset >= current.content.length ||
      current.content.slice(observed.offset, observed.offset + 6) !== 'import') return null;
  return {
    documentId: current.id,
    revision: current.revision,
    source: current.content,
    line: observed.line,
    column: observed.column,
  };
}
