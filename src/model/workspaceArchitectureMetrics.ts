import {
  architectureCycleMembership,
  architectureDirectNeighbors,
  architectureNodeLabel,
  type ArchitectureModule,
  type ArchitectureRiskLevel,
  type ArchitectureSymbol,
  type WorkspaceArchitecture,
} from './workspaceArchitecture';

/**
 * Derived graph metrics for bounded architecture observations.
 * Metrics operate only on the captured open-buffer graph. They are useful for
 * review and comparison but are not claims about runtime coupling or complete
 * project dependencies.
 */

export const MAX_METRIC_MODULES = 200;
export const MAX_METRIC_SYMBOLS = 1500;
export const MAX_METRIC_PATH_DEPTH = 32;
export const MAX_METRIC_RANK_ITERATIONS = 24;
export const MAX_METRIC_TOP_ITEMS = 100;

export interface ModuleArchitectureMetrics {
  readonly moduleId: string;
  readonly label: string;
  readonly declarations: number;
  readonly functions: number;
  readonly sourceUnits: number;
  readonly incomingImports: number;
  readonly outgoingImports: number;
  readonly incomingCallModules: number;
  readonly outgoingCallModules: number;
  readonly afferentCoupling: number;
  readonly efferentCoupling: number;
  readonly instability: number;
  readonly abstractnessProxy: number;
  readonly distanceProxy: number;
  readonly internalCallEdges: number;
  readonly externalCallEdges: number;
  readonly ambiguousCallSites: number;
  readonly unmatchedCallSites: number;
  readonly importCycleCount: number;
  readonly callCycleCount: number;
  readonly dependencyDepth: number;
  readonly dependentDepth: number;
  readonly centrality: number;
  readonly risk: ArchitectureRiskLevel;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface SymbolArchitectureMetrics {
  readonly symbolId: string;
  readonly label: string;
  readonly moduleId: string;
  readonly kind: ArchitectureSymbol['kind'];
  readonly incomingCalls: number;
  readonly outgoingCalls: number;
  readonly crossModuleIncoming: number;
  readonly crossModuleOutgoing: number;
  readonly ambiguousIncoming: number;
  readonly cycleCount: number;
  readonly centrality: number;
  readonly risk: ArchitectureRiskLevel;
  readonly score: number;
}

export interface ArchitectureGraphMetrics {
  readonly generation: string;
  readonly modules: readonly ModuleArchitectureMetrics[];
  readonly symbols: readonly SymbolArchitectureMetrics[];
  readonly moduleDensity: number;
  readonly callDensity: number;
  readonly importDensity: number;
  readonly crossModuleCallRatio: number;
  readonly ambiguousCallRatio: number;
  readonly cyclicModuleRatio: number;
  readonly cyclicFunctionRatio: number;
  readonly meanModuleInstability: number;
  readonly meanModuleCentrality: number;
  readonly maxDependencyDepth: number;
  readonly maxDependentDepth: number;
  readonly complete: boolean;
}

export interface MetricsComparisonDelta {
  readonly metric: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
  readonly direction: 'up' | 'down' | 'unchanged';
}

export interface ModuleMetricsComparison {
  readonly moduleId: string;
  readonly before: ModuleArchitectureMetrics | null;
  readonly after: ModuleArchitectureMetrics | null;
  readonly deltas: readonly MetricsComparisonDelta[];
  readonly changed: boolean;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function rounded(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function riskFromScore(score: number): ArchitectureRiskLevel {
  if (score >= 42) return 'critical';
  if (score >= 26) return 'high';
  if (score >= 12) return 'medium';
  return 'low';
}

function moduleGraphEdges(architecture: WorkspaceArchitecture): readonly { from: string; to: string }[] {
  const seen = new Set<string>();
  const edges: { from: string; to: string }[] = [];
  const add = (from: string, to: string): void => {
    if (from === to) return;
    const key = from + '\0' + to;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to });
  };
  for (const edge of architecture.importEdges) {
    if (edge.toModuleId) add(edge.fromModuleId, edge.toModuleId);
  }
  for (const edge of architecture.callEdges) add(edge.fromModuleId, edge.toModuleId);
  return Object.freeze(edges);
}

function graphDepth(
  root: string,
  direction: 'outgoing' | 'incoming',
  edges: readonly { from: string; to: string }[],
): number {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const from = direction === 'outgoing' ? edge.from : edge.to;
    const to = direction === 'outgoing' ? edge.to : edge.from;
    const list = adjacency.get(from);
    if (list) list.push(to); else adjacency.set(from, [to]);
  }
  const queue: { id: string; depth: number }[] = [{ id: root, depth: 0 }];
  const best = new Map<string, number>([[root, 0]]);
  let maxDepth = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current.depth >= MAX_METRIC_PATH_DEPTH) continue;
    for (const next of adjacency.get(current.id) ?? []) {
      const depth = current.depth + 1;
      const known = best.get(next);
      if (known !== undefined && known <= depth) continue;
      best.set(next, depth);
      maxDepth = Math.max(maxDepth, depth);
      queue.push({ id: next, depth });
    }
  }
  return maxDepth;
}

