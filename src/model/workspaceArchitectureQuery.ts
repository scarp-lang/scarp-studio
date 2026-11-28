import {
  architectureCallStatusLabel,
  architectureNodeLabel,
  architectureRiskLabel,
  type ArchitectureCallSite,
  type ArchitectureCallStatus,
  type ArchitectureCycle,
  type ArchitectureHotspot,
  type ArchitectureImportEdge,
  type ArchitectureImportStatus,
  type ArchitectureModule,
  type ArchitectureRiskLevel,
  type ArchitectureSymbol,
  type WorkspaceArchitecture,
} from './workspaceArchitecture';
import { SYMBOL_KIND_LABELS, type SymbolKind } from './workspaceSymbols';

/** Query language for the read-only architecture review surface.
 * Unknown fields are reported rather than silently reinterpreted.
 * All matching is bounded and locale-independent for deterministic tests.
 */
export const MAX_ARCHITECTURE_QUERY_UNITS = 240;
export const MAX_ARCHITECTURE_QUERY_TERMS = 24;
export const MAX_ARCHITECTURE_QUERY_RESULTS = 240;
export const MAX_ARCHITECTURE_QUERY_TOKEN_UNITS = 96;

export type ArchitectureSearchKind = 'module' | 'symbol' | 'call' | 'import' | 'cycle' | 'hotspot';
export type ArchitectureQueryField =
  | 'kind'
  | 'name'
  | 'file'
  | 'symbol'
  | 'status'
  | 'scope'
  | 'visibility'
  | 'pure'
  | 'cycle'
  | 'risk'
  | 'incoming'
  | 'outgoing';

export interface ArchitectureQueryTerm {
  readonly raw: string;
  readonly value: string;
  readonly field: ArchitectureQueryField | null;
  readonly negated: boolean;
  readonly quoted: boolean;
}

export interface ArchitectureQueryIssue {
  readonly offset: number;
  readonly length: number;
  readonly message: string;
}

export interface ArchitectureQuery {
  readonly source: string;
  readonly terms: readonly ArchitectureQueryTerm[];
  readonly issues: readonly ArchitectureQueryIssue[];
  readonly complete: boolean;
}

export interface ArchitectureSearchItem {
  readonly id: string;
  readonly kind: ArchitectureSearchKind;
  readonly label: string;
  readonly detail: string;
  readonly moduleId: string | null;
  readonly symbolId: string | null;
  readonly file: string;
  readonly name: string;
  readonly symbolKind: SymbolKind | null;
  readonly callStatus: ArchitectureCallStatus | null;
  readonly importStatus: ArchitectureImportStatus | null;
  readonly scope: ArchitectureSymbol['scope'] | null;
  readonly visibility: ArchitectureSymbol['visibility'] | null;
  readonly pure: boolean | null;
  readonly cyclic: boolean;
  readonly risk: ArchitectureRiskLevel | null;
  readonly incoming: number;
  readonly outgoing: number;
  readonly searchable: string;
}

export interface ArchitectureSearchMatch {
  readonly item: ArchitectureSearchItem;
  readonly score: number;
  readonly matchedTerms: number;
  readonly highlights: readonly { start: number; end: number }[];
}

export interface ArchitectureSearchResult {
  readonly query: ArchitectureQuery;
  readonly matches: readonly ArchitectureSearchMatch[];
  readonly totalMatches: number;
  readonly truncated: boolean;
}

const fields = new Set<ArchitectureQueryField>([
  'kind', 'name', 'file', 'symbol', 'status', 'scope', 'visibility', 'pure',
  'cycle', 'risk', 'incoming', 'outgoing',
]);
const searchKinds = new Set<ArchitectureSearchKind>(['module', 'symbol', 'call', 'import', 'cycle', 'hotspot']);
const riskRanks: Readonly<Record<ArchitectureRiskLevel, number>> = Object.freeze({
  low: 1, medium: 2, high: 3, critical: 4,
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function lower(value: string): string {
  return value.toLowerCase();
}

function safeToken(value: string): string {
  return value.slice(0, MAX_ARCHITECTURE_QUERY_TOKEN_UNITS);
}

function unescapeQuoted(value: string): string {
  let output = '';
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '\\' && index + 1 < value.length) {
      const next = value[++index];
      if (next === '"' || next === '\\') output += next;
      else output += '\\' + next;
    } else output += char;
  }
  return output;
}

