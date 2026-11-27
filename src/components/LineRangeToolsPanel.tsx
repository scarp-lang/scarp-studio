import { useState } from 'react';
import { currentActiveDocument, type EditorState } from '../model/editorState';
import { DEFAULT_RANGE_REQUEST, lineRangePlanIsCurrent, MAX_RANGE_AFFIX_UNITS, MAX_RANGE_LINES,
  parseRangeLine, planLineRange, rangeEndingLabel, RANGE_LABELS, RANGE_OPERATIONS,
  type LineRangePlan, type RangeOperation, type RangePreviewLine } from '../model/lineRangeTools';

interface Props {
  editor: EditorState;
  cursorLine: number;
  busy: boolean;
  undoAvailable: boolean;
  onApply: (plan: LineRangePlan) => boolean;
  onUndo: () => void;
  initiallyExpanded?: boolean;
}
function Preview({ title, lines }: { title: string; lines: readonly RangePreviewLine[] }) {
  return <section className="range-preview-side" aria-label={title}>
    <h4>{title}</h4>
    <ol>{lines.map(line => <li key={line.number}>
      <span>{line.number}</span><code dir="auto">{line.text || '(empty)'}</code><small>{rangeEndingLabel(line.ending)}</small>
    </li>)}</ol>
  </section>;
}
export function LineRangeToolsPanel({ editor, cursorLine, busy, undoAvailable, onApply, onUndo, initiallyExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [first, setFirst] = useState('1');
  const [last, setLast] = useState('1');
  const [operation, setOperation] = useState<RangeOperation>(DEFAULT_RANGE_REQUEST.operation);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [indentWidth, setIndentWidth] = useState(2);
  const [affix, setAffix] = useState('');
  const [plan, setPlan] = useState<LineRangePlan | null>(null);
  const [notice, setNotice] = useState('');
  const active = currentActiveDocument(editor);
  const stale = plan !== null && !lineRangePlanIsCurrent(plan, editor);
  const sort = operation === 'sort-ascending' || operation === 'sort-descending';
  const indentation = operation === 'indent' || operation === 'outdent';
  const usesAffix = operation === 'prefix' || operation === 'suffix';
  function reset() { setPlan(null); setNotice(''); }
  function review() {
    reset();
    const start = parseRangeLine(first), end = parseRangeLine(last);
    if (start === null || end === null) { setNotice('Enter positive whole line numbers.'); return; }
    const result = planLineRange(editor, { first: start, last: end, operation, caseSensitive, indentWidth, affix });
    if (result.ok) setPlan(result.value); else setNotice(result.error);
  }
  return <section className="sidebar-section line-range-tools" aria-label="Reviewed line range tools">
    <div className="sidebar-heading">LINE TOOLS</div>
    <button type="button" className="insights-toggle" aria-expanded={expanded} aria-controls="line-range-tools-body"
      onClick={() => { setExpanded(value => !value); reset(); }}>
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Hide line tools' : 'Review line transformations'}</span>
    </button>
    <div id="line-range-tools-body" hidden={!expanded}>
      {expanded && <div className="insights-body">
        <p className="insights-disclaimer">Whole-line text operations on the active buffer only. They may change Scarp program behavior.
          Review every line before applying. No compiler execution or direct disk write.</p>
        {active ? <p>Active buffer: {active.name}. Select up to {MAX_RANGE_LINES} consecutive lines.</p> :
          <p>Open a source buffer to use line tools.</p>}
        <div className="range-tools-inputs">
          <label>First line<input aria-label="First transformation line" inputMode="numeric" maxLength={7}
            value={first} onChange={event => { setFirst(event.target.value); reset(); }}/></label>
          <label>Last line<input aria-label="Last transformation line" inputMode="numeric" maxLength={7}
            value={last} onChange={event => { setLast(event.target.value); reset(); }}/></label>
          <button type="button" disabled={!active || busy} onClick={() => {
            setFirst(String(cursorLine)); setLast(String(cursorLine)); reset();
          }}>Use cursor line</button>
        </div>
        <label>Operation<select aria-label="Line transformation operation" value={operation} onChange={event => {
          const value = event.target.value as RangeOperation;
          if (RANGE_OPERATIONS.includes(value)) { setOperation(value); reset(); }
        }}>{RANGE_OPERATIONS.map(value => <option key={value} value={value}>{RANGE_LABELS[value]}</option>)}</select></label>
        {sort && <label><input type="checkbox" checked={caseSensitive}
          onChange={event => { setCaseSensitive(event.target.checked); reset(); }}/> Match case when ordering</label>}
        {sort && <p>Literal lexicographic ordering, not numeric sorting. Equal comparison keys keep original order.</p>}
        {indentation && <label>Indentation width<select aria-label="Line indentation width" value={indentWidth}
          onChange={event => { setIndentWidth(Number(event.target.value)); reset(); }}>
          {Array.from({ length: 8 }, (_, i) => i + 1).map(width => <option key={width} value={width}>{width} spaces</option>)}
        </select></label>}
        {indentation && <p>Indent inserts spaces on nonempty lines. Outdent removes one leading tab or up to the chosen number of spaces.</p>}
        {usesAffix && <label>Literal text<input aria-label="Line transformation literal text" value={affix} maxLength={MAX_RANGE_AFFIX_UNITS}
          onChange={event => { setAffix(event.target.value); reset(); }}/></label>}
        {operation === 'deduplicate' && <p>Keep the first occurrence of each exact line, including whitespace and case.</p>}
        <button type="button" disabled={busy || !active} onClick={review}>Review line transformation</button>
        {plan && <section className="transfer-review line-range-review" role="group" aria-label="Confirm line transformation">
          <strong>{RANGE_LABELS[plan.request.operation]} · {plan.document.name}</strong>
          <p>Lines {plan.request.first}–{plan.request.last} · {plan.changedRows} changed result row(s) · {plan.removedRows} removed row(s)</p>
          <p>Line-ending slots stay in position; the selected final boundary separator is preserved. No source outside the range changes.</p>
          <div className="range-preview-pair">
            <Preview title="Before transformation" lines={plan.before} />
            <Preview title="After transformation" lines={plan.after} />
          </div>
          {stale && <p role="alert">Editor session changed. Review the transformation again.</p>}
          <button type="button" disabled={busy || stale} onClick={() => {
            const success = onApply(plan); reset();
            setNotice(success ? 'Transformation applied to the buffer. Review or Undo before saving.' : 'Transformation rejected. Review again.');
          }}>Confirm line transformation</button>
          <button type="button" onClick={reset}>Cancel line transformation</button>
        </section>}
        <button type="button" disabled={busy || !undoAvailable} onClick={onUndo}>Undo last line transformation</button>
        {notice && <p role="status">{notice}</p>}
      </div>}
    </div>
  </section>;
}