/** PageRank-like relative importance over the bounded directed graph.
 * This is deterministic and capped; it is a review ranking, not a scientific
 * centrality claim about the complete project.
 */
function boundedCentrality(
  ids: readonly string[],
  edges: readonly { from: string; to: string }[],
): ReadonlyMap<string, number> {
  if (!ids.length) return new Map();
  const idSet = new Set(ids);
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) continue;
    const list = outgoing.get(edge.from);
    if (list) list.push(edge.to); else outgoing.set(edge.from, [edge.to]);
  }
  const damping = 0.85;
  const base = (1 - damping) / ids.length;
  let ranks = new Map(ids.map(id => [id, 1 / ids.length]));
  for (let iteration = 0; iteration < MAX_METRIC_RANK_ITERATIONS; iteration++) {
    const next = new Map(ids.map(id => [id, base]));
    let dangling = 0;
    for (const id of ids) {
      const targets = outgoing.get(id) ?? [];
      const rank = ranks.get(id) ?? 0;
      if (!targets.length) {
        dangling += rank;
        continue;
      }
      const share = damping * rank / targets.length;
      for (const target of targets) next.set(target, (next.get(target) ?? base) + share);
    }
    const danglingShare = damping * dangling / ids.length;
    let change = 0;
    for (const id of ids) {
      const value = (next.get(id) ?? base) + danglingShare;
      next.set(id, value);
      change += Math.abs(value - (ranks.get(id) ?? 0));
    }
    ranks = next;
    if (change < 0.000001) break;
  }
  const maximum = Math.max(...ranks.values(), 0);
  return new Map([...ranks].map(([id, value]) => [id, maximum ? rounded(value / maximum) : 0]));
}

function moduleCallNeighbors(
  architecture: WorkspaceArchitecture,
  moduleId: string,
): { incoming: Set<string>; outgoing: Set<string>; internal: number; external: number } {
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  let internal = 0;
  let external = 0;
  for (const edge of architecture.callEdges) {
    if (edge.fromModuleId === moduleId && edge.toModuleId === moduleId) internal++;
    else if (edge.fromModuleId === moduleId) { outgoing.add(edge.toModuleId); external++; }
    else if (edge.toModuleId === moduleId) incoming.add(edge.fromModuleId);
  }
  return { incoming, outgoing, internal, external };
}

