import { allowsCatalogKind, type IntelliSensePreferences } from '../model/intelliSensePreferences';
import { scarpCompletions, MAX_COMPLETION_PREFIX_UNITS, type ScarpCompletion } from './assist';
import type { LocalFunctionCompletion } from './localCompletion';
import { completionMatchRank, type CompletionContext } from './completionMatching';
import { planCatalogInsertion } from './completionInsertion';

export interface PlannedScarpSuggestion {
  label: string;
  kind: ScarpCompletion['kind'];
  source: 'local' | 'catalog';
  insertText: string;
  detail: string;
  documentation: string;
  sortText: string;
  asSnippet: boolean;
}
export function scarpCompletionEnabled(settings: Readonly<IntelliSensePreferences>): boolean {
  return settings.completionMode !== 'off' &&
    (settings.localFunctions || settings.builtins || settings.templates || settings.keywordsAndTypes);
}

/** Shared suggestion policy for the Monaco adapter and Settings sample preview.
 * The caller owns source context and lazy local analysis. No disk or model
 * access is performed by this function. */
export function collectScarpSuggestions(settings: Readonly<IntelliSensePreferences>, prefix: string,
  resolveLocal: (exclude: ReadonlySet<string>) => readonly LocalFunctionCompletion[] = () => [],
  context: CompletionContext = 'unqualified',
  following = '',
):
  PlannedScarpSuggestion[] {
  if (!scarpCompletionEnabled(settings) || prefix.length > MAX_COMPLETION_PREFIX_UNITS) return [];
  const mode = settings.matchingMode;
  const rank = (label: string, needle: string) => completionMatchRank(label, needle, mode);
  const catalog = settings.conservativeCatalog && context === 'blocked' ? [] : scarpCompletions(prefix,
    item => allowsCatalogKind(settings, item.kind), (label, needle) => Number.isFinite(rank(label, needle)),
    mode === 'subsequence' ? rank : undefined);
  const excluded = new Set(catalog.map(item => item.label));
  const local = settings.localFunctions && context !== 'blocked' ? resolveLocal(excluded) : [];
  const localItems: PlannedScarpSuggestion[] = local.map(item => ({
    label: item.name, kind: 'function', source: 'local', insertText: item.name, asSnippet: false,
    detail: item.detail, documentation: 'Local Scarp function declaration (editor-only).',
    sortText: (settings.preferLocal ? '0_' : '1_') + (mode === 'subsequence' ? String(rank(item.name, prefix)).padStart(6, '0') + '_' : '') + item.name,
  }));
  const catalogItems: PlannedScarpSuggestion[] = catalog.map(item => ({
    label: item.label, kind: item.kind, source: 'catalog', ...planCatalogInsertion(item, following),
    detail: item.detail, documentation: item.documentation,
    sortText: (settings.preferLocal ? '1_' : '0_') + (mode === 'subsequence' ? String(rank(item.label.toLowerCase(), prefix.trim().toLowerCase())).padStart(6, '0') + '_' : '') + item.label,
  }));
  return (settings.preferLocal ? [...localItems, ...catalogItems] : [...catalogItems, ...localItems])
    .slice(0, settings.suggestionLimit);
}
