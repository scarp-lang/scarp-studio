import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectMatchExplorer, ProjectMatchReview, MatchContextText } from './ProjectMatchExplorer';
import { buildProjectMatchInventory } from '../model/projectMatchExplorer';
import { searchListedProjectSources } from '../model/projectSearch';
import { buildProjectScopeInventory, DEFAULT_PROJECT_SEARCH_SCOPE, planScopedProjectSearch, summarizeScopedSearch } from '../model/projectSearchScope';

const options = { caseSensitive: true, wholeWord: false };
async function fixture(content: string, query = 'needle') {
  const listed = [{ name: 'src/private-name.srp', path: 'C:/private-native/src/private-name.srp' }];
  const plan = planScopedProjectSearch(buildProjectScopeInventory(listed), DEFAULT_PROJECT_SEARCH_SCOPE);
  if (!plan.ok) throw Error(plan.error);
  const result = await searchListedProjectSources(plan.value.sources, [], query, options, async () => content);
  if (!result) throw Error('Missing result');
  const coverage = summarizeScopedSearch(plan.value, result);
  if (!coverage.ok) throw Error(coverage.error);
  const inventory = buildProjectMatchInventory(result, coverage.value);
  if (!inventory.ok) throw Error(inventory.error);
  return { result, coverage: coverage.value, inventory: inventory.value };
}

describe('displayed project match workbench rendering', () => {
  it('renders bounded rows with exact match highlighting and no native path', async () => {
    const { result, coverage } = await fixture('prefix needle suffix\nneedle other');
    const onNavigate = vi.fn();
    const html = renderToStaticMarkup(<ProjectMatchExplorer result={result} coverage={coverage} busy={false} onNavigate={onNavigate}/>);
    expect(html).toContain('Displayed project match workbench');
    expect(html).toContain('<mark>needle</mark>');
    expect(html).toContain('prefix ');
    expect(html).toContain('2 filtered of 2 displayed matches');
    expect(html).toContain('Review matching source overview');
    expect(html).toContain('Filter displayed match context');
    expect(html).toContain('Review displayed match report');
    expect(html).not.toContain('C:/private-native');
    expect(html).not.toContain('Displayed project match report"');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('paginates long results and retains original occurrence review identities', async () => {
    const { result, coverage } = await fixture(Array.from({ length: 45 }, (_, index) => 'needle line ' + (index + 1)).join('\n'));
    const html = renderToStaticMarkup(<ProjectMatchExplorer result={result} coverage={coverage} busy={false} onNavigate={vi.fn()}/>);
    expect(html).toContain('Page 1 of 3');
    expect(html).toContain('Review displayed occurrence 20');
    expect(html).not.toContain('Review displayed occurrence 21');
    expect(html).toContain('Next match page');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Previous match page<\/button>/);
  });

  it('discloses incomplete scope even when there are no displayed matches', async () => {
    const { result, coverage } = await fixture('unrelated');
    const html = renderToStaticMarkup(<ProjectMatchExplorer result={result} coverage={{ ...coverage, incomplete: true }}
      busy={false} onNavigate={vi.fn()}/>);
    expect(html).toContain('The source scope is incomplete');
    expect(html).toContain('No displayed matches in this search');
    expect(html).toContain('0 filtered of 0 displayed matches');
  });

  it('renders exact review context with disabled navigation while busy', async () => {
    const { inventory } = await fixture('first needle\nsecond needle');
    const select = vi.fn(), navigate = vi.fn();
    const html = renderToStaticMarkup(<ProjectMatchReview row={inventory.rows[0]} previous={null}
      next={inventory.rows[1]} busy onSelect={select} onNavigate={navigate}/>);
    expect(html).toContain('Exact UTF-16 coordinate');
    expect(html).toContain('Opening the occurrence rechecks the current source');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Previous reviewed match<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Open reviewed match<\/button>/);
    expect(html).toContain('Next reviewed match');
    expect(select).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('escapes control formatting and HTML in source contexts', () => {
    const html = renderToStaticMarkup(<MatchContextText context={{
      before: '<script>\u202e', match: 'needle', after: '\u0001😀',
      leadingOmitted: true, trailingOmitted: true,
    }}/>);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('\\u202e');
    expect(html).toContain('\\u0001');
    expect(html).toContain('😀');
    expect(html).toContain('Earlier line context omitted');
    expect(html).toContain('Later line context omitted');
    expect(html).not.toContain('<script>');
  });

  it('refuses invalid reviewed evidence without offering navigation buttons', async () => {
    const { result, coverage } = await fixture('needle');
    const html = renderToStaticMarkup(<ProjectMatchExplorer result={result} coverage={{ ...coverage, hits: 2 }}
      busy={false} onNavigate={vi.fn()}/>);
    expect(html).toContain('Project match review unavailable');
    expect(html).toContain('Search result counts do not match');
    expect(html).not.toContain('Review displayed occurrence');
  });
});
