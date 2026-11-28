import { useDeferredValue, useMemo, useState } from 'react';
import type { StudioDocument } from '../model/documents';
import type { ListedProjectSource } from '../model/projectQuickOpen';
import {
  architectureCoverageLabel,
  architectureNodeLabel,
  architectureObservedLocationTarget,
  architectureRiskLabel,
  buildWorkspaceArchitecture,
  type ArchitectureNodeKind,
  type WorkspaceArchitecture,
} from '../model/workspaceArchitecture';
import {
  architectureQueryHelp,
  searchWorkspaceArchitecture,
  type ArchitectureSearchKind,
} from '../model/workspaceArchitectureQuery';
import {
  DEFAULT_IMPACT_OPTIONS,
  analyzeWorkspaceImpact,
  impactConfidenceLabel,
  impactRiskLabel,
  impactSummary,
  type ImpactDirection,
  type ImpactEdgeMode,
} from '../model/workspaceImpact';
import {
  ARCHITECTURE_FINDING_CATEGORY_LABELS,
  ARCHITECTURE_FINDING_SEVERITY_LABELS,
  ARCHITECTURE_RULE_LABELS,
  DEFAULT_ARCHITECTURE_FINDING_FILTER,
  architectureFindingPrimaryTarget,
  architectureFindingTargetLabel,
  architectureReviewChecklist,
  architectureReviewSummary,
  filterArchitectureFindings,
  reviewWorkspaceArchitecture,
  type ArchitectureFindingCategory,
  type ArchitectureFindingSeverity,
  type ArchitectureRuleId,
} from '../model/workspaceArchitectureReview';
import {
  EMPTY_ARCHITECTURE_SNAPSHOT_STORE,
  addArchitectureSnapshot,
  architectureSnapshotDiffReport,
  captureArchitectureSnapshot,
  compareArchitectureSnapshots,
  removeArchitectureSnapshot,
  snapshotDiffSummary,
  snapshotSummary,
  type ArchitectureSnapshotStore,
} from '../model/workspaceArchitectureSnapshot';
import {
  ARCHITECTURE_REPORT_SECTIONS,
  DEFAULT_ARCHITECTURE_REPORT_OPTIONS,
  architectureReportFormatLabel,
  architectureReportNotice,
  architectureReportSectionLabel,
  buildArchitectureReport,
  type ArchitectureReportFormat,
  type ArchitectureReportSection,
} from '../model/workspaceArchitectureReport';
import { calculateArchitectureMetrics, architectureMetricsSummary, topArchitectureMetricModules } from '../model/workspaceArchitectureMetrics';
import { architectureRoutePathText, architectureRouteSummary, findArchitectureRoutes, type ArchitectureRouteDirection, type ArchitectureRouteMode } from '../model/workspaceArchitectureRoutes';
import type { InsightNavigation } from './SourceInsightsPanel';

const SEARCH_KINDS: readonly ArchitectureSearchKind[] = ['module', 'symbol', 'call', 'import', 'cycle', 'hotspot'];
const TABS = ['overview', 'search', 'review', 'impact', 'routes', 'snapshots', 'report'] as const;
type ArchitectureTab = typeof TABS[number];

interface Props {
  documents: readonly StudioDocument[];
  listed: readonly ListedProjectSource[];
  activeId: string | null;
  busy: boolean;
  onNavigate: (target: InsightNavigation) => void;
  initiallyExpanded?: boolean;
}

function tabLabel(tab: ArchitectureTab): string {
  switch (tab) {
    case 'overview': return 'Overview';
    case 'search': return 'Search';
    case 'review': return 'Review';
    case 'impact': return 'Impact';
    case 'routes': return 'Routes';
    case 'snapshots': return 'Snapshots';
    case 'report': return 'Report';
  }
}

function nodeKind(architecture: WorkspaceArchitecture, id: string): ArchitectureNodeKind | null {
  if (architecture.modules.some(item => item.id === id)) return 'module';
  if (architecture.symbols.some(item => item.id === id)) return 'symbol';
  return null;
}

