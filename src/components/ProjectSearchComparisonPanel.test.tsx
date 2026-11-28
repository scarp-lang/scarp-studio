import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectSearchComparisonPanel, SearchComparisonDetails } from './ProjectSearchComparisonPanel';
import { captureSearchObservation, compareSearchObservations } from '../model/projectSearchComparison';
import { DEFAULT_PROJECT_SEARCH_SCOPE, type ScopedFileCoverageRow, type ScopedSearchSummary } from '../model/projectSearchScope';

const options = { caseSensitive: true, wholeWord: false };
const query = 'private-search-term';
function summary(rows: readonly ScopedFileCoverageRow[]): ScopedSearchSummary {
  const searched = rows.filter(row => row.state === 'scanned').length;
  return {
    scope: DEFAULT_PROJECT_SEARCH_SCOPE, listed: rows.length, inScope: rows.length, excluded: 0, withheld: 0,
    searched, skipped: rows.length - searched, hits: rows.reduce((total, row) => total + row.hits, 0),
    matchingFiles: rows.filter(row => row.hits > 0).length, incomplete: searched !== rows.length,
    rows: rows.filter(row => row.hits > 0).map(row => ({ name: row.name, hits: row.hits, openBuffer: row.origin === 'open-buffer' })),
    fileCoverage: rows,
  };
}
describe('project search observation comparison panel', () => {
  it('starts collapsed and never exposes queries or labels just by mounting', () => {
    const html = renderToStaticMarkup(<ProjectSearchComparisonPanel busy={false} current={{
      query, options, summary: summary([{ name: 'private-file.srp', state: 'scanned', origin: 'disk', hits: 1 }]),
    }}/>);
    expect(html).toContain('Compare search observations');
    expect(html).not.toContain(query);
    expect(html).not.toContain('private-file.srp');
    expect(html).not.toContain('Record current search observation');
  });
  it('renders incomplete coverage, exact count deltas and origin changes without exporting query text', () => {
    const before = captureSearchObservation(query, options, summary([
      { name: 'private-file.srp', state: 'scanned', origin: 'disk', hits: 1 },
      { name: 'uncertain.srp', state: 'read-failed', origin: 'disk', hits: 0 },
    ]));
    const after = captureSearchObservation(query, options, summary([
      { name: 'private-file.srp', state: 'scanned', origin: 'open-buffer', hits: 2 },
      { name: 'uncertain.srp', state: 'scanned', origin: 'disk', hits: 0 },
    ]));
    if (!before.ok || !after.ok) throw Error('Cannot capture observations');
    const compared = compareSearchObservations(before.value, after.value);
    if (!compared.ok) throw Error(compared.error);
    const html = renderToStaticMarkup(<SearchComparisonDetails comparison={compared.value}/>);
    expect(html).toContain('At least one scope was incomplete');
    expect(html).toContain('Observed count delta');
    expect(html).toContain('origin changed');
    expect(html).toContain('Not established');
    expect(html).toContain('Incomplete file evidence');
    expect(html).toContain('Observed search differences');
    expect(html).not.toContain(query);
    expect(html).toContain('private-file.srp');
    const report = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)?.[1];
    expect(report).toBeDefined();
    expect(report).not.toContain('private-file.srp');
  });
  it('paginates large comparisons instead of rendering every file label at once', () => {
    const rows = Array.from({ length: 42 }, (_, index): ScopedFileCoverageRow => ({
      name: 'file-' + String(index).padStart(3, '0') + '.srp', state: 'scanned', origin: 'disk', hits: 0,
    }));
    const captured = captureSearchObservation(query, options, summary(rows));
    if (!captured.ok) throw Error(captured.error);
    const compared = compareSearchObservations(captured.value, captured.value);
    if (!compared.ok) throw Error(compared.error);
    const html = renderToStaticMarkup(<SearchComparisonDetails comparison={compared.value}/>);
    expect(html).toContain('file-019.srp');
    expect(html).not.toContain('file-020.srp');
    expect(html).toContain('Next comparison page');
    expect(html).toContain('Previous comparison page');
    expect(html).toContain('of 42 file labels');
  });
});
