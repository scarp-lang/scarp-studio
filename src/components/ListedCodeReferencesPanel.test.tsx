import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ListedCodeReferencesPanel,ListedReferenceReview,ListedReferenceResults} from './ListedCodeReferencesPanel';
import {prepareListedReferences,executeListedReferences} from '../model/listedCodeReferences';
import {DEFAULT_PROJECT_SEARCH_SCOPE} from '../model/projectSearchScope';
import type {InspectionSettings} from '../model/projectInspection';

const listed=[{name:'private-src/a.srp',path:'C:/private-native/a.srp'}];
const settings:InspectionSettings={scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false};
const query={identifier:'privateIdentifier',caseSensitive:true};
function plan(){
  const p=prepareListedReferences(listed,settings,query);
  if(!p.ok)throw Error(p.error);
  return p.value;
}
describe('listed code reference components',()=>{
  it('mounts collapsed without reading or consulting the editor cursor',()=>{
    const run=vi.fn(async()=>({kind:'invalidated' as const}));
    const cursor=vi.fn(()=>query.identifier);
    const html=renderToStaticMarkup(<ListedCodeReferencesPanel listed={listed} listingLimited={false}
      available busy={false} cursorIdentifier={cursor} onRun={run} onNavigate={vi.fn()}/>);
    expect(html).toContain('Find listed code references');
    expect(html).not.toContain('private-src');
    expect(html).not.toContain(query.identifier);
    expect(run).not.toHaveBeenCalled();
    expect(cursor).not.toHaveBeenCalled();
  });
  it('shows reviewed identifier and settings without native paths',()=>{
    const html=renderToStaticMarkup(<ListedReferenceReview plan={plan()} busy={false}
      onConfirm={vi.fn()} onCancel={vi.fn()}/>);
    expect(html).toContain(query.identifier);
    expect(html).toContain('Match case');
    expect(html).toContain('1 selected of 1 listed files');
    expect(html).not.toContain('private-src');
    expect(html).not.toContain('C:/private-native');
  });
  it('renders lexical sites without surrounding source text and blocks busy navigation',async()=>{
    const result=await executeListedReferences(plan(),[],async()=> 'bind privateIdentifier = "private value";\nprivateIdentifier();',
      {isCurrent:()=>true,isCancelled:()=>false});
    if(result.kind!=='report')throw Error('Missing report');
    const onNavigate=vi.fn();
    const html=renderToStaticMarkup(<ListedReferenceResults report={result.report} busy onNavigate={onNavigate}/>);
    expect(html).toContain('Declaration-like');
    expect(html).toContain('Call-like');
    expect(html).toContain('privateIdentifier');
    expect(html).not.toContain('private value');
    expect(html).not.toContain('C:/private-native');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Recheck and open reference/);
    expect(onNavigate).not.toHaveBeenCalled();
  });
  it('distinguishes unknown absence from a complete zero match result',async()=>{
    const result=await executeListedReferences(plan(),[],async()=>{throw Error('private native error');},
      {isCurrent:()=>true,isCancelled:()=>false});
    if(result.kind!=='report')throw Error('Missing report');
    const html=renderToStaticMarkup(<ListedReferenceResults report={result.report} busy={false} onNavigate={vi.fn()}/>);
    expect(html).toContain('Incomplete coverage');
    expect(html).toContain('do not establish absence');
    expect(html).not.toContain('private native error');
  });
});