function scanToken(source: string, start: number): { raw: string; end: number; quoted: boolean; closed: boolean } {
  let index = start;
  let quoted = false;
  let closed = true;
  let escaped = false;
  while (index < source.length) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      index++;
      continue;
    }
    if (char === '\\' && quoted) {
      escaped = true;
      index++;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      if (!quoted) closed = true;
      index++;
      continue;
    }
    if (!quoted && /\s/.test(char)) break;
    if (quoted) closed = false;
    index++;
  }
  return { raw: source.slice(start, index), end: index, quoted: source.slice(start, index).includes('"'), closed };
}

function splitField(raw: string): { field: string | null; value: string } {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && quoted) { escaped = true; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ':' && !quoted) return { field: raw.slice(0, index), value: raw.slice(index + 1) };
  }
  return { field: null, value: raw };
}

function normalizeValue(raw: string): { value: string; quoted: boolean; valid: boolean } {
  if (!raw) return { value: '', quoted: false, valid: false };
  if (raw.startsWith('"')) {
    if (raw.length < 2 || !raw.endsWith('"')) return { value: safeToken(unescapeQuoted(raw.slice(1))), quoted: true, valid: false };
    return { value: safeToken(unescapeQuoted(raw.slice(1, -1))), quoted: true, valid: true };
  }
  if (raw.includes('"')) return { value: safeToken(unescapeQuoted(raw.replaceAll('"', ''))), quoted: true, valid: false };
  return { value: safeToken(raw), quoted: false, valid: true };
}

export function parseArchitectureQuery(input: string): ArchitectureQuery {
  const source = input.slice(0, MAX_ARCHITECTURE_QUERY_UNITS);
  const issues: ArchitectureQueryIssue[] = [];
  const terms: ArchitectureQueryTerm[] = [];
  let index = 0;
  while (index < source.length && terms.length < MAX_ARCHITECTURE_QUERY_TERMS) {
    while (index < source.length && /\s/.test(source[index])) index++;
    if (index >= source.length) break;
    const start = index;
    const token = scanToken(source, start);
    index = token.end;
    let raw = token.raw;
    let negated = false;
    if (raw.startsWith('-') && raw.length > 1) { negated = true; raw = raw.slice(1); }
    const split = splitField(raw);
    let field: ArchitectureQueryField | null = null;
    if (split.field !== null) {
      const normalizedField = lower(split.field);
      if (!fields.has(normalizedField as ArchitectureQueryField)) {
        issues.push({ offset: start, length: Math.max(1, split.field.length), message: 'Unknown architecture query field: ' + split.field });
      } else field = normalizedField as ArchitectureQueryField;
    }
    const normalized = normalizeValue(split.value);
    if (!normalized.valid || !token.closed) {
      issues.push({ offset: start, length: Math.max(1, token.end - start), message: 'Unclosed or malformed quoted query term.' });
    }
    if (!normalized.value) {
      issues.push({ offset: start, length: Math.max(1, token.end - start), message: 'Architecture query term is empty.' });
      continue;
    }
    terms.push(Object.freeze({ raw: token.raw, value: normalized.value, field, negated, quoted: normalized.quoted }));
  }
  if (index < source.length) {
    issues.push({ offset: index, length: source.length - index, message: 'Architecture query term limit reached.' });
  }
  return Object.freeze({
    source,
    terms: Object.freeze(terms),
    issues: Object.freeze(issues),
    complete: input.length <= MAX_ARCHITECTURE_QUERY_UNITS && index >= source.length && issues.length === 0,
  });
}

