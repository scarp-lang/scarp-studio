import {
  architectureNodeLabel,
  type ArchitectureCallSite,
  type ArchitectureCycle,
  type ArchitectureHotspot,
  type ArchitectureImportEdge,
  type ArchitectureModule,
  type ArchitectureSymbol,
  type WorkspaceArchitecture,
} from './workspaceArchitecture';

/** Session-only architecture snapshots.
 * The fingerprint is deterministic FNV-1a 64-bit text hashing for change
 * identity, not cryptographic integrity and not a substitute for SHA-256.
 */
export const MAX_ARCHITECTURE_SNAPSHOTS = 12;
export const MAX_SNAPSHOT_MODULES = 200;
export const MAX_SNAPSHOT_SYMBOLS = 1500;
export const MAX_SNAPSHOT_CALLS = 4000;
export const MAX_SNAPSHOT_IMPORTS = 768;
export const MAX_SNAPSHOT_CYCLES = 64;
export const MAX_SNAPSHOT_HOTSPOTS = 96;
export const MAX_SNAPSHOT_DIFF_ITEMS = 512;
export const MAX_SNAPSHOT_LABEL_UNITS = 120;

export interface ArchitectureSnapshotModule {
  readonly id: string;
  readonly name: string;
  readonly path: string | null;
  readonly revision: number;
  readonly symbols: number;
  readonly functions: number;
  readonly importsOut: number;
  readonly importsIn: number;
  readonly calls: number;
  readonly incomplete: boolean;
}

export interface ArchitectureSnapshotSymbol {
  readonly id: string;
  readonly moduleId: string;
  readonly name: string;
  readonly kind: ArchitectureSymbol['kind'];
  readonly scope: ArchitectureSymbol['scope'];
  readonly visibility: ArchitectureSymbol['visibility'];
  readonly pure: boolean;
  readonly line: number;
  readonly incomingCalls: number;
  readonly outgoingCalls: number;
}

export interface ArchitectureSnapshotCall {
  readonly id: string;
  readonly moduleId: string;
  readonly enclosingSymbolId: string | null;
  readonly name: string;
  readonly line: number;
  readonly status: ArchitectureCallSite['status'];
  readonly candidates: readonly string[];
}

export interface ArchitectureSnapshotImport {
  readonly id: string;
  readonly fromModuleId: string;
  readonly toModuleId: string | null;
  readonly specifier: string;
  readonly alias: string | null;
  readonly status: ArchitectureImportEdge['status'];
  readonly line: number;
}

export interface ArchitectureSnapshotCycle {
  readonly id: string;
  readonly kind: ArchitectureCycle['kind'];
  readonly members: readonly string[];
  readonly edgeCount: number;
  readonly selfLoop: boolean;
}

export interface ArchitectureSnapshotHotspot {
  readonly id: string;
  readonly kind: ArchitectureHotspot['kind'];
  readonly label: string;
  readonly score: number;
  readonly risk: ArchitectureHotspot['risk'];
  readonly incoming: number;
  readonly outgoing: number;
  readonly ambiguous: number;
  readonly cycles: number;
}

export interface ArchitectureSnapshot {
  readonly id: string;
  readonly label: string;
  readonly capturedAt: number;
  readonly generation: string;
  readonly fingerprint: string;
  readonly complete: boolean;
  readonly coverageReasons: readonly string[];
  readonly modules: readonly ArchitectureSnapshotModule[];
  readonly symbols: readonly ArchitectureSnapshotSymbol[];
  readonly calls: readonly ArchitectureSnapshotCall[];
  readonly imports: readonly ArchitectureSnapshotImport[];
  readonly cycles: readonly ArchitectureSnapshotCycle[];
  readonly hotspots: readonly ArchitectureSnapshotHotspot[];
}

export type ArchitectureDiffKind = 'added' | 'removed' | 'changed';
export type ArchitectureDiffEntity = 'module' | 'symbol' | 'call' | 'import' | 'cycle' | 'hotspot';

export interface ArchitectureDiffItem {
  readonly id: string;
  readonly entity: ArchitectureDiffEntity;
  readonly kind: ArchitectureDiffKind;
  readonly label: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly severity: 'info' | 'review' | 'high';
}

export interface ArchitectureSnapshotDiff {
  readonly beforeId: string;
  readonly afterId: string;
  readonly identical: boolean;
  readonly fingerprintChanged: boolean;
  readonly complete: boolean;
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly items: readonly ArchitectureDiffItem[];
  readonly moduleDelta: number;
  readonly symbolDelta: number;
  readonly callDelta: number;
  readonly importDelta: number;
  readonly cycleDelta: number;
  readonly hotspotDelta: number;
  readonly highPriorityChanges: number;
}

