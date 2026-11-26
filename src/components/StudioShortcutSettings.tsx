import { ShortcutTransferPanel } from './ShortcutTransferPanel';
import type { ProfileResult } from '../model/intelliSenseProfileTransfer';
import { useState } from 'react';
import { useSettingsReveal } from './settingsReveal';
import {
  DEFAULT_SHORTCUTS, MAX_SHORTCUT_QUERY_UNITS, SHORTCUT_COMMANDS, availableShortcutBindings,
  isFixedShortcut, searchStudioShortcuts, shortcutConflict, shortcutLabel,
  type ShortcutTransferReview, type ShortcutBinding, type ShortcutBindings, type ShortcutChangeResult, type ShortcutCommand, type ShortcutSnapshot,
} from '../model/studioShortcuts';

interface Props {
  bindings: ShortcutBindings;
  persistence: ShortcutSnapshot['persistence'];
  onChange: (id: ShortcutCommand, binding: ShortcutBinding) => ShortcutChangeResult;
  onReset: () => void;
  revision?: number;
  onApplyTransfer?: (review: ShortcutTransferReview) => ProfileResult<true>;
}
export function StudioShortcutSettings({ bindings, persistence, onChange, onReset, revision = 0, onApplyTransfer }: Props) {
  const [query, setQuery] = useState('');
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState('');
  useSettingsReveal('shortcuts', () => { setQuery(''); setModifiedOnly(false); });
  const entries = searchStudioShortcuts(query, modifiedOnly, bindings);
  const changed = SHORTCUT_COMMANDS.filter(item => bindings[item.id] !== DEFAULT_SHORTCUTS[item.id]).length;
  function change(id: ShortcutCommand, binding: ShortcutBinding) {
    setConfirmReset(false);
    const result = onChange(id, binding);
    setNotice(result.ok ? 'Shortcut updated.' : result.error);
  }
  return <section className="shortcut-settings" aria-label="Configure Studio keyboard shortcuts">
    <p>Customize Studio commands without changing Monaco's native editor bindings. Escape, Settings and Stop remain available. Alternative chords may be intercepted by your operating system. Ctrl also accepts Meta for most commands; tab cycling uses Ctrl.</p>
    {persistence === 'session-only' && <p role="status">Shortcut changes apply for this session; persistence is unavailable.</p>}
    <label htmlFor="studio-shortcut-query">Search commands or keys</label>
    <input id="studio-shortcut-query" type="search" value={query} maxLength={MAX_SHORTCUT_QUERY_UNITS}
      onChange={event => setQuery(event.target.value.slice(0, MAX_SHORTCUT_QUERY_UNITS))} placeholder="e.g. save, Ctrl+S, navigation" />
    <label className="editor-setting-checkbox"><input type="checkbox" checked={modifiedOnly}
      onChange={event => setModifiedOnly(event.target.checked)} /> Show modified shortcuts only</label>
    <p role="status">{entries.length} / {SHORTCUT_COMMANDS.length} commands · {changed} modified</p>
    <div className="shortcut-list">
      {entries.map(item => {
        const fixed = isFixedShortcut(item.id);
        const modified = bindings[item.id] !== DEFAULT_SHORTCUTS[item.id];
        return <div key={item.id} className="shortcut-row">
          <label htmlFor={'studio-shortcut-' + item.id}>{item.label}</label>
          <select id={'studio-shortcut-' + item.id} disabled={fixed} value={bindings[item.id] ?? ''}
            onChange={event => {
              const next = event.target.value || null;
              if (availableShortcutBindings(item.id).includes(next)) change(item.id, next);
            }}>
            {availableShortcutBindings(item.id).map(binding => {
              const conflict = shortcutConflict(bindings, item.id, binding);
              return <option key={binding ?? 'none'} value={binding ?? ''} disabled={!!conflict}>
                {shortcutLabel(binding)}{conflict ? ' — used by ' + (SHORTCUT_COMMANDS.find(entry => entry.id === conflict)?.label ?? conflict) : ''}
              </option>;
            })}
          </select>
          <button className="settings-reset" type="button" disabled={fixed || !modified}
            aria-label={'Reset shortcut for ' + item.label} onClick={() => change(item.id, DEFAULT_SHORTCUTS[item.id])}>Reset</button>
          <small>{item.group} · Default: {item.default}{fixed ? ' · Fixed' : ''}{modified ? ' · Modified' : ''}</small>
        </div>;
      })}
      {!entries.length && <p>No shortcuts match this filter.</p>}
    </div>
    <div className="transfer-actions">
      <button type="button" className="settings-reset" onClick={() => { setQuery(''); setModifiedOnly(false); }}>Clear shortcut filters</button>
      <button type="button" className="settings-reset" disabled={!changed} onClick={() => setConfirmReset(true)}>Review reset all shortcuts</button>
    </div>
    {confirmReset && <div role="group" aria-label="Confirm shortcut reset">
      <p>Restore the default key bindings for all Studio commands?</p>
      <button type="button" className="settings-reset" onClick={() => { onReset(); setConfirmReset(false); setNotice('Restored default Studio shortcuts.'); }}>Confirm shortcut reset</button>
      <button type="button" className="settings-reset" onClick={() => setConfirmReset(false)}>Cancel shortcut reset</button>
    </div>}
    {notice && <p role="status">{notice}</p>}
    {onApplyTransfer && <ShortcutTransferPanel bindings={bindings} revision={revision} onApply={onApplyTransfer} />}
  </section>;
}
