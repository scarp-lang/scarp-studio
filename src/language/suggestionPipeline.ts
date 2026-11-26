import type { PreparedUserSnippet } from '../model/userSnippets';
import { allowsCatalogKind, type IntelliSensePreferences } from '../model/intelliSensePreferences';
import { scarpCompletions, MAX_COMPLETION_PREFIX_UNITS, type ScarpCompletion } from './assist';
import type { LocalFunctionCompletion } from './localCompletion';
import { completionMatchRank, type CompletionContext } from './completionMatching';
import { planCatalogInsertion } from './completionInsertion';

export interface PlannedScarpSuggestion {
  label: string;
  kind: ScarpCompletion['kind'];
  source: 'local' | 'catalog' | 'user';
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
  userSnippets: readonly PreparedUserSnippet[] = [],
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
  const occupied = new Set([...localItems, ...catalogItems].map(item => item.label.toLowerCase()));
  const custom: PlannedScarpSuggestion[] = settings.templates && context === 'unqualified' && prefix.length > 0 &&
    !following.trimStart().startsWith('(') ? userSnippets.filter(item => item.enabled && !occupied.has(item.prefix.toLowerCase()) &&
      Number.isFinite(rank(item.prefix.toLowerCase(), prefix.toLowerCase()))).map(item => ({
        label: item.prefix, kind: 'snippet', source: 'user', insertText: item.compiled.insertText,
        asSnippet: item.compiled.asSnippet, detail: 'User snippet · ' + item.name,
        documentation: item.description, sortText: '2_' + String(rank(item.prefix.toLowerCase(), prefix.toLowerCase())).padStart(6, '0') + '_' + item.prefix,
      })).sort((a,b) => a.sortText < b.sortText ? -1 : a.sortText > b.sortText ? 1 : 0) : [];
  // An exact user prefix receives a slot even when the catalog is large.
  // Otherwise keep the configured local/catalog priority and bounded cap.
  const exact = custom.filter(item => item.label.toLowerCase() === prefix.toLowerCase());
  const partial = custom.filter(item => !exact.includes(item));
  const standard = settings.preferLocal ? [...localItems, ...catalogItems] : [...catalogItems, ...localItems];
  return [...exact.map(item => ({ ...item, sortText: '-1_' + item.label })), ...standard, ...partial].slice(0, settings.suggestionLimit);
}