function countEdges(architecture: WorkspaceArchitecture, id: string): { incoming: number; outgoing: number } {
  const module = architecture.modules.find(item => item.id === id);
  if (module) {
    let incoming = 0, outgoing = 0;
    for (const edge of architecture.importEdges) {
      if (edge.fromModuleId === id && edge.toModuleId) outgoing++;
      if (edge.toModuleId === id) incoming++;
    }
    for (const edge of architecture.callEdges) {
      if (edge.fromModuleId === id && edge.toModuleId !== id) outgoing++;
      if (edge.toModuleId === id && edge.fromModuleId !== id) incoming++;
    }
    return { incoming, outgoing };
  }
  const symbol = architecture.symbols.find(item => item.id === id);
  if (symbol) return { incoming: symbol.incomingCallEdgeIds.length, outgoing: symbol.outgoingCallEdgeIds.length };
  return { incoming: 0, outgoing: 0 };
}

function moduleName(architecture: WorkspaceArchitecture, moduleId: string | null): string {
  if (!moduleId) return '';
  const module = architecture.modules.find(item => item.id === moduleId);
  return module?.listedName ?? module?.name ?? '';
}

function moduleItems(architecture: WorkspaceArchitecture): ArchitectureSearchItem[] {
  return architecture.modules.map((module: ArchitectureModule) => {
    const counts = countEdges(architecture, module.id);
    const hotspot = architecture.hotspots.find(item => item.id === module.id) ?? null;
    const cyclic = architecture.cycles.some(cycle => cycle.memberIds.includes(module.id));
    const label = module.listedName ?? module.name;
    const detail = module.symbolIds.length + ' declarations · ' + module.callSiteIds.length + ' calls · ' +
      counts.incoming + ' in / ' + counts.outgoing + ' out' + (module.incomplete ? ' · partial' : '');
    return Object.freeze({
      id: 'module:' + module.id,
      kind: 'module' as const,
      label,
      detail,
      moduleId: module.id,
      symbolId: null,
      file: label,
      name: label,
      symbolKind: null,
      callStatus: null,
      importStatus: null,
      scope: null,
      visibility: null,
      pure: null,
      cyclic,
      risk: hotspot?.risk ?? null,
      incoming: counts.incoming,
      outgoing: counts.outgoing,
      searchable: lower([label, module.name, module.path ?? '', detail, cyclic ? 'cycle cyclic' : '', hotspot?.risk ?? ''].join(' ')),
    });
  });
}

function symbolItems(architecture: WorkspaceArchitecture): ArchitectureSearchItem[] {
  return architecture.symbols.map((symbol: ArchitectureSymbol) => {
    const owner = moduleName(architecture, symbol.moduleId);
    const hotspot = architecture.hotspots.find(item => item.id === symbol.id) ?? null;
    const cyclic = architecture.cycles.some(cycle => cycle.kind === 'call' && cycle.memberIds.includes(symbol.id));
    const detail = SYMBOL_KIND_LABELS[symbol.kind] + ' · ' + owner + ':' + symbol.line +
      ' · ' + symbol.scope + (symbol.visibility === 'public' ? ' · pub' : '') + (symbol.pure ? ' · pure' : '');
    return Object.freeze({
      id: 'symbol:' + symbol.id,
      kind: 'symbol' as const,
      label: symbol.name,
      detail,
      moduleId: symbol.moduleId,
      symbolId: symbol.id,
      file: owner,
      name: symbol.name,
      symbolKind: symbol.kind,
      callStatus: null,
      importStatus: null,
      scope: symbol.scope,
      visibility: symbol.visibility,
      pure: symbol.pure,
      cyclic,
      risk: hotspot?.risk ?? null,
      incoming: symbol.incomingCallEdgeIds.length,
      outgoing: symbol.outgoingCallEdgeIds.length,
      searchable: lower([symbol.name, symbol.header, owner, SYMBOL_KIND_LABELS[symbol.kind], symbol.scope,
        symbol.visibility, symbol.pure ? 'pure' : '', cyclic ? 'cycle cyclic' : '', hotspot?.risk ?? ''].join(' ')),
    });
  });
}

