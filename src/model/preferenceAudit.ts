import {
  DEFAULT_STUDIO_PORTABLE, PORTABLE_GROUPS, PORTABLE_GROUP_LABELS, diffStudioPreferences,
  exportStudioPreferences, importStudioPreferences, sameStudioPreferences, type PortableGroup,
  type StudioPortablePreferences, type StudioPreferenceChange,
} from './studioPreferenceTransfer';
import { profileError, type ProfileResult } from './intelliSenseProfileTransfer';

export const MAX_AUDIT_QUERY_UNITS = 120;
export interface PreferenceAuditRow {
  readonly id: string;
  readonly group: PortableGroup;
  readonly key: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly currentValue: string;
  readonly modified: boolean;
}
export interface PreferenceAuditGroup {
  readonly group: PortableGroup;
  readonly total: number;
  readonly modified: number;
}
export interface PreferenceAudit {
  readonly rows: readonly PreferenceAuditRow[];
  readonly groups: readonly PreferenceAuditGroup[];
  readonly total: number;
  readonly modified: number;
}
function canonical(value: StudioPortablePreferences): StudioPortablePreferences {
  const parsed = importStudioPreferences(exportStudioPreferences(value));
  if (!parsed.ok) throw Error(parsed.error);
  return parsed.value;
}
function idOf(group: PortableGroup, key: string): string { return group + ':' + key; }
export function buildPreferenceAudit(current: StudioPortablePreferences): PreferenceAudit {
  const value = canonical(current);
  const rows = diffStudioPreferences(DEFAULT_STUDIO_PORTABLE, value, true).map(change => Object.freeze({
    id: idOf(change.group, change.key), group: change.group, key: change.key, label: change.label,
    defaultValue: change.before, currentValue: change.after, modified: change.before !== change.after,
  }));
  const groups = PORTABLE_GROUPS.map(group => {
    const groupRows = rows.filter(row => row.group === group);
    return Object.freeze({ group, total: groupRows.length, modified: groupRows.filter(row => row.modified).length });
  });
  return Object.freeze({ rows: Object.freeze(rows), groups: Object.freeze(groups), total: rows.length,
    modified: rows.filter(row => row.modified).length });
}
export function filterPreferenceAudit(audit: PreferenceAudit, query: string, group: PortableGroup | 'all',
  modifiedOnly: boolean): PreferenceAuditRow[] {
  const terms = query.slice(0, MAX_AUDIT_QUERY_UNITS).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return audit.rows.filter(row => (group === 'all' || row.group === group) && (!modifiedOnly || row.modified) &&
    terms.every(term => [row.label, row.key, PORTABLE_GROUP_LABELS[row.group], row.currentValue, row.defaultValue].join(' ').toLowerCase().includes(term)));
}
export function auditTextReport(audit: PreferenceAudit, modifiedOnly: boolean): string {
  const lines = ['Scarp Studio portable preference audit', 'Scope: allowlisted portable preferences only.',
    'Modified: ' + audit.modified + ' / ' + audit.total,
    'Excludes source text, paths, snippets, named profiles, compiler trust, Auto Save enablement and local keyboard bindings.', ''];
  for (const group of audit.groups) {
    const rows = audit.rows.filter(row => row.group === group.group && (!modifiedOnly || row.modified));
    if (!rows.length) continue;
    lines.push(PORTABLE_GROUP_LABELS[group.group] + ' (' + group.modified + ' / ' + group.total + ' modified)');
    for (const row of rows) {
      lines.push('  ' + row.label + ': ' + row.currentValue + (row.modified ? ' (default: ' + row.defaultValue + ')' : ''));
    }
    lines.push('');
  }
  return lines.join('\n');
}
export interface SelectiveResetReview {
  readonly baseline: StudioPortablePreferences;
  readonly target: StudioPortablePreferences;
  readonly selected: readonly string[];
  readonly changes: readonly StudioPreferenceChange[];
}
/** Build reset targets exclusively from the canonical built-in defaults.
 * The selection is a set of static preference IDs, not arbitrary paths.
 * Reject unknown fields rather than silently resetting a broader category. */
export function reviewSelectiveReset(current: StudioPortablePreferences, selected: readonly string[]): ProfileResult<SelectiveResetReview> {
  const baseline = canonical(current);
  const audit = buildPreferenceAudit(baseline);
  if (!selected.length || selected.length > audit.total) return profileError('Select at least one supported preference.');
  const keys = new Set(selected);
  if (keys.size !== selected.length || selected.some(id => !audit.rows.some(row => row.id === id))) return profileError('Invalid or duplicate preference selection.');
  const rows = audit.rows.filter(row => keys.has(row.id) && row.modified);
  if (!rows.length) return profileError('Selected preferences already use defaults.');
  const raw = JSON.parse(exportStudioPreferences(baseline)) as { preferences: Record<PortableGroup, Record<string, unknown>> };
  const defaults = JSON.parse(exportStudioPreferences(DEFAULT_STUDIO_PORTABLE)) as typeof raw;
  for (const row of rows) raw.preferences[row.group][row.key] = defaults.preferences[row.group][row.key];
  const parsed = importStudioPreferences(JSON.stringify({
    ...JSON.parse(exportStudioPreferences(baseline)), preferences: raw.preferences,
  }));
  if (!parsed.ok) return parsed;
  const changes = diffStudioPreferences(baseline, parsed.value);
  if (changes.some(change => !keys.has(idOf(change.group, change.key)))) return profileError('Reset would affect an unselected preference.');
  return { ok: true, value: Object.freeze({ baseline, target: parsed.value, selected: Object.freeze(rows.map(row => row.id)),
    changes: Object.freeze(changes.map(change => Object.freeze(change))) }) };
}
export function selectiveResetIsCurrent(review: SelectiveResetReview, current: StudioPortablePreferences): boolean {
  if (!sameStudioPreferences(review.baseline, current)) return false;
  const checked = reviewSelectiveReset(current, review.selected);
  return checked.ok && sameStudioPreferences(checked.value.target, review.target);
}
