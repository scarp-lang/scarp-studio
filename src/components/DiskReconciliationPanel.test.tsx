import { describe,expect,it,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiskReconciliationPanel } from './DiskReconciliationPanel';
import { currentActiveDocument,editorReducer,initialEditorState } from '../model/editorState';
describe('disk reconciliation initial presentation',()=>{
  it('requires explicit review before exposing application controls',()=>{
    const opened=editorReducer(initialEditorState,{type:'open',path:'/main.srp',content:'a'});
    const editor=editorReducer(opened,{type:'edit',id:opened.activeId!,content:'local'});
    const onApply=vi.fn(async()=>({ok:true as const,value:true}));
    const html=renderToStaticMarkup(<DiskReconciliationPanel editor={editor} snapshot={currentActiveDocument(editor)!}
      diskContent="disk" busy={false} onApply={onApply}/>);
    expect(html).toContain('Review three-way reconciliation');
    expect(html).not.toContain('Apply reviewed reconciliation in memory');
    expect(onApply).not.toHaveBeenCalled();
  });
});