function moduleMetric(
  architecture: WorkspaceArchitecture,
  module: ArchitectureModule,
  graphEdges: readonly { from: string; to: string }[],
  centrality: ReadonlyMap<string, number>,
): ModuleArchitectureMetrics {
  const callNeighbors = moduleCallNeighbors(architecture, module.id);
  const importIncoming = new Set(architecture.importEdges.filter(edge => edge.toModuleId === module.id).map(edge => edge.fromModuleId));
  const importOutgoing = new Set(architecture.importEdges.filter(edge => edge.fromModuleId === module.id && edge.toModuleId).map(edge => edge.toModuleId!));
  const incoming = new Set([...callNeighbors.incoming, ...importIncoming]);
  const outgoing = new Set([...callNeighbors.outgoing, ...importOutgoing]);
  const afferentCoupling = incoming.size;
  const efferentCoupling = outgoing.size;
  const instability = rounded(ratio(efferentCoupling, afferentCoupling + efferentCoupling));
  const moduleSymbols = architecture.symbols.filter(symbol => symbol.moduleId === module.id);
  const abstractCount = moduleSymbols.filter(symbol => symbol.kind === 'record' || symbol.kind === 'variant').length;
  const abstractnessProxy = rounded(ratio(abstractCount, moduleSymbols.length));
  const distanceProxy = rounded(Math.abs(abstractnessProxy + instability - 1));
  const sites = architecture.callSites.filter(site => site.moduleId === module.id);
  const ambiguousCallSites = sites.filter(site => site.status === 'multiple-candidates' || site.status === 'non-function-shadow').length;
  const unmatchedCallSites = sites.filter(site => site.status === 'unmatched').length;
  const importCycleCount = architectureCycleMembership(architecture, module.id).filter(cycle => cycle.kind === 'import').length;
  const functionIds = new Set(module.functionIds);
  const callCycleCount = architecture.cycles.filter(cycle => cycle.kind === 'call' && cycle.memberIds.some(id => functionIds.has(id))).length;
  const dependencyDepth = graphDepth(module.id, 'outgoing', graphEdges);
  const dependentDepth = graphDepth(module.id, 'incoming', graphEdges);
  const centralityValue = centrality.get(module.id) ?? 0;
  const score = Math.min(99, Math.round(
    afferentCoupling * 3 + efferentCoupling * 2 + callNeighbors.external +
    ambiguousCallSites * 3 + unmatchedCallSites + importCycleCount * 7 + callCycleCount * 3 +
    Math.min(12, dependencyDepth * 2) + Math.min(10, dependentDepth) + centralityValue * 12 +
    (module.incomplete ? 6 : 0),
  ));
  const reasons: string[] = [];
  if (afferentCoupling >= 5) reasons.push(afferentCoupling + ' observed incoming module dependencies');
  if (efferentCoupling >= 5) reasons.push(efferentCoupling + ' observed outgoing module dependencies');
  if (ambiguousCallSites) reasons.push(ambiguousCallSites + ' ambiguous call sites');
  if (unmatchedCallSites >= 4) reasons.push(unmatchedCallSites + ' unmatched call sites');
  if (importCycleCount) reasons.push(importCycleCount + ' import cycle memberships');
  if (callCycleCount) reasons.push(callCycleCount + ' call cycle memberships');
  if (dependencyDepth >= 5) reasons.push('dependency depth ' + dependencyDepth);
  if (centralityValue >= 0.7) reasons.push('high bounded graph centrality');
  if (module.incomplete) reasons.push('module observation incomplete');
  return Object.freeze({
    moduleId: module.id,
    label: module.listedName ?? module.name,
    declarations: module.symbolIds.length,
    functions: module.functionIds.length,
    sourceUnits: module.contentLength,
    incomingImports: module.incomingImportEdgeIds.length,
    outgoingImports: module.importEdgeIds.length,
    incomingCallModules: callNeighbors.incoming.size,
    outgoingCallModules: callNeighbors.outgoing.size,
    afferentCoupling,
    efferentCoupling,
    instability,
    abstractnessProxy,
    distanceProxy,
    internalCallEdges: callNeighbors.internal,
    externalCallEdges: callNeighbors.external,
    ambiguousCallSites,
    unmatchedCallSites,
    importCycleCount,
    callCycleCount,
    dependencyDepth,
    dependentDepth,
    centrality: centralityValue,
    risk: riskFromScore(score),
    score,
    reasons: Object.freeze(reasons),
  });
}

function symbolMetric(
  architecture: WorkspaceArchitecture,
  symbol: ArchitectureSymbol,
  centrality: ReadonlyMap<string, number>,
): SymbolArchitectureMetrics {
  const incomingEdges = architecture.callEdges.filter(edge => edge.toSymbolId === symbol.id);
  const outgoingEdges = architecture.callEdges.filter(edge => edge.fromSymbolId === symbol.id);
  const crossModuleIncoming = incomingEdges.filter(edge => edge.fromModuleId !== edge.toModuleId).length;
  const crossModuleOutgoing = outgoingEdges.filter(edge => edge.fromModuleId !== edge.toModuleId).length;
  const ambiguousIncoming = incomingEdges.filter(edge => edge.status === 'multiple-candidates' || edge.status === 'non-function-shadow').length;
  const cycleCount = architectureCycleMembership(architecture, symbol.id).filter(cycle => cycle.kind === 'call').length;
  const centralityValue = centrality.get(symbol.id) ?? 0;
  const score = Math.min(99, Math.round(
    incomingEdges.length * 2 + outgoingEdges.length + crossModuleIncoming * 2 + crossModuleOutgoing +
    ambiguousIncoming * 3 + cycleCount * 5 + centralityValue * 12,
  ));
  return Object.freeze({
    symbolId: symbol.id,
    label: architectureNodeLabel(architecture, symbol.id),
    moduleId: symbol.moduleId,
    kind: symbol.kind,
    incomingCalls: incomingEdges.length,
    outgoingCalls: outgoingEdges.length,
    crossModuleIncoming,
    crossModuleOutgoing,
    ambiguousIncoming,
    cycleCount,
    centrality: centralityValue,
    risk: riskFromScore(score),
    score,
  });
}

