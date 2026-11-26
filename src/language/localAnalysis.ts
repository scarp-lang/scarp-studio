import { scanScarpOutlineSymbols, type ScarpFunctionSymbol, type ScarpOutlineSymbol } from './assist';
import { indexLocalFunctionHeaders, MAX_DEFINITION_SOURCE_UNITS, scarpCallNameFromLexical, type LocalFunctionHeader } from './definition';
import { canCompleteLocalFunctionAtOffset, completeLocalFunctions, type LocalFunctionCompletion } from './localCompletion';
import { localSignatureAt, readLocalParameters, type LocalSignature } from './signature';
import { scanScarpSource, type SourceLexResult } from './sourceLex';

/** One exact immutable source string, with independently lazy lexical and
 * declaration inventories. No disk access, cross-file resolution or compiler
 * invocation. Never expose mutable cached arrays to provider consumers. */
export class LocalSourceAnalysis {
  private lexical: SourceLexResult | undefined;
  private headers: LocalFunctionHeader[] | null | undefined;
  private readonly parameterCache = new Map<number, readonly string[] | null>();
  private outline: ScarpOutlineSymbol[] | undefined;

  constructor(private readonly source: string) {}

  private scan = (): SourceLexResult => {
    return this.lexical ??= scanScarpSource(this.source);
  };
  private index = (): readonly LocalFunctionHeader[] | null => {
    if (this.headers === undefined) this.headers = indexLocalFunctionHeaders(this.source, this.scan);
    return this.headers;
  };
  private parameters = (offset: number): readonly string[] | null => {
    if (this.parameterCache.has(offset)) return this.parameterCache.get(offset) ?? null;
    const labels = readLocalParameters(this.source, offset);
    // Only declaration offsets obtained from the bounded header inventory
    // reach this method; its maximum cardinality is the header inventory cap.
    this.parameterCache.set(offset, labels ? Object.freeze(labels) : null);
    return this.parameterCache.get(offset) ?? null;
  };
  private headerAt(offset: number): LocalFunctionHeader | null {
    const name = scarpCallNameFromLexical(this.source, offset, this.scan);
    if (!name) return null;
    const matches = this.index()?.filter(header => header.name === name);
    return matches?.length === 1 ? matches[0] : null;
  }
  complete(start: number, end: number, prefix: string, exclude: ReadonlySet<string>,
    matches?: (name: string, prefix: string) => boolean, rank?: (name: string, prefix: string) => number,
  ): LocalFunctionCompletion[] {
    if (!canCompleteLocalFunctionAtOffset(this.source, start, end, prefix, this.scan)) return [];
    return completeLocalFunctions(this.source, prefix, exclude, this.index, this.parameters, matches, rank);
  }
  definition(offset: number): ScarpFunctionSymbol | null {
    const header = this.headerAt(offset);
    if (!header) return null;
    const { openOffset: _openOffset, ...symbol } = header;
    return symbol;
  }
  hover(offset: number): { label: string; line: number } | null {
    const header = this.headerAt(offset);
    if (!header) return null;
    const labels = this.parameters(header.openOffset);
    if (!labels) return null;
    return { label: header.name + '(' + labels.join(', ') + ')', line: header.line };
  }
  signature(offset: number): LocalSignature | null {
    return localSignatureAt(this.source, offset, this.index, this.parameters);
  }
  symbols(): ScarpOutlineSymbol[] {
    if (this.source.length > MAX_DEFINITION_SOURCE_UNITS) return [];
    this.outline ??= scanScarpOutlineSymbols(this.source);
    return this.outline.map(symbol => ({ ...symbol }));
  }
}

export interface LocalAnalysisModel {
  getValueLength(): number;
  getValue(): string;
  getVersionId?(): number;
  isDisposed?(): boolean;
}
interface CacheEntry {
  model: WeakRef<LocalAnalysisModel>;
  version: number;
  length: number;
  analysis: LocalSourceAnalysis;
}

/** Deliberately retain at most one bounded source analysis per Monaco language
 * registration. Monaco's monotonic version changes for undo/redo as well as
 * edits, unlike alternative-version IDs. Never key by path or text length alone.
 * Models without revision information use an uncached snapshot. */
export class LocalAnalysisCache {
  private entry: CacheEntry | null = null;
  clear(): void { this.entry = null; }

  get(model: LocalAnalysisModel, budget: number): LocalSourceAnalysis | null {
    if (!Number.isSafeInteger(budget) || budget <= 0 || model.isDisposed?.()) {
      this.clear();
      return null;
    }
    const limit = Math.min(budget, MAX_DEFINITION_SOURCE_UNITS);
    const length = model.getValueLength();
    if (!Number.isSafeInteger(length) || length < 0 || length > limit) {
      this.clear();
      return null;
    }
    const version = model.getVersionId?.();
    const versioned = version !== undefined && Number.isSafeInteger(version) && version >= 1;
    const previous = this.entry;
    if (versioned && previous?.model.deref() === model &&
        previous.version === version && previous.length === length) return previous.analysis;
    this.clear();
    const source = model.getValue();
    if (source.length !== length || model.isDisposed?.() ||
        (versioned && model.getVersionId?.() !== version)) return null;
    const analysis = new LocalSourceAnalysis(source);
    if (versioned && version !== undefined) {
      this.entry = { model: new WeakRef(model), version, length, analysis };
    }
    return analysis;
  }
}
