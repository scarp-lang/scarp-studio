import { useMemo, useState } from 'react';
import type { ProjectSearchSource } from '../model/projectSearch';
import { buildProjectScopeInventory, scopeLabel } from '../model/projectSearchScope';
import {
  addSearchPreset, renameSearchPreset, replaceSearchPresetSettings, removeSearchPreset, clearSearchPresets,
  createSearchPresetLibrary, prepareSearchPresetApply, confirmSearchPresetApply, sameProjectSearchSettings,
  exportSearchPresetBackup, reviewSearchPresetImport, applySearchPresetImport,
  MAX_SEARCH_PRESETS, MAX_SEARCH_PRESET_NAME, MAX_SEARCH_PRESET_BACKUP,
  type ProjectSearchSettings, type SearchPresetLibrary, type SearchPresetApplyReview,
  type PresetImportReview, type PresetResult,
} from '../model/projectSearchPresets';

interface Props {
  readonly listed: readonly ProjectSearchSource[];
  readonly current: ProjectSearchSettings;
  readonly busy: boolean;
  readonly onApply: (settings: ProjectSearchSettings) => boolean;
}
function describeFlags(settings: ProjectSearchSettings): string {
  return (settings.options.caseSensitive ? 'Case sensitive' : 'Ignore case') + ' · ' +
    (settings.options.wholeWord ? 'Whole word' : 'Substring');
}

