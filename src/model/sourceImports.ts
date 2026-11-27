import { scanScarpSource, type InsightToken } from '../language/sourceLex';
import { isScarpPath, sameFilePath, type StudioDocument } from './documents';
import { safeRelativeScarpSourceName } from './folderListing';

/** Pure, read-only import navigation for already-listed Scarp source files.
 * This is not official compiler resolution. Import literals never become
 * native filesystem paths until matched to an exact existing Explorer entry.
 */
export const MAX_IMPORT_GRAPH_SOURCES = 200;
export const MAX_IMPORT_GRAPH_SOURCE_UNITS = 2 * 1024 * 1024;
export const MAX_IMPORTS_PER_SOURCE = 128;
export const MAX_IMPORT_GRAPH_EDGES = 768;
export const MAX_IMPORT_GRAPH_CYCLES = 32;
export const MAX_IMPORT_PATH_UNITS = 256;

export type ImportStatus =
  'open' | 'listed' | 'missing' | 'unsafe' | 'unrecognized' | 'self' | 'ambiguous';
export interface ListedImportSource { name: string; path: string }
export interface ScarpSourceImport {
  id: string;
  documentId: string;
  documentRevision: number;
  sourcePath: string;
  sourceName: string;
  specifier: string;
  alias: string | null;
  line: number;
  column: number;
  offset: number;
  targetRelativeName: string | null;
  targetPath: string | null;
  targetDocumentId: string | null;
  status: ImportStatus;
  note: string | null;
}
export interface SourceImportNode {
  documentId: string;
  sourceName: string;
  path: string;
  imports: ScarpSourceImport[];
  incomplete: boolean;
}
export interface SourceImportGraph {
  nodes: SourceImportNode[];
  edges: ScarpSourceImport[];
  cycles: string[][];
  limited: boolean;
  summary: Record<ImportStatus, number>;
}
interface RawImport {
  specifier: string | null;
  alias: string | null;
  offset: number;
  line: number;
  column: number;
  recognized: boolean;
}

function validSpecifier(path: string): boolean {
  if (!path || path.length > MAX_IMPORT_PATH_UNITS ||
      path.startsWith('/') || path.startsWith('\\') ||
      path.includes('\\') || path.includes(':') ||
      /[\x00-\x1f\x7f]/.test(path)) return false;
  const segments = path.split('/');
  if (segments.length > 6) return false;
  if (segments.some(part => !part || part === '.' || part === '..' ||
      part.startsWith('.') || !/^[A-Za-z_0-9.-]+$/.test(part))) return false;
  return /\.srp$/i.test(segments[segments.length - 1]);
}

/** Computes a safe display-relative name only; it is never read or opened
 * until a separate exact membership check provides the original native path.
 */
export function expectedListedImportName(sourceName: string, specifier: string): string | null {
  if (!safeRelativeScarpSourceName(sourceName) || !validSpecifier(specifier)) return null;
  const last = sourceName.lastIndexOf('/');
  const candidate = (last < 0 ? '' : sourceName.slice(0, last + 1)) + specifier;
  return safeRelativeScarpSourceName(candidate) ? candidate : null;
}

function literalPath(token: InsightToken | undefined): string | null {
  if (!token || token.kind !== 'string' || token.previewTruncated ||
      !token.text.startsWith('"') || !token.text.endsWith('"')) return null;
  const path = token.text.slice(1, -1);
  return path.includes('\\') ? null : path;
}
function validAlias(token: InsightToken | undefined): boolean {
  return !!token && token.kind === 'identifier' &&
    /^[A-Za-z_][A-Za-z_0-9]*$/.test(token.text);
}

/** Only literal imports with an 'as' identifier are considered navigable.
 * Nonstandard or incomplete syntax is labelled but never followed.
 */
