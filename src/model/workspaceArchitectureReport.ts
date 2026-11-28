import {
  architectureCallStatusLabel,
  architectureCoverageLabel,
  architectureNodeLabel,
  architectureRiskLabel,
  type ArchitectureCallEdge,
  type ArchitectureCallSite,
  type ArchitectureCycle,
  type ArchitectureHotspot,
  type ArchitectureImportEdge,
  type ArchitectureModule,
  type ArchitectureSymbol,
  type WorkspaceArchitecture,
} from './workspaceArchitecture';

/**
 * Portable, bounded reports for the read-only Workspace Architecture model.
 * These helpers never read files, execute Scarp, or mutate editor state.
 * Reports intentionally describe lexical observations, not compiler truth.
 */

export const MAX_ARCHITECTURE_REPORT_ROWS = 1000;
export const MAX_ARCHITECTURE_REPORT_CELL_UNITS = 1000;
export const MAX_ARCHITECTURE_REPORT_UNITS = 512 * 1024;
export const MAX_ARCHITECTURE_REPORT_SECTIONS = 16;

export type ArchitectureReportFormat = 'text' | 'markdown' | 'csv' | 'json';
export type ArchitectureReportSection =
  | 'summary'
  | 'coverage'
  | 'modules'
  | 'symbols'
  | 'call-sites'
  | 'call-edges'
  | 'imports'
  | 'cycles'
  | 'hotspots'
  | 'entrypoints'
  | 'orphans'
  | 'isolated';

export const ARCHITECTURE_REPORT_SECTIONS: readonly ArchitectureReportSection[] = Object.freeze([
  'summary', 'coverage', 'modules', 'symbols', 'call-sites', 'call-edges', 'imports',
  'cycles', 'hotspots', 'entrypoints', 'orphans', 'isolated',
]);

export interface ArchitectureReportOptions {
  readonly format: ArchitectureReportFormat;
  readonly sections: readonly ArchitectureReportSection[];
  readonly includeHeaders: boolean;
  readonly includeIds: boolean;
  readonly includePaths: boolean;
  readonly maxRows: number;
}

export const DEFAULT_ARCHITECTURE_REPORT_OPTIONS: ArchitectureReportOptions = Object.freeze({
  format: 'text',
  sections: ARCHITECTURE_REPORT_SECTIONS,
  includeHeaders: true,
  includeIds: false,
  includePaths: false,
  maxRows: 400,
});

export interface ArchitectureReportResult {
  readonly text: string;
  readonly format: ArchitectureReportFormat;
  readonly sections: readonly ArchitectureReportSection[];
  readonly rows: number;
  readonly truncated: boolean;
  readonly omittedRows: number;
  readonly warning: string | null;
}

interface ReportRow {
  readonly section: ArchitectureReportSection;
  readonly fields: Readonly<Record<string, string | number | boolean | null>>;
}

interface RowCollection {
  readonly rows: readonly ReportRow[];
  readonly total: number;
}

function clampRows(value: number): number {
  if (!Number.isSafeInteger(value)) return DEFAULT_ARCHITECTURE_REPORT_OPTIONS.maxRows;
  return Math.max(1, Math.min(MAX_ARCHITECTURE_REPORT_ROWS, value));
}

function safeCell(value: unknown): string {
  const text = String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '�')
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, char =>
      '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
  if (text.length <= MAX_ARCHITECTURE_REPORT_CELL_UNITS) return text;
  return text.slice(0, MAX_ARCHITECTURE_REPORT_CELL_UNITS - 1) + '…';
}

function safePath(path: string | null, includePaths: boolean): string {
  if (!path) return '';
  if (includePaths) return safeCell(path);
  const normalized = path.replace(/\\/g, '/');
  return safeCell(normalized.slice(normalized.lastIndexOf('/') + 1));
}

function moduleName(architecture: WorkspaceArchitecture, id: string | null): string {
  if (!id) return '(unresolved)';
  const module = architecture.modules.find(item => item.id === id);
  return module?.listedName ?? module?.name ?? id;
}

