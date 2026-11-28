import { type StudioDocument } from './documents';
import { searchOpenFiles, type SearchOptions } from './openFileSearch';
import { normalizeSearchPresetName, validateProjectSearchSettings } from './projectSearchPresets';
import { MAX_SCOPE_REPORT_UNITS } from './projectSearchScope';
import {
  prepareProjectInspection, confirmProjectInspection, readInspectionSnapshot, INSPECTION_READ_LIMITS,
  type InspectionSettings, type InspectionOrigin, type InspectionControl, type ProjectInspectionPlan,
} from './projectInspection';
import type { ProjectSearchSource } from './projectSearch';

export const MAX_VERIFICATION_RULES = 8;
export const VERIFICATION_EXPECTATIONS = ['present', 'absent', 'observe'] as const;
export type VerificationExpectation = typeof VERIFICATION_EXPECTATIONS[number];
export interface VerificationRule {
  readonly name: string;
  readonly query: string;
  readonly options: SearchOptions;
  readonly expectation: VerificationExpectation;
}
export type VerificationResult<T> = { readonly ok: true; readonly value: T } |
  { readonly ok: false; readonly error: string };
const fail = (error: string): VerificationResult<never> => ({ ok: false, error });

/** Names and literal queries are private settings, not executable code.
 * Preserve matching options and whitespace exactly. Rule identities are
 * unique within a reviewed run and never grant filesystem access.
 */
export function validateVerificationRules(input: readonly VerificationRule[],
  settings: InspectionSettings): VerificationResult<readonly VerificationRule[]> {
  if (!Array.isArray(input) || !input.length || input.length > MAX_VERIFICATION_RULES) {
    return fail('Add between one and eight verification rules.');
  }
  const names = new Set<string>();
  const rules: VerificationRule[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return fail('Verification rule is invalid.');
    const name = normalizeSearchPresetName(item.name);
    if (!name.ok) return name;
    const key = name.value.toLowerCase();
    if (names.has(key)) return fail('Verification rule names must be unique.');
    names.add(key);
    if (!VERIFICATION_EXPECTATIONS.includes(item.expectation)) return fail('Choose a supported rule expectation.');
    const validated = validateProjectSearchSettings({ query: item.query, options: item.options, scope: settings.scope });
    if (!validated.ok) return validated;
    rules.push(Object.freeze({
      name: name.value, query: validated.value.query, options: validated.value.options, expectation: item.expectation,
    }));
  }
  return { ok: true, value: Object.freeze(rules) };
}
function sameRule(a: VerificationRule, b: VerificationRule): boolean {
  return a.name === b.name && a.query === b.query && a.expectation === b.expectation &&
    a.options.caseSensitive === b.options.caseSensitive && a.options.wholeWord === b.options.wholeWord;
}
export interface ProjectVerificationPlan {
  readonly inspection: ProjectInspectionPlan;
  readonly rules: readonly VerificationRule[];
}
export function prepareProjectVerification(listed: readonly ProjectSearchSource[], settings: InspectionSettings,
  rules: readonly VerificationRule[]): VerificationResult<ProjectVerificationPlan> {
  const validated = validateVerificationRules(rules, settings);
  if (!validated.ok) return validated;
  const inspection = prepareProjectInspection(listed, settings);
  if (!inspection.ok) return inspection;
  return { ok: true, value: Object.freeze({ inspection: inspection.value, rules: validated.value }) };
}
export function confirmProjectVerification(plan: ProjectVerificationPlan, listed: readonly ProjectSearchSource[],
  settings: InspectionSettings, rules: readonly VerificationRule[]): VerificationResult<ProjectVerificationPlan> {
  const checked = validateVerificationRules(rules, settings);
  if (!checked.ok) return checked;
  if (checked.value.length !== plan.rules.length || checked.value.some((rule, index) => !sameRule(rule, plan.rules[index]))) {
    return fail('Verification rules changed. Review the run again.');
  }
  const inspection = confirmProjectInspection(plan.inspection, listed, settings);
  if (!inspection.ok) return inspection;
  return { ok: true, value: Object.freeze({ inspection: inspection.value, rules: checked.value }) };
}

