import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectSearchSweepPanel, SearchSweepResults, SearchSweepReview } from './ProjectSearchSweepPanel';
import { executeSearchSweep, prepareSearchSweep } from '../model/projectSearchSweep';
import { DEFAULT_PROJECT_SEARCH_SCOPE, PROJECT_SEARCH_BATCH_SIZE } from '../model/projectSearchScope';
import type { ProjectSearchSettings } from '../model/projectSearchPresets';

const settings: ProjectSearchSettings = {
  query: 'private-needle', options: { caseSensitive: true, wholeWord: false }, scope: DEFAULT_PROJECT_SEARCH_SCOPE,
};
const listed = Array.from({ length: PROJECT_SEARCH_BATCH_SIZE + 1 }, (_, index) => ({
  name: 'private-src/' + index + '.srp', path: 'C:/private-native/' + index + '.srp',
}));
function plan() {
  const result = prepareSearchSweep(listed, settings, { first: 1, last: 2 });
  if (!result.ok) throw Error(result.error);
  return result.value;
}
describe('project search sweep rendering', () => {
  it('mounts collapsed without exposing search settings or native paths', () => {
    const onRun = vi.fn(async () => ({ kind: 'invalidated' as const }));
    const html = renderToStaticMarkup(<ProjectSearchSweepPanel listed={listed} settings={settings}
      available busy={false} onRun={onRun}/>);
    expect(html).toContain('Run reviewed batch sweep');
    expect(html).not.toContain(settings.query);
    expect(html).not.toContain('private-src');
    expect(html).not.toContain('C:/private-native');
    expect(onRun).not.toHaveBeenCalled();
  });
  it('reviews query, matching options and bounded range without native paths', () => {
    const confirm = vi.fn(), cancel = vi.fn();
    const html = renderToStaticMarkup(<SearchSweepReview plan={plan()} busy={false} onConfirm={confirm} onCancel={cancel}/>);
    expect(html).toContain('private-needle');
    expect(html).toContain('Batch range 1–2 of 2');
    expect(html).toContain('Reads are sequential');
    expect(html).not.toContain('C:/private-native');
    expect(html).not.toContain('private-src/0.srp');
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
  it('renders historical coverage and partial failures without exposing source text', async () => {
    const result = await executeSearchSweep(plan(), [], async path => {
      if (path.endsWith('/0.srp')) throw Error('private failure');
      return settings.query;
    }, { isCurrent: () => true, isCancelled: () => false });
    if (result.kind !== 'report') throw Error('Missing report');
    const html = renderToStaticMarkup(<SearchSweepResults report={result.report}/>);
    expect(html).toContain('Sweep completed');
    expect(html).toContain('Recorded but incomplete');
    expect(html).toContain('Read unavailable');
    expect(html).toContain('not an atomic or current workspace snapshot');
    expect(html).not.toContain(settings.query);
    expect(html).not.toContain('private failure');
    expect(html).not.toContain('C:/private-native');
  });
});
