import {
  LEDGER_COMPARISON_STATES,
  type LedgerComparison,
  type LedgerComparisonRow,
  type LedgerComparisonState,
} from './manifestLedgerComparison';
import { MAX_SCOPE_REPORT_UNITS } from './projectSearchScope';

export type EvidenceGrouping = 'folder' | 'batch';
export type EvidenceOrder = 'label' | 'changed' | 'incomplete' | 'byte-movement' | 'line-movement';
export type EvidenceCoverage = 'all' | 'complete' | 'partial' | 'unobserved';

export interface EvidenceDelta {
  readonly measured: number;
  readonly increased: number;
  readonly decreased: number;
  readonly stable: number;
  readonly net: number;
  readonly movement: number;
}

export interface EvidenceGroup {
  readonly key: string;
  readonly label: string;
  readonly selected: number;
  readonly refreshed: number;
  readonly comparable: number;
  readonly retained: number;
  readonly retainedWithoutDigest: number;
  readonly incomplete: number;
  readonly changed: number;
  readonly counts: Readonly<Record<LedgerComparisonState, number>>;
  readonly bytes: EvidenceDelta;
  readonly lines: EvidenceDelta;
}

export interface EvidenceAnalysis {
  readonly grouping: EvidenceGrouping;
  readonly groups: readonly EvidenceGroup[];
  readonly total: EvidenceGroup;
}

export interface EvidenceFilter {
  readonly query: string;
  readonly coverage: EvidenceCoverage;
  readonly changedOnly: boolean;
  readonly order: EvidenceOrder;
}

export const DEFAULT_EVIDENCE_FILTER: EvidenceFilter = Object.freeze({
  query: '', coverage: 'all', changedOnly: false, order: 'changed',
});

type MutableDelta = { -readonly [K in keyof EvidenceDelta]: EvidenceDelta[K] };
interface Accumulator {
  key: string;
  label: string;
  selected: number;
  retainedWithoutDigest: number;
  counts: Record<LedgerComparisonState, number>;
  bytes: MutableDelta;
  lines: MutableDelta;
}
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function emptyDelta(): MutableDelta {
  return { measured: 0, increased: 0, decreased: 0, stable: 0, net: 0, movement: 0 };
}

function newGroup(key: string, label: string): Accumulator {
  return {
    key, label, selected: 0, retainedWithoutDigest: 0,
    counts: {
      retained: 0, 'newly-hashed': 0, 'newly-unavailable': 0,
      unchanged: 0, changed: 0, 'origin-changed': 0,
      inconsistent: 0, unavailable: 0,
    },
    bytes: emptyDelta(),
    lines: emptyDelta(),
  };
}

/** Track direction as well as net change, so opposing deltas cannot hide
 * actual file movement. A missing measurement is never counted as zero. */
function addDelta(delta: MutableDelta, value: number | null): void {
  if (value === null || !Number.isSafeInteger(value)) return;
  delta.measured++;
  if (value > 0) delta.increased++;
  else if (value < 0) delta.decreased++;
  else delta.stable++;
  delta.net += value;
  delta.movement += Math.abs(value);
}

function observe(group: Accumulator, row: LedgerComparisonRow): void {
  group.selected++;
  group.counts[row.state]++;
  if (row.state === 'retained' && row.current.file?.state !== 'hashed') {
    group.retainedWithoutDigest++;
  }
  // Only fresh, comparable observations can contribute to deltas.
  if (row.state === 'changed' || row.state === 'unchanged') {
    addDelta(group.bytes, row.byteDelta);
    addDelta(group.lines, row.lineDelta);
  }
}

function finish(group: Accumulator): EvidenceGroup {
  const retained = group.counts.retained;
  const comparable = group.counts.changed + group.counts.unchanged;
  return Object.freeze({
    key: group.key,
    label: group.label,
    selected: group.selected,
    refreshed: group.selected - retained,
    comparable,
    retained,
    retainedWithoutDigest: group.retainedWithoutDigest,
    incomplete: group.selected - comparable,
    changed: group.counts.changed,
    counts: Object.freeze({ ...group.counts }),
    bytes: Object.freeze({ ...group.bytes }),
    lines: Object.freeze({ ...group.lines }),
  });
}

/** Direct parent folders form disjoint groups: a nested source contributes
 * exactly once, rather than once per ancestor. Membership is derived from
 * already reviewed relative labels, never a new directory listing. */
