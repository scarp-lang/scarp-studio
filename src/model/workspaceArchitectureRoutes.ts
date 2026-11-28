import {
  architectureNode,
  architectureNodeLabel,
  type ArchitectureCallEdge,
  type ArchitectureNodeKind,
  type WorkspaceArchitecture,
} from './workspaceArchitecture';

/**
 * Point-to-point route exploration over the captured architecture graph.
 * Routes are explanations of observed edges only. They do not establish
 * compiler reachability, dynamic execution order, or semantic dependencies.
 */

export const MAX_ROUTE_DEPTH = 12;
export const MAX_ROUTE_PATHS = 32;
export const MAX_ROUTE_EXPANSIONS = 4096;
export const MAX_ROUTE_ALTERNATIVES_PER_NODE = 8;

export type ArchitectureRouteMode = 'imports' | 'calls' | 'combined';
export type ArchitectureRouteDirection = 'directed' | 'either-direction';
export type ArchitectureRouteStatus =
  | 'found'
  | 'same-node'
  | 'not-found'
  | 'incompatible-node-kinds'
  | 'unknown-node'
  | 'limited';

export interface ArchitectureRouteOptions {
  readonly mode: ArchitectureRouteMode;
  readonly direction: ArchitectureRouteDirection;
  readonly maxDepth: number;
  readonly includeAmbiguousCalls: boolean;
}

export const DEFAULT_ARCHITECTURE_ROUTE_OPTIONS: ArchitectureRouteOptions = Object.freeze({
  mode: 'combined',
  direction: 'directed',
  maxDepth: 8,
  includeAmbiguousCalls: true,
});

export interface ArchitectureRouteStep {
  readonly edgeId: string;
  readonly edgeKind: 'import' | 'call';
  readonly fromId: string;
  readonly toId: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly label: string;
  readonly reversed: boolean;
  readonly ambiguous: boolean;
}

export interface ArchitectureRoutePath {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly steps: readonly ArchitectureRouteStep[];
  readonly depth: number;
  readonly ambiguous: boolean;
  readonly reversedEdges: number;
}

export interface ArchitectureRouteResult {
  readonly fromId: string;
  readonly toId: string;
  readonly fromKind: ArchitectureNodeKind | null;
  readonly toKind: ArchitectureNodeKind | null;
  readonly status: ArchitectureRouteStatus;
  readonly options: ArchitectureRouteOptions;
  readonly paths: readonly ArchitectureRoutePath[];
  readonly shortestDepth: number | null;
  readonly expansions: number;
  readonly visitedNodes: number;
  readonly limited: boolean;
  readonly message: string;
}

interface RouteEdge {
  readonly id: string;
  readonly kind: 'import' | 'call';
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly ambiguous: boolean;
}

interface QueueState {
  readonly node: string;
  readonly steps: readonly ArchitectureRouteStep[];
}

function nodeKind(architecture: WorkspaceArchitecture, id: string): ArchitectureNodeKind | null {
  if (architecture.modules.some(item => item.id === id)) return 'module';
  if (architecture.symbols.some(item => item.id === id)) return 'symbol';
  return null;
}

function safeOptions(input: Partial<ArchitectureRouteOptions> = {}): ArchitectureRouteOptions {
  const mode = input.mode === 'imports' || input.mode === 'calls' || input.mode === 'combined'
    ? input.mode : DEFAULT_ARCHITECTURE_ROUTE_OPTIONS.mode;
  const direction = input.direction === 'directed' || input.direction === 'either-direction'
    ? input.direction : DEFAULT_ARCHITECTURE_ROUTE_OPTIONS.direction;
  const rawDepth = input.maxDepth ?? DEFAULT_ARCHITECTURE_ROUTE_OPTIONS.maxDepth;
  const maxDepth = Number.isSafeInteger(rawDepth) ? Math.max(1, Math.min(MAX_ROUTE_DEPTH, rawDepth))
    : DEFAULT_ARCHITECTURE_ROUTE_OPTIONS.maxDepth;
  return Object.freeze({
    mode,
    direction,
    maxDepth,
    includeAmbiguousCalls: input.includeAmbiguousCalls ?? DEFAULT_ARCHITECTURE_ROUTE_OPTIONS.includeAmbiguousCalls,
  });
}

function callAmbiguous(edge: ArchitectureCallEdge): boolean {
  return edge.status === 'multiple-candidates' || edge.status === 'non-function-shadow' || edge.status === 'index-incomplete';
}