export interface ArchitectureSnapshotStore {
  readonly snapshots: readonly ArchitectureSnapshot[];
}

export const EMPTY_ARCHITECTURE_SNAPSHOT_STORE: ArchitectureSnapshotStore = Object.freeze({
  snapshots: Object.freeze([]),
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function boundedLabel(label: string): string {
  if (label.length <= MAX_SNAPSHOT_LABEL_UNITS) return label;
  const end = MAX_SNAPSHOT_LABEL_UNITS - 1;
  const adjusted = /[\uD800-\uDBFF]/.test(label[end - 1]) && /[\uDC00-\uDFFF]/.test(label[end]) ? end - 1 : end;
  return label.slice(0, adjusted) + '…';
}

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort(compareText).map(key => [key, stableObject(object[key])]));
  }
  return value;
}

export function stableArchitectureJson(value: unknown): string {
  return JSON.stringify(stableObject(value));
}

export function architectureFingerprint(value: unknown): string {
  const text = stableArchitectureJson(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    hash ^= BigInt(code & 0xff);
    hash = (hash * prime) & mask;
    hash ^= BigInt(code >>> 8);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

function snapshotModule(module: ArchitectureModule): ArchitectureSnapshotModule {
  return Object.freeze({
    id: module.id,
    name: boundedLabel(module.listedName ?? module.name),
    path: module.path,
    revision: module.revision,
    symbols: module.symbolIds.length,
    functions: module.functionIds.length,
    importsOut: module.importEdgeIds.length,
    importsIn: module.incomingImportEdgeIds.length,
    calls: module.callSiteIds.length,
    incomplete: module.incomplete,
  });
}

function snapshotSymbol(symbol: ArchitectureSymbol): ArchitectureSnapshotSymbol {
  return Object.freeze({
    id: symbol.id,
    moduleId: symbol.moduleId,
    name: boundedLabel(symbol.name),
    kind: symbol.kind,
    scope: symbol.scope,
    visibility: symbol.visibility,
    pure: symbol.pure,
    line: symbol.line,
    incomingCalls: symbol.incomingCallEdgeIds.length,
    outgoingCalls: symbol.outgoingCallEdgeIds.length,
  });
}

function snapshotCall(call: ArchitectureCallSite): ArchitectureSnapshotCall {
  return Object.freeze({
    id: call.id,
    moduleId: call.moduleId,
    enclosingSymbolId: call.enclosingSymbolId,
    name: boundedLabel(call.name),
    line: call.line,
    status: call.status,
    candidates: Object.freeze([...call.candidateSymbolIds].sort(compareText)),
  });
}

function snapshotImport(edge: ArchitectureImportEdge): ArchitectureSnapshotImport {
  return Object.freeze({
    id: edge.id,
    fromModuleId: edge.fromModuleId,
    toModuleId: edge.toModuleId,
    specifier: boundedLabel(edge.specifier),
    alias: edge.alias ? boundedLabel(edge.alias) : null,
    status: edge.status,
    line: edge.line,
  });
}

function snapshotCycle(cycle: ArchitectureCycle): ArchitectureSnapshotCycle {
  return Object.freeze({
    id: cycle.id,
    kind: cycle.kind,
    members: Object.freeze([...cycle.memberIds].sort(compareText)),
    edgeCount: cycle.edgeIds.length,
    selfLoop: cycle.selfLoop,
  });
}

function snapshotHotspot(hotspot: ArchitectureHotspot): ArchitectureSnapshotHotspot {
  return Object.freeze({
    id: hotspot.id,
    kind: hotspot.kind,
    label: boundedLabel(hotspot.label),
    score: hotspot.score,
    risk: hotspot.risk,
    incoming: hotspot.incoming,
    outgoing: hotspot.outgoing,
    ambiguous: hotspot.ambiguous,
    cycles: hotspot.cycleCount,
  });
}

function snapshotPayload(architecture: WorkspaceArchitecture): object {
  return {
    complete: architecture.summary.complete,
    coverageReasons: architecture.coverageReasons,
    modules: architecture.modules.slice(0, MAX_SNAPSHOT_MODULES).map(snapshotModule),
    symbols: architecture.symbols.slice(0, MAX_SNAPSHOT_SYMBOLS).map(snapshotSymbol),
    calls: architecture.callSites.slice(0, MAX_SNAPSHOT_CALLS).map(snapshotCall),
    imports: architecture.importEdges.slice(0, MAX_SNAPSHOT_IMPORTS).map(snapshotImport),
    cycles: architecture.cycles.slice(0, MAX_SNAPSHOT_CYCLES).map(snapshotCycle),
    hotspots: architecture.hotspots.slice(0, MAX_SNAPSHOT_HOTSPOTS).map(snapshotHotspot),
  };
}

export function captureArchitectureSnapshot(
  architecture: WorkspaceArchitecture,
  label: string,
  capturedAt = Date.now(),
): ArchitectureSnapshot {
  const safeLabel = boundedLabel(label.trim() || 'Architecture snapshot');
  const payload = snapshotPayload(architecture) as ReturnType<typeof snapshotPayload> & {
    modules: ArchitectureSnapshotModule[];
    symbols: ArchitectureSnapshotSymbol[];
    calls: ArchitectureSnapshotCall[];
    imports: ArchitectureSnapshotImport[];
    cycles: ArchitectureSnapshotCycle[];
    hotspots: ArchitectureSnapshotHotspot[];
    complete: boolean;
    coverageReasons: string[];
  };
  const fingerprint = architectureFingerprint(payload);
  return Object.freeze({
    id: JSON.stringify(['architecture-snapshot', capturedAt, fingerprint, safeLabel]),
    label: safeLabel,
    capturedAt,
    generation: architecture.generation,
    fingerprint,
    complete: payload.complete,
    coverageReasons: Object.freeze([...payload.coverageReasons]),
    modules: Object.freeze(payload.modules),
    symbols: Object.freeze(payload.symbols),
    calls: Object.freeze(payload.calls),
    imports: Object.freeze(payload.imports),
    cycles: Object.freeze(payload.cycles),
    hotspots: Object.freeze(payload.hotspots),
  });
}

export function addArchitectureSnapshot(
  store: ArchitectureSnapshotStore,
  snapshot: ArchitectureSnapshot,
): ArchitectureSnapshotStore {
  if (store.snapshots.some(item => item.id === snapshot.id)) return store;
  const next = [snapshot, ...store.snapshots].slice(0, MAX_ARCHITECTURE_SNAPSHOTS);
  return Object.freeze({ snapshots: Object.freeze(next) });
}

export function removeArchitectureSnapshot(
  store: ArchitectureSnapshotStore,
  id: string,
): ArchitectureSnapshotStore {
  if (!store.snapshots.some(item => item.id === id)) return store;
  return Object.freeze({ snapshots: Object.freeze(store.snapshots.filter(item => item.id !== id)) });
}

export function clearArchitectureSnapshots(): ArchitectureSnapshotStore {
  return EMPTY_ARCHITECTURE_SNAPSHOT_STORE;
}

function mapById<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map(item => [item.id, item]));
}

