import {
  MAX_ARCHITECTURE_NEIGHBORS,
  MAX_ARCHITECTURE_PATH_DEPTH,
  MAX_ARCHITECTURE_PATHS,
  architectureCycleMembership,
  architectureHotspotFor,
  architectureNode,
  architectureNodeLabel,
  type ArchitectureCallEdge,
  type ArchitectureImportEdge,
  type ArchitectureNodeKind,
  type ArchitectureRiskLevel,
  type WorkspaceArchitecture,
} from './workspaceArchitecture';

/**
 * Conservative impact tracing over observed architecture edges.
 * Paths explain why an item appeared in the review; they do not prove runtime
 * reachability or compiler dependency semantics.
 */
export const MAX_IMPACT_RESULTS = 320;
export const MAX_IMPACT_DEPTH = 12;
export const MAX_IMPACT_ROOTS = 64;
export const MAX_IMPACT_REASONS = 16;
export const MAX_IMPACT_CHECKLIST = 24;

export type ImpactDirection = 'incoming' | 'outgoing' | 'both';
export type ImpactEdgeMode = 'imports' | 'calls' | 'combined';
export type ImpactTargetKind = ArchitectureNodeKind;
export type ImpactConfidence = 'high-observation' | 'mixed-observation' | 'low-observation';

export interface ImpactOptions {
  readonly direction: ImpactDirection;
  readonly edgeMode: ImpactEdgeMode;
  readonly maxDepth: number;
  readonly includeAmbiguousCalls: boolean;
  readonly crossModules: boolean;
}

export const DEFAULT_IMPACT_OPTIONS: ImpactOptions = Object.freeze({
  direction: 'both',
  edgeMode: 'combined',
  maxDepth: 6,
  includeAmbiguousCalls: true,
  crossModules: true,
});

export interface ImpactPathStep {
  readonly fromId: string;
  readonly toId: string;
  readonly edgeId: string;
  readonly edgeKind: 'import' | 'call';
  readonly label: string;
  readonly ambiguous: boolean;
}

export interface ImpactPath {
  readonly rootId: string;
  readonly targetId: string;
  readonly direction: 'incoming' | 'outgoing';
  readonly steps: readonly ImpactPathStep[];
  readonly ambiguous: boolean;
}

export interface ImpactNode {
  readonly id: string;
  readonly kind: ImpactTargetKind;
  readonly label: string;
  readonly depth: number;
  readonly direction: 'incoming' | 'outgoing' | 'both';
  readonly pathCount: number;
  readonly ambiguousPathCount: number;
  readonly cycleCount: number;
  readonly risk: ArchitectureRiskLevel;
  readonly reasons: readonly string[];
  readonly representativePaths: readonly ImpactPath[];
}

export interface ImpactBoundary {
  readonly id: string;
  readonly reason: 'depth-limit' | 'result-limit' | 'cross-module-disabled' | 'ambiguous-call-excluded';
  readonly fromId: string;
  readonly toId: string;
  readonly edgeId: string;
}

export interface ImpactReview {
  readonly rootId: string;
  readonly rootKind: ImpactTargetKind;
  readonly rootLabel: string;
  readonly options: ImpactOptions;
  readonly nodes: readonly ImpactNode[];
  readonly paths: readonly ImpactPath[];
  readonly boundaries: readonly ImpactBoundary[];
  readonly incomingCount: number;
  readonly outgoingCount: number;
  readonly maxObservedDepth: number;
  readonly cycleCount: number;
  readonly ambiguousPathCount: number;
  readonly confidence: ImpactConfidence;
  readonly score: number;
  readonly risk: ArchitectureRiskLevel;
  readonly checklist: readonly string[];
  readonly complete: boolean;
}

interface TraversalEdge {
  id: string;
  kind: 'import' | 'call';
  from: string;
  to: string;
  label: string;
  ambiguous: boolean;
  fromModule: string;
  toModule: string;
}

interface QueueItem {
  id: string;
  depth: number;
  steps: ImpactPathStep[];
  ambiguous: boolean;
}

