import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ListedSymbolPanel,ListedSymbolReview,ListedSymbolResults} from './ListedSymbolPanel';
import {prepareProjectInspection,type InspectionSettings} from '../model/projectInspection';
import {executeListedSymbolIndex} from '../model/listedSymbolIndex';
import {DEFAULT_PROJECT_SEARCH_SCOPE} from '../model/projectSearchScope';

const listed=[{name:'private-src/a.srp',path:'C:/private-root/a.srp'}];
const settings:InspectionSettings={scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false};
function plan(){
  const result=prepareProjectInspection(listed,settings);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
describe('listed symbol panel',()=>{
  it('starts collapsed and does not initiate source reads',()=>{
    const onRun=vi.fn(async()=>({kind:'invalidated' as const}));
    const onNavigate=vi.fn();
    const html=renderToStaticMarkup(<ListedSymbolPanel listed={listed} listingLimited={false} available
      busy={false} onRun={onRun} onNavigate={onNavigate}/>);
    expect(html).toContain('Index listed project symbols');
    expect(html).not.toContain('private-src');
    expect(html).not.toContain('C:/private-root');
    expect(onRun).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });
  it('reviews count and mode without disclosing paths or source labels by default',()=>{
    const html=renderToStaticMarkup(<ListedSymbolReview plan={plan()} busy={false}
      onConfirm={vi.fn()} onCancel={vi.fn()}/>);
    expect(html).toContain('1 selected of 1 listed files');
    expect(html).toContain('Working buffers take precedence');
    expect(html).toContain('not resolved');
    expect(html).not.toContain('private-src');
    expect(html).not.toContain('C:/private-root');
  });
  it('renders only retained site metadata, not source headers',async()=>{
    const result=await executeListedSymbolIndex(plan(),[],async()=> 'funcra secretName() { privateCall(); }\n',
      {isCurrent:()=>true,isCancelled:()=>false});
    if(result.kind!=='report')throw Error('Missing report');
    const navigate=vi.fn();
    const html=renderToStaticMarkup(<ListedSymbolResults report={result.report} busy onNavigate={navigate}/>);
    expect(html).toContain('secretName');
    expect(html).toContain('privateCall');
    expect(html).toContain('private-src/a.srp');
    expect(html).not.toContain('funcra secretName');
    expect(html).not.toContain('C:/private-root');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Recheck and open symbol/);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('shows incomplete coverage without leaking arbitrary native error text',async()=>{
    const result=await executeListedSymbolIndex(plan(),[],async()=>{throw Error('private native failure');},
      {isCurrent:()=>true,isCancelled:()=>false});
    if(result.kind!=='report')throw Error('Missing report');
    const html=renderToStaticMarkup(<ListedSymbolResults report={result.report} busy={false} onNavigate={vi.fn()}/>);
    expect(html).toContain('Incomplete coverage');
    expect(html).toContain('No observations match these filters');
    expect(html).not.toContain('private native failure');
  });
});