function rootOptions(architecture: WorkspaceArchitecture): readonly { id: string; label: string; kind: ArchitectureNodeKind }[] {
  return [
    ...architecture.modules.map(module => ({
      id: module.id,
      label: 'Module · ' + (module.listedName ?? module.name),
      kind: 'module' as const,
    })),
    ...architecture.symbols.filter(symbol => symbol.kind === 'function').map(symbol => ({
      id: symbol.id,
      label: 'Function · ' + architectureNodeLabel(architecture, symbol.id),
      kind: 'symbol' as const,
    })),
  ].sort((left, right) => left.label.localeCompare(right.label));
}

function ensureRoot(architecture: WorkspaceArchitecture, requested: string): string {
  if (nodeKind(architecture, requested)) return requested;
  const active = architecture.modules.find(module => module.documentId === architecture.symbolIndex.activeId);
  return active?.id ?? architecture.modules[0]?.id ?? architecture.symbols.find(symbol => symbol.kind === 'function')?.id ?? '';
}

function riskClass(risk: string): string {
  return risk === 'critical' || risk === 'high' ? 'problem-severity-error'
    : risk === 'medium' ? 'problem-severity-warning' : 'problem-severity-info';
}

function navigationIdFromSearch(kind: ArchitectureSearchKind, id: string, symbolId: string | null): string | null {
  if (kind === 'symbol') return symbolId ?? id;
  if (kind === 'call' || kind === 'import') return id;
  return null;
}

function checkedSections(values: readonly ArchitectureReportSection[], value: ArchitectureReportSection, checked: boolean): ArchitectureReportSection[] {
  if (checked) return values.includes(value) ? [...values] : [...values, value];
  const next = values.filter(item => item !== value);
  return next.length ? next : ['summary'];
}

