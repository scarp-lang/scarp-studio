import { allowsCatalogKind, type IntelliSensePreferences } from '../model/intelliSensePreferences';
import { scarpCompletions, MAX_COMPLETION_PREFIX_UNITS, type ScarpCompletion } from './assist';
import type { LocalFunctionCompletion } from './localCompletion';

export interface PlannedScarpSuggestion {
  label: string;
  kind: ScarpCompletion['kind'];
  source: 'local' | 'catalog';
  insertText: string;
  detail: string;
  documentation: string;
  sortText: string;
}
export function scarpCompletionEnabled(settings: Readonly<IntelliSensePreferences>): boolean {
  return settings.completionMode !== 'off' &&
    (settings.localFunctions || settings.builtins || settings.templates || settings.keywordsAndTypes);
}

/** Shared suggestion policy for the Monaco adapter and Settings sample preview.
 * The caller owns source context and lazy local analysis. No disk or model
 * access is performed by this function. */
export function collectScarpSuggestions(settings: Readonly<IntelliSensePreferences>, prefix: string,
  resolveLocal: (exclude: ReadonlySet<string>) => readonly LocalFunctionCompletion[] = () => []):
  PlannedScarpSuggestion[] {
  if (!scarpCompletionEnabled(settings) || prefix.length > MAX_COMPLETION_PREFIX_UNITS) return [];
  const catalog = scarpCompletions(prefix, item => allowsCatalogKind(settings, item.kind));
  const excluded = new Set(catalog.map(item => item.label));
  const local = settings.localFunctions ? resolveLocal(excluded) : [];
  const localItems: PlannedScarpSuggestion[] = local.map(item => ({
    label: item.name, kind: 'function', source: 'local', insertText: item.name,
    detail: item.detail, documentation: 'Local Scarp function declaration (editor-only).',
    sortText: (settings.preferLocal ? '0_' : '1_') + item.name,
  }));
  const catalogItems: PlannedScarpSuggestion[] = catalog.map(item => ({
    label: item.label, kind: item.kind, source: 'catalog', insertText: item.insertText,
    detail: item.detail, documentation: item.documentation,
    sortText: (settings.preferLocal ? '1_' : '0_') + item.label,
  }));
  return (settings.preferLocal ? [...localItems, ...catalogItems] : [...catalogItems, ...localItems])
    .slice(0, settings.suggestionLimit);
}