function callItems(architecture: WorkspaceArchitecture): ArchitectureSearchItem[] {
  return architecture.callSites.map((site: ArchitectureCallSite) => {
    const owner = moduleName(architecture, site.moduleId);
    const detail = architectureCallStatusLabel(site.status) + ' · ' + owner + ':' + site.line +
      ' · ' + site.candidateSymbolIds.length + ' candidate' + (site.candidateSymbolIds.length === 1 ? '' : 's');
    return Object.freeze({
      id: 'call:' + site.id,
      kind: 'call' as const,
      label: site.name,
      detail,
      moduleId: site.moduleId,
      symbolId: site.enclosingSymbolId,
      file: owner,
      name: site.name,
      symbolKind: null,
      callStatus: site.status,
      importStatus: null,
      scope: null,
      visibility: null,
      pure: null,
      cyclic: site.candidateSymbolIds.some(id => architecture.cycles.some(cycle => cycle.kind === 'call' && cycle.memberIds.includes(id))),
      risk: null,
      incoming: 0,
      outgoing: site.edgeIds.length,
      searchable: lower([site.name, owner, architectureCallStatusLabel(site.status), detail].join(' ')),
    });
  });
}

function importItems(architecture: WorkspaceArchitecture): ArchitectureSearchItem[] {
  return architecture.importEdges.map((edge: ArchitectureImportEdge) => {
    const owner = moduleName(architecture, edge.fromModuleId);
    const target = moduleName(architecture, edge.toModuleId);
    const detail = edge.status + ' · ' + owner + ':' + edge.line + (target ? ' → ' + target : '') +
      (edge.alias ? ' · as ' + edge.alias : '');
    return Object.freeze({
      id: 'import:' + edge.id,
      kind: 'import' as const,
      label: edge.specifier,
      detail,
      moduleId: edge.fromModuleId,
      symbolId: null,
      file: owner,
      name: edge.specifier,
      symbolKind: null,
      callStatus: null,
      importStatus: edge.status,
      scope: null,
      visibility: null,
      pure: null,
      cyclic: !!edge.toModuleId && architecture.cycles.some(cycle => cycle.kind === 'import' &&
        cycle.memberIds.includes(edge.fromModuleId) && cycle.memberIds.includes(edge.toModuleId!)),
      risk: null,
      incoming: 0,
      outgoing: edge.toModuleId ? 1 : 0,
      searchable: lower([edge.specifier, edge.alias ?? '', owner, target, edge.status, edge.note ?? ''].join(' ')),
    });
  });
}

function cycleItems(architecture: WorkspaceArchitecture): ArchitectureSearchItem[] {
  return architecture.cycles.map((cycle: ArchitectureCycle) => {
    const names = cycle.memberIds.map(id => architectureNodeLabel(architecture, id));
    const detail = cycle.kind + ' cycle · ' + cycle.size + ' member' + (cycle.size === 1 ? '' : 's');
    return Object.freeze({
      id: 'cycle:' + cycle.id,
      kind: 'cycle' as const,
      label: names.join(' → '),
      detail,
      moduleId: cycle.kind === 'import' ? cycle.memberIds[0] ?? null : null,
      symbolId: cycle.kind === 'call' ? cycle.memberIds[0] ?? null : null,
      file: '',
      name: names.join(' '),
      symbolKind: null,
      callStatus: null,
      importStatus: null,
      scope: null,
      visibility: null,
      pure: null,
      cyclic: true,
      risk: cycle.size >= 4 ? 'high' : cycle.size >= 2 ? 'medium' : 'low',
      incoming: 0,
      outgoing: cycle.edgeIds.length,
      searchable: lower([cycle.kind, detail, ...names, cycle.selfLoop ? 'self loop recursion' : ''].join(' ')),
    });
  });
}