function moduleEdges(
  architecture: WorkspaceArchitecture,
  options: ArchitectureRouteOptions,
): RouteEdge[] {
  const edges: RouteEdge[] = [];
  if (options.mode === 'imports' || options.mode === 'combined') {
    for (const edge of architecture.importEdges) {
      if (!edge.toModuleId) continue;
      edges.push({
        id: edge.id,
        kind: 'import',
        from: edge.fromModuleId,
        to: edge.toModuleId,
        label: edge.specifier + ' · ' + edge.status,
        ambiguous: edge.status === 'ambiguous',
      });
    }
  }
  if (options.mode === 'calls' || options.mode === 'combined') {
    const seen = new Set<string>();
    for (const edge of architecture.callEdges) {
      if (!options.includeAmbiguousCalls && callAmbiguous(edge)) continue;
      if (edge.fromModuleId === edge.toModuleId) continue;
      const key = edge.fromModuleId + '\0' + edge.toModuleId + '\0' + edge.name + '\0' + edge.status;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        id: edge.id,
        kind: 'call',
        from: edge.fromModuleId,
        to: edge.toModuleId,
        label: edge.name + ' · ' + edge.status,
        ambiguous: callAmbiguous(edge),
      });
    }
  }
  return edges;
}

function symbolEdges(
  architecture: WorkspaceArchitecture,
  options: ArchitectureRouteOptions,
): RouteEdge[] {
  if (options.mode === 'imports') return [];
  return architecture.callEdges.flatMap(edge => {
    if (!edge.fromSymbolId) return [];
    if (!options.includeAmbiguousCalls && callAmbiguous(edge)) return [];
    return [{
      id: edge.id,
      kind: 'call' as const,
      from: edge.fromSymbolId,
      to: edge.toSymbolId,
      label: edge.name + ' · ' + edge.status,
      ambiguous: callAmbiguous(edge),
    }];
  });
}

function adjacency(
  architecture: WorkspaceArchitecture,
  edges: readonly RouteEdge[],
  direction: ArchitectureRouteDirection,
): ReadonlyMap<string, readonly ArchitectureRouteStep[]> {
  const result = new Map<string, ArchitectureRouteStep[]>();
  const add = (edge: RouteEdge, reversed: boolean): void => {
    const from = reversed ? edge.to : edge.from;
    const to = reversed ? edge.from : edge.to;
    const step: ArchitectureRouteStep = Object.freeze({
      edgeId: edge.id,
      edgeKind: edge.kind,
      fromId: from,
      toId: to,
      fromLabel: architectureNodeLabel(architecture, from),
      toLabel: architectureNodeLabel(architecture, to),
      label: edge.label,
      reversed,
      ambiguous: edge.ambiguous,
    });
    const list = result.get(from);
    if (list) list.push(step); else result.set(from, [step]);
  };
  for (const edge of edges) {
    add(edge, false);
    if (direction === 'either-direction') add(edge, true);
  }
  for (const list of result.values()) {
    list.sort((left, right) => left.toLabel.localeCompare(right.toLabel) || left.edgeId.localeCompare(right.edgeId));
  }
  return result;
}

function pathId(fromId: string, toId: string, steps: readonly ArchitectureRouteStep[]): string {
  return JSON.stringify(['architecture-route', fromId, toId, ...steps.map(step => [step.edgeId, step.reversed])]);
}

function result(
  architecture: WorkspaceArchitecture,
  fromId: string,
  toId: string,
  options: ArchitectureRouteOptions,
  status: ArchitectureRouteStatus,
  paths: readonly ArchitectureRoutePath[],
  expansions: number,
  visitedNodes: number,
  limited: boolean,
  message: string,
): ArchitectureRouteResult {
  return Object.freeze({
    fromId,
    toId,
    fromKind: nodeKind(architecture, fromId),
    toKind: nodeKind(architecture, toId),
    status,
    options,
    paths: Object.freeze(paths),
    shortestDepth: paths[0]?.depth ?? (status === 'same-node' ? 0 : null),
    expansions,
    visitedNodes,
    limited,
    message,
  });
}

