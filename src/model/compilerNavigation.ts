import type { ScarpProjectAction } from '../services/project';

export const MAX_NAVIGATION_JSON_UNITS = 256 * 1024;
export const MAX_NAVIGATION_FILES = 512;
export const MAX_NAVIGATION_SYMBOLS = 4096;
export const MAX_NAVIGATION_REFERENCES = 8192;
export const MAX_NAVIGATION_TEXT_UNITS = 4096;
export const NAVIGATION_PAGE_SIZE = 40;
export const MAX_NAVIGATION_QUERY = 120;

export const SYMBOL_KINDS = ['module', 'import_alias', 'function', 'record', 'variant',
  'constant', 'binding', 'parameter', 'repeat_index', 'contract_result', 'builtin'] as const;
export const REFERENCE_KINDS = ['read', 'write', 'read_write', 'call', 'namespace', 'import',
  'argument_label'] as const;
export type CompilerSymbolKind = typeof SYMBOL_KINDS[number];
export type CompilerReferenceKind = typeof REFERENCE_KINDS[number];
export type InspectionAction = Extract<ScarpProjectAction, 'inspect-symbols' | 'inspect-references'>;
export interface CompilerLocation {
  readonly source: number;
  readonly byteStart: number;
  readonly byteEnd: number;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
}
export interface CompilerFile {
  readonly id: number;
  readonly path: string;
}
export interface CompilerSymbol {
  readonly id: number;
  readonly name: string;
  readonly kind: CompilerSymbolKind;
  readonly owner: number | null;
  readonly public: boolean;
  readonly mutable: boolean;
  readonly targetModule: number | null;
  readonly location: CompilerLocation | null;
}
export interface CompilerReference {
  readonly target: number;
  readonly kind: CompilerReferenceKind;
  readonly location: CompilerLocation;
}
export interface CompilerNavigationReport {
  readonly kind: 'symbols' | 'references';
  readonly files: readonly CompilerFile[];
  readonly symbols: readonly CompilerSymbol[];
  readonly references: readonly CompilerReference[];
}
export type NavigationParse =
  | { readonly ok: true; readonly report: CompilerNavigationReport }
  | { readonly ok: false; readonly reason: string };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function uint(value: unknown, max = 0xffffffff): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}
function index(value: unknown, length: number): value is number {
  return uint(value) && value < length;
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 &&
    value.length <= MAX_NAVIGATION_TEXT_UNITS && !/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value);
}
function position(value: unknown): { line: number; column: number } | null {
  const item = record(value);
  if (!item || !uint(item.line) || !uint(item.column) || item.line < 1 || item.column < 1) return null;
  return { line: item.line, column: item.column };
}
function location(value: unknown, fileCount: number): CompilerLocation | null {
  const item = record(value);
  if (!item || !index(item.source, fileCount) || !Array.isArray(item.span) || item.span.length !== 2 ||
      !uint(item.span[0]) || !uint(item.span[1]) || item.span[0] > item.span[1]) return null;
  const start = position(item.start), end = position(item.end);
  if (!start || !end || end.line < start.line || (end.line === start.line && end.column < start.column)) return null;
  return Object.freeze({ source: item.source, byteStart: item.span[0], byteEnd: item.span[1],
    line: start.line, column: start.column, endLine: end.line, endColumn: end.column });
}
function failure(reason: string): NavigationParse { return { ok: false, reason }; }

/** Parse only a complete schema-v1 response from the separate native inspection
 * channel. Compiler file paths are untrusted display labels; they are never
 * filesystem commands, URLs, editor paths or permission grants.
 *
 * IDs are dense and snapshot-local. Validate every link, position, bound and
 * kind before creating the report. No partial/invented result is returned.
 */
export function parseCompilerNavigation(json: string, action: InspectionAction): NavigationParse {
  if (json.length > MAX_NAVIGATION_JSON_UNITS) return failure('Inspection output exceeds the Studio JSON budget.');
  let value: unknown;
  try { value = JSON.parse(json); } catch { return failure('Inspection output is not complete JSON.'); }
  const root = record(value);
  const kind = action === 'inspect-symbols' ? 'symbols' : 'references';
  if (!root || root.schema_version !== 1 || root.kind !== 'scarp.' + kind ||
      root.span_encoding !== 'utf-8-bytes' || root.column_encoding !== 'unicode-scalar' || root.position_base !== 1) {
    return failure('Inspection response does not match the requested schema and coordinate encoding.');
  }
  if (!Array.isArray(root.files) || root.files.length > MAX_NAVIGATION_FILES ||
      !Array.isArray(root.symbols) || root.symbols.length > MAX_NAVIGATION_SYMBOLS ||
      (kind === 'references' && (!Array.isArray(root.references) || root.references.length > MAX_NAVIGATION_REFERENCES)) ||
      (kind === 'symbols' && Object.hasOwn(root, 'references'))) {
    return failure('Inspection inventory is missing or exceeds its bounds.');
  }
  const files: CompilerFile[] = [];
  const paths = new Set<string>();
  for (const raw of root.files) {
    const item = record(raw);
    if (!item || item.id !== files.length || !text(item.path) || paths.has(item.path)) {
      return failure('Inspection contains malformed or duplicate file identities.');
    }
    paths.add(item.path);
    files.push(Object.freeze({ id: files.length, path: item.path }));
  }
  const symbols: CompilerSymbol[] = [];
  for (const raw of root.symbols) {
    const item = record(raw);
    if (!item || item.id !== symbols.length || !text(item.name) ||
        !SYMBOL_KINDS.includes(item.kind as CompilerSymbolKind) ||
        (item.owner !== null && (!index(item.owner, root.symbols.length) || item.owner === item.id)) ||
        typeof item.public !== 'boolean' || typeof item.mutable !== 'boolean' ||
        (item.target_module !== null && !index(item.target_module, files.length))) {
      return failure('Inspection contains malformed symbol metadata.');
    }
    const site = item.location === null ? null : location(item.location, files.length);
    if (item.location !== null && !site) return failure('Inspection contains an invalid definition location.');
    symbols.push(Object.freeze({ id: symbols.length, name: item.name, kind: item.kind as CompilerSymbolKind,
      owner: item.owner as number | null, public: item.public, mutable: item.mutable,
      targetModule: item.target_module as number | null, location: site }));
  }
  // A malformed owner cycle must not create an infinite qualified-name walk.
  const color = new Uint8Array(symbols.length);
  for (const symbol of symbols) {
    let id: number | null = symbol.id;
    const trail: number[] = [];
    while (id !== null && color[id] === 0) {
      color[id] = 1; trail.push(id); id = symbols[id].owner;
    }
    if (id !== null && color[id] === 1) return failure('Inspection contains a cyclic symbol-owner chain.');
    for (const member of trail) color[member] = 2;
  }
  const references: CompilerReference[] = [];
  if (kind === 'references') {
    for (const raw of root.references as unknown[]) {
      const item = record(raw);
      if (!item || !index(item.target, symbols.length) || !REFERENCE_KINDS.includes(item.kind as CompilerReferenceKind)) {
        return failure('Inspection contains an invalid reference target or kind.');
      }
      const site = location(item.location, files.length);
      if (!site || site.byteStart === site.byteEnd) return failure('Inspection contains an invalid reference span.');
      references.push(Object.freeze({ target: item.target, kind: item.kind as CompilerReferenceKind, location: site }));
    }
  }
  return { ok: true, report: Object.freeze({ kind, files: Object.freeze(files),
    symbols: Object.freeze(symbols), references: Object.freeze(references) }) };
}