export function calculateArchitectureMetrics(architecture: WorkspaceArchitecture): ArchitectureGraphMetrics {
  const modules = architecture.modules.slice(0, MAX_METRIC_MODULES);
  const functions = architecture.symbols.filter(symbol => symbol.kind === 'function').slice(0, MAX_METRIC_SYMBOLS);
  const moduleEdges = moduleGraphEdges(architecture);
  const moduleCentrality = boundedCentrality(modules.map(module => module.id), moduleEdges);
  const callEdges = architecture.callEdges
    .filter(edge => edge.fromSymbolId !== null)
    .map(edge => ({ from: edge.fromSymbolId!, to: edge.toSymbolId }));
  const symbolCentrality = boundedCentrality(functions.map(symbol => symbol.id), callEdges);
  const moduleMetrics = modules.map(module => moduleMetric(architecture, module, moduleEdges, moduleCentrality))
    .sort((left, right) => right.score - left.score || compareText(left.label, right.label));
  const symbolMetrics = functions.map(symbol => symbolMetric(architecture, symbol, symbolCentrality))
    .sort((left, right) => right.score - left.score || compareText(left.label, right.label));

  const modulePossible = modules.length * Math.max(0, modules.length - 1);
  const functionPossible = functions.length * Math.max(0, functions.length - 1);
  const crossModuleCalls = architecture.callEdges.filter(edge => edge.fromModuleId !== edge.toModuleId).length;
  const ambiguousSites = architecture.callSites.filter(site => site.status === 'multiple-candidates' || site.status === 'non-function-shadow').length;
  const cyclicModules = new Set(architecture.cycles.filter(cycle => cycle.kind === 'import').flatMap(cycle => cycle.memberIds));
  const cyclicFunctions = new Set(architecture.cycles.filter(cycle => cycle.kind === 'call').flatMap(cycle => cycle.memberIds));
  const meanModuleInstability = rounded(ratio(moduleMetrics.reduce((sum, item) => sum + item.instability, 0), moduleMetrics.length));
  const meanModuleCentrality = rounded(ratio(moduleMetrics.reduce((sum, item) => sum + item.centrality, 0), moduleMetrics.length));

  return Object.freeze({
    generation: architecture.generation,
    modules: Object.freeze(moduleMetrics),
    symbols: Object.freeze(symbolMetrics),
    moduleDensity: rounded(ratio(moduleEdges.length, modulePossible)),
    callDensity: rounded(ratio(architecture.callEdges.length, functionPossible)),
    importDensity: rounded(ratio(architecture.importEdges.filter(edge => edge.toModuleId).length, modulePossible)),
    crossModuleCallRatio: rounded(ratio(crossModuleCalls, architecture.callEdges.length)),
    ambiguousCallRatio: rounded(ratio(ambiguousSites, architecture.callSites.length)),
    cyclicModuleRatio: rounded(ratio(cyclicModules.size, modules.length)),
    cyclicFunctionRatio: rounded(ratio(cyclicFunctions.size, functions.length)),
    meanModuleInstability,
    meanModuleCentrality,
    maxDependencyDepth: Math.max(0, ...moduleMetrics.map(item => item.dependencyDepth)),
    maxDependentDepth: Math.max(0, ...moduleMetrics.map(item => item.dependentDepth)),
    complete: architecture.summary.complete && architecture.modules.length <= MAX_METRIC_MODULES && functions.length <= MAX_METRIC_SYMBOLS,
  });
}

function delta(metric: string, before: number, after: number): MetricsComparisonDelta {
  const difference = rounded(after - before);
  return Object.freeze({
    metric,
    before,
    after,
    delta: difference,
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'unchanged',
  });
}