function hotspotItems(architecture: WorkspaceArchitecture): ArchitectureSearchItem[] {
  return architecture.hotspots.map((hotspot: ArchitectureHotspot) => {
    const owner = hotspot.kind === 'symbol'
      ? moduleName(architecture, architecture.symbols.find(item => item.id === hotspot.id)?.moduleId ?? null)
      : hotspot.label;
    const detail = architectureRiskLabel(hotspot.risk) + ' · score ' + hotspot.score +
      ' · ' + hotspot.incoming + ' in / ' + hotspot.outgoing + ' out';
    return Object.freeze({
      id: 'hotspot:' + hotspot.id,
      kind: 'hotspot' as const,
      label: hotspot.label,
      detail,
      moduleId: hotspot.kind === 'module' ? hotspot.id : architecture.symbols.find(item => item.id === hotspot.id)?.moduleId ?? null,
      symbolId: hotspot.kind === 'symbol' ? hotspot.id : null,
      file: owner,
      name: hotspot.label,
      symbolKind: hotspot.kind === 'symbol' ? architecture.symbols.find(item => item.id === hotspot.id)?.kind ?? null : null,
      callStatus: null,
      importStatus: null,
      scope: hotspot.kind === 'symbol' ? architecture.symbols.find(item => item.id === hotspot.id)?.scope ?? null : null,
      visibility: hotspot.kind === 'symbol' ? architecture.symbols.find(item => item.id === hotspot.id)?.visibility ?? null : null,
      pure: hotspot.kind === 'symbol' ? architecture.symbols.find(item => item.id === hotspot.id)?.pure ?? null : null,
      cyclic: hotspot.cycleCount > 0,
      risk: hotspot.risk,
      incoming: hotspot.incoming,
      outgoing: hotspot.outgoing,
      searchable: lower([hotspot.label, owner, hotspot.risk, architectureRiskLabel(hotspot.risk), ...hotspot.reasons].join(' ')),
    });
  });
}

export function buildArchitectureSearchItems(architecture: WorkspaceArchitecture): readonly ArchitectureSearchItem[] {
  return Object.freeze([
    ...moduleItems(architecture),
    ...symbolItems(architecture),
    ...callItems(architecture),
    ...importItems(architecture),
    ...cycleItems(architecture),
    ...hotspotItems(architecture),
  ]);
}

function parseBoolean(value: string): boolean | null {
  const normalized = lower(value);
  if (['yes', 'true', '1', 'on'].includes(normalized)) return true;
  if (['no', 'false', '0', 'off'].includes(normalized)) return false;
  return null;
}

function parseCountPredicate(value: string): ((count: number) => boolean) | null {
  const match = /^(<=|>=|<|>|=)?(\d{1,6})$/.exec(value);
  if (!match) return null;
  const expected = Number(match[2]);
  switch (match[1] ?? '=') {
    case '<': return count => count < expected;
    case '<=': return count => count <= expected;
    case '>': return count => count > expected;
    case '>=': return count => count >= expected;
    default: return count => count === expected;
  }
}

function fieldMatch(item: ArchitectureSearchItem, term: ArchitectureQueryTerm): boolean {
  const value = lower(term.value);
  switch (term.field) {
    case null: return item.searchable.includes(value);
    case 'kind': return item.kind === value || (item.kind === 'symbol' && item.symbolKind === value);
    case 'name': return lower(item.name).includes(value);
    case 'file': return lower(item.file).includes(value);
    case 'symbol': return item.symbolKind === value || (item.symbolKind ? lower(SYMBOL_KIND_LABELS[item.symbolKind]).includes(value) : false);
    case 'status': return lower(item.callStatus ?? item.importStatus ?? '').includes(value) || item.detail.toLowerCase().includes(value);
    case 'scope': return item.scope === value;
    case 'visibility': return item.visibility === value || (value === 'pub' && item.visibility === 'public');
    case 'pure': {
      const expected = parseBoolean(value);
      return expected !== null && item.pure === expected;
    }
    case 'cycle': {
      const expected = parseBoolean(value);
      return expected !== null && item.cyclic === expected;
    }
    case 'risk': {
      if (!item.risk) return false;
      const comparison = /^(<=|>=|<|>)?(low|medium|high|critical)$/.exec(value);
      if (!comparison) return false;
      const expected = riskRanks[comparison[2] as ArchitectureRiskLevel];
      const actual = riskRanks[item.risk];
      switch (comparison[1] ?? '=') {
        case '<': return actual < expected;
        case '<=': return actual <= expected;
        case '>': return actual > expected;
        case '>=': return actual >= expected;
        default: return actual === expected;
      }
    }
    case 'incoming': {
      const predicate = parseCountPredicate(value);
      return predicate ? predicate(item.incoming) : false;
    }
    case 'outgoing': {
      const predicate = parseCountPredicate(value);
      return predicate ? predicate(item.outgoing) : false;
    }
  }
}

