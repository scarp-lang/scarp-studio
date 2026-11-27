import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IdentifierEditPanel } from './IdentifierEditPanel';
import { initialEditorState } from '../model/editorState';

const unexpected = () => { throw Error('unexpected editor mutation'); };
describe('identifier edit presentation', () => {
  it('starts collapsed with no scan or mutation', () => {
    const markup = renderToStaticMarkup(createElement(IdentifierEditPanel,{
      editor:initialEditorState,busy:false,undoAvailable:false,onApply:unexpected,onUndo:unexpected,
    }));
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('Existing code identifier');
  });
  it('explains lexical limitations and does not preselect edits', () => {
    const markup = renderToStaticMarkup(createElement(IdentifierEditPanel,{
      editor:initialEditorState,busy:false,undoAvailable:false,onApply:unexpected,onUndo:unexpected,initiallyExpanded:true,
    }));
    expect(markup).toContain('not semantic Rename Symbol');
    expect(markup).toContain('Scan identifier sites');
    expect(markup).not.toContain('Confirm identifier edits');
  });
});