export const VERIFICATION_FILE_STATES = ['scanned','partial','read-failed','byte-limit','ambiguous-buffer','not-observed'] as const;
export type VerificationFileState = typeof VERIFICATION_FILE_STATES[number];
export const VERIFICATION_FILE_LABELS: Readonly<Record<VerificationFileState,string>> = Object.freeze({
  scanned:'Fully searched', partial:'Partial search', 'read-failed':'Read unavailable',
  'byte-limit':'Byte budget', 'ambiguous-buffer':'Ambiguous working buffer', 'not-observed':'Not observed',
});
export type VerificationStatus = 'pass' | 'fail' | 'inconclusive' | 'observed';
export const VERIFICATION_STATUS_LABELS: Readonly<Record<VerificationStatus,string>> = Object.freeze({
  pass:'Expectation satisfied by evidence', fail:'Expectation contradicted by evidence',
  inconclusive:'Insufficient coverage', observed:'Observation only',
});
export const VERIFICATION_EXPECTATION_LABELS: Readonly<Record<VerificationExpectation,string>> = Object.freeze({
  present:'At least one match', absent:'No matches', observe:'Observe matches',
});
export interface VerificationFileEvidence {
  readonly name: string;
  readonly origin: InspectionOrigin;
  readonly state: VerificationFileState;
  readonly matches: number;
}
export interface VerificationRuleEvidence {
  readonly index: number;
  readonly name: string;
  readonly expectation: VerificationExpectation;
  readonly status: VerificationStatus;
  readonly matches: number;
  readonly fullyScanned: number;
  readonly partial: number;
  readonly unread: number;
  readonly complete: boolean;
  readonly rows: readonly VerificationFileEvidence[];
}
export interface ProjectVerificationReport {
  readonly status: 'completed' | 'cancelled';
  readonly mode: InspectionSettings['mode'];
  readonly listed: number;
  readonly selected: number;
  readonly excluded: number;
  readonly withheld: number;
  readonly deferred: number;
  readonly listingLimited: boolean;
  readonly bytes: number;
  readonly rules: readonly VerificationRuleEvidence[];
}
export interface VerificationControl extends InspectionControl {
  readonly yieldBetweenFiles?: () => Promise<void>;
}
export type VerificationExecution = { readonly kind: 'report'; readonly report: ProjectVerificationReport } |
  { readonly kind: 'invalidated' };

function fileEvidence(name: string, origin: InspectionOrigin, state: VerificationFileState, matches = 0): VerificationFileEvidence {
  return Object.freeze({ name, origin, state, matches });
}

/** Presence and absence are asymmetric: one observed occurrence can prove
 * presence or disprove absence even with incomplete coverage. A zero count
 * proves neither until every selected source and the known listing scope
 * are complete. Observe mode never produces a pass/fail assertion.
 */
export function assessVerification(expectation: VerificationExpectation, matches: number, complete: boolean): VerificationStatus {
  if (expectation === 'observe') return 'observed';
  if (matches > 0) return expectation === 'present' ? 'pass' : 'fail';
  if (!complete) return 'inconclusive';
  return expectation === 'present' ? 'fail' : 'pass';
}

/** One bounded source read feeds every reviewed literal rule. A per-file
 * match/candidate cap remains independent for each rule. Store counts only;
 * neither full text nor hit objects survive the per-file analysis.
 */
export async function executeProjectVerification(plan: ProjectVerificationPlan, documents: readonly StudioDocument[],
  read: (path: string, maxBytes: number) => Promise<string>, control: VerificationControl): Promise<VerificationExecution> {
  const rows: VerificationFileEvidence[][] = plan.rules.map(() => []);
  const scope = plan.inspection;
  let bytes = 0, observed = 0;
  const stopped = () => !control.isCurrent() || control.isCancelled();
  for (const source of scope.sources) {
    if (stopped()) break;
    control.onProgress?.({ observed, total: scope.selected });
    if (control.yieldBetweenFiles) await control.yieldBetweenFiles();
    if (stopped()) break;
    const snapshot = await readInspectionSnapshot(source, documents, scope.settings.mode,
      INSPECTION_READ_LIMITS.totalBytes - bytes, read, stopped);
    if (snapshot.kind === 'stopped') break;
    if (snapshot.kind === 'unavailable') {
      for (const row of rows) row.push(fileEvidence(source.name, snapshot.origin, snapshot.state));
      observed++;
      continue;
    }
    bytes += snapshot.bytes;
    const document: StudioDocument = {
      id: 'verification-snapshot', name: source.name, path: null,
      content: snapshot.content, savedContent: snapshot.content, revision: 0,
    };
    const evidence: VerificationFileEvidence[] = [];
    for (const rule of plan.rules) {
      const searched = searchOpenFiles([document], rule.query, rule.options);
      const complete = !searched.error && !searched.truncated &&
        searched.searchedDocuments === 1 && searched.skippedDocuments === 0;
      evidence.push(fileEvidence(source.name, snapshot.origin, complete ? 'scanned' : 'partial',
        searched.error ? 0 : searched.hits.length));
    }
    if (stopped()) break;
    evidence.forEach((item, index) => rows[index].push(item));
    observed++;
  }
  if (!control.isCurrent()) return { kind: 'invalidated' };
  for (const source of scope.sources.slice(observed)) {
    for (const row of rows) row.push(fileEvidence(source.name, 'none', 'not-observed'));
  }
  control.onProgress?.({ observed, total: scope.selected });
  if (!control.isCurrent()) return { kind: 'invalidated' };
  const status = control.isCancelled() ? 'cancelled' : 'completed';
  const scopeComplete = status === 'completed' && !scope.settings.listingLimited && !scope.deferred && !scope.withheld;
  const rules = plan.rules.map((rule, index): VerificationRuleEvidence => {
    const fileRows = rows[index];
    const matches = fileRows.reduce((sum, row) => sum + row.matches, 0);
    const fullyScanned = fileRows.filter(row => row.state === 'scanned').length;
    const partial = fileRows.filter(row => row.state === 'partial').length;
    const unread = fileRows.length - fullyScanned - partial;
    const complete = scopeComplete && fullyScanned === scope.selected;
    return Object.freeze({ index, name: rule.name, expectation: rule.expectation,
      status: assessVerification(rule.expectation, matches, complete), matches, fullyScanned, partial, unread,
      complete, rows: Object.freeze(fileRows) });
  });
  return { kind: 'report', report: Object.freeze({
    status, mode: scope.settings.mode, listed: scope.listed, selected: scope.selected,
    excluded: scope.excluded, withheld: scope.withheld, deferred: scope.deferred,
    listingLimited: scope.settings.listingLimited, bytes, rules: Object.freeze(rules),
  }) };
}

