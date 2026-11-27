import { useMemo, useState, useSyncExternalStore } from 'react';
import { activityCommandLabel, type createCompilerActivityStore } from '../model/compilerActivity';
import { compareRetainedOutput, DEFAULT_OUTPUT_SEARCH, indexCompilerOutput, MAX_INSPECTION_QUERY,
  outputContextLines, outputLine, outputPreview, reviewOutputExcerpt, searchCompilerOutput,
  summarizeOutput, type OutputMatch, type OutputSearchOptions, type OutputPreview } from '../model/outputInspection';

interface Props {
  output: string;
  freshnessWarning: string | null;
  busy: boolean;
  activity: ReturnType<typeof createCompilerActivityStore>;
}
const PAGE = 20;
const contextChoices = [0, 2, 5, 10] as const;
function Preview({ preview }: { preview: OutputPreview }) {
  const { text, highlightStart, highlightEnd } = preview;
  const highlight = highlightStart !== null && highlightEnd !== null &&
    highlightStart >= 0 && highlightEnd <= text.length;
  return <code className="output-inspection-preview" dir="auto">
    {preview.prefixOmitted && <span aria-label="Earlier text omitted">…</span>}
    {highlight ? <>{text.slice(0, highlightStart!)}<mark>{text.slice(highlightStart!, highlightEnd!)}</mark>{text.slice(highlightEnd!)}</> : text}
    {preview.suffixOmitted && <span aria-label="Later text omitted">…</span>}
    {!text.length && <span className="output-empty-line">(empty line)</span>}
  </code>;
}
function OutputTextInspector({ output }: { output: string }) {
  const [options, setOptions] = useState<OutputSearchOptions>(DEFAULT_OUTPUT_SEARCH);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OutputMatch | null>(null);
  const [lineInput, setLineInput] = useState('1');
  const [line, setLine] = useState(1);
  const [radius, setRadius] = useState<number>(2);
  const [showExcerpt, setShowExcerpt] = useState(false);
  const [notice, setNotice] = useState('');
  const index = useMemo(() => indexCompilerOutput(output), [output]);
  const summary = useMemo(() => summarizeOutput(index), [index]);
  const result = useMemo(() => searchCompilerOutput(output, index, options), [output, index, options]);
  const pages = Math.max(1, Math.ceil(result.matches.length / PAGE));
  const currentPage = Math.min(page, pages);
  const selectedLine = outputLine(index, line);
  const context = outputContextLines(index, line, radius);
  const excerpt = showExcerpt && context.length ? reviewOutputExcerpt(output, index,
    context[0].number, context[context.length - 1].number) : null;
  function changeSearch(update: Partial<OutputSearchOptions>) {
    setOptions(previous => ({ ...previous, ...update }));
    setPage(1); setSelected(null); setShowExcerpt(false); setNotice('');
  }
  function focusLine(number: number, match: OutputMatch | null) {
    if (!outputLine(index, number)) { setNotice('Choose an indexed output line.'); return; }
    setLine(number); setLineInput(String(number)); setSelected(match);
    setShowExcerpt(false); setNotice('');
  }
  function goToLine() {
    if (!/^[0-9]+$/.test(lineInput.trim())) { setNotice('Enter a positive indexed line number.'); return; }
    focusLine(Number(lineInput), null);
  }
  return <section className="output-inspection-text" aria-label="Inspect current compiler output">
    <dl className="activity-metrics">
      <div><dt>Output UTF-16 units</dt><dd>{index.totalUnits}</dd></div>
      <div><dt>Indexed lines</dt><dd>{summary.indexedLines}</dd></div>
      <div><dt>Empty indexed lines</dt><dd>{summary.emptyLines}</dd></div>
      <div><dt>Longest indexed line</dt><dd>{summary.longestLineUnits} units</dd></div>
      <div><dt>LF / CRLF / CR</dt><dd>{summary.endings.LF} / {summary.endings.CRLF} / {summary.endings.CR}</dd></div>
    </dl>
    {!index.complete && <p role="status">Limited prefix: {index.scannedUnits} of {index.totalUnits} units indexed.
      {index.limit === 'units' ? ' Unit budget reached.' : ' Line budget reached.'} Matches outside this prefix are unknown.</p>}
    <div className="output-inspection-controls">
      <label>Find literal text<input type="search" aria-label="Find compiler output text" value={options.query}
        maxLength={MAX_INSPECTION_QUERY} onChange={event => changeSearch({ query: event.target.value })} /></label>
      <label><input type="checkbox" checked={options.caseSensitive}
        onChange={event => changeSearch({ caseSensitive: event.target.checked })} /> Match case</label>
      <label><input type="checkbox" checked={options.wholeWord}
        onChange={event => changeSearch({ wholeWord: event.target.checked })} /> Whole word</label>
      <button type="button" onClick={() => changeSearch(DEFAULT_OUTPUT_SEARCH)}>Clear output search</button>
    </div>
    <p role="status" className="output-search-summary">
      {result.reason === 'empty' ? 'Enter literal text to search the indexed output.' :
        result.reason === 'invalid' ? 'Search must be a single line within 120 UTF-16 units.' :
        (result.complete ? '' : 'At least ') + result.matches.length + ' occurrence(s) in ' +
          result.matchedLines + ' indexed line(s)' + (result.complete ? '.' : '; search is limited.')}
      {result.reason === 'match-limit' && ' Occurrence limit reached.'}
    </p>
    {result.matches.length > 0 && <>
      <div className="output-search-matches" aria-label="Compiler output matches">
        {result.matches.slice((currentPage - 1) * PAGE, currentPage * PAGE).map(match => {
          const source = outputLine(index, match.line);
          if (!source) return null;
          return <button type="button" key={match.start} className="output-match"
            aria-pressed={selected?.start === match.start} onClick={() => focusLine(match.line, match)}>
            <span>Output line {match.line}, column {match.start - source.start + 1}</span>
            <Preview preview={outputPreview(output, source, match)} />
          </button>;
        })}
      </div>
      {pages > 1 && <div className="activity-pagination">
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous matches</button>
        <span>Page {currentPage}/{pages}</span>
        <button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next matches</button>
      </div>}
    </>}
    <div className="output-inspection-controls">
      <label>Output line<input aria-label="Inspect output line number" inputMode="numeric" maxLength={6}
        value={lineInput} onChange={event => setLineInput(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') goToLine(); }} /></label>
      <button type="button" onClick={goToLine}>Inspect output line</button>
      <button type="button" disabled={!selectedLine || line <= 1} onClick={() => focusLine(line - 1, null)}>Previous output line</button>
      <button type="button" disabled={!selectedLine || line >= index.lines.length} onClick={() => focusLine(line + 1, null)}>Next output line</button>
      <label>Context<select aria-label="Output context radius" value={radius} onChange={event => {
        const value = Number(event.target.value);
        if (contextChoices.some(choice => choice === value)) { setRadius(value); setShowExcerpt(false); }
      }}>{contextChoices.map(choice => <option key={choice} value={choice}>{choice} lines each side</option>)}</select></label>
    </div>
    {notice && <p role="status">{notice}</p>}
    {selectedLine && <>
      <p role="status">Inspecting output line {line}. These are output coordinates, not source locations.</p>
      <div className="output-context" aria-label="Selected output line and context">
        {context.map(item => <div key={item.number} className={'output-context-line' + (item.number === line ? ' selected' : '')}>
          <span>{item.number}</span>
          <Preview preview={outputPreview(output, item, selected?.line === item.number ? selected : null)} />
          <small>{item.ending}</small>
        </div>)}
      </div>
      <button type="button" aria-expanded={showExcerpt} onClick={() => setShowExcerpt(value => !value)}>
        {showExcerpt ? 'Hide output excerpt' : 'Review copyable output excerpt'}
      </button>
      {excerpt && (excerpt.ok ? <label>Read-only selected excerpt (may contain private output)
        <textarea aria-label="Selected compiler output excerpt" rows={6} readOnly value={excerpt.value.text} />
        <small>{excerpt.value.units} UTF-16 units, lines {excerpt.value.firstLine}–{excerpt.value.lastLine}. No automatic copy or export.</small>
      </label> : <p role="status">{excerpt.error}</p>)}
    </>}
  </section>;
}
function OutputHistoryComparison({ output, activity }: Pick<Props, 'output' | 'activity'>) {
  const state = useSyncExternalStore(activity.subscribe, activity.getSnapshot, activity.getSnapshot);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [review, setReview] = useState(false);
  const [context, setContext] = useState(true);
  const retained = state.records.filter(record => record.output !== null);
  const selected = retained.find(record => record.id === selectedId);
  const comparison = useMemo(() => review && selected ? compareRetainedOutput(selected, output) : null,
    [review, selected, output]);
  return <section className="output-history-comparison" aria-label="Compare retained historical output">
    <h3>Compare with historical output</h3>
    <p>Use an explicitly retained output record as a text baseline. This does not compare source or prove compiler correctness.
      Incomplete history captures cannot serve as exact baselines.</p>
    {!retained.length ? <p role="status">No retained output. Enable output recording in History before a future compiler invocation.</p> : <>
      <label>Historical baseline<select aria-label="Historical output baseline" value={selected?.id ?? ''}
        onChange={event => { setSelectedId(event.target.value ? Number(event.target.value) : null); setReview(false); }}>
        <option value="">Choose retained output</option>
        {[...retained].reverse().map(record => <option key={record.id} value={record.id}>
          {activityCommandLabel(record.command)} · {record.target} · #{record.id}{record.outputTruncated ? ' (incomplete)' : ''}
        </option>)}
      </select></label>
      <button type="button" disabled={!selected || selected.outputTruncated}
        onClick={() => setReview(value => !value)}>{review ? 'Hide output comparison' : 'Review output comparison'}</button>
      {selected?.outputTruncated && <p role="status">This record has omitted output and cannot be compared exactly.</p>}
    </>}
    {comparison && (!comparison.ok ? <p role="status">{comparison.error}</p> : <div className="output-comparison-result">
      <p>Historical record #{comparison.value.historicalRecordId}: {comparison.value.baselineUnits} units; current text: {comparison.value.currentUnits} units.</p>
      {comparison.value.report.status === 'clean' ? <p role="status">The compared output text is identical.</p> :
        comparison.value.report.status === 'limited' ? <p role="status">{comparison.value.report.message}</p> : <>
          <p role="status">+{comparison.value.report.addedLines} / −{comparison.value.report.removedLines} lines from historical to current.</p>
          {comparison.value.report.truncated && <p>Limited change preview; not all changes are displayed.</p>}
          <label><input type="checkbox" checked={context} onChange={event => setContext(event.target.checked)} /> Show unchanged context</label>
          {comparison.value.report.hunks.map(hunk => <section key={hunk.id} className="changes-hunk">
            <div className="changes-hunk-header">Historical {hunk.beforeStart},{hunk.beforeCount} → current {hunk.afterStart},{hunk.afterCount}</div>
            {hunk.lines.filter(item => context || item.kind !== 'context').map((item, i) =>
              <div key={i} className={'changes-line changes-line-' + item.kind}>
                <span>{item.kind === 'added' ? '+' : item.kind === 'removed' ? '−' : '·'}</span>
                <span>{item.beforeLine ?? '–'} → {item.afterLine ?? '–'}</span>
                <code dir="auto">{item.preview}{item.previewTruncated ? '…' : ''}</code>
              </div>)}
          </section>)}
        </>}
    </div>)}
  </section>;
}

export function OutputInspectionPanel({ output, freshnessWarning, busy, activity }: Props) {
  // React discards this render and rerenders before children commit when
  // text changes. The generation remounts all stale selections/excerpts.
  const [snapshot, setSnapshot] = useState(output);
  const [generation, setGeneration] = useState(0);
  if (snapshot !== output) {
    setSnapshot(output);
    setGeneration(value => value + 1);
  }
  return <section className="output-inspection-panel" aria-label="Compiler output inspection">
    <header><strong>Output inspection</strong>
      <p>Read-only inspection of text in the Output view. No file reads, diagnostics navigation, or compiler execution.</p>
    </header>
    {freshnessWarning && <p role="status">{freshnessWarning}</p>}
    {busy ? <p role="status">Output inspection is paused while a compiler operation is active.</p> :
      <div key={generation} className="output-inspection-body">
        <OutputTextInspector output={output} />
        <OutputHistoryComparison output={output} activity={activity} />
      </div>}
  </section>;
}
