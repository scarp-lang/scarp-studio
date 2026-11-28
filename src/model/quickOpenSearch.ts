import { MAX_NAVIGATION_QUERY_UNITS } from './navigation';
import type { QuickOpenEntry } from './projectQuickOpen';
import { EMPTY_QUICK_OPEN_RECENCY, quickOpenRecencyRanks, type QuickOpenRecency } from './quickOpenRecency';

export const QUICK_OPEN_RESULT_LIMIT = 40;
export const MAX_QUICK_OPEN_CANDIDATES = 1000;
export const QUICK_OPEN_SCOPES = ['all', 'open', 'recent', 'modified', 'untitled', 'listed', 'closed'] as const;
export type QuickOpenScope = typeof QUICK_OPEN_SCOPES[number];
export type QuickOpenMatchMode = 'fuzzy' | 'literal';
export const QUICK_OPEN_SCOPE_LABELS: Readonly<Record<QuickOpenScope, string>> = Object.freeze({
  all: 'All sources',
  open: 'Open tabs',
  recent: 'Recently active tabs',
  modified: 'Modified tabs',
  untitled: 'Untitled tabs',
  listed: 'Listed workspace sources',
  closed: 'Unopened listed sources',
});

export interface QuickOpenOptions {
  readonly scope: QuickOpenScope;
  readonly mode: QuickOpenMatchMode;
  readonly activeId: string | null;
  readonly recency?: QuickOpenRecency;
}
export const DEFAULT_QUICK_OPEN_OPTIONS: QuickOpenOptions = Object.freeze({
  scope: 'all', mode: 'fuzzy', activeId: null,
});

export interface QuickOpenMatch {
  readonly entry: QuickOpenEntry;
  readonly score: number;
  /** Positions are UTF-16 indices in the exact visible label. */
  readonly labelPositions: readonly number[];
  readonly match: 'exact' | 'prefix' | 'substring' | 'fuzzy' | 'path' | 'none';
}

export interface QuickOpenResults {
  readonly matches: readonly QuickOpenMatch[];
  readonly eligible: number;
  readonly matched: number;
  readonly inputLimited: boolean;
  readonly resultLimited: boolean;
  readonly invalidQuery: boolean;
}

interface Match {
  readonly score: number;
  readonly positions: readonly number[];
  readonly kind: QuickOpenMatch['match'];
}

const fold = (value: string) => value.toLowerCase().replace(/\\/g, '/');
const boundary = (value: string, index: number) =>
  index === 0 || /[\/._\-\s]/.test(value[index - 1]);

function positions(start: number, length: number): number[] {
  return Array.from({ length }, (_, index) => start + index);
}

/** A bounded linear subsequence scan from a candidate start. Prefer
 * consecutive letters, short gaps and word boundaries. No regex is built
 * from user input and the candidate length is limited before scoring. */
function fuzzyMatch(value: string, term: string): Match | null {
  // First find a complete subsequence, then walk backward from its last
  // character to remove leading gaps. Two bounded scans per candidate.
  let cursor = 0;
  let end = -1;
  for (const unit of term.split('')) {
    end = value.indexOf(unit, cursor);
    if (end < 0) return null;
    cursor = end + 1;
  }
  const found = new Array<number>(term.length);
  cursor = end;
  for (let index = term.length - 1; index >= 0; index--) {
    const position = value.lastIndexOf(term[index], cursor);
    if (position < 0) return null;
    found[index] = position;
    cursor = position - 1;
  }
  let adjacency = 0;
  let boundaries = 0;
  for (let index = 0; index < found.length; index++) {
    if (index > 0 && found[index] === found[index - 1] + 1) adjacency++;
    if (boundary(value, found[index])) boundaries++;
  }
  const gap = found[found.length - 1] - found[0] + 1 - found.length;
  const score = 100 + adjacency * 3 + boundaries * 5 - gap * 2 - found[0];
  return { score, positions: found, kind: 'fuzzy' };
}

function matchTerm(value: string, term: string, mode: QuickOpenMatchMode): Match | null {
  if (value === term) return { score: 1000, positions: positions(0, term.length), kind: 'exact' };
  if (value.startsWith(term)) return { score: 800, positions: positions(0, term.length), kind: 'prefix' };
  const offset = value.indexOf(term);
  if (offset >= 0) return {
    score: 600 + (boundary(value, offset) ? 30 : 0) - Math.min(offset, 100),
    positions: positions(offset, term.length), kind: 'substring',
  };
  // Path terms are explicit segments, not fuzzy subsequences across folders.
  if (mode === 'literal' || term.length < 2 || term.includes('/')) return null;
  return fuzzyMatch(value, term);
}

function basename(value: string): string {
  return value.slice(value.lastIndexOf('/') + 1);
}

function relativePath(entry: QuickOpenEntry): string | undefined {
  return entry.kind === 'project' ? entry.label : entry.relativeLabel;
}