function termScore(item: ArchitectureSearchItem, term: ArchitectureQueryTerm): number {
  if (term.negated) return 0;
  const value = lower(term.value);
  if (!value) return 0;
  if (term.field) {
    if (term.field === 'name' && lower(item.name) === value) return 24;
    if (term.field === 'file' && lower(item.file) === value) return 18;
    if (term.field === 'kind' && item.kind === value) return 12;
    return 8;
  }
  const name = lower(item.name);
  const label = lower(item.label);
  if (name === value || label === value) return 30;
  if (name.startsWith(value) || label.startsWith(value)) return 22;
  if (name.includes(value) || label.includes(value)) return 16;
  if (lower(item.file).includes(value)) return 10;
  return 6;
}

function highlightLabel(label: string, terms: readonly ArchitectureQueryTerm[]): readonly { start: number; end: number }[] {
  const text = lower(label);
  const ranges: { start: number; end: number }[] = [];
  for (const term of terms) {
    if (term.negated || (term.field && term.field !== 'name')) continue;
    const needle = lower(term.value);
    if (!needle) continue;
    let offset = 0;
    while (offset < text.length && ranges.length < 8) {
      const found = text.indexOf(needle, offset);
      if (found < 0) break;
      ranges.push({ start: found, end: found + needle.length });
      offset = found + Math.max(1, needle.length);
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return Object.freeze(merged);
}

export function searchWorkspaceArchitecture(
  architecture: WorkspaceArchitecture,
  queryInput: string,
  kinds: readonly ArchitectureSearchKind[] = ['module', 'symbol', 'call', 'import', 'cycle', 'hotspot'],
): ArchitectureSearchResult {
  const query = parseArchitectureQuery(queryInput);
  const allowedKinds = new Set(kinds.filter(kind => searchKinds.has(kind)));
  const items = buildArchitectureSearchItems(architecture);
  const matches: ArchitectureSearchMatch[] = [];
  for (const item of items) {
    if (!allowedKinds.has(item.kind)) continue;
    let matchedTerms = 0;
    let score = 0;
    let rejected = false;
    for (const term of query.terms) {
      const matched = fieldMatch(item, term);
      if (term.negated ? matched : !matched) { rejected = true; break; }
      if (!term.negated) {
        matchedTerms++;
        score += termScore(item, term);
      }
    }
    if (rejected) continue;
    if (!query.terms.length) score = item.kind === 'hotspot' ? (item.risk ? riskRanks[item.risk] * 5 : 0) : 0;
    if (item.risk) score += riskRanks[item.risk];
    if (item.cyclic) score += 2;
    matches.push(Object.freeze({ item, score, matchedTerms, highlights: highlightLabel(item.label, query.terms) }));
  }
  matches.sort((left, right) => right.score - left.score ||
    compareText(left.item.label.toLowerCase(), right.item.label.toLowerCase()) ||
    compareText(left.item.kind, right.item.kind) || compareText(left.item.id, right.item.id));
  const totalMatches = matches.length;
  return Object.freeze({
    query,
    matches: Object.freeze(matches.slice(0, MAX_ARCHITECTURE_QUERY_RESULTS)),
    totalMatches,
    truncated: totalMatches > MAX_ARCHITECTURE_QUERY_RESULTS,
  });
}

export function architectureQueryHelp(): readonly string[] {
  return Object.freeze([
    'Plain terms search labels, files and review details.',
    'kind:module|symbol|call|import|cycle|hotspot filters result type.',
    'symbol:function|record|variant|binding|variable|import-alias filters declaration kind.',
    'file:"src/main.srp" and name:render filter source and label text.',
    'status:multiple-candidates or status:missing filters observed edge status.',
    'scope:top-level|nested, visibility:public|local and pure:true filter declarations.',
    'cycle:true and risk:>=high focus cyclic or higher-priority review items.',
    'incoming:>=3 and outgoing:>5 filter observed dependency counts.',
    'Prefix any term with - to exclude matching items.',
  ]);
}
