import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectInspectionPanel, ProjectInspectionReview, ProjectInspectionResults } from './ProjectInspectionPanel';
import { prepareProjectInspection, executeProjectInspection, type InspectionSettings } from '../model/projectInspection';
import { DEFAULT_PROJECT_SEARCH_SCOPE } from '../model/projectSearchScope';

const listed = [{ name: 'private-src/main.srp', path: 'C:/private-root/main.srp' }];
const settings: InspectionSettings = { scope: DEFAULT_PROJECT_SEARCH_SCOPE, mode: 'working', listingLimited: false };
function plan() {
  const result = prepareProjectInspection(listed, settings);
  if (!result.ok) throw Error(result.error);
  return result.value;
}
describe('listed inspection components', () => {
  it('is collapsed and does not disclose private labels or run inspection at mount', () => {
    const onRun = vi.fn(async () => ({ kind: 'invalidated' as const }));
    const onOpen = vi.fn();
    const html = renderToStaticMarkup(<ProjectInspectionPanel listed={listed} listingLimited={false}
      available busy={false} onRun={onRun} onOpen={onOpen}/>);
    expect(html).toContain('Inspect listed source quality and tasks');
    expect(html).not.toContain('private-src');
    expect(html).not.toContain('C:/private-root');
    expect(onRun).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });
  it('reviews explicit membership and snapshot mode without disclosing paths', () => {
    const html = renderToStaticMarkup(<ProjectInspectionReview plan={plan()} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()}/>);
    expect(html).toContain('Working buffers take precedence');
    expect(html).toContain('Selected 1 of 1 listed sources');
    expect(html).not.toContain('C:/private-root');
    expect(html).not.toContain('private-src/main.srp');
  });
  it('renders partial scan evidence without source content or native read errors', async () => {
    const outcome = await executeProjectInspection(plan(), [], async () => { throw Error('private read failure'); },
      { isCurrent: () => true, isCancelled: () => false });
    if (outcome.kind !== 'report') throw Error('Missing report');
    const onOpen = vi.fn();
    const html = renderToStaticMarkup(<ProjectInspectionResults report={outcome.report} busy={false} onOpen={onOpen}/>);
    expect(html).toContain('Read unavailable');
    expect(html).toContain('Incomplete coverage');
    expect(html).toContain('current unique Explorer entry');
    expect(html).not.toContain('private read failure');
    expect(html).not.toContain('C:/private-root');
    expect(onOpen).not.toHaveBeenCalled();
  });
  it('does not expose task text while viewing file coverage', async () => {
    const outcome = await executeProjectInspection(plan(), [], async () => '// TODO(privateOwner): private-description\n',
      { isCurrent: () => true, isCancelled: () => false });
    if (outcome.kind !== 'report') throw Error('Missing report');
    const html = renderToStaticMarkup(<ProjectInspectionResults report={outcome.report} busy onOpen={vi.fn()}/>);
    expect(html).toContain('1 retained tasks');
    expect(html).not.toContain('private-description');
    expect(html).not.toContain('privateOwner');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Open current listed source/);
  });
});
