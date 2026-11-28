import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AnalysisSourceOpenPanel} from './AnalysisSourceOpenPanel';
import {analysisSourceCandidates} from '../model/analysisSourceOpen';
import {initialEditorState} from '../model/editorState';

describe('observed source open workbench',()=>{
  it('does not disclose private labels or initiate a read while collapsed',()=>{
    const onOpen=vi.fn(async()=>({ok:true as const,opened:0,reused:0}));
    const html=renderToStaticMarkup(<AnalysisSourceOpenPanel busy={false}
      candidates={analysisSourceCandidates([{source:'private-src/a.srp'}])}
      context={{editor:initialEditorState,listed:[{name:'private-src/a.srp',path:'C:/private-native/a.srp'}],onOpen}}/>);
    expect(html).toContain('Review opening observed source files');
    expect(html).not.toContain('private-src');
    expect(html).not.toContain('private-native');
    expect(onOpen).not.toHaveBeenCalled();
  });
});
