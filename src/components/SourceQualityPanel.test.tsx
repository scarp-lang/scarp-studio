import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SourceQualityPanel } from './SourceQualityPanel';
import { createUntitled } from '../model/documents';

describe('source quality workbench', () => {
  it('starts collapsed without exposing source or invoking actions', () => {
    const doc = { ...createUntitled(1), content: 'private test data  ' };
    const unexpected = () => { throw Error('Unexpected action during render'); };
    const markup = renderToStaticMarkup(createElement(SourceQualityPanel, {
      documents: [doc], activeId: doc.id, busy: false, undoAvailable: false,
      onApply: unexpected, onNavigate: unexpected, onUndo: unexpected,
    }));
    expect(markup).toContain('Source quality workbench');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('private test data');
    expect(markup).not.toContain('Confirm cleanup');
  });
});