function ArchitectureOverview({ architecture }: { architecture: WorkspaceArchitecture }) {
  const s = architecture.summary;
  const metrics = useMemo(() => calculateArchitectureMetrics(architecture), [architecture]);
  return <div className="insights-body">
    <p className="insights-disclaimer">
      Bounded lexical observations across already-open buffers and the current Explorer listing.
      Calls are name candidates, not compiler-resolved edges. No files are read or changed here.
    </p>
    {!s.complete && <div className="sidebar-note" role="status">
      <strong>Coverage limited.</strong>
      <ul>{architecture.coverageReasons.map(reason => <li key={reason}>{architectureCoverageLabel(reason)}</li>)}</ul>
    </div>}
    <dl className="insights-metrics">
      <div><dt>Open modules</dt><dd>{s.moduleCount}</dd></div>
      <div><dt>Declarations</dt><dd>{s.symbolCount}</dd></div>
      <div><dt>Functions</dt><dd>{s.functionCount}</dd></div>
      <div><dt>Call sites</dt><dd>{s.callSiteCount}</dd></div>
      <div><dt>Call candidates</dt><dd>{s.callEdgeCount}</dd></div>
      <div><dt>Imports</dt><dd>{s.importEdgeCount}</dd></div>
      <div><dt>Ambiguous calls</dt><dd>{s.ambiguousCallSiteCount}</dd></div>
      <div><dt>Unmatched calls</dt><dd>{s.unmatchedCallSiteCount}</dd></div>
      <div><dt>Import cycles</dt><dd>{s.importCycleCount}</dd></div>
      <div><dt>Call cycles</dt><dd>{s.callCycleCount}</dd></div>
      <div><dt>Orphan modules</dt><dd>{s.orphanModuleCount}</dd></div>
      <div><dt>Entrypoints</dt><dd>{s.entrypointCount}</dd></div>
    </dl>
    <p className="sidebar-note">{architectureMetricsSummary(metrics)}</p>
    <div className="insights-task-header"><strong>MODULE COUPLING</strong><span>bounded metrics</span></div>
    <div className="references-list">
      {topArchitectureMetricModules(metrics, 8).map(metric => <div className="references-row" key={metric.moduleId}>
        <div className="references-title"><strong>{metric.label}</strong><span className={riskClass(metric.risk)}>{architectureRiskLabel(metric.risk)} · score {metric.score}</span></div>
        <span>Ca {metric.afferentCoupling} · Ce {metric.efferentCoupling} · instability {metric.instability.toFixed(2)} · depth {metric.dependencyDepth}/{metric.dependentDepth}</span>
        {metric.reasons.length > 0 && <small>{metric.reasons.join(' · ')}</small>}
      </div>)}
    </div>
    <div className="insights-task-header"><strong>HOTSPOTS</strong><span>{architecture.hotspots.length} ranked</span></div>
    <div className="references-list">
      {architecture.hotspots.slice(0, 12).map(hotspot => <div className="references-row" key={hotspot.id}>
        <div className="references-title">
          <strong>{hotspot.label}</strong>
          <span className={riskClass(hotspot.risk)}>{architectureRiskLabel(hotspot.risk)} · score {hotspot.score}</span>
        </div>
        <span>{hotspot.incoming} incoming · {hotspot.outgoing} outgoing · {hotspot.cycleCount} cycles · {hotspot.ambiguous} ambiguous</span>
        {hotspot.reasons.length > 0 && <small>{hotspot.reasons.join(' · ')}</small>}
      </div>)}
      {!architecture.hotspots.length && <p className="sidebar-note">No architecture hotspots in the bounded open-buffer graph.</p>}
    </div>
    <div className="insights-task-header"><strong>OBSERVED ENTRYPOINTS</strong><span>{architecture.entrypoints.length}</span></div>
    <div className="references-list">
      {architecture.entrypoints.slice(0, 16).map(entry => <div className="references-row" key={entry.symbolId}>
        <div className="references-title"><strong>{entry.name}</strong><span>{entry.sourceName}:{entry.line}</span></div>
        <small>{entry.reason === 'main-name' ? 'Function is named main.' : 'No open-buffer call candidate points to this function.'}</small>
      </div>)}
      {!architecture.entrypoints.length && <p className="sidebar-note">No entrypoint observations in the current open buffers.</p>}
    </div>
  </div>;
}

function ArchitectureSearch({
  architecture, documents, busy, onNavigate,
}: { architecture: WorkspaceArchitecture; documents: readonly StudioDocument[]; busy: boolean; onNavigate: (target: InsightNavigation) => void }) {
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<ArchitectureSearchKind[]>([...SEARCH_KINDS]);
  const [showHelp, setShowHelp] = useState(false);
  const result = useMemo(() => searchWorkspaceArchitecture(architecture, query, kinds), [architecture, query, kinds]);
  function toggleKind(kind: ArchitectureSearchKind): void {
    setKinds(current => current.includes(kind) ? current.filter(item => item !== kind) : [...current, kind]);
  }
  return <div className="references-content">
    <p className="insights-disclaimer">Search only the captured bounded graph. Query syntax is local to Studio and does not invoke the compiler.</p>
    <input type="search" maxLength={240} value={query} aria-label="Search workspace architecture"
      placeholder={'Try kind:symbol risk:>=high or file:"src/main.srp"'} onChange={event => setQuery(event.target.value)} />
    <div className="references-options" aria-label="Architecture result types">
      {SEARCH_KINDS.map(kind => <label key={kind}><input type="checkbox" checked={kinds.includes(kind)} onChange={() => toggleKind(kind)} />{kind}</label>)}
    </div>
    <button type="button" aria-expanded={showHelp} onClick={() => setShowHelp(value => !value)}>{showHelp ? 'Hide query help' : 'Query help'}</button>
    {showHelp && <ul className="sidebar-note">{architectureQueryHelp().map(item => <li key={item}>{item}</li>)}</ul>}
    {result.query.issues.length > 0 && <ul className="sidebar-note" role="status">
      {result.query.issues.map((issue, index) => <li key={index}>{issue.message} at {issue.offset + 1}</li>)}
    </ul>}
    <p role="status">{result.totalMatches} matching architecture items{result.truncated ? ' · first results shown' : ''}</p>
    <div className="references-list">
      {result.matches.map(match => {
        const navigationId = navigationIdFromSearch(match.item.kind, match.item.id, match.item.symbolId);
        const target = navigationId ? architectureObservedLocationTarget(architecture, documents, navigationId) : null;
        return <div className="references-row" key={match.item.kind + ':' + match.item.id}>
          <div className="references-title"><strong>{match.item.label}</strong><span>{match.item.kind} · score {match.score}</span></div>
          <code title={match.item.detail}>{match.item.detail}</code>
          <span>{match.item.incoming} incoming · {match.item.outgoing} outgoing{match.item.cyclic ? ' · cycle member' : ''}</span>
          {target && <button type="button" disabled={busy} onClick={() => !busy && onNavigate(target)}>Go to source</button>}
        </div>;
      })}
      {!result.matches.length && <p className="sidebar-note">No architecture items match the current query and type filters.</p>}
    </div>
  </div>;
}

