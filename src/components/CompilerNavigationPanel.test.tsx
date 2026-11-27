import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompilerNavigationPanel } from './CompilerNavigationPanel';
import type { CompilerNavigationReport } from '../model/compilerNavigation';

describe('compiler static report UI', () => {
  it('renders historical paths as escaped text, not file links', () => {
    const report: CompilerNavigationReport = {
      kind: 'references',
      files: [{id: 0, path: 'C:/source/<unsafe>.srp'}],
      symbols: [{id: 0, name: 'work', kind: 'function', owner: null, public: true, mutable: false,
        targetModule: null, location: {source: 0, byteStart: 0, byteEnd: 4, line: 1, column: 1, endLine: 1, endColumn: 5}}],
      references: [],
    };
    const html = renderToStaticMarkup(<CompilerNavigationPanel report={report} onHide={() => {}} />);
    expect(html).toContain('Historical snapshot only');
    expect(html).toContain('&lt;unsafe&gt;');
    expect(html).not.toContain('href=');
  });
  it('does not present a symbols-only report as zero references', () => {
    const report: CompilerNavigationReport = {kind: 'symbols', files: [], symbols: [], references: []};
    expect(renderToStaticMarkup(<CompilerNavigationPanel report={report} onHide={() => {}} />)).toContain('Not requested');
  });
});
