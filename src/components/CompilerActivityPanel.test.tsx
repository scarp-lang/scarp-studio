import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompilerActivityPanel } from './CompilerActivityPanel';
import { createCompilerActivityStore } from '../model/compilerActivity';

describe('compiler activity view', () => {
  it('defaults to off and never fabricates browser invocations', () => {
    const store = createCompilerActivityStore();
    const markup = renderToStaticMarkup(createElement(CompilerActivityPanel, { store, native: false }));
    expect(markup).toContain('Recording off');
    expect(markup).toContain('No invocation records are simulated');
    expect(markup).toContain('No matching recorded invocations');
    expect(store.getSnapshot().records).toEqual([]);
  });
  it('renders historical metadata without exposing raw captured output by default', () => {
    const store = createCompilerActivityStore();
    store.setMode('output');
    const token = store.start({ command: { scope: 'source', action: 'verify' }, target: 'test.srp', timestamp: 100 });
    store.finish(token, { timestamp: 200, outcome: 'returned', exitCode: null, staleAtCompletion: false,
      inputChanged: false, output: 'private captured output' });
    const markup = renderToStaticMarkup(createElement(CompilerActivityPanel, { store, native: true }));
    expect(markup).toContain('Verify source');
    expect(markup).toContain('test.srp');
    expect(markup).toContain('Returned (exit status unavailable)');
    expect(markup).not.toContain('private captured output');
  });
});