function symbolName(architecture: WorkspaceArchitecture, id: string | null): string {
  if (!id) return '(top level)';
  const symbol = architecture.symbols.find(item => item.id === id);
  return symbol ? moduleName(architecture, symbol.moduleId) + '::' + symbol.name : id;
}

function bool(value: boolean): string {
  return value ? 'yes' : 'no';
}

function moduleRows(architecture: WorkspaceArchitecture, includeIds: boolean, includePaths: boolean): ReportRow[] {
  return architecture.modules.map(module => ({
    section: 'modules',
    fields: {
      ...(includeIds ? { id: module.id } : {}),
      module: module.listedName ?? module.name,
      path: safePath(module.path, includePaths),
      revision: module.revision,
      sourceUnits: module.contentLength,
      symbols: module.symbolIds.length,
      functions: module.functionIds.length,
      importsOut: module.importEdgeIds.length,
      importsIn: module.incomingImportEdgeIds.length,
      callSites: module.callSiteIds.length,
      incomplete: bool(module.incomplete),
    },
  }));
}

function symbolRows(architecture: WorkspaceArchitecture, includeIds: boolean): ReportRow[] {
  return architecture.symbols.map(symbol => ({
    section: 'symbols',
    fields: {
      ...(includeIds ? { id: symbol.id } : {}),
      module: moduleName(architecture, symbol.moduleId),
      symbol: symbol.name,
      kind: symbol.kind,
      scope: symbol.scope,
      visibility: symbol.visibility,
      pure: bool(symbol.pure),
      line: symbol.line,
      column: symbol.column,
      incomingCalls: symbol.incomingCallEdgeIds.length,
      outgoingCalls: symbol.outgoingCallEdgeIds.length,
      observedCallSites: symbol.observedCallSiteCount,
      depth: symbol.depth,
      header: symbol.header,
    },
  }));
}

function callSiteRows(architecture: WorkspaceArchitecture, includeIds: boolean): ReportRow[] {
  return architecture.callSites.map(site => ({
    section: 'call-sites',
    fields: {
      ...(includeIds ? { id: site.id } : {}),
      module: moduleName(architecture, site.moduleId),
      caller: symbolName(architecture, site.enclosingSymbolId),
      call: site.name,
      line: site.line,
      column: site.column,
      status: architectureCallStatusLabel(site.status),
      candidates: site.candidateSymbolIds.length,
      observedEdges: site.edgeIds.length,
    },
  }));
}

function callEdgeRows(architecture: WorkspaceArchitecture, includeIds: boolean): ReportRow[] {
  return architecture.callEdges.map(edge => ({
    section: 'call-edges',
    fields: {
      ...(includeIds ? { id: edge.id } : {}),
      fromModule: moduleName(architecture, edge.fromModuleId),
      caller: symbolName(architecture, edge.fromSymbolId),
      call: edge.name,
      target: symbolName(architecture, edge.toSymbolId),
      toModule: moduleName(architecture, edge.toModuleId),
      status: architectureCallStatusLabel(edge.status),
      sameSource: bool(edge.sameSource),
      confidence: edge.confidence,
    },
  }));
}

function importRows(architecture: WorkspaceArchitecture, includeIds: boolean): ReportRow[] {
  return architecture.importEdges.map(edge => ({
    section: 'imports',
    fields: {
      ...(includeIds ? { id: edge.id } : {}),
      fromModule: moduleName(architecture, edge.fromModuleId),
      specifier: edge.specifier,
      alias: edge.alias ?? '',
      toModule: moduleName(architecture, edge.toModuleId),
      status: edge.status,
      line: edge.line,
      column: edge.column,
      listedTarget: edge.targetRelativeName ?? '',
      note: edge.note ?? '',
    },
  }));
}

function cycleRows(architecture: WorkspaceArchitecture, includeIds: boolean): ReportRow[] {
  return architecture.cycles.map(cycle => ({
    section: 'cycles',
    fields: {
      ...(includeIds ? { id: cycle.id } : {}),
      graph: cycle.kind,
      size: cycle.size,
      selfLoop: bool(cycle.selfLoop),
      members: cycle.memberIds.map(id => architectureNodeLabel(architecture, id)).join(' → '),
      edgeCount: cycle.edgeIds.length,
    },
  }));
}

