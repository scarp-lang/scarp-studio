import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OutputInspectionPanel } from './OutputInspectionPanel';
import { createCompilerActivityStore } from '../model/compilerActivity';

describe('output inspector initial rendering', () => {
  it('shows a freshness warning without making it searchable output', () => {
    const markup = renderToStaticMarkup(createElement(OutputInspectionPanel, {
      output: 'first\nsecond', freshnessWarning: 'Previous result is stale', busy: false,
      activity: createCompilerActivityStore(),
    }));
    expect(markup).toContain('Previous result is stale');
    expect(markup).toContain('Find compiler output text');
    expect(markup).toContain('Inspecting output line 1');
    expect(markup).not.toContain('Selected compiler output excerpt');
  });
  it('does not expose a current output review while native operations are busy', () => {
    const markup = renderToStaticMarkup(createElement(OutputInspectionPanel, {
      output: 'private reply', freshnessWarning: null, busy: true, activity: createCompilerActivityStore(),
    }));
    expect(markup).toContain('Output inspection is paused');
    expect(markup).not.toContain('private reply');
    expect(markup).not.toContain('Find compiler output text');
  });
  it('lists retained history metadata but not the raw historical text before review', () => {
    const activity = createCompilerActivityStore();
    activity.setMode('output');
    const token = activity.start({ command: { scope: 'source', action: 'exec' }, target: 'sample.srp', timestamp: 1 });
    activity.finish(token, { timestamp: 2, outcome: 'returned', exitCode: null, staleAtCompletion: false,
      inputChanged: false, output: 'private historic output' });
    const markup = renderToStaticMarkup(createElement(OutputInspectionPanel, {
      output: 'current output', freshnessWarning: null, busy: false, activity,
    }));
    expect(markup).toContain('sample.srp');
    expect(markup).toContain('Review output comparison');
    expect(markup).not.toContain('private historic output');
  });
});