function compactModule(item: ArchitectureSnapshotModule): string {
  return [item.name, 'symbols=' + item.symbols, 'functions=' + item.functions,
    'imports=' + item.importsIn + '/' + item.importsOut, 'calls=' + item.calls,
    item.incomplete ? 'partial' : 'complete'].join(' · ');
}

function compactSymbol(item: ArchitectureSnapshotSymbol): string {
  return [item.kind, item.name, item.scope, item.visibility, item.pure ? 'pure' : 'impure/unknown',
    'line=' + item.line, 'calls=' + item.incomingCalls + '/' + item.outgoingCalls].join(' · ');
}

function compactCall(item: ArchitectureSnapshotCall): string {
  return [item.name, item.status, 'line=' + item.line, 'candidates=' + item.candidates.length].join(' · ');
}

function compactImport(item: ArchitectureSnapshotImport): string {
  return [item.specifier, item.alias ? 'as ' + item.alias : '', item.status, 'line=' + item.line].filter(Boolean).join(' · ');
}

function compactCycle(item: ArchitectureSnapshotCycle): string {
  return [item.kind, item.members.length + ' members', item.edgeCount + ' edges', item.selfLoop ? 'self-loop' : 'multi-node'].join(' · ');
}

function compactHotspot(item: ArchitectureSnapshotHotspot): string {
  return [item.label, item.risk, 'score=' + item.score, 'in=' + item.incoming,
    'out=' + item.outgoing, 'ambiguous=' + item.ambiguous, 'cycles=' + item.cycles].join(' · ');
}

interface DiffDescriptor<T extends { id: string }> {
  entity: ArchitectureDiffEntity;
  before: readonly T[];
  after: readonly T[];
  label: (item: T) => string;
  compact: (item: T) => string;
  severity: (before: T | null, after: T | null) => ArchitectureDiffItem['severity'];
}