export function compareModuleArchitectureMetrics(
  before: ArchitectureGraphMetrics,
  after: ArchitectureGraphMetrics,
): readonly ModuleMetricsComparison[] {
  const ids = new Set([...before.modules.map(item => item.moduleId), ...after.modules.map(item => item.moduleId)]);
  const comparisons: ModuleMetricsComparison[] = [];
  for (const id of ids) {
    const oldMetric = before.modules.find(item => item.moduleId === id) ?? null;
    const newMetric = after.modules.find(item => item.moduleId === id) ?? null;
    const deltas = oldMetric && newMetric ? [
      delta('afferentCoupling', oldMetric.afferentCoupling, newMetric.afferentCoupling),
      delta('efferentCoupling', oldMetric.efferentCoupling, newMetric.efferentCoupling),
      delta('instability', oldMetric.instability, newMetric.instability),
      delta('abstractnessProxy', oldMetric.abstractnessProxy, newMetric.abstractnessProxy),
      delta('distanceProxy', oldMetric.distanceProxy, newMetric.distanceProxy),
      delta('internalCallEdges', oldMetric.internalCallEdges, newMetric.internalCallEdges),
      delta('externalCallEdges', oldMetric.externalCallEdges, newMetric.externalCallEdges),
      delta('ambiguousCallSites', oldMetric.ambiguousCallSites, newMetric.ambiguousCallSites),
      delta('unmatchedCallSites', oldMetric.unmatchedCallSites, newMetric.unmatchedCallSites),
      delta('dependencyDepth', oldMetric.dependencyDepth, newMetric.dependencyDepth),
      delta('dependentDepth', oldMetric.dependentDepth, newMetric.dependentDepth),
      delta('centrality', oldMetric.centrality, newMetric.centrality),
      delta('score', oldMetric.score, newMetric.score),
    ] : [];
    comparisons.push(Object.freeze({
      moduleId: id,
      before: oldMetric,
      after: newMetric,
      deltas: Object.freeze(deltas),
      changed: !oldMetric || !newMetric || deltas.some(item => item.delta !== 0),
    }));
  }
  return Object.freeze(comparisons.sort((left, right) => {
    if (left.changed !== right.changed) return left.changed ? -1 : 1;
    const leftScore = Math.abs(left.deltas.find(item => item.metric === 'score')?.delta ?? 0);
    const rightScore = Math.abs(right.deltas.find(item => item.metric === 'score')?.delta ?? 0);
    return rightScore - leftScore || compareText(left.after?.label ?? left.before?.label ?? left.moduleId,
      right.after?.label ?? right.before?.label ?? right.moduleId);
  }));
}

export function architectureMetricsSummary(metrics: ArchitectureGraphMetrics): string {
  return [
    metrics.modules.length + ' modules',
    metrics.symbols.length + ' functions',
    'module density ' + metrics.moduleDensity.toFixed(4),
    'call density ' + metrics.callDensity.toFixed(4),
    'import density ' + metrics.importDensity.toFixed(4),
    'cross-module calls ' + Math.round(metrics.crossModuleCallRatio * 100) + '%',
    'ambiguous calls ' + Math.round(metrics.ambiguousCallRatio * 100) + '%',
    'max dependency depth ' + metrics.maxDependencyDepth,
    metrics.complete ? 'bounded metrics complete' : 'bounded metrics incomplete',
  ].join(' · ');
}

export function topArchitectureMetricModules(
  metrics: ArchitectureGraphMetrics,
  limit = 12,
): readonly ModuleArchitectureMetrics[] {
  const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(MAX_METRIC_TOP_ITEMS, limit)) : 12;
  return Object.freeze(metrics.modules.slice(0, safeLimit));
}

export function topArchitectureMetricSymbols(
  metrics: ArchitectureGraphMetrics,
  limit = 12,
): readonly SymbolArchitectureMetrics[] {
  const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(MAX_METRIC_TOP_ITEMS, limit)) : 12;
  return Object.freeze(metrics.symbols.slice(0, safeLimit));
}

export function architectureModuleMetricFor(
  metrics: ArchitectureGraphMetrics,
  moduleId: string,
): ModuleArchitectureMetrics | null {
  return metrics.modules.find(item => item.moduleId === moduleId) ?? null;
}

export function architectureSymbolMetricFor(
  metrics: ArchitectureGraphMetrics,
  symbolId: string,
): SymbolArchitectureMetrics | null {
  return metrics.symbols.find(item => item.symbolId === symbolId) ?? null;
}

export function architectureMetricNeighbors(
  architecture: WorkspaceArchitecture,
  metrics: ArchitectureGraphMetrics,
  moduleId: string,
): readonly { id: string; label: string; direction: 'incoming' | 'outgoing' | 'both'; score: number }[] {
  const neighbors = architectureDirectNeighbors(architecture, moduleId);
  const ids = new Set([...neighbors.incoming, ...neighbors.outgoing]);
  return Object.freeze([...ids].map(id => ({
    id,
    label: architectureNodeLabel(architecture, id),
    direction: neighbors.incoming.includes(id) && neighbors.outgoing.includes(id) ? 'both' as const
      : neighbors.incoming.includes(id) ? 'incoming' as const : 'outgoing' as const,
    score: architectureModuleMetricFor(metrics, id)?.score ?? 0,
  })).sort((left, right) => right.score - left.score || compareText(left.label, right.label)));
}
