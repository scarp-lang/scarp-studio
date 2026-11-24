import { useState } from 'react';
import { filterProblems, type ProblemFilter, type StudioProblem } from '../model/problems';

interface Props {
  problems: readonly StudioProblem[];
  stale: boolean;
  busy: boolean;
  onNavigate: (problem: StudioProblem) => void;
  onShowOutput: () => void;
}

export function ProblemsPanel({ problems, stale, busy, onNavigate, onShowOutput }: Props) {
  const [filter, setFilter] = useState<ProblemFilter>('all');
  const [query, setQuery] = useState('');
  const filtered = filterProblems(problems, filter, query);
  const compiler = problems.filter(problem => problem.kind === 'compiler').length;
  const tests = problems.length - compiler;
  return <section className="problems-panel" aria-label="Current compiler problems">
    <div className="problems-toolbar">
      <label htmlFor="studio-problem-kind">Kind</label>
      <select id="studio-problem-kind" value={filter} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'compiler' || value === 'test') setFilter(value);
      }}>
        <option value="all">All ({problems.length})</option>
        <option value="compiler">Compiler ({compiler})</option>
        <option value="test">Failed tests ({tests})</option>
      </select>
      <input type="search" aria-label="Filter problems" placeholder="Filter code, message or source…" value={query}
        maxLength={160} onChange={event => setQuery(event.target.value)} />
      <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filter</button>
    </div>
    <p role="status" className="problems-summary">{stale ? 'Results are historical. Save and rerun to refresh problems.'
      : filtered.length + ' of ' + problems.length + ' current problem(s)'}</p>
    {filtered.length === 0 ? <div className="problems-empty">
      <strong>{stale ? 'Stale results' : problems.length ? 'No matching problems' : 'No current structured problems'}</strong>
      <p>{stale ? 'The previous output is still available.' : problems.length ? 'Clear or adjust the filter.' : 'Run Verify or Run Tests for structured results. An empty list does not establish successful verification.'}</p>
      <button type="button" onClick={onShowOutput}>Show raw output</button>
    </div> : <ul className="problems-list">
      {filtered.map(problem => <li key={problem.id} className="problem-row">
        <div className="problem-row-heading">
          <span className="problem-error">Error</span>
          <strong>{problem.code ?? (problem.kind === 'test' ? 'Test failure' : 'Compiler diagnostic')}</strong>
          <span className="problem-kind">{problem.kind === 'test' ? 'Test' : 'Compiler'}</span>
        </div>
        <div className="problem-message">{problem.message}</div>
        {problem.location && <div className="problem-location">{problem.location}</div>}
        {problem.help && <div className="problem-help">{problem.help}</div>}
        {problem.target ? <button type="button" disabled={busy} onClick={() => onNavigate(problem)}>
          {problem.target.kind === 'source' ? 'Go to source location' : 'Open listed test source'}
        </button> : <span className="problem-location">Source navigation unavailable for this diagnostic.</span>}
      </li>)}
    </ul>}
  </section>;
}
