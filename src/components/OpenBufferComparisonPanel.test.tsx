import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { OpenBufferComparisonPanel } from './OpenBufferComparisonPanel';
import { initialEditorState } from '../model/editorState';

describe('open-buffer comparison presentation',()=>{
  it('starts collapsed without comparing or modifying a buffer',()=>{
    const unexpected=()=>{throw Error('unexpected action');};
    const markup=renderToStaticMarkup(createElement(OpenBufferComparisonPanel,{
      editor:initialEditorState,busy:false,undoAvailable:false,onApply:unexpected,onUndo:unexpected,onNavigate:unexpected,
    }));
    expect(markup).toContain('Compare open buffers');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('Confirm buffer transfer');
  });
});