export interface NavigationFilter {
  readonly query: string;
  readonly symbolKind: CompilerSymbolKind | 'all';
  readonly file: number | 'all' | 'implicit';
  readonly visibility: 'all' | 'public' | 'private';
  readonly mutableOnly: boolean;
}
export const DEFAULT_NAVIGATION_FILTER: NavigationFilter = Object.freeze({
  query: '', symbolKind: 'all', file: 'all', visibility: 'all', mutableOnly: false,
});
export function symbolOwnerLabel(report: CompilerNavigationReport, symbol: CompilerSymbol): string {
  const names: string[] = [];
  let owner = symbol.owner;
  // A bounded display breadcrumb is sufficient. Identity remains the ID.
  for (let depth = 0; owner !== null && depth < 8; depth++) {
    const parent: CompilerSymbol | undefined = report.symbols[owner];
    if (!parent) break;
    names.unshift(parent.name);
    owner = parent.owner;
  }
  return (owner === null ? '' : '… / ') + names.join(' / ');
}
export function filterCompilerSymbols(report: CompilerNavigationReport, filter: NavigationFilter): CompilerSymbol[] {
  const terms = filter.query.slice(0, MAX_NAVIGATION_QUERY).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return report.symbols.filter(symbol => {
    if (filter.symbolKind !== 'all' && symbol.kind !== filter.symbolKind) return false;
    if (filter.visibility !== 'all' && symbol.public !== (filter.visibility === 'public')) return false;
    if (filter.mutableOnly && !symbol.mutable) return false;
    if (filter.file === 'implicit' && symbol.location !== null) return false;
    if (typeof filter.file === 'number' && symbol.location?.source !== filter.file) return false;
    if (!terms.length) return true;
    const file = symbol.location === null ? '' : report.files[symbol.location.source]?.path ?? '';
    const haystack = [symbol.name, symbol.kind, file, symbolOwnerLabel(report, symbol)].join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}
export interface ReferenceFilter {
  readonly kind: CompilerReferenceKind | 'all';
  readonly file: number | 'all';
}
export function referencesToSymbol(report: CompilerNavigationReport, symbolId: number, filter: ReferenceFilter): CompilerReference[] {
  if (report.kind !== 'references' || !index(symbolId, report.symbols.length)) return [];
  return report.references.filter(reference => reference.target === symbolId &&
    (filter.kind === 'all' || reference.kind === filter.kind) &&
    (filter.file === 'all' || reference.location.source === filter.file));
}
export function symbolKindCounts(report: CompilerNavigationReport): Readonly<Record<CompilerSymbolKind, number>> {
  const counts = Object.fromEntries(SYMBOL_KINDS.map(kind => [kind, 0])) as Record<CompilerSymbolKind, number>;
  for (const symbol of report.symbols) counts[symbol.kind]++;
  return Object.freeze(counts);
}
export function referenceKindCounts(references: readonly CompilerReference[]): Readonly<Record<CompilerReferenceKind, number>> {
  const counts = Object.fromEntries(REFERENCE_KINDS.map(kind => [kind, 0])) as Record<CompilerReferenceKind, number>;
  for (const reference of references) counts[reference.kind]++;
  return Object.freeze(counts);
}
export function navigationPage<T>(items: readonly T[], requested: number): { items: readonly T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / NAVIGATION_PAGE_SIZE));
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(pages, requested)) : 1;
  return { items: items.slice((page - 1) * NAVIGATION_PAGE_SIZE, page * NAVIGATION_PAGE_SIZE), page, pages };
}
export function formatCompilerLocation(report: CompilerNavigationReport, site: CompilerLocation | null): string {
  if (!site) return 'Implicit or builtin; no definition token';
  return (report.files[site.source]?.path ?? 'Unknown file') + ':' + site.line + ':' + site.column +
    ' (UTF-8 bytes ' + site.byteStart + '–' + site.byteEnd + ')';
}
