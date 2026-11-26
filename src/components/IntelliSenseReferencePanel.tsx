import { useMemo, useState } from 'react';
import type { IntelliSensePreferences } from '../model/intelliSensePreferences';
import {
  MAX_REFERENCE_QUERY_UNITS, REFERENCE_KINDS, REFERENCE_AVAILABILITY, searchScarpReference,
  type ReferenceKind, type ReferenceAvailability,
} from '../language/intelliSenseReference';

const kindLabels: Record<ReferenceKind, string> = {
  all: 'All categories', function: 'Functions', type: 'Types', keyword: 'Keywords', snippet: 'Templates',
};
const availabilityLabels: Record<ReferenceAvailability, string> = {
  all: 'All entries', enabled: 'Enabled suggestions', disabled: 'Disabled suggestions',
};

export function IntelliSenseReferencePanel({ preferences }: { preferences: Readonly<IntelliSensePreferences> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<ReferenceKind>('all');
  const [availability, setAvailability] = useState<ReferenceAvailability>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const results = useMemo(() => searchScarpReference({ text, kind, availability }, preferences, page),
    [text, kind, availability, preferences, page]);
  const selected = results.entries.find(item => item.id === selectedId) ?? results.entries[0];
  function resetPage() { setPage(1); setSelectedId(''); }
  return <section className="intellisense-section intellisense-reference-panel" aria-label="Scarp language reference">
    <h3>Scarp language reference</h3>
    <p>Browse the editor catalog, including entries beyond the completion result limit. This read-only reference does not establish support in the installed compiler.</p>
    <button type="button" className="settings-reset" aria-expanded={open}
      aria-controls="intellisense-reference-content" onClick={() => setOpen(value => !value)}>
      {open ? 'Hide language reference' : 'Browse language reference (' + results.catalogTotal + ' entries)'}
    </button>
    <div id="intellisense-reference-content" hidden={!open}>
      {open && <>
        <div className="reference-filters">
          <div>
            <label htmlFor="intellisense-reference-query">Search names and documentation</label>
            <input type="search" id="intellisense-reference-query" maxLength={MAX_REFERENCE_QUERY_UNITS} value={text}
              onChange={event => { setText(event.target.value); resetPage(); }} placeholder="e.g. bigint power" />
          </div>
          <div>
            <label htmlFor="intellisense-reference-kind">Category</label>
            <select id="intellisense-reference-kind" value={kind} onChange={event => {
              const next = REFERENCE_KINDS.find(item => item === event.target.value);
              if (next) { setKind(next); resetPage(); }
            }}>{REFERENCE_KINDS.map(item => <option key={item} value={item}>{kindLabels[item]} ({results.counts[item]})</option>)}</select>
          </div>
          <div>
            <label htmlFor="intellisense-reference-availability">Suggestion availability</label>
            <select id="intellisense-reference-availability" value={availability} onChange={event => {
              const next = REFERENCE_AVAILABILITY.find(item => item === event.target.value);
              if (next) { setAvailability(next); resetPage(); }
            }}>{REFERENCE_AVAILABILITY.map(item => <option key={item} value={item}>{availabilityLabels[item]}</option>)}</select>
          </div>
        </div>
        <div className="reference-pages">
          <button type="button" className="settings-reset" onClick={() => {
            setText(''); setKind('all'); setAvailability('all'); resetPage();
          }}>Clear reference filters</button>
          <span role="status">{results.total} matching entries · page {results.page} of {results.pages}</span>
          <button type="button" className="settings-reset" disabled={results.page <= 1} onClick={() => {
            setPage(results.page - 1); setSelectedId('');
          }}>Previous page</button>
          <button type="button" className="settings-reset" disabled={results.page >= results.pages} onClick={() => {
            setPage(results.page + 1); setSelectedId('');
          }}>Next page</button>
        </div>
        {results.entries.length ? <>
          <div className="reference-list" role="group" aria-label="Matching catalog entries">
            {results.entries.map(item => <button type="button" className="settings-reset reference-entry" key={item.id}
              aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
              <code>{item.label}</code><span>{item.kind} · {item.enabled ? 'Enabled' : 'Disabled'}</span>
            </button>)}
          </div>
          {selected && <div className="reference-detail" aria-label="Selected catalog entry">
            <strong>{selected.label} · {selected.kind}</strong>
            <p>{selected.detail}</p>
            <p>{selected.documentation}</p>
            {selected.signature && <><span>Catalog signature</span><pre><code>{selected.signature}</code></pre></>}
            <span>Raw insertion template (Monaco placeholders may appear)</span>
            <pre><code>{selected.insertText}</code></pre>
            <p>{selected.enabled ? 'This category is enabled in your completion preferences.' :
              'This category is disabled in your completion preferences. Documentation remains available.'}
              {' '}Actual suggestions depend on source context and the selected completion mode.</p>
          </div>}
        </> : <p>No catalog entries match these filters.</p>}
      </>}
    </div>
  </section>;
}
