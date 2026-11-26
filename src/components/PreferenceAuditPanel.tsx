import { useMemo, useState } from 'react';
import { PORTABLE_GROUPS, PORTABLE_GROUP_LABELS, type PortableGroup, type StudioPortablePreferences } from '../model/studioPreferenceTransfer';
import { buildPreferenceAudit, filterPreferenceAudit, auditTextReport, reviewSelectiveReset,
  selectiveResetIsCurrent, MAX_AUDIT_QUERY_UNITS, type SelectiveResetReview } from '../model/preferenceAudit';

interface Props {
  current: StudioPortablePreferences;
  onApply: (expected: StudioPortablePreferences, target: StudioPortablePreferences) => boolean;
}
export function PreferenceAuditPanel({ current, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<PortableGroup | 'all'>('all');
  const [modifiedOnly, setModifiedOnly] = useState(true);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [review, setReview] = useState<SelectiveResetReview | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportModified, setReportModified] = useState(true);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const audit = useMemo(() => buildPreferenceAudit(current), [current]);
  const rows = useMemo(() => filterPreferenceAudit(audit, query, group, modifiedOnly), [audit, query, group, modifiedOnly]);
  const validSelection = selected.filter(id => audit.rows.some(row => row.id === id && row.modified));
  const stale = !!review && !selectiveResetIsCurrent(review, current);
  function clearReview() { setReview(null); setNotice(null); }
  function updateSelection(next: readonly string[]) { setSelected(next); clearReview(); }
  function prepare() {
    clearReview();
    const result = reviewSelectiveReset(current, validSelection);
    if (!result.ok) { setNotice({ message: result.error, error: true }); return; }
    setReview(result.value);
  }
  function confirm() {
    if (!review || !selectiveResetIsCurrent(review, current) || !onApply(review.baseline, review.target)) {
      setReview(null); setNotice({ message: 'Preferences changed. Review the reset again.', error: true }); return;
    }
    setReview(null); setSelected([]); setNotice({ message: 'Reviewed preferences restored to their defaults.', error: false });
  }
  return <section className="preference-audit" id="studio-preference-audit" tabIndex={-1} aria-label="Preference audit and selective reset">
    <h3>Preference audit and selective reset</h3>
    <p role="status">{audit.modified} / {audit.total} portable preferences modified</p>
    <button type="button" className="settings-reset" aria-expanded={open} aria-controls="preference-audit-content" onClick={() => {
      setOpen(value => !value); clearReview();
    }}>{open ? 'Hide preference audit' : 'Inspect portable preferences'}</button>
    <div id="preference-audit-content" hidden={!open}>
      {open && <>
        <p>Compare active portable settings with their built-in defaults. Select individual modified fields to review a reset. This never changes automatic-write enablement, compiler trust, local keyboard bindings or saved source.</p>
        <div className="preference-audit-tools">
          <label htmlFor="preference-audit-search">Search audit</label>
          <input id="preference-audit-search" type="search" maxLength={MAX_AUDIT_QUERY_UNITS} value={query} onChange={event => setQuery(event.target.value)} />
          <label htmlFor="preference-audit-group">Category</label>
          <select id="preference-audit-group" value={group} onChange={event => {
            const value = event.target.value;
            if (value === 'all' || PORTABLE_GROUPS.includes(value as PortableGroup)) setGroup(value as PortableGroup | 'all');
          }}>
            <option value="all">All categories</option>
            {audit.groups.map(item => <option key={item.group} value={item.group}>
              {PORTABLE_GROUP_LABELS[item.group]} ({item.modified}/{item.total})
            </option>)}
          </select>
          <label><input type="checkbox" checked={modifiedOnly} onChange={event => setModifiedOnly(event.target.checked)} /> Modified only</label>
          <button type="button" className="settings-reset" onClick={() => { setQuery(''); setGroup('all'); setModifiedOnly(true); }}>Clear audit filters</button>
        </div>
        <div className="preference-audit-tools">
          <button type="button" className="settings-reset" disabled={!rows.some(row => row.modified)} onClick={() =>
            updateSelection([...new Set([...validSelection, ...rows.filter(row => row.modified).map(row => row.id)])])}>Select visible modified</button>
          <button type="button" className="settings-reset" disabled={!validSelection.length} onClick={() => updateSelection([])}>Clear reset selection</button>
          <p role="status">{rows.length} visible · {validSelection.length} selected for reset</p>
        </div>
        <div className="preference-audit-scroll" tabIndex={0} aria-label="Portable preference comparison table">
          <table className="preference-audit-table">
            <thead><tr><th scope="col">Reset</th><th scope="col">Preference</th><th scope="col">Current</th><th scope="col">Default</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>
              <td><input type="checkbox" aria-label={'Reset ' + row.label} disabled={!row.modified} checked={validSelection.includes(row.id)}
                onChange={event => updateSelection(event.target.checked ? [...validSelection, row.id] : validSelection.filter(id => id !== row.id))} /></td>
              <th scope="row">{row.label}<small>{PORTABLE_GROUP_LABELS[row.group]}</small></th>
              <td>{row.currentValue}{row.modified && <small>Modified</small>}</td>
              <td>{row.defaultValue}</td>
            </tr>)}</tbody>
          </table>
          {!rows.length && <p>No preferences match the current filters.</p>}
        </div>
        <button type="button" className="settings-reset" disabled={!validSelection.length} onClick={prepare}>Review selected preference reset</button>
        {review && <div role="group" className="transfer-review" aria-label="Confirm selected preference reset">
          <strong>{review.changes.length} selected changes</strong>
          <ul className="transfer-changes">{review.changes.map(change => <li key={change.group + ':' + change.key}>
            {change.label}: {change.before} → {change.after}
          </li>)}</ul>
          {stale && <p role="alert">Preferences changed. Review again.</p>}
          <p>All unselected settings and local authorizations are preserved.</p>
          <button type="button" className="settings-reset" disabled={stale} onClick={confirm}>Confirm selected reset</button>
          <button type="button" className="settings-reset" onClick={clearReview}>Cancel selected reset</button>
        </div>}
        <button type="button" className="settings-reset" aria-expanded={reportOpen} onClick={() => setReportOpen(value => !value)}>
          {reportOpen ? 'Hide preference report' : 'Show copyable preference report'}
        </button>
        {reportOpen && <div>
          <label><input type="checkbox" checked={reportModified} onChange={event => setReportModified(event.target.checked)} /> Report modified preferences only</label>
          <label htmlFor="preference-audit-report">Read-only report</label>
          <textarea id="preference-audit-report" rows={9} readOnly value={auditTextReport(audit, reportModified)} />
          <p>Report contains only portable setting values. It excludes source text, paths, snippets, profiles, compiler trust, Auto Save enablement and keyboard bindings.</p>
        </div>}
        {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
      </>}
    </div>
  </section>;
}