function appendDescriptorDiff<T extends { id: string }>(
  descriptor: DiffDescriptor<T>,
  items: ArchitectureDiffItem[],
): void {
  const before = mapById(descriptor.before);
  const after = mapById(descriptor.after);
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort(compareText);
  for (const id of ids) {
    if (items.length >= MAX_SNAPSHOT_DIFF_ITEMS) return;
    const oldItem = before.get(id) ?? null;
    const newItem = after.get(id) ?? null;
    const oldText = oldItem ? descriptor.compact(oldItem) : null;
    const newText = newItem ? descriptor.compact(newItem) : null;
    if (oldItem && newItem && stableArchitectureJson(oldItem) === stableArchitectureJson(newItem)) continue;
    const kind: ArchitectureDiffKind = oldItem && newItem ? 'changed' : oldItem ? 'removed' : 'added';
    const labelSource = newItem ?? oldItem!;
    items.push(Object.freeze({
      id: JSON.stringify(['architecture-diff', descriptor.entity, kind, id]),
      entity: descriptor.entity,
      kind,
      label: descriptor.label(labelSource),
      before: oldText,
      after: newText,
      severity: descriptor.severity(oldItem, newItem),
    }));
  }
}

function hotspotSeverity(before: ArchitectureSnapshotHotspot | null,
  after: ArchitectureSnapshotHotspot | null): ArchitectureDiffItem['severity'] {
  if (!after) return 'review';
  if (after.risk === 'critical' || after.risk === 'high') return 'high';
  if (before && after.score > before.score + 5) return 'high';
  return 'review';
}

function cycleSeverity(_before: ArchitectureSnapshotCycle | null,
  after: ArchitectureSnapshotCycle | null): ArchitectureDiffItem['severity'] {
  return after ? 'high' : 'review';
}

export function compareArchitectureSnapshots(
  beforeSnapshot: ArchitectureSnapshot,
  afterSnapshot: ArchitectureSnapshot,
): ArchitectureSnapshotDiff {
  const items: ArchitectureDiffItem[] = [];
  appendDescriptorDiff<ArchitectureSnapshotModule>({
    entity: 'module', before: beforeSnapshot.modules, after: afterSnapshot.modules,
    label: item => item.name,
    compact: compactModule,
    severity: (_before, after) => after?.incomplete ? 'high' : 'review',
  }, items);
  appendDescriptorDiff<ArchitectureSnapshotSymbol>({
    entity: 'symbol', before: beforeSnapshot.symbols, after: afterSnapshot.symbols,
    label: item => item.name,
    compact: compactSymbol,
    severity: () => 'review',
  }, items);
  appendDescriptorDiff<ArchitectureSnapshotCall>({
    entity: 'call', before: beforeSnapshot.calls, after: afterSnapshot.calls,
    label: item => item.name,
    compact: compactCall,
    severity: (_before, after) => after && (after.status === 'multiple-candidates' ||
      after.status === 'non-function-shadow' || after.status === 'index-incomplete') ? 'high' : 'review',
  }, items);
  appendDescriptorDiff<ArchitectureSnapshotImport>({
    entity: 'import', before: beforeSnapshot.imports, after: afterSnapshot.imports,
    label: item => item.specifier,
    compact: compactImport,
    severity: (_before, after) => after && !['open', 'listed'].includes(after.status) ? 'high' : 'review',
  }, items);
  appendDescriptorDiff<ArchitectureSnapshotCycle>({
    entity: 'cycle', before: beforeSnapshot.cycles, after: afterSnapshot.cycles,
    label: item => item.kind + ' cycle (' + item.members.length + ')',
    compact: compactCycle,
    severity: cycleSeverity,
  }, items);
  appendDescriptorDiff<ArchitectureSnapshotHotspot>({
    entity: 'hotspot', before: beforeSnapshot.hotspots, after: afterSnapshot.hotspots,
    label: item => item.label,
    compact: compactHotspot,
    severity: hotspotSeverity,
  }, items);
  items.sort((left, right) => {
    const severityRank = (value: ArchitectureDiffItem['severity']) => value === 'high' ? 2 : value === 'review' ? 1 : 0;
    return severityRank(right.severity) - severityRank(left.severity) || compareText(left.entity, right.entity) ||
      compareText(left.label.toLowerCase(), right.label.toLowerCase()) || compareText(left.id, right.id);
  });
  const added = items.filter(item => item.kind === 'added').length;
  const removed = items.filter(item => item.kind === 'removed').length;
  const changed = items.filter(item => item.kind === 'changed').length;
  return Object.freeze({
    beforeId: beforeSnapshot.id,
    afterId: afterSnapshot.id,
    identical: beforeSnapshot.fingerprint === afterSnapshot.fingerprint && items.length === 0,
    fingerprintChanged: beforeSnapshot.fingerprint !== afterSnapshot.fingerprint,
    complete: beforeSnapshot.complete && afterSnapshot.complete && items.length < MAX_SNAPSHOT_DIFF_ITEMS,
    added,
    removed,
    changed,
    items: Object.freeze(items.slice(0, MAX_SNAPSHOT_DIFF_ITEMS)),
    moduleDelta: afterSnapshot.modules.length - beforeSnapshot.modules.length,
    symbolDelta: afterSnapshot.symbols.length - beforeSnapshot.symbols.length,
    callDelta: afterSnapshot.calls.length - beforeSnapshot.calls.length,
    importDelta: afterSnapshot.imports.length - beforeSnapshot.imports.length,
    cycleDelta: afterSnapshot.cycles.length - beforeSnapshot.cycles.length,
    hotspotDelta: afterSnapshot.hotspots.length - beforeSnapshot.hotspots.length,
    highPriorityChanges: items.filter(item => item.severity === 'high').length,
  });
}

