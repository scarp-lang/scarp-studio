import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjectTestWorkbench } from './ProjectTestWorkbench';
import type { TestResultIdentity } from '../model/projectTestWorkbench';

const folder = 'C:/project';
const result: TestResultIdentity = { folder, report: { mode: 'run', discovered: 1, passed: 0, failed: 1,
  tests: [{ path: 'tests/failure.srp', status: 'failed', phase: 'runtime', code: 'E0001', message: 'Failed assertion', help: 'Check values' }] } };
const unexpected = () => { throw Error('unexpected side effect'); };
function render(historical = false, busy = false, input = result) {
  return renderToStaticMarkup(createElement(ProjectTestWorkbench, { result: input,
    selection: { path: folder, files: [{ name: 'tests/failure.srp', path: folder + '/tests/failure.srp' }] },
    historical, busy, baseline: null, onBaseline: unexpected, onOpenSource: unexpected, onHide: unexpected }));
}
describe('project test workbench', () => {
  it('renders actual reported status and filtering controls without capturing data on render', () => {
    const markup = render();
    expect(markup).toContain('PROJECT TEST RESULTS');
    expect(markup).toContain('Filter project test failure phase');
    expect(markup).toContain('Failed assertion');
    expect(markup).toContain('Review capture test baseline');
    expect(markup).not.toContain('Matching project test report');
    expect(markup).not.toContain('Confirm test baseline capture');
  });
  it('disables source navigation when historical or busy', () => {
    for (const markup of [render(true), render(false, true)]) {
      expect(markup).toMatch(/class="project-test-open" disabled=""/);
    }
    expect(render(true)).toContain('Historical results');
  });
  it('labels discovery separately and disables baseline capture', () => {
    const list: TestResultIdentity = { folder, report: { mode: 'list', discovered: 1, passed: 0, failed: 0,
      tests: [{ path: 'tests/failure.srp', status: 'discovered', phase: null, code: null, message: null, help: null }] } };
    const markup = render(false, false, list);
    expect(markup).toContain('Discovery only. Listed tests have not been executed.');
    expect(markup).toMatch(/disabled=""[^>]*>Review capture test baseline/);
    expect(markup).not.toContain('Failed assertion');
  });
});
