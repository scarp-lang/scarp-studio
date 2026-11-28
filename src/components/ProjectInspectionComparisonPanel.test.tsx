import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectInspectionComparisonPanel, InspectionComparisonDetails } from './ProjectInspectionComparisonPanel';
import { captureInspectionBaseline, compareInspectionBaselines } from '../model/projectInspectionComparison';
import { executeProjectInspection, prepareProjectInspection } from '../model/projectInspection';
import { DEFAULT_PROJECT_SEARCH_SCOPE } from '../model/projectSearchScope';

async function inspect(content:string, unavailable=false) {
  const plan=prepareProjectInspection([{name:'private/a.srp',path:'C:/private-root/a.srp'}],
    {scope:DEFAULT_PROJECT_SEARCH_SCOPE,mode:'working',listingLimited:false});
  if(!plan.ok)throw Error(plan.error);
  const result=await executeProjectInspection(plan.value,[],async()=> {
    if(unavailable)throw Error('private read failure');
    return content;
  },{isCurrent:()=>true,isCancelled:()=>false});
  if(result.kind!=='report')throw Error('Missing inspection');
  return result.report;
}
describe('listed source inspection comparison rendering',()=>{
  it('starts collapsed without exposing private source names or task text',async()=>{
    const report=await inspect('// TODO(privateOwner): private-description\n');
    const html=renderToStaticMarkup(<ProjectInspectionComparisonPanel current={report} busy={false}/>);
    expect(html).toContain('Compare inspection baselines');
    expect(html).not.toContain('private/a.srp');
    expect(html).not.toContain('private-description');
    expect(html).not.toContain('privateOwner');
    expect(html).not.toContain('Record current inspection baseline');
  });
  it('renders comparable count changes but not task descriptions or native paths',async()=>{
    const a=captureInspectionBaseline(await inspect('// TODO(privateOwner): private-description  \n'));
    const b=captureInspectionBaseline(await inspect('// FIXME: private replacement\n'));
    if(!a.ok||!b.ok)throw Error('Missing baseline');
    const compared=compareInspectionBaselines(a.value,b.value);
    if(!compared.ok)throw Error(compared.error);
    const html=renderToStaticMarkup(<InspectionComparisonDetails data={compared.value}/>);
    expect(html).toContain('Task count change');
    expect(html).toContain('1 → 1 (0)');
    expect(html).toContain('1 → 0 (-1)');
    expect(html).toContain('private/a.srp');
    expect(html).not.toContain('private-description');
    expect(html).not.toContain('privateOwner');
    expect(html).not.toContain('C:/private-root');
    expect(html).not.toContain('private replacement');
  });
  it('renders unavailable evidence rather than a fabricated reduction',async()=>{
    const a=captureInspectionBaseline(await inspect('// TODO private\n',true));
    const b=captureInspectionBaseline(await inspect('// TODO private\n'));
    if(!a.ok||!b.ok)throw Error('Missing baseline');
    const compared=compareInspectionBaselines(a.value,b.value);
    if(!compared.ok)throw Error(compared.error);
    const html=renderToStaticMarkup(<InspectionComparisonDetails data={compared.value}/>);
    expect(html).toContain('Not comparable');
    expect(html).toContain('At least one scope was incomplete');
    expect(html).toContain('Read unavailable');
    expect(html).not.toContain('private read failure');
  });
});