/** Find shortest observed routes, retaining bounded equal-depth alternatives. */
export function findArchitectureRoutes(
  architecture: WorkspaceArchitecture,
  fromId: string,
  toId: string,
  input: Partial<ArchitectureRouteOptions> = {},
): ArchitectureRouteResult {
  const options = safeOptions(input);
  const from = architectureNode(architecture, fromId);
  const to = architectureNode(architecture, toId);
  if (!from || !to) {
    return result(architecture, fromId, toId, options, 'unknown-node', [], 0, 0, false,
      'Choose two nodes from the current bounded architecture snapshot.');
  }
  const fromKind = nodeKind(architecture, fromId)!;
  const toKind = nodeKind(architecture, toId)!;
  if (fromId === toId) {
    return result(architecture, fromId, toId, options, 'same-node', [], 0, 1, false,
      'Source and destination are the same architecture node.');
  }
  if (fromKind !== toKind) {
    return result(architecture, fromId, toId, options, 'incompatible-node-kinds', [], 0, 2, false,
      'Route endpoints must both be modules or both be function declarations.');
  }
  if (fromKind === 'symbol' && ('kind' in from && from.kind !== 'function' || 'kind' in to && to.kind !== 'function')) {
    return result(architecture, fromId, toId, options, 'incompatible-node-kinds', [], 0, 2, false,
      'Function routes use observed call edges; non-function declarations have no call topology.');
  }
  const edges = fromKind === 'module' ? moduleEdges(architecture, options) : symbolEdges(architecture, options);
  const graph = adjacency(architecture, edges, options.direction);
  const queue: QueueState[] = [{ node: fromId, steps: [] }];
  const bestDepth = new Map<string, number>([[fromId, 0]]);
  const alternatives = new Map<string, number>([[fromId, 1]]);
  const paths: ArchitectureRoutePath[] = [];
  let shortest: number | null = null;
  let expansions = 0;
  let limited = false;

  for (let cursor = 0; cursor < queue.length; cursor++) {
    if (expansions >= MAX_ROUTE_EXPANSIONS) { limited = true; break; }
    const current = queue[cursor];
    const depth = current.steps.length;
    if (shortest !== null && depth >= shortest) continue;
    if (depth >= options.maxDepth) continue;
    for (const step of graph.get(current.node) ?? []) {
      expansions++;
      if (expansions > MAX_ROUTE_EXPANSIONS) { limited = true; break; }
      const nextSteps = [...current.steps, step];
      const nextDepth = nextSteps.length;
      if (step.toId === toId) {
        if (shortest === null) shortest = nextDepth;
        if (nextDepth === shortest && paths.length < MAX_ROUTE_PATHS) {
          paths.push(Object.freeze({
            id: pathId(fromId, toId, nextSteps),
            fromId,
            toId,
            steps: Object.freeze(nextSteps),
            depth: nextDepth,
            ambiguous: nextSteps.some(item => item.ambiguous),
            reversedEdges: nextSteps.filter(item => item.reversed).length,
          }));
        } else if (nextDepth === shortest) limited = true;
        continue;
      }
      if (shortest !== null && nextDepth >= shortest) continue;
      const knownDepth = bestDepth.get(step.toId);
      if (knownDepth !== undefined && knownDepth < nextDepth) continue;
      const count = alternatives.get(step.toId) ?? 0;
      if (knownDepth === nextDepth && count >= MAX_ROUTE_ALTERNATIVES_PER_NODE) {
        limited = true;
        continue;
      }
      bestDepth.set(step.toId, nextDepth);
      alternatives.set(step.toId, knownDepth === nextDepth ? count + 1 : 1);
      queue.push({ node: step.toId, steps: nextSteps });
    }
  }

  paths.sort((left, right) => left.reversedEdges - right.reversedEdges ||
    Number(left.ambiguous) - Number(right.ambiguous) || left.id.localeCompare(right.id));
  const status: ArchitectureRouteStatus = paths.length ? limited ? 'limited' : 'found'
    : limited ? 'limited' : 'not-found';
  const message = paths.length
    ? paths.length + ' shortest observed route' + (paths.length === 1 ? '' : 's') + ' at depth ' + paths[0].depth +
      (limited ? '; additional alternatives may be omitted.' : '.')
    : limited
      ? 'No route was found before the bounded route search limit was reached.'
      : 'No observed route connects these nodes under the selected edge and direction settings.';
  return result(architecture, fromId, toId, options, status, paths, expansions, bestDepth.size, limited, message);
}

export function architectureRouteSummary(route: ArchitectureRouteResult): string {
  return [
    architectureRouteStatusLabel(route.status),
    route.paths.length + ' path' + (route.paths.length === 1 ? '' : 's'),
    route.shortestDepth === null ? 'no depth' : 'depth ' + route.shortestDepth,
    route.expansions + ' edge expansions',
    route.visitedNodes + ' visited nodes',
    route.options.mode,
    route.options.direction,
    route.options.includeAmbiguousCalls ? 'ambiguous calls included' : 'ambiguous calls excluded',
  ].join(' · ');
}

export function architectureRouteStatusLabel(status: ArchitectureRouteStatus): string {
  switch (status) {
    case 'found': return 'Observed route found';
    case 'same-node': return 'Same architecture node';
    case 'not-found': return 'No observed route';
    case 'incompatible-node-kinds': return 'Incompatible route endpoints';
    case 'unknown-node': return 'Unknown architecture endpoint';
    case 'limited': return 'Bounded route search limited';
  }
}

export function architectureRoutePathText(path: ArchitectureRoutePath): string {
  if (!path.steps.length) return '';
  return [path.steps[0].fromLabel, ...path.steps.map(step =>
    (step.reversed ? '←' : '→') + ' [' + step.edgeKind + (step.ambiguous ? ', ambiguous' : '') + '] ' + step.toLabel)]
    .join(' ');
}