export function snapshotSummary(snapshot: ArchitectureSnapshot): string {
  return [
    snapshot.label,
    snapshot.fingerprint,
    snapshot.modules.length + ' modules',
    snapshot.symbols.length + ' declarations',
    snapshot.calls.length + ' call sites',
    snapshot.imports.length + ' imports',
    snapshot.cycles.length + ' cycles',
    snapshot.hotspots.length + ' hotspots',
    snapshot.complete ? 'complete bounded coverage' : 'partial bounded coverage',
  ].join(' · ');
}

export function snapshotDiffSummary(diff: ArchitectureSnapshotDiff): string {
  if (diff.identical) return 'No architecture changes in the captured bounded observations.';
  return [
    diff.added + ' added',
    diff.removed + ' removed',
    diff.changed + ' changed',
    diff.highPriorityChanges + ' high-priority review items',
    'modules ' + signed(diff.moduleDelta),
    'symbols ' + signed(diff.symbolDelta),
    'calls ' + signed(diff.callDelta),
    'imports ' + signed(diff.importDelta),
    'cycles ' + signed(diff.cycleDelta),
    'hotspots ' + signed(diff.hotspotDelta),
  ].join(' · ');
}

function signed(value: number): string {
  return value > 0 ? '+' + value : String(value);
}

export function architectureSnapshotReport(
  architecture: WorkspaceArchitecture,
  snapshot: ArchitectureSnapshot,
): string {
  const moduleNames = new Map(architecture.modules.map(module => [module.id, module.listedName ?? module.name]));
  return [
    'Scarp Studio architecture snapshot (lexical observations only)',
    'Label: ' + snapshot.label,
    'Fingerprint (FNV-1a 64, non-cryptographic): ' + snapshot.fingerprint,
    'Coverage: ' + (snapshot.complete ? 'complete within editor bounds' : 'partial'),
    'Modules: ' + snapshot.modules.length,
    'Declarations: ' + snapshot.symbols.length,
    'Call sites: ' + snapshot.calls.length,
    'Imports: ' + snapshot.imports.length,
    'Cycles: ' + snapshot.cycles.length,
    'Hotspots: ' + snapshot.hotspots.length,
    ...snapshot.coverageReasons.map(reason => 'Coverage note: ' + reason),
    ...snapshot.cycles.map(cycle => 'Cycle: ' + cycle.kind + ' · ' + cycle.members.map(id => moduleNames.get(id) ?? architectureNodeLabel(architecture, id)).join(' -> ')),
  ].join('\n');
}

/** Human-readable, bounded comparison report for two session snapshots. */
export function architectureSnapshotDiffReport(
  diff: ArchitectureSnapshotDiff,
  before: ArchitectureSnapshot,
  after: ArchitectureSnapshot,
): string {
  const lines = [
    'Scarp Studio architecture snapshot comparison (lexical observations only)',
    'Before: ' + before.label + ' · ' + before.fingerprint,
    'After: ' + after.label + ' · ' + after.fingerprint,
    'Summary: ' + snapshotDiffSummary(diff),
    'Coverage: ' + (diff.complete ? 'complete within both bounded captures' : 'partial or diff-limited'),
  ];
  for (const item of diff.items) {
    lines.push([
      item.severity.toUpperCase(),
      item.kind,
      item.entity,
      item.label,
      item.before === null ? '' : 'before=' + item.before,
      item.after === null ? '' : 'after=' + item.after,
    ].filter(Boolean).join(' · '));
  }
  if (diff.added + diff.removed + diff.changed > diff.items.length) {
    lines.push('Additional diff items were omitted by the bounded comparison limit.');
  }
  return lines.join('\n');
}
