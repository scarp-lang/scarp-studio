import { useMemo, useState, useSyncExternalStore } from 'react';
import { programInputBytes } from '../model/programInput';
import { createInputPresetUndo, filterInputPresets, inputPresetLineCount, inputPresetCaptureIsCurrent,
  inputPresetApplyIsCurrent, inputPresetRemovalIsCurrent, reviewInputPresetCapture, reviewInputPresetApply,
  reviewInputPresetRemoval, MAX_INPUT_PRESETS, MAX_PRESET_TOTAL_BYTES, MAX_PRESET_LABEL_UNITS,
  type createProgramInputPresetStore, type ProgramInputSnapshot, type InputPresetCaptureReview,
  type InputPresetApplyReview, type InputPresetRemovalReview, type InputPresetUndo } from '../model/programInputPresets';

interface Props {
  store: ReturnType<typeof createProgramInputPresetStore>;
  current: ProgramInputSnapshot;
  busy: boolean;
  onCapture: (review: InputPresetCaptureReview) => number | null;
  onApply: (review: InputPresetApplyReview) => ProgramInputSnapshot | null;
  onRemove: (review: InputPresetRemovalReview) => boolean;
  onUndo: (undo: InputPresetUndo) => boolean;
}
export function ProgramInputPresetsPanel({ store, current, busy, onCapture, onApply, onRemove, onUndo }: Props) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [capture, setCapture] = useState<InputPresetCaptureReview | null>(null);
  const [apply, setApply] = useState<InputPresetApplyReview | null>(null);
  const [removal, setRemoval] = useState<InputPresetRemovalReview | null>(null);
  const [undo, setUndo] = useState<InputPresetUndo | null>(null);
  const [showText, setShowText] = useState(false);
  const [notice, setNotice] = useState('');
  const entries = useMemo(() => filterInputPresets(state.entries, query), [state.entries, query]);
  const selected = state.entries.find(entry => entry.id === selectedId);
  const captureStale = !!capture && !inputPresetCaptureIsCurrent(capture, state, current);
  const applyStale = !!apply && !inputPresetApplyIsCurrent(apply, state, current);
  const removalStale = !!removal && !inputPresetRemovalIsCurrent(removal, state);
  const undoAvailable = !!undo && undo.after.revision === current.revision &&
    undo.after.text === current.text && undo.after.interactive === current.interactive;
  function clearReview() { setCapture(null); setApply(null); setRemoval(null); setNotice(''); }
  function prepareCapture(replace: boolean) {
    clearReview();
    if (replace && !selected) return;
    const result = reviewInputPresetCapture(state, current, label, replace ? selected!.id : null);
    if (result.ok) setCapture(result.value); else setNotice(result.error);
  }
  function prepareApply() {
    clearReview();
    if (!selected) return;
    const result = reviewInputPresetApply(state, current, selected.id);
    if (result.ok) setApply(result.value); else setNotice(result.error);
  }
  function prepareRemoval(ids: readonly number[]) {
    clearReview();
    const result = reviewInputPresetRemoval(state, ids);
    if (result.ok) setRemoval(result.value); else setNotice(result.error);
  }
  return <section className="input-presets" aria-label="Session program input presets">
    <button type="button" aria-expanded={open} aria-controls="input-presets-content" onClick={() => {
      setOpen(value => !value); clearReview(); setShowText(false);
    }}>{open ? 'Hide input presets' : 'Manage input presets'}</button>
    <div id="input-presets-content" hidden={!open}>
      {open && <>
        <p>Explicit in-memory copies of preloaded replies and prompt mode. Presets are cleared on exit, are not saved or sent elsewhere, and never start a compiler command. Avoid passwords or secrets.</p>
        <p role="status">{state.entries.length}/{MAX_INPUT_PRESETS} presets · {state.bytes}/{MAX_PRESET_TOTAL_BYTES} UTF-8 bytes</p>
        <div className="input-preset-tools">
          <label>Preset label<input aria-label="Input preset label" value={label} maxLength={MAX_PRESET_LABEL_UNITS}
            placeholder="Practice input" onChange={event => { setLabel(event.target.value); clearReview(); }} /></label>
          <button type="button" disabled={busy || !label.trim()} onClick={() => prepareCapture(false)}>Review save input preset</button>
          <button type="button" disabled={busy || !selected || !label.trim()} onClick={() => prepareCapture(true)}>Review replace selected preset</button>
        </div>
        <input type="search" aria-label="Search input preset labels" maxLength={MAX_PRESET_LABEL_UNITS} value={query}
          placeholder="Find preset…" onChange={event => setQuery(event.target.value)} />
        <div className="input-preset-list">
          {entries.map(item => <button type="button" key={item.id} className="input-preset-entry"
            aria-pressed={selectedId === item.id} onClick={() => {
              setSelectedId(item.id); setLabel(item.label); setShowText(false); clearReview();
            }}>
            <strong>{item.label}</strong>
            <span>{item.bytes} bytes · {inputPresetLineCount(item.text)} supplied lines · {item.interactive ? 'Prompt mode' : 'Redirected input'}</span>
          </button>)}
          {!entries.length && <p>No matching session presets.</p>}
        </div>
        {selected && <div className="input-preset-detail">
          <strong>{selected.label}</strong>
          <p>{current.text === selected.text && current.interactive === selected.interactive ? 'Matches current input and mode.' : 'Differs from current input or prompt mode.'}</p>
          <button type="button" aria-expanded={showText} onClick={() => setShowText(value => !value)}>
            {showText ? 'Hide stored replies' : 'Inspect stored replies'}
          </button>
          {showText && <label>Read-only preset replies
            <textarea aria-label="Stored input preset text" readOnly rows={4} value={selected.text} />
          </label>}
          <div className="input-preset-tools">
            <button type="button" disabled={busy || current.text === selected.text && current.interactive === selected.interactive}
              onClick={prepareApply}>Review apply input preset</button>
            <button type="button" disabled={busy} onClick={() => prepareRemoval([selected.id])}>Review remove input preset</button>
          </div>
        </div>}
        {capture && <div className="transfer-review" role="group" aria-label="Confirm input preset capture">
          <p>{capture.replaceId === null ? 'Save' : 'Replace'} {capture.label} with {capture.bytes} bytes of current replies and {capture.snapshot.interactive ? 'prompt' : 'redirected'} mode?</p>
          {captureStale && <p role="alert">Input or presets changed. Review again.</p>}
          <button type="button" disabled={busy || captureStale} onClick={() => {
            const id = onCapture(capture); clearReview();
            if (id !== null) { setSelectedId(id); setShowText(false); setNotice('Session input preset saved.'); }
            else setNotice('Preset capture rejected. Review again.');
          }}>Confirm input preset capture</button>
          <button type="button" onClick={clearReview}>Cancel input preset capture</button>
        </div>}
        {apply && <div className="transfer-review" role="group" aria-label="Confirm apply input preset">
          <dl className="input-preset-comparison">
            <div><dt>Current replies</dt><dd>{programInputBytes(apply.snapshot.text)} bytes · {inputPresetLineCount(apply.snapshot.text)} lines</dd></div>
            <div><dt>Preset replies</dt><dd>{programInputBytes(apply.targetText)} bytes · {inputPresetLineCount(apply.targetText)} lines</dd></div>
            <div><dt>Prompt mode</dt><dd>{apply.snapshot.interactive ? 'On' : 'Off'} → {apply.targetInteractive ? 'On' : 'Off'}</dd></div>
          </dl>
          <p>Replace the entire Program Input field with the selected preset, without running a program.</p>
          {applyStale && <p role="alert">Input or presets changed. Review again.</p>}
          <button type="button" disabled={busy || applyStale} onClick={() => {
            const after = onApply(apply); const before = apply.snapshot; clearReview();
            if (after) { setUndo(createInputPresetUndo(before, after)); setNotice('Preset applied. No compiler command started.'); }
            else setNotice('Input changed; review again.');
          }}>Confirm apply input preset</button>
          <button type="button" onClick={clearReview}>Cancel input preset apply</button>
        </div>}
        <div className="input-preset-tools">
          <button type="button" disabled={busy || !undoAvailable} onClick={() => {
            if (!undo) return; const success = onUndo(undo);
            setUndo(null); clearReview(); setNotice(success ? 'Previous Program Input restored.' : 'Undo is stale.');
          }}>Undo last preset apply</button>
          <button type="button" disabled={busy || !state.entries.length} onClick={() => prepareRemoval(state.entries.map(item => item.id))}>Review clear input presets</button>
        </div>
        {removal && <div className="transfer-review" role="group" aria-label="Confirm remove input presets">
          <p>Remove {removal.ids.length} session preset(s)? Current Program Input is unchanged.</p>
          {removalStale && <p role="alert">Preset inventory changed. Review again.</p>}
          <button type="button" disabled={busy || removalStale} onClick={() => {
            const success = onRemove(removal); clearReview();
            if (success) { setSelectedId(null); setShowText(false); setLabel(''); setUndo(null); }
            setNotice(success ? 'Reviewed presets removed.' : 'Preset inventory changed. Review again.');
          }}>Confirm remove input presets</button>
          <button type="button" onClick={clearReview}>Cancel input preset removal</button>
        </div>}
        {notice && <p role="status">{notice}</p>}
      </>}
    </div>
  </section>;
}