function hotspotRows(hotspots: readonly ArchitectureHotspot[], includeIds: boolean): ReportRow[] {
  return hotspots.map(hotspot => ({
    section: 'hotspots',
    fields: {
      ...(includeIds ? { id: hotspot.id } : {}),
      kind: hotspot.kind,
      label: hotspot.label,
      risk: architectureRiskLabel(hotspot.risk),
      score: hotspot.score,
      incoming: hotspot.incoming,
      outgoing: hotspot.outgoing,
      ambiguous: hotspot.ambiguous,
      cycles: hotspot.cycleCount,
      reasons: hotspot.reasons.join('; '),
    },
  }));
}

function entrypointRows(architecture: WorkspaceArchitecture, includeIds: boolean): ReportRow[] {
  return architecture.entrypoints.map(entry => ({
    section: 'entrypoints',
    fields: {
      ...(includeIds ? { symbolId: entry.symbolId, moduleId: entry.moduleId } : {}),
      module: entry.sourceName,
      symbol: entry.name,
      line: entry.line,
      reason: entry.reason === 'main-name' ? 'Named main' : 'No observed callers',
    },
  }));
}

function nodeSetRows(
  architecture: WorkspaceArchitecture,
  section: 'orphans' | 'isolated',
  ids: readonly string[],
  includeIds: boolean,
): ReportRow[] {
  return ids.map(id => ({
    section,
    fields: {
      ...(includeIds ? { id } : {}),
      module: architectureNodeLabel(architecture, id),
    },
  }));
}

function summaryRows(architecture: WorkspaceArchitecture): ReportRow[] {
  const s = architecture.summary;
  const pairs: readonly [string, string | number | boolean][] = [
    ['Generation', architecture.generation],
    ['Complete within editor bounds', s.complete],
    ['Open modules', s.moduleCount],
    ['Declarations', s.symbolCount],
    ['Functions', s.functionCount],
    ['Observed call sites', s.callSiteCount],
    ['Observed call candidate edges', s.callEdgeCount],
    ['Literal imports', s.importEdgeCount],
    ['Resolved/open import targets', s.resolvedImportEdgeCount],
    ['Unresolved import targets', s.unresolvedImportEdgeCount],
    ['Ambiguous call sites', s.ambiguousCallSiteCount],
    ['Unmatched call sites', s.unmatchedCallSiteCount],
    ['Import cycles', s.importCycleCount],
    ['Call cycles', s.callCycleCount],
    ['Orphan modules', s.orphanModuleCount],
    ['Isolated modules', s.isolatedModuleCount],
    ['Observed entrypoints', s.entrypointCount],
  ];
  return pairs.map(([metric, value]) => ({ section: 'summary', fields: { metric, value: String(value) } }));
}

function coverageRows(architecture: WorkspaceArchitecture): ReportRow[] {
  if (!architecture.coverageReasons.length) {
    return [{ section: 'coverage', fields: { status: 'Complete within editor bounds', reason: '' } }];
  }
  return architecture.coverageReasons.map(reason => ({
    section: 'coverage',
    fields: { status: 'Limited', reason: architectureCoverageLabel(reason) },
  }));
}

function collectSectionRows(
  architecture: WorkspaceArchitecture,
  section: ArchitectureReportSection,
  includeIds: boolean,
  includePaths: boolean,
): ReportRow[] {
  switch (section) {
    case 'summary': return summaryRows(architecture);
    case 'coverage': return coverageRows(architecture);
    case 'modules': return moduleRows(architecture, includeIds, includePaths);
    case 'symbols': return symbolRows(architecture, includeIds);
    case 'call-sites': return callSiteRows(architecture, includeIds);
    case 'call-edges': return callEdgeRows(architecture, includeIds);
    case 'imports': return importRows(architecture, includeIds);
    case 'cycles': return cycleRows(architecture, includeIds);
    case 'hotspots': return hotspotRows(architecture.hotspots, includeIds);
    case 'entrypoints': return entrypointRows(architecture, includeIds);
    case 'orphans': return nodeSetRows(architecture, 'orphans', architecture.orphanModuleIds, includeIds);
    case 'isolated': return nodeSetRows(architecture, 'isolated', architecture.isolatedModuleIds, includeIds);
  }
}

