import {
  architectureCallStatusLabel,
  architectureNodeLabel,
  architectureRiskLabel,
  type ArchitectureCallSite,
  type ArchitectureHotspot,
  type ArchitectureImportEdge,
  type ArchitectureModule,
  type ArchitectureRiskLevel,
  type ArchitectureSymbol,
  type WorkspaceArchitecture,
} from './workspaceArchitecture';

/**
 * Explainable architecture review findings over the bounded read-only graph.
 * Findings are editor observations and must not be presented as compiler
 * diagnostics, unreachable-code proof, or semantic dependency resolution.
 */

export const MAX_ARCHITECTURE_FINDINGS = 320;
export const MAX_ARCHITECTURE_FINDING_TARGETS = 32;
export const MAX_ARCHITECTURE_REVIEW_QUERY = 120;
export const MAX_ARCHITECTURE_REVIEW_RULES = 64;

export type ArchitectureFindingSeverity = 'info' | 'review' | 'warning' | 'high';
export type ArchitectureFindingCategory =
  | 'coverage'
  | 'imports'
  | 'calls'
  | 'cycles'
  | 'coupling'
  | 'entrypoints'
  | 'structure';

export type ArchitectureRuleId =
  | 'limited-coverage'
  | 'unresolved-import'
  | 'ambiguous-import'
  | 'self-import'
  | 'import-cycle'
  | 'call-cycle'
  | 'ambiguous-call'
  | 'unmatched-call'
  | 'cross-module-name-call'
  | 'high-fan-in'
  | 'high-fan-out'
  | 'high-coupling-hotspot'
  | 'isolated-module'
  | 'orphan-module'
  | 'multiple-main-entrypoints'
  | 'many-observed-entrypoints'
  | 'large-module-surface'
  | 'deep-nested-declaration'
  | 'repeated-public-name';

export interface ArchitectureReviewSettings {
  readonly includeInfo: boolean;
  readonly includeIncompleteDerived: boolean;
  readonly fanInWarning: number;
  readonly fanOutWarning: number;
  readonly moduleSymbolWarning: number;
  readonly nestedDepthWarning: number;
  readonly entrypointWarning: number;
  readonly disabledRules: readonly ArchitectureRuleId[];
}

export const DEFAULT_ARCHITECTURE_REVIEW_SETTINGS: ArchitectureReviewSettings = Object.freeze({
  includeInfo: true,
  includeIncompleteDerived: false,
  fanInWarning: 8,
  fanOutWarning: 8,
  moduleSymbolWarning: 40,
  nestedDepthWarning: 5,
  entrypointWarning: 12,
  disabledRules: Object.freeze([]),
});

export interface ArchitectureFindingTarget {
  readonly kind: 'module' | 'symbol' | 'call-site' | 'import-edge' | 'cycle' | 'hotspot';
  readonly id: string;
  readonly label: string;
}

export interface ArchitectureFinding {
  readonly id: string;
  readonly rule: ArchitectureRuleId;
  readonly category: ArchitectureFindingCategory;
  readonly severity: ArchitectureFindingSeverity;
  readonly title: string;
  readonly explanation: string;
  readonly evidence: readonly string[];
  readonly targets: readonly ArchitectureFindingTarget[];
  readonly incompleteEvidence: boolean;
}

export interface ArchitectureReviewSummary {
  readonly total: number;
  readonly info: number;
  readonly review: number;
  readonly warning: number;
  readonly high: number;
  readonly byCategory: Readonly<Record<ArchitectureFindingCategory, number>>;
  readonly truncated: boolean;
  readonly complete: boolean;
}

export interface ArchitectureReview {
  readonly generation: string;
  readonly findings: readonly ArchitectureFinding[];
  readonly summary: ArchitectureReviewSummary;
  readonly settings: ArchitectureReviewSettings;
  readonly omitted: number;
}

