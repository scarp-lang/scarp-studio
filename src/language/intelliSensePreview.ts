import type { IntelliSensePreferences } from '../model/intelliSensePreferences';
import { LocalSourceAnalysis } from './localAnalysis';
import { canCompleteLocalFunction } from './localCompletion';
import { collectScarpSuggestions } from './suggestionPipeline';
import { completionMatchRank, lineCompletionContext } from './completionMatching';
import { scarpTokenHelp } from './assist';

const header = 'funcra add(a: integer, b: integer) -> integer { return a + b; }\n';
const mixedHeader = 'funcra print_total(value: integer) -> integer { return value; }\n';
type PreviewKind = 'completion' | 'hover' | 'signature' | 'definition' | 'symbols';
interface PreviewExample {
  readonly id: string;
  readonly title: string;
  readonly kind: PreviewKind;
  readonly marked: string;
  readonly prefix?: string;
}
export const INTELLISENSE_EXAMPLES = [
  { id: 'templates', title: 'Statement templates', kind: 'completion', marked: 'func|', prefix: 'func' },
  { id: 'builtins', title: 'BigInt built-in functions', kind: 'completion', marked: 'bigint_|', prefix: 'bigint_' },
  { id: 'types', title: 'Type names', kind: 'completion', marked: 'int|', prefix: 'int' },
  { id: 'local', title: 'Local function completion', kind: 'completion', marked: header + 'ad|d(1, 2);', prefix: 'ad' },
  { id: 'priority', title: 'Local and catalog priority', kind: 'completion', marked: mixedHeader + 'pri|', prefix: 'pri' },
  { id: 'abbreviation', title: 'Ordered-character abbreviation', kind: 'completion', marked: 'bgpw|', prefix: 'bgpw' },
  { id: 'qualified', title: 'Qualified name context', kind: 'completion', marked: 'module.pri|', prefix: 'pri' },
  { id: 'existing-call', title: 'Complete an existing call', kind: 'completion', marked: 'pri|nt(42);', prefix: 'pri' },
  { id: 'catalog-hover', title: 'Built-in hover documentation', kind: 'hover', marked: 'pri|nt(42);' },
  { id: 'local-hover', title: 'Local function hover', kind: 'hover', marked: header + 'a|dd(1, 2);' },
  { id: 'signature', title: 'Parameter hints', kind: 'signature', marked: header + 'add(1, |2);' },
  { id: 'definition', title: 'Go to Definition', kind: 'definition', marked: header + 'a|dd(1, 2);' },
  { id: 'symbols', title: 'Document symbols', kind: 'symbols', marked: header + 'record Point { x: integer }\n|' },
] as const satisfies readonly PreviewExample[];

export type PreviewId = (typeof INTELLISENSE_EXAMPLES)[number]['id'];
export interface PreviewResult {
  label: string;
  kind: string;
  detail: string;
  insertion?: string;
  asSnippet?: boolean;
}
export interface IntelliSensePreview {
  before: string;
  after: string;
  kind: PreviewKind;
  results: PreviewResult[];
  explanation: string;
}
function identifierAt(source: string, offset: number): string | null {
  let start = offset;
  let end = offset;
  while (start > 0 && /[A-Za-z_0-9]/.test(source[start - 1])) start--;
  while (end < source.length && /[A-Za-z_0-9]/.test(source[end])) end++;
  return start < end ? source.slice(start, end) : null;
}

/** Built-in, non-editable examples only. Never accept arbitrary workspace
 * text or copy a live Monaco model into the Settings component. */
export function evaluateIntelliSensePreview(id: PreviewId, settings: Readonly<IntelliSensePreferences>): IntelliSensePreview {
  const example: PreviewExample = INTELLISENSE_EXAMPLES.find(item => item.id === id) ?? INTELLISENSE_EXAMPLES[0];
  const offset = example.marked.indexOf('|');
  const before = example.marked.slice(0, offset);
  const after = example.marked.slice(offset + 1);
  const source = before + after;
  const result: IntelliSensePreview = { before, after, kind: example.kind, results: [], explanation: '' };
  const allowed = source.length <= settings.localAnalysisKiB * 1024;
  let analysis: LocalSourceAnalysis | undefined;
  const local = () => allowed ? analysis ??= new LocalSourceAnalysis(source) : null;
  if (example.kind === 'completion') {
    const prefix = example.prefix ?? '';
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineEnd = source.indexOf('\n', offset);
    const line = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
    const start = offset - prefix.length;
    let end = offset;
    while (end < source.length && /[A-Za-z_0-9]/.test(source[end])) end++;
    const rank = (name: string, needle: string) => completionMatchRank(name, needle, settings.matchingMode);
    const items = collectScarpSuggestions(settings, prefix, exclude => {
      if (!canCompleteLocalFunction(line, start - lineStart, prefix)) return [];
      return local()?.complete(start, end, prefix, exclude, (name, needle) => Number.isFinite(rank(name, needle)),
        settings.matchingMode === 'subsequence' ? rank : undefined) ?? [];
    }, lineCompletionContext(line, start - lineStart), source.slice(end, lineEnd < 0 ? source.length : lineEnd));
    result.results = items.map(item => ({ label: item.label, kind: item.source + ' · ' + item.kind, detail: item.detail,
      insertion: item.insertText, asSnippet: item.asSnippet }));
    result.explanation = settings.completionMode === 'off' ? 'Scarp completion is off.' :
      settings.completionMode === 'manual' ? 'Simulates explicit Ctrl+Space completion. Monaco word suggestions are not included.' :
        'Simulates the Scarp completion provider. Monaco word suggestions and trigger timing are not included.';
    return result;
  }
  if (example.kind === 'hover') {
    if (!settings.hover) { result.explanation = 'Hover is disabled.'; return result; }
    const name = identifierAt(source, offset);
    const catalog = name && scarpTokenHelp(name);
    if (catalog) result.results.push({ label: catalog.label, kind: 'catalog', detail: catalog.documentation });
    else if (settings.localFunctionHover) {
      const hover = local()?.hover(offset);
      if (hover) result.results.push({ label: hover.label, kind: 'local function', detail: 'Declaration at line ' + hover.line });
    }
    result.explanation = 'Editor-only hover information; not a compiler-resolved type.';
    return result;
  }
  if (example.kind === 'signature') {
    if (!settings.signatureHelp) { result.explanation = 'Parameter hints are disabled.'; return result; }
    const signature = local()?.signature(offset);
    if (signature) result.results.push({ label: signature.label, kind: 'signature',
      detail: 'Active parameter: ' + (signature.parameters[signature.activeParameter] ?? '(none)') });
    result.explanation = 'Typed parameters from the same-file declaration.';
    return result;
  }
  if (example.kind === 'definition') {
    if (!settings.goToDefinition) { result.explanation = 'Go to Definition is disabled.'; return result; }
    const definition = local()?.definition(offset);
    if (definition) result.results.push({ label: definition.name, kind: 'definition',
      detail: 'Line ' + definition.line + ', column ' + definition.startColumn });
    result.explanation = 'Local declaration target only; imported functions are not resolved.';
    return result;
  }
  if (!settings.documentSymbols) { result.explanation = 'Monaco document symbols are disabled.'; return result; }
  result.results = (local()?.symbols() ?? []).map(symbol => ({
    label: symbol.name, kind: symbol.kind, detail: 'Line ' + symbol.line + ', column ' + symbol.startColumn,
  }));
  result.explanation = 'Monaco document symbols; Studio sidebar outline is independent.';
  return result;
}