function selectedSections(sections: readonly ArchitectureReportSection[]): ArchitectureReportSection[] {
  const valid = new Set<ArchitectureReportSection>(ARCHITECTURE_REPORT_SECTIONS);
  const unique: ArchitectureReportSection[] = [];
  for (const section of sections.slice(0, MAX_ARCHITECTURE_REPORT_SECTIONS)) {
    if (valid.has(section) && !unique.includes(section)) unique.push(section);
  }
  return unique.length ? unique : ['summary'];
}

function collectRows(
  architecture: WorkspaceArchitecture,
  sections: readonly ArchitectureReportSection[],
  includeIds: boolean,
  includePaths: boolean,
  maxRows: number,
): RowCollection {
  const rows: ReportRow[] = [];
  let total = 0;
  for (const section of sections) {
    const sectionRows = collectSectionRows(architecture, section, includeIds, includePaths);
    total += sectionRows.length;
    const remaining = Math.max(0, maxRows - rows.length);
    if (remaining) rows.push(...sectionRows.slice(0, remaining));
  }
  return { rows, total };
}

function textLine(fields: Readonly<Record<string, string | number | boolean | null>>): string {
  return Object.entries(fields).map(([key, value]) => key + '=' + safeCell(value)).join(' · ');
}

function formatText(rows: readonly ReportRow[], includeHeaders: boolean): string {
  const output: string[] = [];
  let last: ArchitectureReportSection | null = null;
  for (const row of rows) {
    if (row.section !== last) {
      if (last !== null) output.push('');
      if (includeHeaders) output.push('[' + row.section.toUpperCase() + ']');
      last = row.section;
    }
    output.push(textLine(row.fields));
  }
  return output.join('\n');
}

function markdownEscape(value: unknown): string {
  return safeCell(value).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function formatMarkdown(rows: readonly ReportRow[], includeHeaders: boolean): string {
  const output: string[] = [];
  const bySection = new Map<ArchitectureReportSection, ReportRow[]>();
  for (const row of rows) {
    const list = bySection.get(row.section);
    if (list) list.push(row); else bySection.set(row.section, [row]);
  }
  for (const [section, sectionRows] of bySection) {
    if (output.length) output.push('');
    if (includeHeaders) output.push('## ' + section.replace(/-/g, ' '));
    const columns = [...new Set(sectionRows.flatMap(row => Object.keys(row.fields)))];
    if (!columns.length) continue;
    output.push('| ' + columns.map(markdownEscape).join(' | ') + ' |');
    output.push('| ' + columns.map(() => '---').join(' | ') + ' |');
    for (const row of sectionRows) {
      output.push('| ' + columns.map(column => markdownEscape(row.fields[column] ?? '')).join(' | ') + ' |');
    }
  }
  return output.join('\n');
}

function csvCell(value: unknown): string {
  const text = safeCell(value).replace(/\r?\n/g, ' ');
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function formatCsv(rows: readonly ReportRow[], includeHeaders: boolean): string {
  if (!rows.length) return '';
  const columns = ['section', ...new Set(rows.flatMap(row => Object.keys(row.fields)))];
  const output: string[] = [];
  if (includeHeaders) output.push(columns.map(csvCell).join(','));
  for (const row of rows) {
    output.push(columns.map(column => csvCell(column === 'section' ? row.section : row.fields[column] ?? '')).join(','));
  }
  return output.join('\n');
}

function formatJson(rows: readonly ReportRow[]): string {
  const grouped: Partial<Record<ArchitectureReportSection, Record<string, unknown>[]>> = {};
  for (const row of rows) {
    const list = grouped[row.section] ?? [];
    list.push(Object.fromEntries(Object.entries(row.fields).map(([key, value]) => [key, safeCell(value)])));
    grouped[row.section] = list;
  }
  return JSON.stringify(grouped, null, 2);
}

function boundedOutput(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_ARCHITECTURE_REPORT_UNITS) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_ARCHITECTURE_REPORT_UNITS - 80) +
      '\n… report output stopped at the 512 Ki UTF-16 safety limit …',
    truncated: true,
  };
}