export interface ArchitectureFindingFilter {
  readonly query: string;
  readonly severity: ArchitectureFindingSeverity | 'all';
  readonly category: ArchitectureFindingCategory | 'all';
  readonly rule: ArchitectureRuleId | 'all';
}

export const DEFAULT_ARCHITECTURE_FINDING_FILTER: ArchitectureFindingFilter = Object.freeze({
  query: '', severity: 'all', category: 'all', rule: 'all',
});

export const ARCHITECTURE_RULE_LABELS: Readonly<Record<ArchitectureRuleId, string>> = Object.freeze({
  'limited-coverage': 'Limited architecture coverage',
  'unresolved-import': 'Unresolved literal import',
  'ambiguous-import': 'Ambiguous listed import target',
  'self-import': 'Self import observation',
  'import-cycle': 'Observed import cycle',
  'call-cycle': 'Observed call cycle',
  'ambiguous-call': 'Ambiguous call candidate set',
  'unmatched-call': 'Unmatched call-shaped identifier',
  'cross-module-name-call': 'Cross-module name-only call candidate',
  'high-fan-in': 'High observed fan-in',
  'high-fan-out': 'High observed fan-out',
  'high-coupling-hotspot': 'High architecture hotspot score',
  'isolated-module': 'Isolated open module',
  'orphan-module': 'Module without observed incoming import',
  'multiple-main-entrypoints': 'Multiple main-named functions',
  'many-observed-entrypoints': 'Large entrypoint candidate set',
  'large-module-surface': 'Large declaration surface',
  'deep-nested-declaration': 'Deep lexical declaration nesting',
  'repeated-public-name': 'Repeated public declaration name',
});

export const ARCHITECTURE_FINDING_CATEGORY_LABELS: Readonly<Record<ArchitectureFindingCategory, string>> = Object.freeze({
  coverage: 'Coverage', imports: 'Imports', calls: 'Calls', cycles: 'Cycles', coupling: 'Coupling',
  entrypoints: 'Entrypoints', structure: 'Structure',
});

export const ARCHITECTURE_FINDING_SEVERITY_LABELS: Readonly<Record<ArchitectureFindingSeverity, string>> = Object.freeze({
  info: 'Information', review: 'Review', warning: 'Warning', high: 'High review priority',
});

