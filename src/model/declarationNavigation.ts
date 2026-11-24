import type { ScarpOutlineSymbol } from '../language/assist';
import { MAX_SCARP_OUTLINE_SYMBOLS } from '../language/assist';
import type { StudioDocument } from './documents';
import type { NavigationEntry } from './navigation';

/** A selection is tied to the active editor snapshot, not a disk path.
 * No filesystem reads, compiler execution or implicit source changes.
 */
export interface DeclarationEntry extends NavigationEntry {
  documentId: string;
  revision: number;
  source: string;
  symbol: ScarpOutlineSymbol;
}

export function buildDeclarationEntries(
  document: StudioDocument | null | undefined,
  symbols: readonly ScarpOutlineSymbol[],
): DeclarationEntry[] {
  if (!document) return [];
  return symbols.slice(0, MAX_SCARP_OUTLINE_SYMBOLS).map((symbol) => ({
    id: 'declaration:' + document.id + ':' + symbol.line + ':' + symbol.startColumn,
    label: symbol.name,
    detail: symbol.kind + ' · line ' + symbol.line + ' · ' + document.name,
    documentId: document.id,
    revision: document.revision,
    source: document.content,
    symbol,
  }));
}

export function isCurrentDeclarationEntry(
  document: StudioDocument | null | undefined,
  entry: DeclarationEntry,
): boolean {
  return !!document && document.id === entry.documentId &&
    document.revision === entry.revision && document.content === entry.source;
}