export function collectScarpRawImports(source: string): {
  references: RawImport[];
  incomplete: boolean;
} {
  const lex = scanScarpSource(source);
  if (!lex.complete || lex.issues.length) return { references: [], incomplete: true };
  const tokens = lex.tokens.filter(token => token.kind !== 'comment');
  const references: RawImport[] = [];
  for (let i = 0; i < tokens.length && references.length < MAX_IMPORTS_PER_SOURCE; i++) {
    const first = tokens[i];
    if (first.kind !== 'identifier' || first.text !== 'import') continue;
    const path = literalPath(tokens[i + 1]);
    const asKeyword = tokens[i + 2];
    const aliasToken = tokens[i + 3];
    const alias = validAlias(aliasToken) ? aliasToken!.text : null;
    const recognized = path !== null && asKeyword?.text === 'as' &&
      asKeyword.kind === 'identifier' && alias !== null && tokens[i + 4]?.text === ';';
    references.push({
      specifier: path,
      alias: recognized ? alias : null,
      offset: first.start,
      line: first.line,
      column: first.column,
      recognized,
    });
    if (recognized) i += 3;
  }
  return {
    references,
    incomplete: !lex.complete || references.length >= MAX_IMPORTS_PER_SOURCE,
  };
}

function listedDocument(
  document: StudioDocument,
  listing: readonly ListedImportSource[],
): ListedImportSource | null {
  if (!document.path) return null;
  return listing.find(source =>
    safeRelativeScarpSourceName(source.name) && isScarpPath(source.path) &&
    sameFilePath(source.path, document.path!)) ?? null;
}
function resolveImport(
  doc: StudioDocument, source: ListedImportSource, raw: RawImport,
  listing: readonly ListedImportSource[], documents: readonly StudioDocument[],
): ScarpSourceImport {
  const name = raw.recognized && raw.specifier
    ? expectedListedImportName(source.name, raw.specifier) : null;
  const targets = name ? listing.filter(item =>
    item.name === name && safeRelativeScarpSourceName(item.name)) : [];
  let status: ImportStatus = 'unrecognized', note: string | null = null;
  let targetPath: string | null = null, targetDocumentId: string | null = null;
  if (!raw.recognized) {
    note = 'Only literal import paths followed by an as alias are indexed.';
  } else if (!name) {
    status = 'unsafe';
    note = 'Unsupported or unsafe import specifier; no path was resolved.';
  } else if (targets.length > 1) {
    status = 'ambiguous';
    note = 'Several listed sources have this name.';
  } else if (!targets.length) {
    status = 'missing';
    note = 'Target is not in the current bounded Explorer listing.';
  } else {
    targetPath = targets[0].path;
    if (sameFilePath(doc.path!, targetPath)) {
      status = 'self';
      note = 'The import points to the current source.';
    } else {
      const open = documents.find(item => item.path &&
        sameFilePath(item.path, targetPath!));
      targetDocumentId = open?.id ?? null;
      status = open ? 'open' : 'listed';
    }
  }
  return {
    id: doc.id + ':import:' + raw.offset,
    documentId: doc.id,
    documentRevision: doc.revision,
    sourcePath: doc.path!,
    sourceName: source.name,
    specifier: raw.specifier ?? '(unrecognized)',
    alias: raw.alias,
    line: raw.line,
    column: raw.column,
    offset: raw.offset,
    targetRelativeName: name,
    targetPath,
    targetDocumentId,
    status,
    note,
  };
}

/** Detect cycles only between already-open buffers (no disk reads).
 * Iterative DFS bounds call stack depth; cycles are review hints only.
 */
function openBufferCycles(nodes: readonly SourceImportNode[]): string[][] {
  const byId = new Map(nodes.map(n => [n.documentId, n]));
  const state = new Map<string, 0 | 1 | 2>();
  const cycles: string[][] = [], seen = new Set<string>();
  for (const node of nodes) {
    if (state.get(node.documentId)) continue;
    const stack: { id: string; next: number; targets: string[] }[] = [];
    const push = (id: string): void => {
      const current = byId.get(id);
      if (!current) return;
      state.set(id, 1);
      stack.push({
        id, next: 0,
        targets: current.imports.filter(e => e.status === 'open' &&
          e.targetDocumentId !== null).map(e => e.targetDocumentId!),
      });
    };
    push(node.documentId);
    while (stack.length && cycles.length < MAX_IMPORT_GRAPH_CYCLES) {
      const frame = stack[stack.length - 1];
      if (frame.next >= frame.targets.length) {
        state.set(frame.id, 2);
        stack.pop();
        continue;
      }
      const next = frame.targets[frame.next++];
      if (!byId.has(next)) continue;
      if (!state.get(next)) {
        push(next);
        continue;
      }
      if (state.get(next) === 1) {
        const index = stack.findIndex(item => item.id === next);
        if (index < 0) continue;
        const cycle = stack.slice(index).map(item => item.id);
        if (cycle.length < 2) continue;
        const fingerprint = [...cycle].sort().join('\0');
        if (!seen.has(fingerprint)) {
          seen.add(fingerprint);
          cycles.push([...cycle, next]);
        }
      }
    }
  }
  return cycles;
}