function eligible(entry: QuickOpenEntry, scope: QuickOpenScope, recent: ReadonlyMap<string, number>): boolean {
  switch (scope) {
    case 'all': return true;
    case 'open': return entry.kind === 'tab';
    case 'recent': return entry.kind === 'tab' && recent.has(entry.documentId);
    case 'modified': return entry.kind === 'tab' && entry.modified === true;
    case 'untitled': return entry.kind === 'tab' && entry.path === null;
    case 'listed': return entry.kind === 'project' || entry.relativeLabel !== undefined;
    case 'closed': return entry.kind === 'project';
  }
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const kindPriority: Readonly<Record<QuickOpenMatch['match'], number>> = {
  exact: 0, prefix: 1, substring: 2, fuzzy: 3, path: 4, none: 5,
};

function scoreEntry(entry: QuickOpenEntry, terms: readonly string[], options: QuickOpenOptions): QuickOpenMatch | null {
  const active = entry.kind === 'tab' && entry.documentId === options.activeId;
  if (!terms.length) return {
    entry, score: active ? 2 : entry.kind === 'tab' ? 1 : 0, labelPositions: [], match: 'none',
  };
  const rawLabel = entry.label.slice(0, 1024);
  const label = fold(rawLabel);
  const base = basename(label);
  const baseOffset = label.length - base.length;
  const relative = fold((relativePath(entry) ?? '').slice(0, 1024));
  const path = fold((entry.kind === 'project' ? entry.sourcePath : entry.path ?? '').slice(0, 2048));
  const labelPositions = new Set<number>();
  let score = 0;
  let weakest: QuickOpenMatch['match'] = 'exact';
  for (const term of terms) {
    const optionsForTerm: Match[] = [];
    const labelMatch = matchTerm(label, term, options.mode);
    if (labelMatch) optionsForTerm.push(labelMatch);
    const nameMatch = matchTerm(base, term, options.mode);
    if (nameMatch) optionsForTerm.push({
      ...nameMatch, score: nameMatch.score + 40,
      positions: nameMatch.positions.map(position => position + baseOffset),
    });
    for (const [value, penalty] of [[relative, 80], [path, 160]] as const) {
      if (!value) continue;
      const found = matchTerm(value, term, 'literal');
      if (found) optionsForTerm.push({ score: found.score - penalty, positions: [], kind: 'path' });
    }
    if (!optionsForTerm.length) return null;
    optionsForTerm.sort((a, b) => b.score - a.score || kindPriority[a.kind] - kindPriority[b.kind]);
    const best = optionsForTerm[0];
    score += best.score;
    if (kindPriority[best.kind] > kindPriority[weakest]) weakest = best.kind;
    // Lowercasing can expand characters such as U+0130. Avoid applying
    // offsets to a different string shape and splitting grapheme pairs.
    if (rawLabel.length === label.length && rawLabel.length === entry.label.length) {
      for (const position of best.positions) {
        labelPositions.add(position);
        const unit = rawLabel.charCodeAt(position);
        if (unit >= 0xd800 && unit <= 0xdbff && position + 1 < rawLabel.length) labelPositions.add(position + 1);
        if (unit >= 0xdc00 && unit <= 0xdfff && position > 0) labelPositions.add(position - 1);
      }
    }
  }
  // Active/open state breaks close matches but cannot outrank an exact name
  // solely because that document happens to be active.
  score += active ? 2 : entry.kind === 'tab' ? 1 : 0;
  return { entry, score, labelPositions: [...labelPositions].sort((a, b) => a - b), match: weakest };
}

/** Search only the live Quick Open projection. No content or path is read;
 * invalid queries and missing scopes never fall back to broader results. */
export function searchQuickOpen(
  entries: readonly QuickOpenEntry[],
  query: string,
  options: QuickOpenOptions = DEFAULT_QUICK_OPEN_OPTIONS,
  limit = QUICK_OPEN_RESULT_LIMIT,
): QuickOpenResults {
  const invalidQuery = query.length > MAX_NAVIGATION_QUERY_UNITS || /[\x00-\x1f\x7f]/.test(query) ||
    !QUICK_OPEN_SCOPES.includes(options.scope) || !['fuzzy', 'literal'].includes(options.mode) ||
    !Number.isSafeInteger(limit) || limit < 1 || limit > QUICK_OPEN_RESULT_LIMIT;
  const inputLimited = entries.length > MAX_QUICK_OPEN_CANDIDATES;
  if (invalidQuery) return { matches: [], eligible: 0, matched: 0, inputLimited, resultLimited: false, invalidQuery };
  const terms = fold(query).trim().split(/\s+/).filter(Boolean);
  const recent = quickOpenRecencyRanks(options.recency ?? EMPTY_QUICK_OPEN_RECENCY);
  const candidates = entries.slice(0, MAX_QUICK_OPEN_CANDIDATES).filter(entry => eligible(entry, options.scope, recent));
  const ranked = candidates.flatMap((entry, index) => {
    const match = scoreEntry(entry, terms, options);
    return match ? [{ match, index }] : [];
  });
  const rank = (entry: QuickOpenEntry) => entry.kind === 'tab' ? recent.get(entry.documentId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
  ranked.sort((a, b) => b.match.score - a.match.score ||
    rank(a.match.entry) - rank(b.match.entry) ||
    (terms.length ? compareText(fold(a.match.entry.label), fold(b.match.entry.label)) : 0) || a.index - b.index);
  return {
    matches: ranked.slice(0, limit).map(item => item.match),
    eligible: candidates.length, matched: ranked.length,
    inputLimited, resultLimited: ranked.length > limit, invalidQuery: false,
  };
}

export interface QuickOpenLabelPart {
  readonly text: string;
  readonly matched: boolean;
}

/** Split a visible label into escaped React text segments, never HTML. */
export function quickOpenLabelParts(label: string, matchedPositions: readonly number[]): readonly QuickOpenLabelPart[] {
  const selected = new Set(matchedPositions);
  const parts: QuickOpenLabelPart[] = [];
  let start = 0;
  while (start < label.length) {
    const matched = selected.has(start);
    let end = start + 1;
    while (end < label.length && selected.has(end) === matched) end++;
    parts.push({ text: label.slice(start, end), matched });
    start = end;
  }
  return parts;
}