export function SearchPresetSettingsView({ settings }: { settings: ProjectSearchSettings }) {
  return <dl className="project-scope-stats">
    <div><dt>Literal query</dt><dd><code dir="auto">{JSON.stringify(settings.query)}</code></dd></div>
    <div><dt>Matching</dt><dd>{describeFlags(settings)}</dd></div>
    <div><dt>Directory scope</dt><dd><code dir="auto">{scopeLabel(settings.scope)}</code></dd></div>
    <div><dt>Filename substring</dt><dd><code dir="auto">{JSON.stringify(settings.scope.filename)}</code></dd></div>
    <div><dt>Search mode</dt><dd>{settings.scope.batch === undefined
      ? 'Conventional bounded search' : 'Explicit batch ' + settings.scope.batch}</dd></div>
  </dl>;
}
export function SearchPresetApplyDetails({ review, busy, onConfirm, onCancel }: {
  readonly review: SearchPresetApplyReview;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const [showLabels, setShowLabels] = useState(false);
  return <div role="group" aria-label="Review applying search preset" className="project-scope-coverage">
    <p><strong>Review preset: {review.preset.name}</strong></p>
    <p>Current search settings</p><SearchPresetSettingsView settings={review.before}/>
    <p>Proposed search settings</p><SearchPresetSettingsView settings={review.preset.settings}/>
    <p>{review.preview.eligible} selected eligible label(s) · {review.preview.excluded} excluded ·
      {' '}{review.preview.deferred} deferred to other batches · {review.preview.withheld} withheld listing entries.</p>
    <button type="button" aria-expanded={showLabels} onClick={() => setShowLabels(value => !value)}>
      {showLabels ? 'Hide preset scope labels' : 'Review preset scope labels'}
    </button>
    {showLabels && <div className="project-scope-inventory"><ul>
      {review.preview.labels.map(label => <li key={label}><code dir="auto">{label}</code></li>)}
    </ul></div>}
    <p>Applying changes the search controls only. It retires prior search and replacement previews.
      It does not perform a search, replace text, run a compiler or write a file.</p>
    <button type="button" disabled={busy} onClick={onConfirm}>Confirm apply search preset</button>
    <button type="button" onClick={onCancel}>Cancel preset review</button>
  </div>;
}

const importLabels = {
  new: 'New preset',
  identical: 'Already present',
  conflict: 'Name conflict; existing preset retained',
} as const;
export function SearchPresetImportDetails({ review, selected, busy, onSelect, onApply, onCancel }: {
  readonly review: PresetImportReview;
  readonly selected: readonly number[];
  readonly busy: boolean;
  readonly onSelect: (index: number, checked: boolean) => void;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}) {
  return <div role="group" aria-label="Review importing search presets" className="project-scope-coverage">
    <p>Choose new presets to merge. Existing presets are never overwritten, even when their names conflict.</p>
    <p>{selected.length} selected · {review.remainingCapacity} remaining library slots.</p>
    <div className="project-scope-inventory"><table>
      <caption>Preset import review</caption>
      <thead><tr><th>Import</th><th>Preset name</th><th>Status</th></tr></thead>
      <tbody>{review.rows.map(row => <tr key={row.index}>
        <td><input type="checkbox" aria-label={'Import preset ' + row.name}
          checked={selected.includes(row.index)}
          disabled={busy || row.status !== 'new' || (!selected.includes(row.index) && selected.length >= review.remainingCapacity)}
          onChange={event => onSelect(row.index, event.target.checked)}/></td>
        <td><code dir="auto">{row.name}</code></td><td>{importLabels[row.status]}</td>
      </tr>)}</tbody>
    </table></div>
    {!review.rows.length && <p>The backup contains no presets.</p>}
    <button type="button" disabled={busy || !selected.length || selected.length > review.remainingCapacity}
      onClick={onApply}>Import selected new presets</button>
    <button type="button" onClick={onCancel}>Cancel import review</button>
  </div>;
}

export function ProjectSearchPresetsPanel({ listed, current, busy, onApply }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [library, setLibrary] = useState(createSearchPresetLibrary);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [review, setReview] = useState<SearchPresetApplyReview | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [importText, setImportText] = useState('');
  const [importReview, setImportReview] = useState<PresetImportReview | null>(null);
  const [importSelected, setImportSelected] = useState<readonly number[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const selected = library.presets.find(preset => preset.id === selectedId);
  const inventory = useMemo(() => buildProjectScopeInventory(listed), [listed]);
  const backup = useMemo(() => showBackup ? exportSearchPresetBackup(library) : null, [showBackup, library]);

  function clearReviews() {
    setReview(null); setConfirmClear(false); setConfirmReplace(false);
    setImportReview(null); setImportSelected([]);
  }
  function commit(result: PresetResult<SearchPresetLibrary>, message: string, preferId?: number) {
    if (!result.ok) { setError(result.error); return; }
    setLibrary(result.value);
    setSelectedId(result.value.presets.some(preset => preset.id === (preferId ?? selectedId))
      ? preferId ?? selectedId : result.value.presets.at(-1)?.id ?? null);
    clearReviews();
    setError(''); setNotice(message);
  }
  function reviewApply() {
    if (!selected || busy) return;
    const result = prepareSearchPresetApply(library, selected.id, current, inventory);
    if (!result.ok) { setError(result.error); setReview(null); return; }
    setReview(result.value); setError(''); setNotice('');
  }
  function confirmApply() {
    if (!review || busy) return;
    const result = confirmSearchPresetApply(library, review, current, inventory);
    if (!result.ok) { setError(result.error); setReview(null); return; }
    if (!onApply(result.value)) { setError('Search controls changed or are busy. Review the preset again.'); setReview(null); return; }
    setReview(null); setError(''); setNotice('Applied search settings. Run Search Project explicitly when ready.');
  }
  function reviewImport() {
    const result = reviewSearchPresetImport(library, importText);
    if (!result.ok) { setError(result.error); setImportReview(null); setImportSelected([]); return; }
    setImportReview(result.value); setImportSelected([]); setError(''); setNotice('');
  }
  function applyImport() {
    if (!importReview || busy || importReview.source !== importText) return;
    const result = applySearchPresetImport(library, importReview, importSelected);
    if (!result.ok) { setError(result.error); return; }
    commit(result, 'Merged ' + importSelected.length + ' new search preset(s).');
    setImportText('');
  }

  return <section className="project-scope-coverage" aria-label="Project search presets">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Hide search presets' : 'Manage search presets'}
    </button>
    {expanded && <>
      <p>Store up to {MAX_SEARCH_PRESETS} named search settings while this search workbench remains open.
        Presets retain literal queries and relative scope settings, not replacement text or source snapshots.
        Applying a preset never runs a search.</p>
      <label>Preset name<input aria-label="Search preset name" value={name} maxLength={MAX_SEARCH_PRESET_NAME}
        onChange={event => setName(event.target.value)}/></label>
      <button type="button" disabled={busy || library.presets.length >= MAX_SEARCH_PRESETS}
        onClick={() => commit(addSearchPreset(library, name, current), 'Recorded current search settings.', library.nextId)}>
        Add current search as preset
      </button>
      <p role="status">{library.presets.length} / {MAX_SEARCH_PRESETS} presets. {notice}</p>
      {error && <p role="alert">{error}</p>}
      {library.presets.length > 0 && <>
        <label>Selected preset<select aria-label="Selected search preset" value={selectedId ?? ''}
          onChange={event => {
            const id = Number(event.target.value);
            if (library.presets.some(preset => preset.id === id)) { setSelectedId(id); clearReviews(); }
          }}>
          {library.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select></label>
        {selected && <>
          <SearchPresetSettingsView settings={selected.settings}/>
          <button type="button" disabled={busy} onClick={reviewApply}>Review applying selected preset</button>
          <button type="button" disabled={busy}
            onClick={() => commit(renameSearchPreset(library, selected.id, name), 'Updated preset name.', selected.id)}>
            Rename selected preset
          </button>
          <button type="button" disabled={busy || confirmReplace || sameProjectSearchSettings(selected.settings, current)}
            onClick={() => { setConfirmReplace(true); setReview(null); }}>Review replacing selected preset settings</button>
          {confirmReplace && <div role="group" aria-label="Review replacing search preset settings">
            <p>Replace the stored search settings for {selected.name} with these current controls?</p>
            <SearchPresetSettingsView settings={current}/>
            <button type="button" disabled={busy}
              onClick={() => commit(replaceSearchPresetSettings(library, selected.id, current), 'Replaced preset settings.', selected.id)}>
              Confirm replace preset settings
            </button>
            <button type="button" onClick={() => setConfirmReplace(false)}>Cancel replace preset</button>
          </div>}
          <button type="button" disabled={busy}
            onClick={() => commit(removeSearchPreset(library, selected.id), 'Removed selected preset.')}>Remove selected preset</button>
        </>}
        <button type="button" disabled={busy || confirmClear} onClick={() => setConfirmClear(true)}>Clear all search presets</button>
        {confirmClear && <div role="group" aria-label="Confirm clearing search presets">
          <p>Remove every saved preset from this workbench? Current search controls are unchanged.</p>
          <button type="button" disabled={busy}
            onClick={() => commit({ ok: true, value: clearSearchPresets(library) }, 'Cleared all search presets.')}>Confirm clear presets</button>
          <button type="button" onClick={() => setConfirmClear(false)}>Cancel clear presets</button>
        </div>}
      </>}
      {review && <SearchPresetApplyDetails key={review.preset.id} review={review} busy={busy}
        onConfirm={confirmApply} onCancel={() => setReview(null)}/>}
      <div className="project-scope-coverage">
        <p>Portable backups contain preset names, literal queries and relative scope labels.
          Treat the text as private unless you intend to share it.</p>
        <label><input type="checkbox" checked={showBackup} onChange={event => setShowBackup(event.target.checked)}/>
          Show portable backup including search queries and scope settings</label>
        {backup?.ok && <label>Portable preset backup<textarea aria-label="Portable search preset backup"
          readOnly rows={8} value={backup.value}/></label>}
        {backup && !backup.ok && <p role="alert">{backup.error}</p>}
        <label>Paste portable preset backup<textarea aria-label="Import search preset backup" rows={6}
          maxLength={MAX_SEARCH_PRESET_BACKUP} value={importText}
          onChange={event => { setImportText(event.target.value); setImportReview(null); setImportSelected([]); }}/></label>
        <button type="button" disabled={busy || !importText} onClick={reviewImport}>Review preset backup import</button>
        {importReview && <SearchPresetImportDetails review={importReview} selected={importSelected} busy={busy}
          onSelect={(index, checked) => setImportSelected(previous => checked
            ? previous.includes(index) || previous.length >= importReview.remainingCapacity ? previous : [...previous, index]
            : previous.filter(item => item !== index))}
          onApply={applyImport} onCancel={() => { setImportReview(null); setImportSelected([]); }}/>}
      </div>
    </>}
  </section>;
}
