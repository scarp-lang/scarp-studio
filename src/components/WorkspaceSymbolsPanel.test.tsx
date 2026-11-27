import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspaceSymbolsPanel } from './WorkspaceSymbolsPanel';
import { createUntitled } from '../model/documents';

const unexpected = () => { throw Error('unexpected action during static render'); };
describe('workspace symbol explorer presentation', () => {
  it('is collapsed by default and does not expose declaration text', () => {
    const document = { ...createUntitled(1), content: 'funcra private_name() {}' };
    const markup = renderToStaticMarkup(createElement(WorkspaceSymbolsPanel, {
      documents: [document], activeId: document.id, busy: false, onNavigate: unexpected,
    }));
    expect(markup).toContain('Workspace symbol explorer');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('private_name');
  });
  it('renders recognized declaration sites and an explicit semantic limitation', () => {
    const document = { ...createUntitled(1), content: 'pub pure funcra square(x: integer) -> integer { return x*x; }' };
    const markup = renderToStaticMarkup(createElement(WorkspaceSymbolsPanel, {
      documents: [document], activeId: document.id, busy: false, onNavigate: unexpected, initiallyExpanded: true,
    }));
    expect(markup).toContain('square');
    expect(markup).toContain('Not compiler symbol resolution');
    expect(markup).toContain('Repeated names');
    expect(markup).toContain('Call sites');
  });
  it('labels partial inventory instead of implying a complete source scan', () => {
    const document = { ...createUntitled(1), content: 'funcra partial() {' };
    const markup = renderToStaticMarkup(createElement(WorkspaceSymbolsPanel, {
      documents: [document], activeId: document.id, busy: false, onNavigate: unexpected, initiallyExpanded: true,
    }));
    expect(markup).toContain('Limited inventory');
    expect(markup).toContain('Unfinished delimiter');
  });
});