export function architectureReportSectionLabel(section: ArchitectureReportSection): string {
  switch (section) {
    case 'summary': return 'Summary';
    case 'coverage': return 'Coverage limits';
    case 'modules': return 'Open modules';
    case 'symbols': return 'Declarations';
    case 'call-sites': return 'Observed call sites';
    case 'call-edges': return 'Call candidates';
    case 'imports': return 'Literal imports';
    case 'cycles': return 'Observed cycles';
    case 'hotspots': return 'Architecture hotspots';
    case 'entrypoints': return 'Entrypoint observations';
    case 'orphans': return 'Orphan modules';
    case 'isolated': return 'Isolated modules';
  }
}

export function architectureReportFormatLabel(format: ArchitectureReportFormat): string {
  switch (format) {
    case 'text': return 'Plain text';
    case 'markdown': return 'Markdown tables';
    case 'csv': return 'CSV rows';
    case 'json': return 'JSON';
  }
}

export function buildArchitectureReport(
  architecture: WorkspaceArchitecture,
  options: Partial<ArchitectureReportOptions> = {},
): ArchitectureReportResult {
  const format = options.format ?? DEFAULT_ARCHITECTURE_REPORT_OPTIONS.format;
  const sections = selectedSections(options.sections ?? DEFAULT_ARCHITECTURE_REPORT_OPTIONS.sections);
  const includeHeaders = options.includeHeaders ?? DEFAULT_ARCHITECTURE_REPORT_OPTIONS.includeHeaders;
  const includeIds = options.includeIds ?? DEFAULT_ARCHITECTURE_REPORT_OPTIONS.includeIds;
  const includePaths = options.includePaths ?? DEFAULT_ARCHITECTURE_REPORT_OPTIONS.includePaths;
  const maxRows = clampRows(options.maxRows ?? DEFAULT_ARCHITECTURE_REPORT_OPTIONS.maxRows);
  const collected = collectRows(architecture, sections, includeIds, includePaths, maxRows);
  let text = '';
  if (format === 'text') text = formatText(collected.rows, includeHeaders);
  else if (format === 'markdown') text = formatMarkdown(collected.rows, includeHeaders);
  else if (format === 'csv') text = formatCsv(collected.rows, includeHeaders);
  else text = formatJson(collected.rows);
  const bounded = boundedOutput(text);
  const omittedRows = Math.max(0, collected.total - collected.rows.length);
  const truncated = omittedRows > 0 || bounded.truncated;
  const warnings: string[] = [];
  if (omittedRows) warnings.push(omittedRows + ' report rows omitted by the selected row limit');
  if (bounded.truncated) warnings.push('formatted output reached the 512 Ki UTF-16 limit');
  if (!architecture.summary.complete) warnings.push('architecture coverage is incomplete within editor bounds');
  return Object.freeze({
    text: bounded.text,
    format,
    sections: Object.freeze(sections),
    rows: collected.rows.length,
    truncated,
    omittedRows,
    warning: warnings.length ? warnings.join('; ') + '.' : null,
  });
}

export interface ArchitectureReportSelection {
  readonly moduleIds?: readonly string[];
  readonly symbolIds?: readonly string[];
  readonly callSiteIds?: readonly string[];
  readonly callEdgeIds?: readonly string[];
  readonly importEdgeIds?: readonly string[];
  readonly cycleIds?: readonly string[];
  readonly hotspotIds?: readonly string[];
}

function keepIds<T extends { readonly id: string }>(items: readonly T[], ids: readonly string[] | undefined): T[] {
  if (!ids) return [...items];
  const chosen = new Set(ids.slice(0, MAX_ARCHITECTURE_REPORT_ROWS));
  return items.filter(item => chosen.has(item.id));
}

/**
 * Produce a report for an explicit selection without changing the source
 * architecture object. Summary counts still describe the full captured graph,
 * while entity sections are restricted to selected stable IDs.
 */
