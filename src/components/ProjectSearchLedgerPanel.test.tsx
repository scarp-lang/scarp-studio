import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectSearchLedgerPanel, SearchLedgerDetails } from './ProjectSearchLedgerPanel';
import { buildProjectScopeInventory, DEFAULT_PROJECT_SEARCH_SCOPE, planScopedProjectSearch,
  summarizeScopedSearch, PROJECT_SEARCH_BATCH_SIZE } from '../model/projectSearchScope';
import { searchListedProjectSources } from '../model/projectSearch';
import { captureSearchObservation } from '../model/projectSearchComparison';
import { createSearchBatchLedger, summarizeSearchBatchLedger } from '../model/projectSearchLedger';

const options = { caseSensitive: true, wholeWord: false };
const query = 'private-query';
function listing(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: 'private/' + String(index).padStart(3, '0') + '.srp',
    path: 'C:/native/private/' + String(index).padStart(3, '0') + '.srp',
  }));
}
async function fixture(count: number) {
  const listed = listing(count);
  const inventory = buildProjectScopeInventory(listed);
  const scope = { ...DEFAULT_PROJECT_SEARCH_SCOPE, batch: 1 };
  const plan = planScopedProjectSearch(inventory, scope);
  if (!plan.ok) throw Error(plan.error);
  const result = await searchListedProjectSources(plan.value.sources, [], query, options, async () => query);
  const summary = summarizeScopedSearch(plan.value, result!);
  if (!summary.ok) throw Error(summary.error);
  const observation = captureSearchObservation(query, options, summary.value);
  if (!observation.ok) throw Error(observation.error);
  const ledger = createSearchBatchLedger(inventory, observation.value);
  if (!ledger.ok) throw Error(ledger.error);
  return { listed, scope, summary: summary.value, ledgerSummary: summarizeSearchBatchLedger(ledger.value) };
}

describe('project search batch ledger rendering', () => {
  it('mounts collapsed and does not disclose private settings or labels', async () => {
    const { listed, scope, summary } = await fixture(PROJECT_SEARCH_BATCH_SIZE + 1);
    const onScopeChange = vi.fn();
    const html = renderToStaticMarkup(<ProjectSearchLedgerPanel listed={listed} query={query}
      options={options} scope={scope} current={summary} busy={false} onScopeChange={onScopeChange}/>);
    expect(html).toContain('Track search batch coverage');
    expect(html).not.toContain(query);
    expect(html).not.toContain('private/000.srp');
    expect(html).not.toContain('C:/native');
    expect(html).not.toContain('Start ledger from current batch');
    expect(onScopeChange).not.toHaveBeenCalled();
  });

  it('renders recorded and unrecorded evidence separately with neutral wording', async () => {
    const { ledgerSummary } = await fixture(PROJECT_SEARCH_BATCH_SIZE + 1);
    const onSelectBatch = vi.fn();
    const onRemoveBatch = vi.fn();
    const html = renderToStaticMarkup(<SearchLedgerDetails summary={ledgerSummary} canNavigate busy={false}
      onSelectBatch={onSelectBatch} onRemoveBatch={onRemoveBatch}/>);
    expect(html).toContain('No combined or current workspace coverage is asserted');
    expect(html).toContain('All batch labels fully scanned in its observation');
    expect(html).toContain('No observation');
    expect(html).toContain('Select next pending batch');
    expect(html).toContain('Remove observation for batch 1');
    expect(html).not.toContain('Remove observation for batch 2');
    expect(html).not.toContain('private/000.srp');
    expect(html).not.toContain(query);
    expect(onSelectBatch).not.toHaveBeenCalled();
    expect(onRemoveBatch).not.toHaveBeenCalled();
  });

  it('discloses historical limits even when every planned label was fully scanned', async () => {
    const { ledgerSummary } = await fixture(1);
    const html = renderToStaticMarkup(<SearchLedgerDetails summary={ledgerSummary} canNavigate busy={false}
      onSelectBatch={vi.fn()} onRemoveBatch={vi.fn()}/>);
    expect(html).toContain('Every planned label was fully scanned in its recorded observation');
    expect(html).toContain('This does not establish current workspace coverage');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Select next pending batch/);
  });

  it('paginates large batch plans and disables navigation when context is stale', async () => {
    const { ledgerSummary } = await fixture(PROJECT_SEARCH_BATCH_SIZE * 12);
    const html = renderToStaticMarkup(<SearchLedgerDetails summary={ledgerSummary} canNavigate={false} busy={false}
      onSelectBatch={vi.fn()} onRemoveBatch={vi.fn()}/>);
    expect(html).toContain('12 matching batches');
    expect(html).toContain('page 1 of 2');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Select batch 1<\/button>/);
    expect(html).not.toContain('Select batch 11');
    expect(html).toContain('Next ledger page');
  });
});