function ArchitectureReviewView({
  architecture, documents, busy, onNavigate,
}: { architecture: WorkspaceArchitecture; documents: readonly StudioDocument[]; busy: boolean; onNavigate: (target: InsightNavigation) => void }) {
  const review = useMemo(() => reviewWorkspaceArchitecture(architecture), [architecture]);
  const [query, setQuery] = useState(DEFAULT_ARCHITECTURE_FINDING_FILTER.query);
  const [severity, setSeverity] = useState<ArchitectureFindingSeverity | 'all'>('all');
  const [category, setCategory] = useState<ArchitectureFindingCategory | 'all'>('all');
  const [rule, setRule] = useState<ArchitectureRuleId | 'all'>('all');
  const findings = useMemo(() => filterArchitectureFindings(review, { query, severity, category, rule }),
    [review, query, severity, category, rule]);
  return <div className="references-content">
    <p className="insights-disclaimer">{architectureReviewSummary(review)}</p>
    <div className="insights-filter">
      <input type="search" maxLength={120} value={query} aria-label="Filter architecture review findings"
        placeholder="Filter findings…" onChange={event => setQuery(event.target.value)} />
      <select aria-label="Architecture finding severity" value={severity} onChange={event => setSeverity(event.target.value as ArchitectureFindingSeverity | 'all')}>
        <option value="all">All severities</option>
        {(['high', 'warning', 'review', 'info'] as const).map(value => <option key={value} value={value}>{ARCHITECTURE_FINDING_SEVERITY_LABELS[value]}</option>)}
      </select>
      <select aria-label="Architecture finding category" value={category} onChange={event => setCategory(event.target.value as ArchitectureFindingCategory | 'all')}>
        <option value="all">All categories</option>
        {(Object.keys(ARCHITECTURE_FINDING_CATEGORY_LABELS) as ArchitectureFindingCategory[]).map(value => <option key={value} value={value}>{ARCHITECTURE_FINDING_CATEGORY_LABELS[value]}</option>)}
      </select>
      <select aria-label="Architecture review rule" value={rule} onChange={event => setRule(event.target.value as ArchitectureRuleId | 'all')}>
        <option value="all">All rules</option>
        {(Object.keys(ARCHITECTURE_RULE_LABELS) as ArchitectureRuleId[]).map(value => <option key={value} value={value}>{ARCHITECTURE_RULE_LABELS[value]}</option>)}
      </select>
    </div>
    <p role="status">{findings.length} matching findings</p>
    <div className="references-list">
      {findings.map(finding => {
        const primary = architectureFindingPrimaryTarget(finding);
        const locationId = primary && (primary.kind === 'symbol' || primary.kind === 'call-site' || primary.kind === 'import-edge') ? primary.id : null;
        const navigation = locationId ? architectureObservedLocationTarget(architecture, documents, locationId) : null;
        return <div className="references-row" key={finding.id}>
          <div className="references-title"><strong>{finding.title}</strong>
            <span>{ARCHITECTURE_FINDING_SEVERITY_LABELS[finding.severity]} · {ARCHITECTURE_FINDING_CATEGORY_LABELS[finding.category]}</span></div>
          <p>{finding.explanation}</p>
          <ul>{finding.evidence.map(item => <li key={item}>{item}</li>)}</ul>
          {finding.targets.length > 0 && <small>{finding.targets.map(architectureFindingTargetLabel).join(' · ')}</small>}
          {finding.incompleteEvidence && <small>Evidence is incomplete within bounded editor coverage.</small>}
          {navigation && <button type="button" disabled={busy} onClick={() => !busy && onNavigate(navigation)}>Go to evidence</button>}
        </div>;
      })}
      {!findings.length && <p className="sidebar-note">No findings match these filters.</p>}
    </div>
    <div className="insights-notes"><strong>Review checklist</strong><ul>{architectureReviewChecklist(review).map(item => <li key={item}>{item}</li>)}</ul></div>
  </div>;
}

