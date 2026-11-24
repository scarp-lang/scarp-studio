import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceImportsPanel } from './SourceImportsPanel';
import type { StudioDocument } from '../model/documents';
function doc(text: string): StudioDocument {
  return {
    id: 'a', name: 'main.srp', path: 'C:/Scarp/src/main.srp',
    content: text, savedContent: text, revision: 1,
  };
}
const sources = [
  { name: 'src/main.srp', path: 'C:/Scarp/src/main.srp' },
  { name: 'src/util.srp', path: 'C:/Scarp/src/util.srp' },
];
describe('Scarp Imports panel', () => {
  it('is collapsed by default without rendering source data', () => {
    const html = renderToStaticMarkup(createElement(SourceImportsPanel,{
      documents: [doc('import "util.srp" as util;')],
      listed: sources, activeId: 'a', busy: false, onOpen: () => {},
    }));
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('imports-row');
  });
  it('renders only explicitly listed target links', () => {
    const html = renderToStaticMarkup(createElement(SourceImportsPanel,{
      documents: [doc('import "util.srp" as util;\nimport "../outside.srp" as bad;')],
      listed: sources, activeId: 'a', busy: false, onOpen: () => {},
      initiallyExpanded: true,
    }));
    expect(html).toContain('Open Source');
    expect((html.match(/Open Source/g) ?? []).length).toBe(1);
    expect(html).toContain('unsafe');
  });
  it('does not index files outside selected folder listing', () => {
    const html = renderToStaticMarkup(createElement(SourceImportsPanel,{
      documents: [doc('import "util.srp" as util;')],
      listed: [], activeId: 'a', busy: false, onOpen: () => {},
      initiallyExpanded: true,
    }));
    expect(html).toContain('Open a source from the selected');
    expect(html).not.toContain('imports-row');
  });
  it('disables navigation during native busy state', () => {
    const html = renderToStaticMarkup(createElement(SourceImportsPanel,{
      documents: [doc('import "util.srp" as util;')],
      listed: sources, activeId: 'a', busy: true, onOpen: () => {},
      initiallyExpanded: true,
    }));
    expect(html).toContain('disabled=""');
  });
  it('escapes import paths and aliases in rendered text', () => {
    const html = renderToStaticMarkup(createElement(SourceImportsPanel,{
      documents: [doc('import "<script>.srp" as mod;')],
      listed: sources, activeId: 'a', busy: false, onOpen: () => {},
      initiallyExpanded: true,
    }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
