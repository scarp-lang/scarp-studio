import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LineRangeToolsPanel } from './LineRangeToolsPanel';
import { editorReducer, initialEditorState } from '../model/editorState';

describe('line range tools presentation', () => {
  const editor = editorReducer(initialEditorState, { type: 'edit', id: initialEditorState.activeId!, content: 'private text' });
  const unexpected = () => { throw Error('unexpected edit during render'); };
  it('starts collapsed without exposing source or applying any transformation', () => {
    const markup = renderToStaticMarkup(createElement(LineRangeToolsPanel, {
      editor, cursorLine: 1, busy: false, undoAvailable: false, onApply: unexpected, onUndo: unexpected,
    }));
    expect(markup).toContain('Reviewed line range tools');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('private text');
  });
  it('shows explicit operation choices and no implicit confirmation', () => {
    const markup = renderToStaticMarkup(createElement(LineRangeToolsPanel, {
      editor, cursorLine: 1, busy: false, undoAvailable: false, onApply: unexpected, onUndo: unexpected,
      initiallyExpanded: true,
    }));
    expect(markup).toContain('First transformation line');
    expect(markup).toContain('Sort lines ascending');
    expect(markup).toContain('Remove exact duplicate lines');
    expect(markup).toContain('may change Scarp program behavior');
    expect(markup).not.toContain('Confirm line transformation');
    expect(markup).not.toContain('private text');
  });
});