function groupIdentity(row: LedgerComparisonRow, grouping: EvidenceGrouping): { key: string; label: string } {
  if (grouping === 'batch') {
    return { key: 'batch:' + row.batch, label: 'Batch ' + row.batch };
  }
  const slash = row.label.lastIndexOf('/');
  if (slash < 0) return { key: 'folder:', label: '(project root)' };
  const folder = row.label.slice(0, slash);
  return { key: 'folder:' + folder, label: folder };
}

export function analyzeLedgerEvidence(comparison: LedgerComparison, grouping: EvidenceGrouping): EvidenceAnalysis {
  const total = newGroup('total', 'All selected sources');
  const accumulators = new Map<string, Accumulator>();
  for (const row of comparison.rows) {
    const identity = groupIdentity(row, grouping);
    let group = accumulators.get(identity.key);
    if (!group) {
      group = newGroup(identity.key, identity.label);
      accumulators.set(identity.key, group);
    }
    observe(group, row);
    observe(total, row);
  }
  const groups = Array.from(accumulators.values(), finish);
  groups.sort((a, b) => lexical(a.key, b.key));
  return Object.freeze({ grouping, groups: Object.freeze(groups), total: finish(total) });
}

export function evidenceCoverage(group: EvidenceGroup): Exclude<EvidenceCoverage, 'all'> {
  if (group.refreshed === 0) return 'unobserved';
  if (group.selected > 0 && group.comparable === group.selected) return 'complete';
  return 'partial';
}

function orderValue(group: EvidenceGroup, order: EvidenceOrder): number {
  switch (order) {
    case 'changed': return group.changed;
    case 'incomplete': return group.incomplete;
    case 'byte-movement': return group.bytes.movement;
    case 'line-movement': return group.lines.movement;
    default: return 0;
  }
}

export function filterEvidenceGroups(analysis: EvidenceAnalysis, filter: EvidenceFilter): readonly EvidenceGroup[] {
  if (filter.query.length > 120 || /[\x00-\x1f\x7f]/.test(filter.query)) return [];
  const query = filter.query.trim().toLowerCase();
  return analysis.groups.filter(group =>
    (!query || group.label.toLowerCase().includes(query)) &&
    (filter.coverage === 'all' || evidenceCoverage(group) === filter.coverage) &&
    (!filter.changedOnly || group.changed > 0),
  ).sort((a, b) =>
    orderValue(b, filter.order) - orderValue(a, filter.order) ||
    lexical(a.label, b.label) || lexical(a.key, b.key));
}

function deltaText(delta: EvidenceDelta): string {
  if (!delta.measured) return 'no measurements';
  return delta.measured + ' measured; net ' + delta.net + '; absolute movement ' + delta.movement +
    '; increased ' + delta.increased + '; decreased ' + delta.decreased + '; stable ' + delta.stable;
}

function groupText(group: EvidenceGroup): string {
  return 'selected ' + group.selected + '; refreshed ' + group.refreshed +
    '; comparable ' + group.comparable + '; changed ' + group.changed +
    '; retained ' + group.retained + '; retained without digest ' + group.retainedWithoutDigest +
    '; incomplete ' + group.incomplete + '; bytes: ' + deltaText(group.bytes) +
    '; editor lines: ' + deltaText(group.lines) + '; ' +
    LEDGER_COMPARISON_STATES.map(state => state + ' ' + group.counts[state]).join(', ');
}

/** Aggregate export is private by default. No per-file labels, hashes,
 * source text, absolute paths, or authorization tokens are emitted. */
export function evidenceAnalysisText(analysis: EvidenceAnalysis, includeGroupLabels = false): string {
  const lines = [
    'Scarp Studio — sequential ledger evidence analysis',
    'Historical observations, NOT atomic snapshots or Git line contributions.',
    'Grouping: ' + analysis.grouping,
    'Groups: ' + analysis.groups.length,
    'Incomplete means no fresh comparable digest pair. Retained is not unchanged.',
    'Deltas summarize only measured comparable rows; movement sums absolute per-file deltas.',
    'Total: ' + groupText(analysis.total),
  ];
  let units = lines.join('\n').length;
  if (includeGroupLabels) for (const [index, group] of analysis.groups.entries()) {
    const line = 'Group ' + (index + 1) + ' ' + JSON.stringify(group.label) + ': ' + groupText(group);
    if (units + line.length + 1 > MAX_SCOPE_REPORT_UNITS - 100) {
      lines.push('Additional groups omitted.');
      break;
    }
    lines.push(line);
    units += line.length + 1;
  }
  return lines.join('\n');
}
