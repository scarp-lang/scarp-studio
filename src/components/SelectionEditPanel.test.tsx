import { describe,expect,it,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectionEditPanel } from './SelectionEditPanel';
import { initialEditorState } from '../model/editorState';

describe('selection workbench rendering',()=>{
  it('renders a collapsed entry without invoking capture, apply or undo',()=>{
    const onCapture=vi.fn(()=>({ok:false as const,error:'Not captured'}));
    const onApply=vi.fn(()=>false);
    const onUndo=vi.fn();
    const markup=renderToStaticMarkup(<SelectionEditPanel editor={initialEditorState} busy={false}
      undoAvailable={false} onCapture={onCapture} onApply={onApply} onUndo={onUndo}/>);
    expect(markup).toContain('Review selection edits');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('Confirm selection transformation');
    expect(onCapture).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
  });
});
