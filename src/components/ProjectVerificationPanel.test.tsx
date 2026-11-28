import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectVerificationPanel, ProjectVerificationReview, ProjectVerificationResults } from './ProjectVerificationPanel';
import { prepareProjectVerification, executeProjectVerification, type VerificationRule } from '../model/projectVerification';
import { DEFAULT_PROJECT_SEARCH_SCOPE } from '../model/projectSearchScope';
import type { InspectionSettings } from '../model/projectInspection';

const listed=[{name:'private/a.srp',path:'C:/private-root/a.srp'}];
const settings:InspectionSettings={scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false};
const rules:VerificationRule[]=[
  {name:'Private required',query:'private-needle',expectation:'present',options:{caseSensitive:true,wholeWord:false}},
  {name:'Private absent',query:'private-forbidden',expectation:'absent',options:{caseSensitive:true,wholeWord:false}},
];
function plan(){
  const result=prepareProjectVerification(listed,settings,rules);
  if(!result.ok)throw Error(result.error);
  return result.value;
}
describe('literal project verification components',()=>{
  it('mounts collapsed without exposing labels or initiating a read',()=>{
    const onRun=vi.fn(async()=>({kind:'invalidated' as const}));
    const html=renderToStaticMarkup(<ProjectVerificationPanel listed={listed} listingLimited={false} available
      busy={false} onRun={onRun}/>);
    expect(html).toContain('Verify literal project rules');
    expect(html).not.toContain('private/a.srp');
    expect(html).not.toContain('C:/private-root');
    expect(html).not.toContain('Confirm and run verification');
    expect(onRun).not.toHaveBeenCalled();
  });
  it('reviews all rules and the read budget without exposing native paths',()=>{
    const html=renderToStaticMarkup(<ProjectVerificationReview plan={plan()} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()}/>);
    expect(html).toContain('Private required');
    expect(html).toContain('private-needle');
    expect(html).toContain('At least one match');
    expect(html).toContain('No matches');
    expect(html).toContain('One bounded read per selected source');
    expect(html).not.toContain('private/a.srp');
    expect(html).not.toContain('C:/private-root');
  });
  it('discloses unknown zero-count evidence and never prints query text',async()=>{
    const result=await executeProjectVerification(plan(),[],async()=>{throw Error('private error');},
      {isCurrent:()=>true,isCancelled:()=>false});
    if(result.kind!=='report')throw Error('Missing verification report');
    const html=renderToStaticMarkup(<ProjectVerificationResults report={result.report}/>);
    expect(html).toContain('Insufficient coverage');
    expect(html).toContain('zero matches are not conclusive');
    expect(html).toContain('Read unavailable');
    expect(html).not.toContain('private error');
    expect(html).not.toContain('private-needle');
    expect(html).not.toContain('private-forbidden');
    expect(html).not.toContain('C:/private-root');
  });
  it('shows positive evidence even when the selected scope is incomplete',async()=>{
    const p=prepareProjectVerification(listed,{...settings,listingLimited:true},rules);
    if(!p.ok)throw Error(p.error);
    const result=await executeProjectVerification(p.value,[],async()=> 'private-needle',
      {isCurrent:()=>true,isCancelled:()=>false});
    if(result.kind!=='report')throw Error('Missing verification report');
    const html=renderToStaticMarkup(<ProjectVerificationResults report={result.report}/>);
    expect(html).toContain('Expectation satisfied by evidence');
    expect(html).toContain('Insufficient coverage');
    expect(html).not.toContain('private-needle');
  });
});