function safeThreshold(value: number, fallback: number, min: number, max: number): number {
  return Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function normalizedSettings(input: Partial<ArchitectureReviewSettings>): ArchitectureReviewSettings {
  const disabled = [...new Set((input.disabledRules ?? DEFAULT_ARCHITECTURE_REVIEW_SETTINGS.disabledRules)
    .filter(rule => Object.hasOwn(ARCHITECTURE_RULE_LABELS, rule)).slice(0, MAX_ARCHITECTURE_REVIEW_RULES))];
  return Object.freeze({
    includeInfo: input.includeInfo ?? DEFAULT_ARCHITECTURE_REVIEW_SETTINGS.includeInfo,
    includeIncompleteDerived: input.includeIncompleteDerived ?? DEFAULT_ARCHITECTURE_REVIEW_SETTINGS.includeIncompleteDerived,
    fanInWarning: safeThreshold(input.fanInWarning ?? 8, 8, 2, 100),
    fanOutWarning: safeThreshold(input.fanOutWarning ?? 8, 8, 2, 100),
    moduleSymbolWarning: safeThreshold(input.moduleSymbolWarning ?? 40, 40, 8, 500),
    nestedDepthWarning: safeThreshold(input.nestedDepthWarning ?? 5, 5, 2, 64),
    entrypointWarning: safeThreshold(input.entrypointWarning ?? 12, 12, 2, 64),
    disabledRules: Object.freeze(disabled),
  });
}

function moduleLabel(module: ArchitectureModule): string {
  return module.listedName ?? module.name;
}

function target(kind: ArchitectureFindingTarget['kind'], id: string, label: string): ArchitectureFindingTarget {
  return Object.freeze({ kind, id, label });
}

function moduleTarget(module: ArchitectureModule): ArchitectureFindingTarget {
  return target('module', module.id, moduleLabel(module));
}

function symbolTarget(architecture: WorkspaceArchitecture, symbol: ArchitectureSymbol): ArchitectureFindingTarget {
  return target('symbol', symbol.id, architectureNodeLabel(architecture, symbol.id));
}

function callTarget(architecture: WorkspaceArchitecture, site: ArchitectureCallSite): ArchitectureFindingTarget {
  const module = architecture.modules.find(item => item.id === site.moduleId);
  return target('call-site', site.id,
    (module ? moduleLabel(module) : site.documentId) + ':' + site.line + ':' + site.column + ' ' + site.name);
}

function importTarget(architecture: WorkspaceArchitecture, edge: ArchitectureImportEdge): ArchitectureFindingTarget {
  const module = architecture.modules.find(item => item.id === edge.fromModuleId);
  return target('import-edge', edge.id,
    (module ? moduleLabel(module) : edge.fromModuleId) + ':' + edge.line + ' import ' + edge.specifier);
}

function hotspotTarget(hotspot: ArchitectureHotspot): ArchitectureFindingTarget {
  return target('hotspot', hotspot.id, hotspot.label);
}

function makeFinding(
  rule: ArchitectureRuleId,
  category: ArchitectureFindingCategory,
  severity: ArchitectureFindingSeverity,
  title: string,
  explanation: string,
  evidence: readonly string[],
  targets: readonly ArchitectureFindingTarget[],
  incompleteEvidence = false,
): ArchitectureFinding {
  const identity = [rule, ...targets.map(item => item.kind + ':' + item.id)].join('|');
  return Object.freeze({
    id: identity,
    rule,
    category,
    severity,
    title,
    explanation,
    evidence: Object.freeze(evidence.slice(0, MAX_ARCHITECTURE_FINDING_TARGETS)),
    targets: Object.freeze(targets.slice(0, MAX_ARCHITECTURE_FINDING_TARGETS)),
    incompleteEvidence,
  });
}

function findingEnabled(settings: ArchitectureReviewSettings, rule: ArchitectureRuleId): boolean {
  return !settings.disabledRules.includes(rule);
}

function canUseDerived(architecture: WorkspaceArchitecture, settings: ArchitectureReviewSettings): boolean {
  return architecture.summary.complete || settings.includeIncompleteDerived;
}

function importFindings(
  architecture: WorkspaceArchitecture,
  settings: ArchitectureReviewSettings,
): ArchitectureFinding[] {
  const findings: ArchitectureFinding[] = [];
  for (const edge of architecture.importEdges) {
    if (edge.status === 'missing' || edge.status === 'unsafe' || edge.status === 'unrecognized') {
      if (!findingEnabled(settings, 'unresolved-import')) continue;
      findings.push(makeFinding(
        'unresolved-import', 'imports', edge.status === 'unsafe' ? 'warning' : 'review',
        'Review import that has no bounded listed target',
        'The literal import observation could not be matched to one safe current Explorer entry. This may be valid compiler syntax that the editor does not understand; verify with the compiler before changing source.',
        [
          'Import status: ' + edge.status,
          'Specifier: ' + edge.specifier,
          edge.note ?? 'No additional import note.',
        ],
        [importTarget(architecture, edge)],
        !architecture.summary.complete,
      ));
    } else if (edge.status === 'ambiguous' && findingEnabled(settings, 'ambiguous-import')) {
      findings.push(makeFinding(
        'ambiguous-import', 'imports', 'warning',
        'Several listed sources match an import observation',
        'The editor found more than one bounded Explorer entry for this relative import name and will not choose between them.',
        ['Specifier: ' + edge.specifier, 'Listed target: ' + (edge.targetRelativeName ?? '(none)')],
        [importTarget(architecture, edge)],
      ));
    } else if (edge.status === 'self' && findingEnabled(settings, 'self-import')) {
      findings.push(makeFinding(
        'self-import', 'imports', 'review',
        'Source appears to import itself',
        'A literal import resolved back to the same listed source. Confirm whether the module spelling is intentional.',
        ['Specifier: ' + edge.specifier],
        [importTarget(architecture, edge)],
      ));
    }
  }
  return findings;
}

function cycleFindings(
  architecture: WorkspaceArchitecture,
  settings: ArchitectureReviewSettings,
): ArchitectureFinding[] {
  const findings: ArchitectureFinding[] = [];
  for (const cycle of architecture.cycles) {
    const rule: ArchitectureRuleId = cycle.kind === 'import' ? 'import-cycle' : 'call-cycle';
    if (!findingEnabled(settings, rule)) continue;
    const labels = cycle.memberIds.map(id => architectureNodeLabel(architecture, id));
    const severity: ArchitectureFindingSeverity = cycle.kind === 'import'
      ? cycle.size >= 4 ? 'high' : 'warning'
      : cycle.size >= 6 ? 'warning' : 'review';
    findings.push(makeFinding(
      rule, 'cycles', severity,
      cycle.kind === 'import' ? 'Observed import cycle' : 'Observed lexical call cycle',
      cycle.kind === 'import'
        ? 'Open/listed literal imports form a strongly connected component. Review initialization and ownership boundaries; compiler module semantics remain authoritative.'
        : 'Name-based call candidates form a strongly connected component. This can represent ordinary recursion and is not proof of an execution cycle.',
      [
        'Members: ' + labels.join(' → '),
        'Observed edges: ' + cycle.edgeIds.length,
        cycle.selfLoop ? 'Includes a self-loop.' : 'Includes multiple graph members.',
      ],
      cycle.memberIds.slice(0, MAX_ARCHITECTURE_FINDING_TARGETS).map(id =>
        target(cycle.kind === 'import' ? 'module' : 'symbol', id, architectureNodeLabel(architecture, id))),
      !architecture.summary.complete,
    ));
  }
  return findings;
}

function callFindings(
  architecture: WorkspaceArchitecture,
  settings: ArchitectureReviewSettings,
): ArchitectureFinding[] {
  const findings: ArchitectureFinding[] = [];
  for (const site of architecture.callSites) {
    if ((site.status === 'multiple-candidates' || site.status === 'non-function-shadow') &&
        findingEnabled(settings, 'ambiguous-call')) {
      const candidates = site.candidateSymbolIds.map(id => architectureNodeLabel(architecture, id));
      findings.push(makeFinding(
        'ambiguous-call', 'calls', site.status === 'non-function-shadow' ? 'warning' : 'review',
        'Call-shaped identifier has multiple lexical candidates',
        'The editor cannot resolve this call semantically. Candidate declarations share the spelling, or a non-function declaration could shadow the name.',
        [
          'Observation: ' + architectureCallStatusLabel(site.status),
          'Candidates: ' + (candidates.join(', ') || '(none)'),
        ],
        [callTarget(architecture, site), ...site.candidateSymbolIds.slice(0, MAX_ARCHITECTURE_FINDING_TARGETS - 1)
          .map(id => target('symbol', id, architectureNodeLabel(architecture, id)))],
        !architecture.summary.complete,
      ));
    } else if (site.status === 'unmatched' && findingEnabled(settings, 'unmatched-call')) {
      findings.push(makeFinding(
        'unmatched-call', 'calls', 'info',
        'No open declaration shares a call-shaped identifier name',
        'The declaration may be imported, built in, generated, unopened, or invalid. This is only an open-buffer lexical observation.',
        ['Call spelling: ' + site.name],
        [callTarget(architecture, site)],
        !architecture.summary.complete,
      ));
    }
  }
  if (findingEnabled(settings, 'cross-module-name-call')) {
    const bySite = new Map<string, number>();
    for (const edge of architecture.callEdges) {
      if (!edge.sameSource) bySite.set(edge.callSiteId, (bySite.get(edge.callSiteId) ?? 0) + 1);
    }
    for (const [siteId, count] of bySite) {
      const site = architecture.callSites.find(item => item.id === siteId);
      if (!site || site.status !== 'workspace-unique') continue;
      findings.push(makeFinding(
        'cross-module-name-call', 'calls', 'info',
        'Cross-module call candidate is based on name matching only',
        'One open function declaration shares this call spelling, but the editor has not proven import visibility, scope, overload selection, or type compatibility.',
        ['Observed cross-module candidate edges: ' + count, 'Call spelling: ' + site.name],
        [callTarget(architecture, site), ...site.candidateSymbolIds.slice(0, 2)
          .map(id => target('symbol', id, architectureNodeLabel(architecture, id)))],
        !architecture.summary.complete,
      ));
    }
  }
  return findings;
}

function hotspotSeverity(risk: ArchitectureRiskLevel): ArchitectureFindingSeverity {
  if (risk === 'critical') return 'high';
  if (risk === 'high') return 'warning';
  return 'review';
}

function couplingFindings(
  architecture: WorkspaceArchitecture,
  settings: ArchitectureReviewSettings,
): ArchitectureFinding[] {
  if (!canUseDerived(architecture, settings)) return [];
  const findings: ArchitectureFinding[] = [];
  const seen = new Set<string>();
  for (const hotspot of architecture.hotspots) {
    if (hotspot.incoming >= settings.fanInWarning && findingEnabled(settings, 'high-fan-in')) {
      findings.push(makeFinding(
        'high-fan-in', 'coupling', hotspotSeverity(hotspot.risk),
        'High observed fan-in',
        'Many bounded import/call observations point to this node. Changes may deserve wider review, but this is not a runtime dependency proof.',
        ['Observed incoming edges: ' + hotspot.incoming, 'Risk score: ' + hotspot.score],
        [hotspotTarget(hotspot)],
      ));
      seen.add(hotspot.id + ':in');
    }
    if (hotspot.outgoing >= settings.fanOutWarning && findingEnabled(settings, 'high-fan-out')) {
      findings.push(makeFinding(
        'high-fan-out', 'coupling', hotspotSeverity(hotspot.risk),
        'High observed fan-out',
        'This node has many bounded outgoing import/call observations. Review whether responsibilities or module boundaries remain understandable.',
        ['Observed outgoing edges: ' + hotspot.outgoing, 'Risk score: ' + hotspot.score],
        [hotspotTarget(hotspot)],
      ));
      seen.add(hotspot.id + ':out');
    }
    if ((hotspot.risk === 'high' || hotspot.risk === 'critical') &&
        findingEnabled(settings, 'high-coupling-hotspot')) {
      findings.push(makeFinding(
        'high-coupling-hotspot', 'coupling', hotspotSeverity(hotspot.risk),
        'Architecture hotspot merits review',
        'The combined bounded coupling score is elevated because of observed incoming/outgoing edges, ambiguity, or cycle membership.',
        [
          'Risk: ' + architectureRiskLabel(hotspot.risk),
          'Score: ' + hotspot.score,
          ...hotspot.reasons,
        ],
        [hotspotTarget(hotspot)],
      ));
    }
  }
  void seen;
  return findings;
}

function structureFindings(
  architecture: WorkspaceArchitecture,
  settings: ArchitectureReviewSettings,
): ArchitectureFinding[] {
  if (!canUseDerived(architecture, settings)) return [];
  const findings: ArchitectureFinding[] = [];
  if (findingEnabled(settings, 'isolated-module')) {
    for (const id of architecture.isolatedModuleIds) {
      const module = architecture.modules.find(item => item.id === id);
      if (!module) continue;
      findings.push(makeFinding(
        'isolated-module', 'structure', 'info',
        'Open module is isolated in the observed graph',
        'No bounded open-buffer call edge or resolved listed import edge currently connects this source to another open module.',
        ['Module: ' + moduleLabel(module)],
        [moduleTarget(module)],
      ));
    }
  }
  if (findingEnabled(settings, 'orphan-module')) {
    for (const id of architecture.orphanModuleIds) {
      const module = architecture.modules.find(item => item.id === id);
      if (!module || architecture.isolatedModuleIds.includes(id)) continue;
      findings.push(makeFinding(
        'orphan-module', 'structure', 'info',
        'No resolved incoming import observation for module',
        'The source has no current incoming resolved import edge. It may still be an entrypoint, be loaded by another mechanism, or have unopened callers.',
        ['Module: ' + moduleLabel(module), 'Outgoing imports: ' + module.importEdgeIds.length],
        [moduleTarget(module)],
      ));
    }
  }
  if (findingEnabled(settings, 'large-module-surface')) {
    for (const module of architecture.modules) {
      if (module.symbolIds.length < settings.moduleSymbolWarning) continue;
      findings.push(makeFinding(
        'large-module-surface', 'structure', module.symbolIds.length >= settings.moduleSymbolWarning * 2 ? 'warning' : 'review',
        'Module has a large lexical declaration surface',
        'A large number of indexed declarations can make navigation and ownership harder to review. This metric does not measure source quality by itself.',
        ['Declarations: ' + module.symbolIds.length, 'Functions: ' + module.functionIds.length],
        [moduleTarget(module)],
      ));
    }
  }
  if (findingEnabled(settings, 'deep-nested-declaration')) {
    for (const symbol of architecture.symbols) {
      if (symbol.depth < settings.nestedDepthWarning) continue;
      findings.push(makeFinding(
        'deep-nested-declaration', 'structure', symbol.depth >= settings.nestedDepthWarning + 3 ? 'warning' : 'review',
        'Declaration is deeply nested lexically',
        'The bounded lexical index observed this declaration inside several delimiter scopes. Confirm that the structure remains readable and intentional.',
        ['Lexical depth: ' + symbol.depth, 'Kind: ' + symbol.kind],
        [symbolTarget(architecture, symbol)],
      ));
    }
  }
  if (findingEnabled(settings, 'repeated-public-name')) {
    const groups = new Map<string, ArchitectureSymbol[]>();
    for (const symbol of architecture.symbols) {
      if (symbol.visibility !== 'public') continue;
      const list = groups.get(symbol.name);
      if (list) list.push(symbol); else groups.set(symbol.name, [symbol]);
    }
    for (const [name, symbols] of groups) {
      if (symbols.length < 2) continue;
      findings.push(makeFinding(
        'repeated-public-name', 'structure', 'review',
        'Public declaration name is repeated across observed sources',
        'Repeated public names may be intentional in separate modules. Review only if the project expects a flatter public namespace.',
        ['Name: ' + name, 'Observed declarations: ' + symbols.length],
        symbols.slice(0, MAX_ARCHITECTURE_FINDING_TARGETS).map(symbol => symbolTarget(architecture, symbol)),
      ));
    }
  }
  return findings;
}

function entrypointFindings(
  architecture: WorkspaceArchitecture,
  settings: ArchitectureReviewSettings,
): ArchitectureFinding[] {
  if (!canUseDerived(architecture, settings)) return [];
  const findings: ArchitectureFinding[] = [];
  const main = architecture.entrypoints.filter(item => item.reason === 'main-name');
  if (main.length > 1 && findingEnabled(settings, 'multiple-main-entrypoints')) {
    findings.push(makeFinding(
      'multiple-main-entrypoints', 'entrypoints', 'review',
      'Multiple open functions are named main',
      'This may be normal in a workspace containing several projects or examples. Confirm the intended run target before assuming one entrypoint.',
      ['main-named functions: ' + main.length],
      main.slice(0, MAX_ARCHITECTURE_FINDING_TARGETS).map(entry =>
        target('symbol', entry.symbolId, architectureNodeLabel(architecture, entry.symbolId))),
    ));
  }
  if (architecture.entrypoints.length >= settings.entrypointWarning && findingEnabled(settings, 'many-observed-entrypoints')) {
    findings.push(makeFinding(
      'many-observed-entrypoints', 'entrypoints', 'info',
      'Many functions have no observed open-buffer callers',
      'Uncalled functions can be public APIs, callbacks, tests, imported entrypoints, or simply outside the current open-buffer observation window.',
      [
        'Observed entrypoint candidates: ' + architecture.entrypoints.length,
        'Threshold: ' + settings.entrypointWarning,
      ],
      architecture.entrypoints.slice(0, MAX_ARCHITECTURE_FINDING_TARGETS).map(entry =>
        target('symbol', entry.symbolId, architectureNodeLabel(architecture, entry.symbolId))),
    ));
  }
  return findings;
}

function coverageFindings(
  architecture: WorkspaceArchitecture,
  settings: ArchitectureReviewSettings,
): ArchitectureFinding[] {
  if (architecture.summary.complete || !findingEnabled(settings, 'limited-coverage')) return [];
  return [makeFinding(
    'limited-coverage', 'coverage', 'warning',
    'Architecture observations are incomplete',
    'At least one bounded source, token, declaration, call, import, component, or cycle limit was reached. Absence-based findings should not be interpreted as complete project evidence.',
    architecture.coverageReasons.map(reason => 'Coverage reason: ' + reason),
    [],
    true,
  )];
}

function severityRank(severity: ArchitectureFindingSeverity): number {
  switch (severity) {
    case 'high': return 0;
    case 'warning': return 1;
    case 'review': return 2;
    case 'info': return 3;
  }
}

function compareFindings(left: ArchitectureFinding, right: ArchitectureFinding): number {
  return severityRank(left.severity) - severityRank(right.severity) ||
    left.category.localeCompare(right.category) || left.rule.localeCompare(right.rule) ||
    left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function summarize(
  findings: readonly ArchitectureFinding[],
  truncated: boolean,
  complete: boolean,
): ArchitectureReviewSummary {
  const byCategory: Record<ArchitectureFindingCategory, number> = {
    coverage: 0, imports: 0, calls: 0, cycles: 0, coupling: 0, entrypoints: 0, structure: 0,
  };
  let info = 0, review = 0, warning = 0, high = 0;
  for (const finding of findings) {
    byCategory[finding.category]++;
    if (finding.severity === 'info') info++;
    else if (finding.severity === 'review') review++;
    else if (finding.severity === 'warning') warning++;
    else high++;
  }
  return Object.freeze({
    total: findings.length, info, review, warning, high,
    byCategory: Object.freeze(byCategory), truncated, complete,
  });
}

export function reviewWorkspaceArchitecture(
  architecture: WorkspaceArchitecture,
  input: Partial<ArchitectureReviewSettings> = {},
): ArchitectureReview {
  const settings = normalizedSettings(input);
  let findings = [
    ...coverageFindings(architecture, settings),
    ...importFindings(architecture, settings),
    ...cycleFindings(architecture, settings),
    ...callFindings(architecture, settings),
    ...couplingFindings(architecture, settings),
    ...entrypointFindings(architecture, settings),
    ...structureFindings(architecture, settings),
  ];
  if (!settings.includeInfo) findings = findings.filter(item => item.severity !== 'info');
  findings.sort(compareFindings);
  const omitted = Math.max(0, findings.length - MAX_ARCHITECTURE_FINDINGS);
  findings = findings.slice(0, MAX_ARCHITECTURE_FINDINGS);
  return Object.freeze({
    generation: architecture.generation,
    findings: Object.freeze(findings),
    summary: summarize(findings, omitted > 0, architecture.summary.complete),
    settings,
    omitted,
  });
}

export function filterArchitectureFindings(
  review: ArchitectureReview,
  filter: Partial<ArchitectureFindingFilter>,
): ArchitectureFinding[] {
  const query = (filter.query ?? '').slice(0, MAX_ARCHITECTURE_REVIEW_QUERY).trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const severity = filter.severity ?? 'all';
  const category = filter.category ?? 'all';
  const rule = filter.rule ?? 'all';
  return review.findings.filter(finding => {
    if (severity !== 'all' && finding.severity !== severity) return false;
    if (category !== 'all' && finding.category !== category) return false;
    if (rule !== 'all' && finding.rule !== rule) return false;
    if (!terms.length) return true;
    const haystack = [
      finding.title, finding.explanation, finding.rule,
      ARCHITECTURE_RULE_LABELS[finding.rule],
      ARCHITECTURE_FINDING_CATEGORY_LABELS[finding.category],
      ARCHITECTURE_FINDING_SEVERITY_LABELS[finding.severity],
      ...finding.evidence,
      ...finding.targets.map(item => item.label),
    ].join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

export function architectureFindingPrimaryTarget(finding: ArchitectureFinding): ArchitectureFindingTarget | null {
  return finding.targets[0] ?? null;
}

export function architectureFindingTargetLabel(target: ArchitectureFindingTarget): string {
  switch (target.kind) {
    case 'module': return 'Module · ' + target.label;
    case 'symbol': return 'Declaration · ' + target.label;
    case 'call-site': return 'Call site · ' + target.label;
    case 'import-edge': return 'Import · ' + target.label;
    case 'cycle': return 'Cycle · ' + target.label;
    case 'hotspot': return 'Hotspot · ' + target.label;
  }
}

export function architectureFindingSummary(finding: ArchitectureFinding): string {
  return ARCHITECTURE_FINDING_SEVERITY_LABELS[finding.severity] + ' · ' +
    ARCHITECTURE_FINDING_CATEGORY_LABELS[finding.category] + ' · ' + finding.title;
}

export function architectureReviewSummary(review: ArchitectureReview): string {
  const summary = review.summary;
  return [
    summary.total + ' findings',
    summary.high + ' high',
    summary.warning + ' warning',
    summary.review + ' review',
    summary.info + ' info',
    summary.complete ? 'bounded coverage complete' : 'coverage limited',
    review.omitted ? review.omitted + ' omitted' : 'none omitted',
  ].join(' · ');
}

export function architectureReviewChecklist(review: ArchitectureReview): readonly string[] {
  const output: string[] = [];
  const add = (text: string): void => { if (!output.includes(text) && output.length < 24) output.push(text); };
  if (!review.summary.complete) add('Review coverage limits before using absence-based architecture conclusions.');
  if (review.summary.high) add('Inspect high-priority findings before large cross-module changes.');
  if (review.findings.some(item => item.rule === 'import-cycle')) add('Confirm import-cycle behavior with the Scarp compiler/runtime.');
  if (review.findings.some(item => item.rule === 'ambiguous-call')) add('Use compiler/type information before refactoring ambiguous call names.');
  if (review.findings.some(item => item.rule === 'unresolved-import')) add('Verify unresolved import spellings against the current project layout.');
  if (review.findings.some(item => item.rule === 'high-coupling-hotspot')) add('Add focused regression tests around high-coupling nodes before structural changes.');
  if (review.findings.some(item => item.rule === 'multiple-main-entrypoints')) add('Choose the intended project/run target explicitly when several main functions are open.');
  if (!output.length) add('No configured architecture review rule requires action in this bounded snapshot.');
  return Object.freeze(output);
}

export function architectureReviewSettingsDescription(settings: ArchitectureReviewSettings): string {
  return [
    'fan-in≥' + settings.fanInWarning,
    'fan-out≥' + settings.fanOutWarning,
    'module declarations≥' + settings.moduleSymbolWarning,
    'nested depth≥' + settings.nestedDepthWarning,
    'entrypoints≥' + settings.entrypointWarning,
    settings.includeInfo ? 'info included' : 'info hidden',
    settings.includeIncompleteDerived ? 'incomplete derived findings allowed' : 'absence-based findings require complete coverage',
    settings.disabledRules.length + ' disabled rules',
  ].join(' · ');
}