export function buildScarpImportGraph(
  documents: readonly StudioDocument[],
  currentListing: readonly ListedImportSource[],
): SourceImportGraph {
  const listing = currentListing.slice(0, MAX_IMPORT_GRAPH_SOURCES)
    .filter(entry => safeRelativeScarpSourceName(entry.name) &&
      isScarpPath(entry.path));
  const nodes: SourceImportNode[] = [], edges: ScarpSourceImport[] = [];
  let limited = currentListing.length > MAX_IMPORT_GRAPH_SOURCES ||
    documents.length > MAX_IMPORT_GRAPH_SOURCES;
  let units = 0;
  for (const document of documents.slice(0, MAX_IMPORT_GRAPH_SOURCES)) {
    const listed = listedDocument(document, listing);
    if (!listed) continue;
    if (units + document.content.length > MAX_IMPORT_GRAPH_SOURCE_UNITS || edges.length >= MAX_IMPORT_GRAPH_EDGES) {
      limited = true;
      continue;
    }
    units += document.content.length;
    const raw = collectScarpRawImports(document.content);
    limited ||= raw.incomplete;
    const imports: ScarpSourceImport[] = [];
    for (const reference of raw.references) {
      if (edges.length >= MAX_IMPORT_GRAPH_EDGES) {
        limited = true;
        break;
      }
      const edge = resolveImport(document, listed, reference, listing, documents);
      imports.push(edge);
      edges.push(edge);
    }
    nodes.push({
      documentId: document.id,
      sourceName: listed.name,
      path: listed.path,
      imports, incomplete: raw.incomplete || imports.length < raw.references.length,
    });
  }
  const summary: Record<ImportStatus, number> = {
    open: 0, listed: 0, missing: 0, unsafe: 0,
    unrecognized: 0, self: 0, ambiguous: 0,
  };
  for (const edge of edges) summary[edge.status]++;
  const cycles = openBufferCycles(nodes);
  if (cycles.length >= MAX_IMPORT_GRAPH_CYCLES) limited = true;
  return { nodes, edges, cycles, limited, summary };
}

/** Navigation is permitted only through an unchanged listed source entry,
 * followed by Studio's independently guarded Explorer source opener.
 */
export function listedImportNavigationTarget(
  edge: ScarpSourceImport, listing: readonly ListedImportSource[],
): string | null {
  if (edge.status !== 'open' && edge.status !== 'listed') return null;
  if (!edge.targetPath || !edge.targetRelativeName) return null;
  const matches = listing.filter(item => item.name === edge.targetRelativeName &&
    safeRelativeScarpSourceName(item.name) && isScarpPath(item.path));
  if (matches.length !== 1 || !sameFilePath(matches[0].path, edge.targetPath)) return null;
  return matches[0].path;
}


/** A click must refer to the exact current source generation and the same
 * recognizable import header. The compiler's own resolution is not inferred. */
export function currentImportNavigationTarget(edge: ScarpSourceImport,
  documents: readonly StudioDocument[], listing: readonly ListedImportSource[]): string | null {
  const document = documents.find(item => item.id === edge.documentId);
  if (!document || document.revision !== edge.documentRevision || !document.path ||
      !sameFilePath(document.path, edge.sourcePath)) return null;
  const source = listedDocument(document, listing);
  if (!source || source.name !== edge.sourceName) return null;
  const scan = collectScarpRawImports(document.content);
  if (scan.incomplete) return null;
  const raw = scan.references.find(item => item.offset === edge.offset && item.line === edge.line &&
    item.column === edge.column && item.recognized && item.specifier === edge.specifier && item.alias === edge.alias);
  if (!raw) return null;
  const current = resolveImport(document, source, raw, listing, documents);
  if (current.targetRelativeName !== edge.targetRelativeName || !current.targetPath || !edge.targetPath ||
      !sameFilePath(current.targetPath, edge.targetPath)) return null;
  return listedImportNavigationTarget(current, listing);
}
