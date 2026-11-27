import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProblemsPanel } from './ProblemsPanel';
import type { StudioProblem } from '../model/problems';

const problem: StudioProblem = {
  id: 'example', kind: 'compiler', code: 'E001', message: 'A compiler diagnostic',
  location: 'example.srp:1:1', help: 'Review the declaration', target: null,
};
const noop = () => {};
function render(problems: readonly StudioProblem[], stale = false) {
  return renderToStaticMarkup(createElement(ProblemsPanel, { problems, stale, busy: false,
    onNavigate: noop, onShowOutput: noop }));
}
describe('structured problems panel', () => {
  it('never exposes stale structured problems as current navigable rows', () => {
    const markup = render([problem], true);
    expect(markup).toContain('Stale results');
    expect(markup).not.toContain(problem.message);
    expect(markup).not.toContain('Go to source location');
  });
  it('does not imply empty diagnostics prove success', () => {
    expect(render([])).toContain('An empty list does not establish successful verification');
  });
  it('renders grouping, ordering and navigation controls without preparing a report by default', () => {
    const markup = render([problem]);
    expect(markup).toContain('Group problems by');
    expect(markup).toContain('Sort problems by');
    expect(markup).toContain('Filter problem navigation availability');
    expect(markup).toContain('Review matching problem report');
    expect(markup).not.toContain('Matching problem report text');
    expect(markup).toContain('Source navigation unavailable');
  });
  it('renders only the first page of large structured problem collections', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...problem, id: String(i), message: 'unique-problem-' + i }));
    const markup = render(many);
    expect(markup).toContain('unique-problem-24');
    expect(markup).not.toContain('unique-problem-25');
    expect(markup).toContain('Next problems');
  });
});