export type VerificationFileFilter = 'all' | 'matches' | 'incomplete' | 'zero-scanned';
export function filterVerificationFiles(rule: VerificationRuleEvidence, filter: VerificationFileFilter): readonly VerificationFileEvidence[] {
  return rule.rows.filter(row => filter === 'all' ||
    (filter === 'matches' && row.matches > 0) ||
    (filter === 'incomplete' && row.state !== 'scanned') ||
    (filter === 'zero-scanned' && row.state === 'scanned' && row.matches === 0));
}
export const VERIFICATION_PAGE_SIZE = 15;
export function pageVerificationFiles(rows: readonly VerificationFileEvidence[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(rows.length / VERIFICATION_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  return { pages, page, rows: rows.slice((page - 1) * VERIFICATION_PAGE_SIZE, page * VERIFICATION_PAGE_SIZE) };
}
export interface VerificationReportOptions {
  readonly includeRuleNames: boolean;
  readonly includeSourceLabels: boolean;
}
/** Never export the literal queries, hit strings, native paths, source
 * snapshots or arbitrary read failures. Names and labels are separate
 * explicit disclosures, since either can contain private text.
 */
export function verificationReportText(report: ProjectVerificationReport,
  options: VerificationReportOptions = { includeRuleNames: false, includeSourceLabels: false }): string {
  const lines = [
    'Scarp Studio — literal source verification',
    'Only reviewed listed sources were searched; disk snapshots were sequential.',
    'Run status: ' + report.status,
    'Snapshot mode: ' + report.mode,
    'Selected / listed sources: ' + report.selected + ' / ' + report.listed,
    'Excluded / deferred / withheld: ' + report.excluded + ' / ' + report.deferred + ' / ' + report.withheld,
    'Explorer listing known limited: ' + (report.listingLimited ? 'yes' : 'no'),
    'UTF-8 bytes analyzed: ' + report.bytes,
    'Rules: ' + report.rules.length,
    'Literal checks are not compiler, semantic or security guarantees.',
  ];
  let units = lines.join('\n').length;
  const add = (line: string) => {
    if (units + line.length + 1 > MAX_SCOPE_REPORT_UNITS - 100) return false;
    units += line.length + 1;
    lines.push(line);
    return true;
  };
  for (const rule of report.rules) {
    if (!add('Rule ' + (rule.index + 1) + (options.includeRuleNames ? ' ' + JSON.stringify(rule.name) : '') +
      ': ' + VERIFICATION_EXPECTATION_LABELS[rule.expectation] + ' — ' + VERIFICATION_STATUS_LABELS[rule.status] +
      '; observed matches: ' + rule.matches + '; fully searched: ' + rule.fullyScanned +
      '; partial: ' + rule.partial + '; unread: ' + rule.unread)) {
      lines.push('Additional report rows omitted due to size limit.'); break;
    }
    if (!options.includeSourceLabels) continue;
    for (const row of rule.rows) {
      if (!add('  ' + JSON.stringify(row.name) + ' — ' + VERIFICATION_FILE_LABELS[row.state] +
        '; observed matches: ' + row.matches)) {
        lines.push('Additional report rows omitted due to size limit.');
        return lines.join('\n');
      }
    }
  }
  return lines.join('\n');
}