export function buildSelectedArchitectureReport(
  architecture: WorkspaceArchitecture,
  selection: ArchitectureReportSelection,
  options: Partial<ArchitectureReportOptions> = {},
): ArchitectureReportResult {
  const modules = keepIds(architecture.modules, selection.moduleIds);
  const symbols = keepIds(architecture.symbols, selection.symbolIds);
  const callSites = keepIds(architecture.callSites, selection.callSiteIds);
  const callEdges = keepIds(architecture.callEdges, selection.callEdgeIds);
  const importEdges = keepIds(architecture.importEdges, selection.importEdgeIds);
  const cycles = keepIds(architecture.cycles, selection.cycleIds);
  const hotspots = keepIds(architecture.hotspots, selection.hotspotIds);
  const selected: WorkspaceArchitecture = {
    ...architecture,
    modules: Object.freeze(modules),
    symbols: Object.freeze(symbols),
    callSites: Object.freeze(callSites),
    callEdges: Object.freeze(callEdges),
    importEdges: Object.freeze(importEdges),
    cycles: Object.freeze(cycles),
    hotspots: Object.freeze(hotspots),
  };
  return buildArchitectureReport(selected, options);
}

export function architectureReportSuggestedFilename(
  architecture: WorkspaceArchitecture,
  format: ArchitectureReportFormat,
): string {
  const extension: Readonly<Record<ArchitectureReportFormat, string>> = {
    text: 'txt', markdown: 'md', csv: 'csv', json: 'json',
  };
  const generation = architecture.generation.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 48) || 'snapshot';
  return 'scarp-workspace-architecture-' + generation + '.' + extension[format];
}

export function architectureReportNotice(architecture: WorkspaceArchitecture): string {
  const summary = architecture.summary;
  const coverage = summary.complete ? 'complete within bounded editor rules' : 'limited; review coverage warnings';
  return [
    summary.moduleCount + ' open modules',
    summary.functionCount + ' functions',
    summary.callSiteCount + ' lexical call sites',
    summary.importEdgeCount + ' literal imports',
    summary.importCycleCount + summary.callCycleCount + ' observed cycles',
    coverage,
  ].join(' · ');
}

export function architectureReportCallEdgeDescription(
  architecture: WorkspaceArchitecture,
  edge: ArchitectureCallEdge,
): string {
  return symbolName(architecture, edge.fromSymbolId) + ' → ' + symbolName(architecture, edge.toSymbolId) +
    ' · ' + architectureCallStatusLabel(edge.status) + (edge.sameSource ? ' · same source' : ' · cross source');
}

export function architectureReportImportEdgeDescription(
  architecture: WorkspaceArchitecture,
  edge: ArchitectureImportEdge,
): string {
  return moduleName(architecture, edge.fromModuleId) + ' → ' + moduleName(architecture, edge.toModuleId) +
    ' · ' + edge.specifier + ' · ' + edge.status;
}

export function architectureReportCycleDescription(
  architecture: WorkspaceArchitecture,
  cycle: ArchitectureCycle,
): string {
  const members = cycle.memberIds.map(id => architectureNodeLabel(architecture, id));
  return cycle.kind + ' cycle · ' + members.join(' → ') + (cycle.selfLoop ? ' · self-loop' : '');
}

export function architectureReportModuleDescription(module: ArchitectureModule): string {
  return (module.listedName ?? module.name) + ' · ' + module.symbolIds.length + ' declarations · ' +
    module.importEdgeIds.length + ' imports · ' + module.callSiteIds.length + ' call sites' +
    (module.incomplete ? ' · incomplete index' : '');
}

export function architectureReportSymbolDescription(
  architecture: WorkspaceArchitecture,
  symbol: ArchitectureSymbol,
): string {
  return moduleName(architecture, symbol.moduleId) + '::' + symbol.name + ' · ' + symbol.kind +
    ' · ' + symbol.scope + ' · ' + symbol.incomingCallEdgeIds.length + ' incoming · ' +
    symbol.outgoingCallEdgeIds.length + ' outgoing';
}

export function architectureReportCallSiteDescription(
  architecture: WorkspaceArchitecture,
  site: ArchitectureCallSite,
): string {
  return moduleName(architecture, site.moduleId) + ':' + site.line + ':' + site.column + ' · ' + site.name +
    ' · ' + architectureCallStatusLabel(site.status) + ' · ' + site.candidateSymbolIds.length + ' candidates';
}