function ArchitectureImpact({
  architecture, documents, busy, onNavigate,
}: { architecture: WorkspaceArchitecture; documents: readonly StudioDocument[]; busy: boolean; onNavigate: (target: InsightNavigation) => void }) {
  const options = rootOptions(architecture);
  const [requestedRoot, setRequestedRoot] = useState('');
  const [direction, setDirection] = useState<ImpactDirection>(DEFAULT_IMPACT_OPTIONS.direction);
  const [edgeMode, setEdgeMode] = useState<ImpactEdgeMode>(DEFAULT_IMPACT_OPTIONS.edgeMode);
  const [maxDepth, setMaxDepth] = useState(DEFAULT_IMPACT_OPTIONS.maxDepth);
  const [includeAmbiguousCalls, setIncludeAmbiguousCalls] = useState(DEFAULT_IMPACT_OPTIONS.includeAmbiguousCalls);
  const [crossModules, setCrossModules] = useState(DEFAULT_IMPACT_OPTIONS.crossModules);
  const rootId = ensureRoot(architecture, requestedRoot);
  const review = useMemo(() => rootId ? analyzeWorkspaceImpact(architecture, rootId, {
    direction, edgeMode, maxDepth, includeAmbiguousCalls, crossModules,
  }) : null, [architecture, rootId, direction, edgeMode, maxDepth, includeAmbiguousCalls, crossModules]);
  return <div className="references-content">
    <p className="insights-disclaimer">Trace bounded observed imports and call-name candidates. Results are review surfaces, not runtime reachability.</p>
    <label>Impact root<select aria-label="Architecture impact root" value={rootId} onChange={event => setRequestedRoot(event.target.value)}>
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select></label>
    <div className="insights-filter">
      <select aria-label="Impact direction" value={direction} onChange={event => setDirection(event.target.value as ImpactDirection)}>
        <option value="both">Incoming and outgoing</option><option value="incoming">Incoming only</option><option value="outgoing">Outgoing only</option>
      </select>
      <select aria-label="Impact edge mode" value={edgeMode} onChange={event => setEdgeMode(event.target.value as ImpactEdgeMode)}>
        <option value="combined">Imports and calls</option><option value="imports">Imports only</option><option value="calls">Calls only</option>
      </select>
      <label>Depth <input type="number" min={1} max={12} value={maxDepth} onChange={event => setMaxDepth(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} /></label>
    </div>
    <div className="references-options">
      <label><input type="checkbox" checked={includeAmbiguousCalls} onChange={event => setIncludeAmbiguousCalls(event.target.checked)} />Include ambiguous call candidates</label>
      <label><input type="checkbox" checked={crossModules} onChange={event => setCrossModules(event.target.checked)} />Cross module boundaries</label>
    </div>
    {!review && <p className="sidebar-note">Open a Scarp source to build an impact root.</p>}
    {review && <>
      <p role="status">{impactSummary(review)}</p>
      <p className="sidebar-note">{impactConfidenceLabel(review.confidence)} · {impactRiskLabel(review.risk)} · score {review.score}</p>
      {review.boundaries.length > 0 && <p className="sidebar-note">Traversal stopped at {review.boundaries.length} bounded edges because of depth, result, ambiguity, or cross-module settings.</p>}
      <div className="references-list">
        {review.nodes.map(node => {
          const target = node.kind === 'symbol' ? architectureObservedLocationTarget(architecture, documents, node.id) : null;
          return <div className="references-row" key={node.id}>
            <div className="references-title"><strong>{node.label}</strong><span>{node.direction} · depth {node.depth}</span></div>
            <span className={riskClass(node.risk)}>{impactRiskLabel(node.risk)} · {node.pathCount} paths · {node.ambiguousPathCount} ambiguous</span>
            {node.reasons.length > 0 && <small>{node.reasons.join(' · ')}</small>}
            {target && <button type="button" disabled={busy} onClick={() => !busy && onNavigate(target)}>Go to declaration</button>}
          </div>;
        })}
        {!review.nodes.length && <p className="sidebar-note">No connected observed nodes under the selected settings.</p>}
      </div>
      <div className="insights-notes"><strong>Change review checklist</strong><ul>{review.checklist.map(item => <li key={item}>{item}</li>)}</ul></div>
    </>}
  </div>;
}

function ArchitectureRoutes({ architecture }: { architecture: WorkspaceArchitecture }) {
  const options = rootOptions(architecture);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [mode, setMode] = useState<ArchitectureRouteMode>('combined');
  const [direction, setDirection] = useState<ArchitectureRouteDirection>('directed');
  const [includeAmbiguousCalls, setIncludeAmbiguousCalls] = useState(true);
  const [maxDepth, setMaxDepth] = useState(8);
  const actualFrom = nodeKind(architecture, fromId) ? fromId : options[0]?.id ?? '';
  const compatible = options.filter(option => option.kind === nodeKind(architecture, actualFrom));
  const actualTo = compatible.some(option => option.id === toId) ? toId : compatible.find(option => option.id !== actualFrom)?.id ?? actualFrom;
  const result = useMemo(() => actualFrom && actualTo ? findArchitectureRoutes(architecture, actualFrom, actualTo, {
    mode, direction, includeAmbiguousCalls, maxDepth,
  }) : null, [architecture, actualFrom, actualTo, mode, direction, includeAmbiguousCalls, maxDepth]);
  return <div className="references-content">
    <p className="insights-disclaimer">Find shortest bounded routes between two module nodes or two function nodes. Routes explain observed edges only.</p>
    <label>From<select aria-label="Architecture route source" value={actualFrom} onChange={event => { setFromId(event.target.value); setToId(''); }}>
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select></label>
    <label>To<select aria-label="Architecture route destination" value={actualTo} onChange={event => setToId(event.target.value)}>
      {compatible.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select></label>
    <div className="insights-filter">
      <select aria-label="Architecture route edges" value={mode} onChange={event => setMode(event.target.value as ArchitectureRouteMode)}>
        <option value="combined">Imports and calls</option><option value="imports">Imports only</option><option value="calls">Calls only</option>
      </select>
      <select aria-label="Architecture route direction" value={direction} onChange={event => setDirection(event.target.value as ArchitectureRouteDirection)}>
        <option value="directed">Follow edge direction</option><option value="either-direction">Allow reverse observations</option>
      </select>
      <label>Depth <input type="number" min={1} max={12} value={maxDepth} onChange={event => setMaxDepth(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} /></label>
    </div>
    <label className="search-option"><input type="checkbox" checked={includeAmbiguousCalls} onChange={event => setIncludeAmbiguousCalls(event.target.checked)} />Include ambiguous call candidates</label>
    {result && <>
      <p role="status">{architectureRouteSummary(result)}</p>
      <p className="sidebar-note">{result.message}</p>
      <div className="references-list">{result.paths.map(path => <div className="references-row" key={path.id}>
        <div className="references-title"><strong>Depth {path.depth}</strong><span>{path.ambiguous ? 'ambiguous candidate route' : 'bounded observed route'}{path.reversedEdges ? ' · ' + path.reversedEdges + ' reverse edges' : ''}</span></div>
        <code>{architectureRoutePathText(path)}</code>
      </div>)}</div>
    </>}
  </div>;
}

function ArchitectureSnapshots({ architecture }: { architecture: WorkspaceArchitecture }) {
  const [store, setStore] = useState<ArchitectureSnapshotStore>(EMPTY_ARCHITECTURE_SNAPSHOT_STORE);
  const [label, setLabel] = useState('');
  const [baseId, setBaseId] = useState('');
  const [headId, setHeadId] = useState('');
  const base = store.snapshots.find(item => item.id === baseId) ?? store.snapshots[1] ?? null;
  const head = store.snapshots.find(item => item.id === headId) ?? store.snapshots[0] ?? null;
  const diff = base && head && base.id !== head.id ? compareArchitectureSnapshots(base, head) : null;
  function capture(): void {
    const snapshot = captureArchitectureSnapshot(architecture, label);
    const next = addArchitectureSnapshot(store, snapshot);
    setStore(next);
    setHeadId(snapshot.id);
    if (!baseId && next.snapshots.length > 1) setBaseId(next.snapshots[1].id);
    setLabel('');
  }
  return <div className="references-content">
    <p className="insights-disclaimer">Session-only architecture snapshots keep structural metadata and a deterministic non-cryptographic fingerprint. They do not persist source text or write files.</p>
    <div className="references-search"><input type="text" maxLength={120} value={label} aria-label="Architecture snapshot label" placeholder="Optional snapshot label" onChange={event => setLabel(event.target.value)} />
      <button type="button" onClick={capture}>Capture current graph</button></div>
    <div className="references-list">
      {store.snapshots.map(snapshot => <div className="references-row" key={snapshot.id}>
        <div className="references-title"><strong>{snapshot.label}</strong><span>{snapshot.fingerprint}</span></div>
        <small>{snapshotSummary(snapshot)}</small>
        <button type="button" onClick={() => setBaseId(snapshot.id)} aria-pressed={base?.id === snapshot.id}>Use as base</button>
        <button type="button" onClick={() => setHeadId(snapshot.id)} aria-pressed={head?.id === snapshot.id}>Use as head</button>
        <button type="button" onClick={() => setStore(current => removeArchitectureSnapshot(current, snapshot.id))}>Forget</button>
      </div>)}
      {!store.snapshots.length && <p className="sidebar-note">No session architecture snapshots captured.</p>}
    </div>
    {diff && <section aria-label="Architecture snapshot comparison">
      <strong>{snapshotDiffSummary(diff)}</strong>
      <pre className="output-log">{architectureSnapshotDiffReport(diff, base!, head!)}</pre>
    </section>}
  </div>;
}

function ArchitectureReportView({ architecture }: { architecture: WorkspaceArchitecture }) {
  const [format, setFormat] = useState<ArchitectureReportFormat>(DEFAULT_ARCHITECTURE_REPORT_OPTIONS.format);
  const [sections, setSections] = useState<ArchitectureReportSection[]>([...DEFAULT_ARCHITECTURE_REPORT_OPTIONS.sections]);
  const [includeIds, setIncludeIds] = useState(false);
  const [includePaths, setIncludePaths] = useState(false);
  const [maxRows, setMaxRows] = useState(DEFAULT_ARCHITECTURE_REPORT_OPTIONS.maxRows);
  const report = useMemo(() => buildArchitectureReport(architecture, { format, sections, includeIds, includePaths, maxRows }),
    [architecture, format, sections, includeIds, includePaths, maxRows]);
  return <div className="references-content">
    <p className="insights-disclaimer">{architectureReportNotice(architecture)}</p>
    <div className="insights-filter">
      <select aria-label="Architecture report format" value={format} onChange={event => setFormat(event.target.value as ArchitectureReportFormat)}>
        {(['text', 'markdown', 'csv', 'json'] as const).map(value => <option key={value} value={value}>{architectureReportFormatLabel(value)}</option>)}
      </select>
      <label>Maximum rows <input type="number" min={1} max={1000} value={maxRows} onChange={event => setMaxRows(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))} /></label>
    </div>
    <div className="references-options"><label><input type="checkbox" checked={includeIds} onChange={event => setIncludeIds(event.target.checked)} />Include stable observation IDs</label>
      <label><input type="checkbox" checked={includePaths} onChange={event => setIncludePaths(event.target.checked)} />Include captured native paths</label></div>
    <fieldset><legend>Report sections</legend><div className="references-options">
      {ARCHITECTURE_REPORT_SECTIONS.map(section => <label key={section}><input type="checkbox" checked={sections.includes(section)}
        onChange={event => setSections(current => checkedSections(current, section, event.target.checked))} />{architectureReportSectionLabel(section)}</label>)}
    </div></fieldset>
    <p role="status">{report.rows} rows{report.truncated ? ' · truncated' : ''}{report.warning ? ' · ' + report.warning : ''}</p>
    <textarea readOnly rows={18} aria-label="Generated workspace architecture report" value={report.text} />
  </div>;
}

export function WorkspaceArchitecturePanel({
  documents, listed, activeId, busy, onNavigate, initiallyExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [tab, setTab] = useState<ArchitectureTab>('overview');
  const deferredDocuments = useDeferredValue(documents);
  const deferredListed = useDeferredValue(listed);
  const architecture = useMemo(() => expanded
    ? buildWorkspaceArchitecture(deferredDocuments, deferredListed, activeId)
    : null, [expanded, deferredDocuments, deferredListed, activeId]);
  const stale = architecture ? architecture.documents.some(captured => {
    const current = documents.find(document => document.id === captured.id);
    return !current || current.revision !== captured.revision || current.content !== captured.content;
  }) || architecture.documents.length !== documents.length : false;

  return <section className="sidebar-section workspace-architecture-panel" aria-label="Workspace architecture explorer">
    <div className="sidebar-heading">WORKSPACE ARCHITECTURE</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} aria-controls="workspace-architecture-body"
      onClick={() => setExpanded(value => !value)}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide architecture' : 'Analyze open architecture'}</span>
      <span className="insights-toggle-hint">{documents.length} open source{documents.length === 1 ? '' : 's'}</span>
    </button>
    <div id="workspace-architecture-body" hidden={!expanded}>
      {expanded && !architecture && <p className="sidebar-note">Preparing bounded architecture observations…</p>}
      {architecture && <>
        <div className="tool-directory-shortcuts" role="tablist" aria-label="Workspace architecture views">
          {TABS.map(value => <button type="button" role="tab" key={value} aria-selected={tab === value}
            onClick={() => setTab(value)}>{tabLabel(value)}</button>)}
        </div>
        {stale && <p className="sidebar-note" role="status">An editor update is newer than this deferred architecture view. Navigation stays guarded until the next render catches up.</p>}
        {tab === 'overview' && <ArchitectureOverview architecture={architecture} />}
        {tab === 'search' && <ArchitectureSearch architecture={architecture} documents={documents} busy={busy} onNavigate={onNavigate} />}
        {tab === 'review' && <ArchitectureReviewView architecture={architecture} documents={documents} busy={busy} onNavigate={onNavigate} />}
        {tab === 'impact' && <ArchitectureImpact architecture={architecture} documents={documents} busy={busy} onNavigate={onNavigate} />}
        {tab === 'routes' && <ArchitectureRoutes architecture={architecture} />}
        {tab === 'snapshots' && <ArchitectureSnapshots architecture={architecture} />}
        {tab === 'report' && <ArchitectureReportView architecture={architecture} />}
      </>}
    </div>
  </section>;
}
