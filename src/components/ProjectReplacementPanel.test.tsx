import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { ProjectReplacementPanel } from './ProjectReplacementPanel';
import { initialEditorState } from '../model/editorState';
describe('workspace replacement starts read-only',()=>{
  it('does not read, stage or mutate sources until an explicit action',()=>{
    const unexpected=()=>{throw Error('unexpected operation');};
    const html=renderToStaticMarkup(<ProjectReplacementPanel result={{hits:[],searchedFiles:0,skippedFiles:1,totalListedFiles:1,truncated:true,error:null}}
      query="name" options={{caseSensitive:true,wholeWord:true}} editor={initialEditorState} busy={false} onStage={unexpected} onApply={unexpected}/>);
    expect(html).toContain('Review selected workspace replacements');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Confirm workspace replacements');
  });
});