interface MutableImpactNode {
  id: string;
  kind: ImpactTargetKind;
  label: string;
  depth: number;
  directions: Set<'incoming' | 'outgoing'>;
  pathCount: number;
  ambiguousPathCount: number;
  cycleCount: number;
  reasons: Set<string>;
  representativePaths: ImpactPath[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function riskRank(risk: ArchitectureRiskLevel): number {
  return risk === 'critical' ? 4 : risk === 'high' ? 3 : risk === 'medium' ? 2 : 1;
}

function riskFromScore(score: number): ArchitectureRiskLevel {
  if (score >= 30) return 'critical';
  if (score >= 18) return 'high';
  if (score >= 9) return 'medium';
  return 'low';
}

function normalizeOptions(options: Partial<ImpactOptions> | undefined): ImpactOptions {
  const source = options ?? {};
  const maxDepth = Number.isSafeInteger(source.maxDepth) ? Math.max(1, Math.min(MAX_IMPACT_DEPTH, source.maxDepth!))
    : DEFAULT_IMPACT_OPTIONS.maxDepth;
  const direction = source.direction === 'incoming' || source.direction === 'outgoing' || source.direction === 'both'
    ? source.direction : DEFAULT_IMPACT_OPTIONS.direction;
  const edgeMode = source.edgeMode === 'imports' || source.edgeMode === 'calls' || source.edgeMode === 'combined'
    ? source.edgeMode : DEFAULT_IMPACT_OPTIONS.edgeMode;
  return Object.freeze({
    direction,
    edgeMode,
    maxDepth,
    includeAmbiguousCalls: source.includeAmbiguousCalls ?? DEFAULT_IMPACT_OPTIONS.includeAmbiguousCalls,
    crossModules: source.crossModules ?? DEFAULT_IMPACT_OPTIONS.crossModules,
  });
}

function nodeKind(architecture: WorkspaceArchitecture, id: string): ImpactTargetKind | null {
  if (architecture.modules.some(item => item.id === id)) return 'module';
  if (architecture.symbols.some(item => item.id === id)) return 'symbol';
  return null;
}

function edgeLabel(architecture: WorkspaceArchitecture, edge: ArchitectureImportEdge | ArchitectureCallEdge): string {
  if (edge.kind === 'import') {
    const target = edge.toModuleId ? architectureNodeLabel(architecture, edge.toModuleId) : edge.targetRelativeName ?? edge.specifier;
    return 'import ' + edge.specifier + ' → ' + target;
  }
  return 'call ' + edge.name + ' → ' + architectureNodeLabel(architecture, edge.toSymbolId);
}

function traversalEdges(architecture: WorkspaceArchitecture, rootKind: ImpactTargetKind,
  options: ImpactOptions): TraversalEdge[] {
  const edges: TraversalEdge[] = [];
  if (rootKind === 'module' && options.edgeMode !== 'calls') {
    for (const edge of architecture.importEdges) {
      if (!edge.toModuleId) continue;
      edges.push({
        id: edge.id,
        kind: 'import',
        from: edge.fromModuleId,
        to: edge.toModuleId,
        label: edgeLabel(architecture, edge),
        ambiguous: edge.status === 'ambiguous' || edge.status === 'unrecognized',
        fromModule: edge.fromModuleId,
        toModule: edge.toModuleId,
      });
    }
  }
  if (options.edgeMode !== 'imports') {
    for (const edge of architecture.callEdges) {
      if (!options.includeAmbiguousCalls && (edge.status === 'multiple-candidates' ||
          edge.status === 'non-function-shadow' || edge.status === 'index-incomplete')) continue;
      if (rootKind === 'symbol') {
        if (!edge.fromSymbolId) continue;
        edges.push({
          id: edge.id,
          kind: 'call',
          from: edge.fromSymbolId,
          to: edge.toSymbolId,
          label: edgeLabel(architecture, edge),
          ambiguous: edge.status === 'multiple-candidates' || edge.status === 'non-function-shadow' || edge.status === 'index-incomplete',
          fromModule: edge.fromModuleId,
          toModule: edge.toModuleId,
        });
      } else {
        if (edge.fromModuleId === edge.toModuleId) continue;
        edges.push({
          id: edge.id,
          kind: 'call',
          from: edge.fromModuleId,
          to: edge.toModuleId,
          label: edgeLabel(architecture, edge),
          ambiguous: edge.status === 'multiple-candidates' || edge.status === 'non-function-shadow' || edge.status === 'index-incomplete',
          fromModule: edge.fromModuleId,
          toModule: edge.toModuleId,
        });
      }
    }
  }
  edges.sort((a, b) => compareText(a.from, b.from) || compareText(a.to, b.to) || compareText(a.id, b.id));
  return edges;
}

function addPath(node: MutableImpactNode, path: ImpactPath): void {
  node.pathCount++;
  if (path.ambiguous) node.ambiguousPathCount++;
  if (node.representativePaths.length < 3) node.representativePaths.push(path);
}

function materializeNode(architecture: WorkspaceArchitecture, mutable: MutableImpactNode): ImpactNode {
  const hotspot = architectureHotspotFor(architecture, mutable.id);
  const baseScore = mutable.depth <= 1 ? 4 : mutable.depth <= 3 ? 2 : 1;
  const pathScore = Math.min(8, mutable.pathCount);
  const ambiguityScore = Math.min(9, mutable.ambiguousPathCount * 2);
  const cycleScore = Math.min(12, mutable.cycleCount * 4);
  const hotspotScore = hotspot ? Math.min(12, Math.ceil(hotspot.score / 3)) : 0;
  const risk = riskFromScore(baseScore + pathScore + ambiguityScore + cycleScore + hotspotScore);
  return Object.freeze({
    id: mutable.id,
    kind: mutable.kind,
    label: mutable.label,
    depth: mutable.depth,
    direction: mutable.directions.size > 1 ? 'both' : [...mutable.directions][0] ?? 'both',
    pathCount: mutable.pathCount,
    ambiguousPathCount: mutable.ambiguousPathCount,
    cycleCount: mutable.cycleCount,
    risk,
    reasons: Object.freeze([...mutable.reasons].slice(0, MAX_IMPACT_REASONS)),
    representativePaths: Object.freeze(mutable.representativePaths),
  });
}

function pathFingerprint(path: ImpactPath): string {
  return path.direction + '\0' + path.rootId + '\0' + path.targetId + '\0' + path.steps.map(step => step.edgeId).join('\0');
}

function traverseDirection(
  architecture: WorkspaceArchitecture,
  rootId: string,
  direction: 'incoming' | 'outgoing',
  edges: readonly TraversalEdge[],
  options: ImpactOptions,
  nodes: Map<string, MutableImpactNode>,
  paths: ImpactPath[],
  pathFingerprints: Set<string>,
  boundaries: ImpactBoundary[],
): { maxDepth: number; limited: boolean } {
  const byNode = new Map<string, TraversalEdge[]>();
  for (const edge of edges) {
    const key = direction === 'outgoing' ? edge.from : edge.to;
    const list = byNode.get(key);
    if (list) list.push(edge); else byNode.set(key, [edge]);
  }
  for (const list of byNode.values()) list.sort((a, b) => compareText(a.id, b.id));
  const queue: QueueItem[] = [{ id: rootId, depth: 0, steps: [], ambiguous: false }];
  const bestDepth = new Map<string, number>([[rootId, 0]]);
  let head = 0;
  let maxDepth = 0;
  let limited = false;
  while (head < queue.length) {
    const current = queue[head++];
    if (current.depth >= options.maxDepth || current.depth >= MAX_ARCHITECTURE_PATH_DEPTH) {
      if ((byNode.get(current.id)?.length ?? 0) > 0) {
        limited = true;
        for (const edge of (byNode.get(current.id) ?? []).slice(0, MAX_ARCHITECTURE_NEIGHBORS)) {
          boundaries.push(Object.freeze({
            id: JSON.stringify(['impact-boundary', direction, edge.id, current.depth]),
            reason: 'depth-limit',
            fromId: edge.from,
            toId: edge.to,
            edgeId: edge.id,
          }));
        }
      }
      continue;
    }
    for (const edge of (byNode.get(current.id) ?? []).slice(0, MAX_ARCHITECTURE_NEIGHBORS)) {
      const nextId = direction === 'outgoing' ? edge.to : edge.from;
      const fromModule = direction === 'outgoing' ? edge.fromModule : edge.toModule;
      const toModule = direction === 'outgoing' ? edge.toModule : edge.fromModule;
      if (!options.crossModules && fromModule !== toModule) {
        boundaries.push(Object.freeze({
          id: JSON.stringify(['impact-boundary', direction, edge.id, 'module']),
          reason: 'cross-module-disabled', fromId: edge.from, toId: edge.to, edgeId: edge.id,
        }));
        continue;
      }
      if (!options.includeAmbiguousCalls && edge.kind === 'call' && edge.ambiguous) {
        boundaries.push(Object.freeze({
          id: JSON.stringify(['impact-boundary', direction, edge.id, 'ambiguous']),
          reason: 'ambiguous-call-excluded', fromId: edge.from, toId: edge.to, edgeId: edge.id,
        }));
        continue;
      }
      if (!nodeKind(architecture, nextId)) continue;
      const step: ImpactPathStep = Object.freeze({
        fromId: direction === 'outgoing' ? current.id : nextId,
        toId: direction === 'outgoing' ? nextId : current.id,
        edgeId: edge.id,
        edgeKind: edge.kind,
        label: edge.label,
        ambiguous: edge.ambiguous,
      });
      const nextSteps = direction === 'outgoing' ? [...current.steps, step] : [step, ...current.steps];
      const path: ImpactPath = Object.freeze({
        rootId,
        targetId: nextId,
        direction,
        steps: Object.freeze(nextSteps),
        ambiguous: current.ambiguous || edge.ambiguous,
      });
      const fingerprint = pathFingerprint(path);
      if (!pathFingerprints.has(fingerprint) && paths.length < MAX_ARCHITECTURE_PATHS) {
        pathFingerprints.add(fingerprint);
        paths.push(path);
      } else if (paths.length >= MAX_ARCHITECTURE_PATHS) limited = true;

      let node = nodes.get(nextId);
      if (!node) {
        if (nodes.size >= MAX_IMPACT_RESULTS) {
          limited = true;
          boundaries.push(Object.freeze({
            id: JSON.stringify(['impact-boundary', direction, edge.id, 'result']),
            reason: 'result-limit', fromId: edge.from, toId: edge.to, edgeId: edge.id,
          }));
          continue;
        }
        const kind = nodeKind(architecture, nextId)!;
        node = {
          id: nextId,
          kind,
          label: architectureNodeLabel(architecture, nextId),
          depth: current.depth + 1,
          directions: new Set(),
          pathCount: 0,
          ambiguousPathCount: 0,
          cycleCount: architectureCycleMembership(architecture, nextId).length,
          reasons: new Set(),
          representativePaths: [],
        };
        nodes.set(nextId, node);
      }
      node.depth = Math.min(node.depth, current.depth + 1);
      node.directions.add(direction);
      addPath(node, path);
      node.reasons.add(direction === 'outgoing'
        ? 'reachable through observed ' + edge.kind + ' dependency'
        : 'can reach the selected item through observed ' + edge.kind + ' dependency');
      if (edge.ambiguous) node.reasons.add('at least one path contains an ambiguous lexical call candidate');
      if (node.cycleCount) node.reasons.add('participates in an observed architecture cycle');
      maxDepth = Math.max(maxDepth, current.depth + 1);

      const previousDepth = bestDepth.get(nextId);
      if (previousDepth === undefined || current.depth + 1 < previousDepth) {
        bestDepth.set(nextId, current.depth + 1);
        queue.push({ id: nextId, depth: current.depth + 1, steps: nextSteps, ambiguous: path.ambiguous });
      } else if (current.depth + 1 === previousDepth && queue.length < MAX_IMPACT_RESULTS * 4) {
        // Equal-depth alternate routes improve path evidence without creating
        // unbounded cycle expansion; bestDepth prevents deeper revisits.
        queue.push({ id: nextId, depth: current.depth + 1, steps: nextSteps, ambiguous: path.ambiguous });
      }
    }
  }
  return { maxDepth, limited };
}

function impactChecklist(
  architecture: WorkspaceArchitecture,
  rootId: string,
  nodes: readonly ImpactNode[],
  boundaries: readonly ImpactBoundary[],
): readonly string[] {
  const items: string[] = [];
  const rootCycles = architectureCycleMembership(architecture, rootId);
  const rootHotspot = architectureHotspotFor(architecture, rootId);
  const ambiguous = nodes.reduce((sum, node) => sum + node.ambiguousPathCount, 0);
  const crossModule = nodes.filter(node => node.kind === 'module').length;
  if (rootCycles.length) items.push('Review the selected item together with every member of its observed cycle before changing interfaces or imports.');
  if (rootHotspot && riskRank(rootHotspot.risk) >= riskRank('high')) items.push('The selected item is a high-priority architecture hotspot; prefer a smaller staged change with focused regression checks.');
  if (ambiguous) items.push('Recheck ambiguous lexical call candidates with the compiler or exact source context before treating them as real dependencies.');
  if (crossModule >= 3) items.push('Exercise project-level tests because observed impact crosses several open source modules.');
  if (nodes.some(node => node.depth >= 4)) items.push('Inspect transitive dependents beyond the immediate caller/importer because the observed dependency chain is deep.');
  if (boundaries.some(boundary => boundary.reason === 'depth-limit')) items.push('Increase the impact depth or review boundary nodes manually; the current trace stopped at its depth limit.');
  if (boundaries.some(boundary => boundary.reason === 'result-limit')) items.push('Narrow the review target or query; the impact result limit was reached.');
  if (boundaries.some(boundary => boundary.reason === 'ambiguous-call-excluded')) items.push('A strict trace omitted ambiguous calls; compare with an inclusive trace before concluding that impact is absent.');
  if (architecture.summary.complete === false) items.push('Architecture coverage is incomplete; do not use absence from this review as proof that no dependency exists.');
  if (!items.length) items.push('Review direct observed callers/importers and run the relevant compiler or project tests before applying a behavior-changing edit.');
  return Object.freeze(items.slice(0, MAX_IMPACT_CHECKLIST));
}

export function analyzeWorkspaceImpact(
  architecture: WorkspaceArchitecture,
  rootId: string,
  optionsInput?: Partial<ImpactOptions>,
): ImpactReview | null {
  const root = architectureNode(architecture, rootId);
  const rootKind = nodeKind(architecture, rootId);
  if (!root || !rootKind) return null;
  if (rootKind === 'symbol' && 'kind' in root && root.kind !== 'function') {
    // Non-function declaration nodes have no call graph edges. They can still
    // be reviewed elsewhere, but pretending to trace them would be misleading.
    return Object.freeze({
      rootId,
      rootKind,
      rootLabel: architectureNodeLabel(architecture, rootId),
      options: normalizeOptions(optionsInput),
      nodes: Object.freeze([]),
      paths: Object.freeze([]),
      boundaries: Object.freeze([]),
      incomingCount: 0,
      outgoingCount: 0,
      maxObservedDepth: 0,
      cycleCount: architectureCycleMembership(architecture, rootId).length,
      ambiguousPathCount: 0,
      confidence: architecture.summary.complete ? 'high-observation' : 'mixed-observation',
      score: architecture.summary.complete ? 1 : 4,
      risk: architecture.summary.complete ? 'low' : 'medium',
      checklist: Object.freeze(['This lexical declaration has no function-call topology. Use code references or compiler-aware tooling for semantic impact.']),
      complete: architecture.summary.complete,
    });
  }
  const options = normalizeOptions(optionsInput);
  const edges = traversalEdges(architecture, rootKind, options);
  const nodes = new Map<string, MutableImpactNode>();
  const paths: ImpactPath[] = [];
  const pathFingerprints = new Set<string>();
  const boundaries: ImpactBoundary[] = [];
  let maxObservedDepth = 0;
  let limited = false;
  if (options.direction === 'incoming' || options.direction === 'both') {
    const result = traverseDirection(architecture, rootId, 'incoming', edges, options,
      nodes, paths, pathFingerprints, boundaries);
    maxObservedDepth = Math.max(maxObservedDepth, result.maxDepth);
    limited ||= result.limited;
  }
  if (options.direction === 'outgoing' || options.direction === 'both') {
    const result = traverseDirection(architecture, rootId, 'outgoing', edges, options,
      nodes, paths, pathFingerprints, boundaries);
    maxObservedDepth = Math.max(maxObservedDepth, result.maxDepth);
    limited ||= result.limited;
  }
  nodes.delete(rootId);
  const materialized = [...nodes.values()].map(node => materializeNode(architecture, node));
  materialized.sort((a, b) => a.depth - b.depth || riskRank(b.risk) - riskRank(a.risk) ||
    compareText(a.label.toLowerCase(), b.label.toLowerCase()) || compareText(a.id, b.id));
  paths.sort((a, b) => a.steps.length - b.steps.length || compareText(a.direction, b.direction) ||
    compareText(a.targetId, b.targetId) || compareText(pathFingerprint(a), pathFingerprint(b)));

  const incomingCount = materialized.filter(node => node.direction === 'incoming' || node.direction === 'both').length;
  const outgoingCount = materialized.filter(node => node.direction === 'outgoing' || node.direction === 'both').length;
  const cycleCount = architectureCycleMembership(architecture, rootId).length +
    materialized.reduce((sum, node) => sum + (node.cycleCount ? 1 : 0), 0);
  const ambiguousPathCount = paths.filter(path => path.ambiguous).length;
  const rootHotspot = architectureHotspotFor(architecture, rootId);
  const score = Math.min(99,
    incomingCount * 2 + outgoingCount + Math.min(18, maxObservedDepth * 2) +
    ambiguousPathCount * 2 + cycleCount * 5 + (rootHotspot?.score ?? 0) +
    (architecture.summary.complete ? 0 : 6) + (limited ? 5 : 0));
  const risk = riskFromScore(score);
  const confidence: ImpactConfidence = !architecture.summary.complete || limited
    ? 'low-observation'
    : ambiguousPathCount > 0 ? 'mixed-observation' : 'high-observation';
  const complete = architecture.summary.complete && !limited && boundaries.length === 0;
  const checklist = impactChecklist(architecture, rootId, materialized, boundaries);

  return Object.freeze({
    rootId,
    rootKind,
    rootLabel: architectureNodeLabel(architecture, rootId),
    options,
    nodes: Object.freeze(materialized.slice(0, MAX_IMPACT_RESULTS)),
    paths: Object.freeze(paths.slice(0, MAX_ARCHITECTURE_PATHS)),
    boundaries: Object.freeze(boundaries.slice(0, MAX_IMPACT_RESULTS)),
    incomingCount,
    outgoingCount,
    maxObservedDepth,
    cycleCount,
    ambiguousPathCount,
    confidence,
    score,
    risk,
    checklist,
    complete,
  });
}

export function impactNodePath(
  review: ImpactReview,
  nodeId: string,
  direction?: 'incoming' | 'outgoing',
): ImpactPath | null {
  return review.paths.find(path => path.targetId === nodeId && (!direction || path.direction === direction)) ?? null;
}

export function impactRiskLabel(risk: ArchitectureRiskLevel): string {
  return risk === 'critical' ? 'Critical change surface'
    : risk === 'high' ? 'High change surface'
    : risk === 'medium' ? 'Medium change surface'
    : 'Low change surface';
}

export function impactConfidenceLabel(confidence: ImpactConfidence): string {
  return confidence === 'high-observation' ? 'High confidence in the bounded observation set'
    : confidence === 'mixed-observation' ? 'Mixed confidence because some call paths are ambiguous'
    : 'Low confidence because coverage or traversal is incomplete';
}

export function impactSummary(review: ImpactReview): string {
  return [
    review.rootLabel,
    impactRiskLabel(review.risk),
    review.incomingCount + ' incoming observed item' + (review.incomingCount === 1 ? '' : 's'),
    review.outgoingCount + ' outgoing observed item' + (review.outgoingCount === 1 ? '' : 's'),
    'depth ' + review.maxObservedDepth,
    review.ambiguousPathCount + ' ambiguous path' + (review.ambiguousPathCount === 1 ? '' : 's'),
    review.cycleCount + ' cycle observation' + (review.cycleCount === 1 ? '' : 's'),
    review.complete ? 'bounded trace complete' : 'bounded trace incomplete',
  ].join(' · ');
}
