import { DEFAULT_INTELLISENSE_PREFERENCES as defaults, type IntelliSensePreferences } from './intelliSensePreferences';

export const MAX_INTELLISENSE_SEARCH_UNITS = 120;
export type IntelliSenseControlGroup = 'completion' | 'sources' | 'navigation' | 'performance';
interface ControlEntry {
  label: string;
  group: IntelliSenseControlGroup;
  aliases: string;
}
type Key = keyof IntelliSensePreferences;
export const INTELLISENSE_CONTROL_INDEX: Readonly<Record<Key, ControlEntry>> = {
  completionMode: { label: 'Completion mode', group: 'completion', aliases: 'autocomplete automatic manual popup ctrl space off trigger' },
  matchingMode: { label: 'Completion matching', group: 'completion', aliases: 'prefix subsequence ordered characters abbreviation fuzzy' },
  conservativeCatalog: { label: 'Context-aware catalog suggestions', group: 'sources', aliases: 'qualified module declaration suppress context multiline' },
  templates: { label: 'Statement templates', group: 'sources', aliases: 'snippets insertion code blocks' },
  builtins: { label: 'Built-in functions', group: 'sources', aliases: 'builtin intrinsic catalog function suggestions' },
  keywordsAndTypes: { label: 'Keywords and types', group: 'sources', aliases: 'reserved words language type names' },
  localFunctions: { label: 'Local function declarations', group: 'sources', aliases: 'same file local completion callable' },
  documentWords: { label: 'Words from current document', group: 'sources', aliases: 'word based text monaco suggestions' },
  preferLocal: { label: 'Prefer local functions', group: 'sources', aliases: 'priority ranking order local declaration' },
  suggestionDelay: { label: 'Automatic delay', group: 'completion', aliases: 'typing wait latency milliseconds popup completion' },
  suggestionLimit: { label: 'Scarp result limit', group: 'completion', aliases: 'maximum suggestions count result cap' },
  hover: { label: 'Hover documentation', group: 'navigation', aliases: 'mouse tooltip help' },
  localFunctionHover: { label: 'Local function hover', group: 'navigation', aliases: 'same file typed signature tooltip' },
  hoverDelay: { label: 'Hover delay', group: 'navigation', aliases: 'mouse tooltip wait latency milliseconds' },
  signatureHelp: { label: 'Function parameter hints', group: 'navigation', aliases: 'popup active argument signature local' },
  builtinSignatureHelp: { label: 'Built-in parameter hints', group: 'navigation', aliases: 'builtin intrinsic catalog arguments signature popup' },
  inlayHintMode: { label: 'Inline parameter labels', group: 'navigation', aliases: 'inlay argument hints literal all decoration' },
  inlayBuiltins: { label: 'Inline built-in labels', group: 'navigation', aliases: 'inlay builtin intrinsic catalog argument decoration' },
  goToDefinition: { label: 'Go to Definition', group: 'navigation', aliases: 'f12 jump declaration location navigation' },
  documentSymbols: { label: 'Monaco document symbols', group: 'navigation', aliases: 'outline function record variant navigation' },
  localAnalysisKiB: { label: 'Maximum analyzed source size', group: 'performance', aliases: 'budget limit memory performance large file utf16' },
  acceptOnEnter: { label: 'Accept using Enter', group: 'completion', aliases: 'keyboard acceptance return smart never always' },
  tabCompletion: { label: 'Tab completion', group: 'completion', aliases: 'keyboard acceptance snippet' },
};
const keys = Object.keys(INTELLISENSE_CONTROL_INDEX) as Key[];
export function matchIntelliSenseControls(preferences: Readonly<IntelliSensePreferences>, query: string,
  modifiedOnly = false): Key[] {
  const terms = query.slice(0, MAX_INTELLISENSE_SEARCH_UNITS).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return keys.filter(key => {
    if (modifiedOnly && preferences[key] === defaults[key]) return false;
    const item = INTELLISENSE_CONTROL_INDEX[key];
    const searchable = (item.label + ' ' + item.aliases + ' ' + item.group).toLowerCase();
    return terms.every(term => searchable.includes(term));
  });
}
/** The individual reset is an allowlisted one-key patch, never a whole
 * preference replacement and never a reset of saved profiles or source data. */
export function resetIntelliSensePreference<K extends Key>(key: K): Pick<IntelliSensePreferences, K> {
  return { [key]: defaults[key] } as Pick<IntelliSensePreferences, K>;
}
